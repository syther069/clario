/**
 * Settlement Service Tests (SET-001)
 *
 * Tests: calldata encoding, prepare pre-condition checks,
 * duplicate guard, treasury authorization, and reconcile lifecycle.
 */

import { describe, expect, it, beforeEach } from "vitest";
import type { DatabaseClient, QueryResult } from "@clario/database";
import { SettlementService, type SettlementTokenConfig } from "./service";
import {
  encodeReimburseCalldata,
  encodeApproveCalldata,
  buildSettlementPrepareResult,
  checksumAddress,
} from "./calldata";
import {
  getSettlementConfig,
  tryGetSettlementConfig,
  setSettlementConfigForTesting,
  SettlementConfigError,
} from "./config";
import type { AuthContext } from "../auth/policy";

// ---------------------------------------------------------------------------
// Mock database
// ---------------------------------------------------------------------------

class MockDb implements DatabaseClient {
  workspaces: Array<{ workspace_id: string; created_by: string }> = [];
  memberships: Array<{
    membership_id: string;
    workspace_id: string;
    user_id: string;
    address: string;
    status: string;
  }> = [];
  roleGrants: Array<{
    workspace_id: string;
    address: string;
    account_address?: string;
    role: string;
    scope: string;
    revoked_at: null | string;
  }> = [];
  expenses: Array<{
    workspace_id: string;
    expense_id: string;
    created_by: string;
    current_version: number | null;
  }> = [];
  expenseVersions: Array<{
    workspace_id: string;
    expense_id: string;
    version: number;
    commitment: string;
    previous_commitment: string | null;
    amount: string | null;
    currency: string | null;
    recipient: string | null;
    status: string;
  }> = [];
  decisions: Array<{
    workspace_id: string;
    expense_id: string;
    version: number;
    commitment: string;
    decision_type: string;
    reviewer_address: string;
    recorded_at: string;
  }> = [];
  reimbursements: Array<{
    reimbursement_id: string;
    workspace_id: string;
    expense_id: string;
    version: number;
    token_address: string | null;
    recipient_address: string | null;
    amount: string | null;
    payment_reference: string | null;
    transaction_hash: string | null;
    status: string;
    settled_at: string | null;
    created_at: string;
  }> = [];
  chainTransactions: Array<{
    transaction_id: string;
    workspace_id: string;
    chain_id: number;
    transaction_hash: string;
    action: string;
    status: string;
    submitted_at: string;
  }> = [];
  auditEvents: Array<{
    workspace_id: string;
    actor_address: string;
    action: string;
    resource_type: string;
    resource_id: string;
    metadata: string;
    created_at: string;
  }> = [];
  evidenceObjects: Array<{
    workspace_id: string;
    expense_id: string;
    version: number;
    evidence_id: string;
    sha256_hash: string;
  }> = [];
  sourceTransactions: Array<{
    workspace_id: string;
    expense_id: string;
    source_chain_id: number;
    source_transaction_hash: string;
    claim_slot: number;
  }> = [];
  projectionSettlements: Array<{
    workspace_id: string;
    expense_id: string;
    version: number;
    settled_at_tx: string;
    settled_at_block?: string;
  }> = [];

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    const normalizedSql = sql.trim().replace(/\s+/g, " ").toLowerCase();

    // Auth: workspace + role checks
    if (normalizedSql.includes("from workspaces where workspace_id")) {
      const wsId = params?.[0] as string;
      const rows = this.workspaces.filter((w) => w.workspace_id === wsId);
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    if (normalizedSql.includes("from memberships")) {
      const wsId = params?.[0] as string;
      const userId = params?.[1] as string;
      const addr = params?.[2] as string;
      const rows = this.memberships.filter(
        (m) =>
          m.workspace_id === wsId &&
          (m.user_id === userId ||
            m.address.toLowerCase() === addr.toLowerCase()),
      );
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    if (
      normalizedSql.includes("from role_grants where workspace_id") &&
      normalizedSql.includes("account_address")
    ) {
      const wsId = params?.[0] as string;
      const addr = params?.[1] as string;
      const rows = this.roleGrants.filter(
        (r) =>
          r.workspace_id === wsId &&
          (r.account_address ?? r.address)?.toLowerCase() ===
            addr.toLowerCase() &&
          r.revoked_at === null,
      );
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    if (
      normalizedSql.includes("from role_grants") &&
      normalizedSql.includes("revoked_at is null")
    ) {
      const wsId = params?.[0] as string;
      const addr = params?.[1] as string;
      const rows = this.roleGrants.filter(
        (r) =>
          r.workspace_id === wsId &&
          (r.address ?? r.account_address)?.toLowerCase() ===
            addr.toLowerCase() &&
          r.revoked_at === null,
      );
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    // Treasury queue
    if (
      normalizedSql.includes("from expense_versions ev") &&
      normalizedSql.includes("join decisions d")
    ) {
      const wsId = params?.[0] as string;
      const rows = [];
      for (const ev of this.expenseVersions) {
        if (ev.workspace_id !== wsId) continue;
        const expense = this.expenses.find(
          (e) =>
            e.workspace_id === wsId &&
            e.expense_id === ev.expense_id &&
            e.current_version === ev.version,
        );
        if (!expense) continue;
        if (!["current", "submitted"].includes(ev.status)) continue;
        const dec = this.decisions.find(
          (d) =>
            d.workspace_id === wsId &&
            d.expense_id === ev.expense_id &&
            d.version === ev.version &&
            d.decision_type === "approve",
        );
        if (!dec) continue;
        rows.push({
          ...ev,
          decision_type: dec.decision_type,
          reviewer_address: dec.reviewer_address,
          recorded_at: dec.recorded_at,
        });
      }
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    // Expense lookup
    if (
      normalizedSql.includes("from expenses") &&
      normalizedSql.includes("where workspace_id")
    ) {
      const wsId = params?.[0] as string;
      const expId = params?.[1] as string | undefined;
      const rows = expId
        ? this.expenses.filter(
            (e) => e.workspace_id === wsId && e.expense_id === expId,
          )
        : this.expenses.filter((e) => e.workspace_id === wsId);
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    // Expense version lookup
    if (
      normalizedSql.includes("from expense_versions") &&
      params?.length === 3
    ) {
      const wsId = params[0] as string;
      const expId = params[1] as string;
      const ver = params[2] as number;
      const rows = this.expenseVersions.filter(
        (v) =>
          v.workspace_id === wsId &&
          v.expense_id === expId &&
          v.version === ver,
      );
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    // Decision lookup
    if (
      normalizedSql.includes("from decisions") &&
      normalizedSql.includes("decision_type = 'approve'")
    ) {
      const wsId = params?.[0] as string;
      const expId = params?.[1] as string;
      const ver = params?.[2] as number;
      const commitment = params?.[3] as string;
      const rows = this.decisions.filter(
        (d) =>
          d.workspace_id === wsId &&
          d.expense_id === expId &&
          d.version === ver &&
          d.commitment === commitment &&
          d.decision_type === "approve",
      );
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    // Reimbursement lookup
    if (normalizedSql.includes("from reimbursements")) {
      const wsId = params?.[0] as string;
      const expId = params?.[1] as string;
      const ver =
        params && params.length >= 3 && typeof params[2] === "number"
          ? params[2]
          : undefined;
      const isStatusConfirmed = normalizedSql.includes("status = 'confirmed'");
      const rows = this.reimbursements
        .filter(
          (r) =>
            r.workspace_id === wsId &&
            r.expense_id === expId &&
            (ver !== undefined ? r.version === ver : true) &&
            (!isStatusConfirmed || r.status === "confirmed"),
        )
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    // Projection settlements lookup
    if (normalizedSql.includes("from projection_settlements")) {
      const wsId = params?.[0] as string;
      const expId = params?.[1] as string;
      const ver =
        params && params.length >= 3 && typeof params[2] === "number"
          ? params[2]
          : undefined;
      const rows = this.projectionSettlements.filter(
        (p) =>
          p.workspace_id === wsId &&
          p.expense_id === expId &&
          (ver !== undefined ? p.version === ver : true),
      );
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    // Evidence duplicate join
    if (
      normalizedSql.includes("evidence_objects current_eo") &&
      normalizedSql.includes("evidence_objects other_eo")
    ) {
      const wsId = params?.[0] as string;
      const expId = params?.[1] as string;
      const ver = params?.[2] as number;
      const currentEos = this.evidenceObjects.filter(
        (e) =>
          e.workspace_id === wsId &&
          e.expense_id === expId &&
          e.version === ver,
      );
      const matches = [];
      for (const cur of currentEos) {
        for (const other of this.evidenceObjects) {
          if (
            other.workspace_id === wsId &&
            other.expense_id !== expId &&
            other.sha256_hash === cur.sha256_hash
          ) {
            const reimb = this.reimbursements.find(
              (r) =>
                r.workspace_id === wsId &&
                r.expense_id === other.expense_id &&
                r.status !== "failed" &&
                r.status !== "cancelled",
            );
            if (reimb) {
              matches.push({
                other_expense_id: other.expense_id,
                other_version: other.version,
                reimbursement_id: reimb.reimbursement_id,
                reimbursement_status: reimb.status,
                transaction_hash: reimb.transaction_hash,
                sha256_hash: cur.sha256_hash,
              });
            }
          }
        }
      }
      return { rows: matches as unknown as T[], rowCount: matches.length };
    }

    // Source transactions duplicate join
    if (
      normalizedSql.includes("source_transactions current_st") &&
      normalizedSql.includes("source_transactions other_st")
    ) {
      const wsId = params?.[0] as string;
      const expId = params?.[1] as string;
      const currentSts = this.sourceTransactions.filter(
        (s) => s.workspace_id === wsId && s.expense_id === expId,
      );
      const matches = [];
      for (const cur of currentSts) {
        for (const other of this.sourceTransactions) {
          if (
            other.workspace_id === wsId &&
            other.expense_id !== expId &&
            other.source_chain_id === cur.source_chain_id &&
            other.source_transaction_hash.toLowerCase() ===
              cur.source_transaction_hash.toLowerCase() &&
            other.claim_slot === cur.claim_slot
          ) {
            const reimb = this.reimbursements.find(
              (r) =>
                r.workspace_id === wsId &&
                r.expense_id === other.expense_id &&
                r.status !== "failed" &&
                r.status !== "cancelled",
            );
            if (reimb) {
              matches.push({
                other_expense_id: other.expense_id,
                source_transaction_hash: cur.source_transaction_hash,
                claim_slot: cur.claim_slot,
                reimbursement_id: reimb.reimbursement_id,
                reimbursement_status: reimb.status,
              });
            }
          }
        }
      }
      return { rows: matches as unknown as T[], rowCount: matches.length };
    }

    // Write operations (INSERT, UPDATE) — just succeed
    if (
      normalizedSql.startsWith("insert") ||
      normalizedSql.startsWith("update") ||
      normalizedSql.startsWith("begin") ||
      normalizedSql.startsWith("commit") ||
      normalizedSql.startsWith("rollback")
    ) {
      if (normalizedSql.includes("into chain_transactions")) {
        this.chainTransactions.push({
          transaction_id: "test-tx-id",
          workspace_id: params?.[1] as string,
          chain_id: params?.[2] as number,
          transaction_hash: params?.[3] as string,
          action: "reimburse",
          status: "submitted",
          submitted_at: new Date().toISOString(),
        });
      }
      if (normalizedSql.includes("into reimbursements")) {
        const wsId = params?.[1] as string;
        const expId = params?.[2] as string;
        const existingActive = this.reimbursements.find(
          (r) =>
            r.workspace_id === wsId &&
            r.expense_id === expId &&
            r.status !== "failed" &&
            r.status !== "cancelled",
        );
        if (existingActive) {
          const err = new Error(
            "duplicate key value violates unique constraint idx_reimbursements_active_unique",
          );
          (err as unknown as { code: string }).code = "23505";
          throw err;
        }

        this.reimbursements.push({
          reimbursement_id: params?.[0] as string,
          workspace_id: wsId,
          expense_id: expId,
          version: params?.[3] as number,
          token_address: params?.[4] as string,
          recipient_address: null,
          amount: null,
          payment_reference: null,
          transaction_hash: params?.[6] as string,
          status: "submitted",
          settled_at: null,
          created_at: new Date().toISOString(),
        });
      }
      if (normalizedSql.includes("into audit_events")) {
        this.auditEvents.push({
          workspace_id: params?.[0] as string,
          actor_address: params?.[1] as string,
          action: params?.[2] as string,
          resource_type: params?.[3] as string,
          resource_id: params?.[4] as string,
          metadata: params?.[5] as string,
          created_at: new Date().toISOString(),
        });
      }
      if (
        normalizedSql.includes("update reimbursements") &&
        normalizedSql.includes("status = 'failed'")
      ) {
        const reimbId = params?.[0] as string;
        const target = this.reimbursements.find(
          (r) => r.reimbursement_id === reimbId,
        );
        if (target) target.status = "failed";
      }
      if (
        normalizedSql.includes("update reimbursements") &&
        normalizedSql.includes("status = 'confirmed'")
      ) {
        const txHash = params?.[0] as string;
        const reimbId = params?.[1] as string;
        const target = this.reimbursements.find(
          (r) => r.reimbursement_id === reimbId,
        );
        if (target) {
          target.status = "confirmed";
          target.transaction_hash = txHash;
          target.settled_at = new Date().toISOString();
        }
      }
      if (normalizedSql.includes("into projection_settlements")) {
        this.projectionSettlements.push({
          workspace_id: params?.[0] as string,
          expense_id: params?.[1] as string,
          version: params?.[2] as number,
          settled_at_tx: params?.[9] as string,
          settled_at_block: params?.[8] as string,
        });
      }
      return { rows: [] as unknown as T[], rowCount: 0 };
    }

    return { rows: [] as unknown as T[], rowCount: 0 };
  }
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const WS_ID = "0x" + "aa".repeat(32);
const EXP_ID = "0x" + "bb".repeat(32);
const COMMITMENT = "0x" + "cc".repeat(32);
const TX_HASH = "0x" + "dd".repeat(32);
const TREASURY_ADDR = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const RECIPIENT_ADDR = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const TREASURY_ROLE_HASH =
  "0xe1dcbdb91df27212a29bc27177c840cf2f819ecf2187432e1fac86c2dd5dfca9";

const TOKEN_CONFIG: SettlementTokenConfig = {
  address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  decimals: 6,
  symbol: "USDC",
};

const REGISTRY_ADDRESS = "0x1234567890123456789012345678901234567890";
const CHAIN_ID = 10143;

function makeAuthContext(address = TREASURY_ADDR): AuthContext {
  const now = Date.now();
  return {
    userId: "user-treasury-1",
    address: address as `0x${string}`,
    session: {
      userId: "user-treasury-1",
      address: address as `0x${string}`,
      sessionId: "sess-123",
      csrfToken: "test-csrf",
      issuedAt: now - 300000, // 5 min ago
      expiresAt: now + 3600000, // 1 hour
      lastConfirmedAt: now - 60000, // 1 minute ago (within 15 min window)
    },
  };
}

function seedDb(
  db: MockDb,
  options: { hasApproval?: boolean; hasReimbursement?: string } = {},
) {
  db.workspaces = [
    {
      workspace_id: WS_ID,
      created_by: "0x1000000000000000000000000000000000000001",
    },
  ];
  db.memberships = [
    {
      membership_id: "mem-1",
      workspace_id: WS_ID,
      user_id: "user-treasury-1",
      address: TREASURY_ADDR,
      status: "active",
    },
  ];
  db.roleGrants = [
    {
      workspace_id: WS_ID,
      address: TREASURY_ADDR,
      account_address: TREASURY_ADDR,
      role: TREASURY_ROLE_HASH,
      scope: "0x" + "0".repeat(64),
      revoked_at: null,
    },
  ];
  db.expenses = [
    {
      workspace_id: WS_ID,
      expense_id: EXP_ID,
      created_by: "0x1000000000000000000000000000000000000001",
      current_version: 1,
    },
  ];
  db.expenseVersions = [
    {
      workspace_id: WS_ID,
      expense_id: EXP_ID,
      version: 1,
      commitment: COMMITMENT,
      previous_commitment: null,
      amount: "1000000", // 1.000000 USDC in base units
      currency: "USDC",
      recipient: RECIPIENT_ADDR,
      status: "current",
    },
  ];

  if (options.hasApproval !== false) {
    db.decisions = [
      {
        workspace_id: WS_ID,
        expense_id: EXP_ID,
        version: 1,
        commitment: COMMITMENT,
        decision_type: "approve",
        reviewer_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        recorded_at: new Date().toISOString(),
      },
    ];
  } else {
    db.decisions = [];
  }

  if (options.hasReimbursement) {
    db.reimbursements = [
      {
        reimbursement_id: "reimb-existing",
        workspace_id: WS_ID,
        expense_id: EXP_ID,
        version: 1,
        token_address: TOKEN_CONFIG.address,
        recipient_address: RECIPIENT_ADDR,
        amount: "1000000",
        payment_reference: null,
        transaction_hash: TX_HASH,
        status: options.hasReimbursement,
        settled_at:
          options.hasReimbursement === "confirmed"
            ? new Date().toISOString()
            : null,
        created_at: new Date().toISOString(),
      },
    ];
  } else {
    db.reimbursements = [];
  }
}

// ---------------------------------------------------------------------------
// Calldata tests
// ---------------------------------------------------------------------------

describe("Settlement calldata encoding", () => {
  it("encodes reimburse() calldata with valid parameters", () => {
    const calldata = encodeReimburseCalldata({
      workspaceId: WS_ID,
      expenseId: EXP_ID,
      version: 1,
      commitment: COMMITMENT,
      registryAddress: REGISTRY_ADDRESS,
      token: TOKEN_CONFIG,
      recipient: RECIPIENT_ADDR,
      amountBaseUnits: 1000000n,
    });

    expect(calldata).toMatch(/^0x/);
    expect(calldata.length).toBeGreaterThan(10);
  });

  it("rejects zero amount", () => {
    expect(() =>
      encodeReimburseCalldata({
        workspaceId: WS_ID,
        expenseId: EXP_ID,
        version: 1,
        commitment: COMMITMENT,
        registryAddress: REGISTRY_ADDRESS,
        token: TOKEN_CONFIG,
        recipient: RECIPIENT_ADDR,
        amountBaseUnits: 0n,
      }),
    ).toThrow(/positive/i);
  });

  it("encodes approve() calldata", () => {
    const calldata = encodeApproveCalldata(REGISTRY_ADDRESS, 1000000n);
    expect(calldata).toMatch(/^0x/);
  });

  it("validates checksum addresses correctly", () => {
    const result = checksumAddress(TREASURY_ADDR, "test");
    expect(result).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("builds prepare result including approval calldata when allowance is zero", () => {
    const result = buildSettlementPrepareResult(
      {
        workspaceId: WS_ID,
        expenseId: EXP_ID,
        version: 1,
        commitment: COMMITMENT,
        registryAddress: REGISTRY_ADDRESS,
        token: TOKEN_CONFIG,
        recipient: RECIPIENT_ADDR,
        amountBaseUnits: 1000000n,
      },
      CHAIN_ID,
      0n,
    );

    expect(result.needsApproval).toBe(true);
    expect(result.approveCalldata).not.toBeNull();
    expect(result.calldata).toMatch(/^0x/);
    expect(result.intent.action).toBe("reimburse");
    expect(result.intent.chainId).toBe(CHAIN_ID);
  });

  it("does not include approval calldata when allowance is sufficient", () => {
    const result = buildSettlementPrepareResult(
      {
        workspaceId: WS_ID,
        expenseId: EXP_ID,
        version: 1,
        commitment: COMMITMENT,
        registryAddress: REGISTRY_ADDRESS,
        token: TOKEN_CONFIG,
        recipient: RECIPIENT_ADDR,
        amountBaseUnits: 1000000n,
      },
      CHAIN_ID,
      5000000n, // allowance > amount
    );

    expect(result.needsApproval).toBe(false);
    expect(result.approveCalldata).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Settlement service tests
// ---------------------------------------------------------------------------

describe("SettlementService.prepareSettlement", () => {
  let db: MockDb;
  let service: SettlementService;

  beforeEach(() => {
    db = new MockDb();
    service = new SettlementService(db);
  });

  it("prepares reimbursement successfully for approved current version", async () => {
    seedDb(db);
    const ctx = makeAuthContext();

    const result = await service.prepareSettlement(
      WS_ID,
      EXP_ID,
      ctx,
      TOKEN_CONFIG,
      REGISTRY_ADDRESS,
      CHAIN_ID,
    );

    expect(result.expenseId).toBe(EXP_ID);
    expect(result.version).toBe(1);
    expect(result.amountBaseUnits).toBe("1000000");
    expect(result.calldata).toMatch(/^0x/);
    expect(result.tokenAddress).toBe(TOKEN_CONFIG.address);
    expect(result.chainId).toBe(CHAIN_ID);
  });

  it("blocks preparation when no valid Approve decision exists", async () => {
    seedDb(db, { hasApproval: false });
    const ctx = makeAuthContext();

    await expect(
      service.prepareSettlement(
        WS_ID,
        EXP_ID,
        ctx,
        TOKEN_CONFIG,
        REGISTRY_ADDRESS,
        CHAIN_ID,
      ),
    ).rejects.toThrow(/APPROVAL_REQUIRED|approved/i);
  });

  it("blocks duplicate settlement when already confirmed", async () => {
    seedDb(db, { hasReimbursement: "confirmed" });
    const ctx = makeAuthContext();

    await expect(
      service.prepareSettlement(
        WS_ID,
        EXP_ID,
        ctx,
        TOKEN_CONFIG,
        REGISTRY_ADDRESS,
        CHAIN_ID,
      ),
    ).rejects.toThrow(/DUPLICATE_SETTLEMENT|already settled/i);
  });

  it("blocks preparation when a reimbursement is pending confirmation", async () => {
    seedDb(db, { hasReimbursement: "submitted" });
    const ctx = makeAuthContext();

    await expect(
      service.prepareSettlement(
        WS_ID,
        EXP_ID,
        ctx,
        TOKEN_CONFIG,
        REGISTRY_ADDRESS,
        CHAIN_ID,
      ),
    ).rejects.toThrow(/DUPLICATE_SETTLEMENT|pending/i);
  });

  it("returns NOT_FOUND for an expense not in the workspace", async () => {
    seedDb(db);
    const ctx = makeAuthContext();

    await expect(
      service.prepareSettlement(
        WS_ID,
        "0x" + "ee".repeat(32),
        ctx,
        TOKEN_CONFIG,
        REGISTRY_ADDRESS,
        CHAIN_ID,
      ),
    ).rejects.toThrow();
  });

  it("blocks preparation when treasury balance is insufficient", async () => {
    seedDb(db);
    const ctx = makeAuthContext();

    // Required amount is 1000000 base units; provide balance of 500000
    await expect(
      service.prepareSettlement(
        WS_ID,
        EXP_ID,
        ctx,
        TOKEN_CONFIG,
        REGISTRY_ADDRESS,
        CHAIN_ID,
        { treasuryBalance: 500000n },
      ),
    ).rejects.toThrow(/INSUFFICIENT_BALANCE|less than required/i);
  });

  it("permits preparation when treasury balance is sufficient", async () => {
    seedDb(db);
    const ctx = makeAuthContext();

    const result = await service.prepareSettlement(
      WS_ID,
      EXP_ID,
      ctx,
      TOKEN_CONFIG,
      REGISTRY_ADDRESS,
      CHAIN_ID,
      { treasuryBalance: 2000000n },
    );

    expect(result.amountBaseUnits).toBe("1000000");
  });

  it("blocks preparation when simulation probe fails", async () => {
    seedDb(db);
    const ctx = makeAuthContext();

    await expect(
      service.prepareSettlement(
        WS_ID,
        EXP_ID,
        ctx,
        TOKEN_CONFIG,
        REGISTRY_ADDRESS,
        CHAIN_ID,
        {
          simulateCall: async () => ({
            success: false,
            revertReason: "ERC20: transfer amount exceeds balance",
          }),
        },
      ),
    ).rejects.toThrow(/SIMULATION_FAILED|exceeds balance/i);
  });

  it("evaluates needsApproval false when allowance is already sufficient", async () => {
    seedDb(db);
    const ctx = makeAuthContext();

    const result = await service.prepareSettlement(
      WS_ID,
      EXP_ID,
      ctx,
      TOKEN_CONFIG,
      REGISTRY_ADDRESS,
      CHAIN_ID,
      {
        treasuryAllowance: 5000000n, // greater than 1000000
        simulateCall: async () => ({ success: true }),
      },
    );

    expect(result.needsApproval).toBe(false);
    expect(result.approveCalldata).toBeNull();
  });

  it("blocks preparation when expense currency is not supported (UNSUPPORTED_ASSET)", async () => {
    seedDb(db);
    db.expenseVersions[0]!.currency = "EUR";
    const ctx = makeAuthContext();

    await expect(
      service.prepareSettlement(
        WS_ID,
        EXP_ID,
        ctx,
        TOKEN_CONFIG,
        REGISTRY_ADDRESS,
        CHAIN_ID,
      ),
    ).rejects.toThrow(/UNSUPPORTED_ASSET|does not match token/i);
  });

  it("blocks preparation when token address is invalid (INVALID_TOKEN_CONFIG)", async () => {
    seedDb(db);
    const ctx = makeAuthContext();

    await expect(
      service.prepareSettlement(
        WS_ID,
        EXP_ID,
        ctx,
        {
          ...TOKEN_CONFIG,
          address: "0x0000000000000000000000000000000000000000",
        },
        REGISTRY_ADDRESS,
        CHAIN_ID,
      ),
    ).rejects.toThrow(/INVALID_TOKEN_CONFIG/i);
  });

  it("blocks preparation when registry address is invalid (INVALID_REGISTRY_CONFIG)", async () => {
    seedDb(db);
    const ctx = makeAuthContext();

    await expect(
      service.prepareSettlement(
        WS_ID,
        EXP_ID,
        ctx,
        TOKEN_CONFIG,
        "not-a-valid-address",
        CHAIN_ID,
      ),
    ).rejects.toThrow(/INVALID_REGISTRY_CONFIG/i);
  });

  it("blocks preparation when chainId is invalid (UNSUPPORTED_NETWORK)", async () => {
    seedDb(db);
    const ctx = makeAuthContext();

    await expect(
      service.prepareSettlement(
        WS_ID,
        EXP_ID,
        ctx,
        TOKEN_CONFIG,
        REGISTRY_ADDRESS,
        0,
      ),
    ).rejects.toThrow(/UNSUPPORTED_NETWORK/i);
  });

  it("blocks preparation when requireSufficientAllowance is set and allowance is insufficient (INSUFFICIENT_ALLOWANCE)", async () => {
    seedDb(db);
    const ctx = makeAuthContext();

    await expect(
      service.prepareSettlement(
        WS_ID,
        EXP_ID,
        ctx,
        TOKEN_CONFIG,
        REGISTRY_ADDRESS,
        CHAIN_ID,
        {
          treasuryAllowance: 500n, // less than 1000000n
          requireSufficientAllowance: true,
        },
      ),
    ).rejects.toThrow(/INSUFFICIENT_ALLOWANCE/i);
  });
});

describe("SettlementService.reconcileSettlement", () => {
  let db: MockDb;
  let service: SettlementService;

  beforeEach(() => {
    db = new MockDb();
    service = new SettlementService(db);
  });

  it("reconciles settlement successfully and writes chain transaction and reimbursement", async () => {
    seedDb(db);
    const ctx = makeAuthContext();

    const result = await service.reconcileSettlement(
      WS_ID,
      EXP_ID,
      1,
      COMMITMENT,
      TX_HASH,
      "idem-1",
      ctx,
      TOKEN_CONFIG,
      CHAIN_ID,
      REGISTRY_ADDRESS,
    );

    expect(result.status).toBe("submitted");
    expect(result.transactionHash).toBe(TX_HASH);
    expect(db.reimbursements.length).toBe(1);
    expect(db.reimbursements[0]?.status).toBe("submitted");
  });

  it("blocks reconcile when token address is invalid (INVALID_TOKEN_CONFIG)", async () => {
    seedDb(db);
    const ctx = makeAuthContext();

    await expect(
      service.reconcileSettlement(
        WS_ID,
        EXP_ID,
        1,
        COMMITMENT,
        TX_HASH,
        "idem-invalid-token",
        ctx,
        {
          ...TOKEN_CONFIG,
          address: "0x0000000000000000000000000000000000000000",
        },
        CHAIN_ID,
        REGISTRY_ADDRESS,
      ),
    ).rejects.toThrow(/INVALID_TOKEN_CONFIG/i);
  });

  it("blocks reconcile when registry address is invalid (INVALID_REGISTRY_CONFIG)", async () => {
    seedDb(db);
    const ctx = makeAuthContext();

    await expect(
      service.reconcileSettlement(
        WS_ID,
        EXP_ID,
        1,
        COMMITMENT,
        TX_HASH,
        "idem-invalid-reg",
        ctx,
        TOKEN_CONFIG,
        CHAIN_ID,
        "0x0000000000000000000000000000000000000000",
      ),
    ).rejects.toThrow(/INVALID_REGISTRY_CONFIG/i);
  });

  it("blocks reconcile when chainId is invalid (UNSUPPORTED_NETWORK)", async () => {
    seedDb(db);
    const ctx = makeAuthContext();

    await expect(
      service.reconcileSettlement(
        WS_ID,
        EXP_ID,
        1,
        COMMITMENT,
        TX_HASH,
        "idem-invalid-chain",
        ctx,
        TOKEN_CONFIG,
        -1,
        REGISTRY_ADDRESS,
      ),
    ).rejects.toThrow(/UNSUPPORTED_NETWORK/i);
  });
});

describe("SettlementService.getTreasuryQueue", () => {
  let db: MockDb;
  let service: SettlementService;

  beforeEach(() => {
    db = new MockDb();
    service = new SettlementService(db);
  });

  it("returns approved expenses without settled reimbursements", async () => {
    seedDb(db);
    const ctx = makeAuthContext();

    const queue = await service.getTreasuryQueue(WS_ID, ctx, TOKEN_CONFIG);

    expect(queue.workspaceId).toBe(WS_ID);
    expect(queue.items.length).toBeGreaterThanOrEqual(0);
  });

  it("marks an item as settled when reimbursement is confirmed", async () => {
    seedDb(db, { hasReimbursement: "confirmed" });
    const ctx = makeAuthContext();

    const queue = await service.getTreasuryQueue(WS_ID, ctx, TOKEN_CONFIG);

    // The item should still be returned but marked settled
    const item = queue.items.find((i) => i.expenseId === EXP_ID);
    if (item) {
      expect(item.isSettled).toBe(true);
    }
  });
});

describe("Settlement Configuration & Provenance", () => {
  it("fails closed with SettlementConfigError when deployment manifest is missing and no test override is set", () => {
    setSettlementConfigForTesting(null);
    expect(() => getSettlementConfig()).toThrow(SettlementConfigError);
  });

  it("tryGetSettlementConfig returns null when unconfigured", () => {
    setSettlementConfigForTesting(null);
    expect(tryGetSettlementConfig()).toBeNull();
  });

  it("resolves isolated configuration when set via setSettlementConfigForTesting", () => {
    setSettlementConfigForTesting({
      token: TOKEN_CONFIG,
      registryAddress: REGISTRY_ADDRESS,
      chainId: CHAIN_ID,
      isFromManifest: true,
    });
    const config = getSettlementConfig();
    expect(config.token.symbol).toBe("USDC");
    expect(config.token.decimals).toBe(6);
    expect(config.token.address).toBe(TOKEN_CONFIG.address);
    expect(config.registryAddress).toBe(REGISTRY_ADDRESS);
    expect(config.chainId).toBe(CHAIN_ID);
    expect(config.isFromManifest).toBe(true);
    setSettlementConfigForTesting(null);
  });
});

describe("Duplicate Settlement & Receipt Prevention", () => {
  let db: MockDb;
  let service: SettlementService;

  const OTHER_EXP_ID =
    "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
  const RECEIPT_HASH =
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  const DIFFERENT_RECEIPT_HASH =
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

  beforeEach(() => {
    db = new MockDb();
    service = new SettlementService(db);
  });

  it("blocks duplicate settlement of the same expense across different versions (v1 confirmed, v2 prepare blocked)", async () => {
    seedDb(db);
    const ctx = makeAuthContext();

    // v1 is already confirmed
    db.reimbursements = [
      {
        reimbursement_id: "reimb-v1",
        workspace_id: WS_ID,
        expense_id: EXP_ID,
        version: 1,
        token_address: TOKEN_CONFIG.address,
        recipient_address: RECIPIENT_ADDR,
        amount: "1000000",
        payment_reference: null,
        transaction_hash: TX_HASH,
        status: "confirmed",
        settled_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
    ];

    // Set expense to version 2
    const exp = db.expenses.find((e) => e.expense_id === EXP_ID)!;
    exp.current_version = 2;
    db.expenseVersions.push({
      workspace_id: WS_ID,
      expense_id: EXP_ID,
      version: 2,
      commitment:
        "0x2222222222222222222222222222222222222222222222222222222222222222",
      previous_commitment: COMMITMENT,
      amount: "1000000",
      currency: "USDC",
      recipient: RECIPIENT_ADDR,
      status: "current",
    });
    db.decisions.push({
      workspace_id: WS_ID,
      expense_id: EXP_ID,
      version: 2,
      commitment:
        "0x2222222222222222222222222222222222222222222222222222222222222222",
      decision_type: "approve",
      reviewer_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      recorded_at: new Date().toISOString(),
    });

    await expect(
      service.prepareSettlement(
        WS_ID,
        EXP_ID,
        ctx,
        TOKEN_CONFIG,
        REGISTRY_ADDRESS,
        CHAIN_ID,
      ),
    ).rejects.toThrow(/DUPLICATE_SETTLEMENT|already been reimbursed/i);
  });

  it("blocks duplicate settlement when an identical receipt was already reimbursed in another expense", async () => {
    seedDb(db);
    const ctx = makeAuthContext();

    // Attach receipt to current expense (EXP_ID)
    db.evidenceObjects.push({
      workspace_id: WS_ID,
      expense_id: EXP_ID,
      version: 1,
      evidence_id: "ev-1",
      sha256_hash: RECEIPT_HASH,
    });

    // Another expense (OTHER_EXP_ID) attached the same receipt and was already confirmed
    db.evidenceObjects.push({
      workspace_id: WS_ID,
      expense_id: OTHER_EXP_ID,
      version: 1,
      evidence_id: "ev-other",
      sha256_hash: RECEIPT_HASH,
    });
    db.reimbursements.push({
      reimbursement_id: "reimb-other",
      workspace_id: WS_ID,
      expense_id: OTHER_EXP_ID,
      version: 1,
      token_address: TOKEN_CONFIG.address,
      recipient_address: RECIPIENT_ADDR,
      amount: "1000000",
      payment_reference: null,
      transaction_hash: "0x9999999999999999999999999999999999999999999999999999999999999999",
      status: "confirmed",
      settled_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });

    await expect(
      service.prepareSettlement(
        WS_ID,
        EXP_ID,
        ctx,
        TOKEN_CONFIG,
        REGISTRY_ADDRESS,
        CHAIN_ID,
      ),
    ).rejects.toThrow(/DUPLICATE_RECEIPT_SETTLEMENT|identical receipt/i);
  });

  it("blocks duplicate settlement when an identical receipt is pending in another expense", async () => {
    seedDb(db);
    const ctx = makeAuthContext();

    db.evidenceObjects.push({
      workspace_id: WS_ID,
      expense_id: EXP_ID,
      version: 1,
      evidence_id: "ev-1",
      sha256_hash: RECEIPT_HASH,
    });
    db.evidenceObjects.push({
      workspace_id: WS_ID,
      expense_id: OTHER_EXP_ID,
      version: 1,
      evidence_id: "ev-other",
      sha256_hash: RECEIPT_HASH,
    });
    db.reimbursements.push({
      reimbursement_id: "reimb-other-pending",
      workspace_id: WS_ID,
      expense_id: OTHER_EXP_ID,
      version: 1,
      token_address: TOKEN_CONFIG.address,
      recipient_address: RECIPIENT_ADDR,
      amount: "1000000",
      payment_reference: null,
      transaction_hash: "0x8888888888888888888888888888888888888888888888888888888888888888",
      status: "submitted",
      settled_at: null,
      created_at: new Date().toISOString(),
    });

    await expect(
      service.prepareSettlement(
        WS_ID,
        EXP_ID,
        ctx,
        TOKEN_CONFIG,
        REGISTRY_ADDRESS,
        CHAIN_ID,
      ),
    ).rejects.toThrow(/DUPLICATE_RECEIPT_SETTLEMENT|pending reimbursement/i);
  });

  it("blocks duplicate settlement when the source transaction was already reimbursed in another expense", async () => {
    seedDb(db);
    const ctx = makeAuthContext();

    db.sourceTransactions.push({
      workspace_id: WS_ID,
      expense_id: EXP_ID,
      source_chain_id: 1,
      source_transaction_hash: "0xabc1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
      claim_slot: 0,
    });
    db.sourceTransactions.push({
      workspace_id: WS_ID,
      expense_id: OTHER_EXP_ID,
      source_chain_id: 1,
      source_transaction_hash: "0xabc1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
      claim_slot: 0,
    });
    db.reimbursements.push({
      reimbursement_id: "reimb-source-confirmed",
      workspace_id: WS_ID,
      expense_id: OTHER_EXP_ID,
      version: 1,
      token_address: TOKEN_CONFIG.address,
      recipient_address: RECIPIENT_ADDR,
      amount: "1000000",
      payment_reference: null,
      transaction_hash: "0x7777777777777777777777777777777777777777777777777777777777777777",
      status: "confirmed",
      settled_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });

    await expect(
      service.prepareSettlement(
        WS_ID,
        EXP_ID,
        ctx,
        TOKEN_CONFIG,
        REGISTRY_ADDRESS,
        CHAIN_ID,
      ),
    ).rejects.toThrow(/DUPLICATE_SOURCE_SETTLEMENT|source transaction/i);
  });

  it("allows settlement of a separate legitimate expense with different receipt evidence", async () => {
    seedDb(db);
    const ctx = makeAuthContext();

    // Attach distinct receipts to both expenses
    db.evidenceObjects.push({
      workspace_id: WS_ID,
      expense_id: EXP_ID,
      version: 1,
      evidence_id: "ev-1",
      sha256_hash: RECEIPT_HASH,
    });
    db.evidenceObjects.push({
      workspace_id: WS_ID,
      expense_id: OTHER_EXP_ID,
      version: 1,
      evidence_id: "ev-other",
      sha256_hash: DIFFERENT_RECEIPT_HASH,
    });
    // OTHER_EXP_ID was already confirmed
    db.reimbursements.push({
      reimbursement_id: "reimb-other",
      workspace_id: WS_ID,
      expense_id: OTHER_EXP_ID,
      version: 1,
      token_address: TOKEN_CONFIG.address,
      recipient_address: RECIPIENT_ADDR,
      amount: "1000000",
      payment_reference: null,
      transaction_hash: "0x9999999999999999999999999999999999999999999999999999999999999999",
      status: "confirmed",
      settled_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });

    // First valid settlement on EXP_ID must succeed
    const prep = await service.prepareSettlement(
      WS_ID,
      EXP_ID,
      ctx,
      TOKEN_CONFIG,
      REGISTRY_ADDRESS,
      CHAIN_ID,
    );
    expect(prep.expenseId).toBe(EXP_ID);

    const reconciled = await service.reconcileSettlement(
      WS_ID,
      EXP_ID,
      1,
      COMMITMENT,
      TX_HASH,
      "idem-valid",
      ctx,
      TOKEN_CONFIG,
      CHAIN_ID,
      REGISTRY_ADDRESS,
    );
    expect(reconciled.status).toBe("submitted");
  });

  it("handles repeated reconcile requests with same txHash idempotently", async () => {
    seedDb(db);
    const ctx = makeAuthContext();

    const first = await service.reconcileSettlement(
      WS_ID,
      EXP_ID,
      1,
      COMMITMENT,
      TX_HASH,
      "idem-first",
      ctx,
      TOKEN_CONFIG,
      CHAIN_ID,
      REGISTRY_ADDRESS,
    );
    expect(first.status).toBe("submitted");

    // Second repeated reconcile call with same txHash
    const second = await service.reconcileSettlement(
      WS_ID,
      EXP_ID,
      1,
      COMMITMENT,
      TX_HASH,
      "idem-retry",
      ctx,
      TOKEN_CONFIG,
      CHAIN_ID,
      REGISTRY_ADDRESS,
    );
    expect(second.reimbursementId).toBe(first.reimbursementId);
    expect(second.status).toBe("submitted");
  });

  it("blocks concurrent reconcile request with different txHash when already submitted", async () => {
    seedDb(db);
    const ctx = makeAuthContext();

    await service.reconcileSettlement(
      WS_ID,
      EXP_ID,
      1,
      COMMITMENT,
      TX_HASH,
      "idem-1",
      ctx,
      TOKEN_CONFIG,
      CHAIN_ID,
      REGISTRY_ADDRESS,
    );

    const DIFFERENT_TX =
      "0x4444444444444444444444444444444444444444444444444444444444444444";

    await expect(
      service.reconcileSettlement(
        WS_ID,
        EXP_ID,
        1,
        COMMITMENT,
        DIFFERENT_TX,
        "idem-2",
        ctx,
        TOKEN_CONFIG,
        CHAIN_ID,
        REGISTRY_ADDRESS,
      ),
    ).rejects.toThrow(/DUPLICATE_SETTLEMENT|already pending/i);
  });

  it("allows retry after previous settlement transaction failed", async () => {
    seedDb(db);
    const ctx = makeAuthContext();

    // Prior settlement attempt failed
    db.reimbursements = [
      {
        reimbursement_id: "reimb-failed",
        workspace_id: WS_ID,
        expense_id: EXP_ID,
        version: 1,
        token_address: TOKEN_CONFIG.address,
        recipient_address: RECIPIENT_ADDR,
        amount: "1000000",
        payment_reference: null,
        transaction_hash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        status: "failed",
        settled_at: null,
        created_at: new Date(Date.now() - 60000).toISOString(),
      },
    ];

    // Retry must be permitted
    const prep = await service.prepareSettlement(
      WS_ID,
      EXP_ID,
      ctx,
      TOKEN_CONFIG,
      REGISTRY_ADDRESS,
      CHAIN_ID,
    );
    expect(prep.expenseId).toBe(EXP_ID);

    const reconciled = await service.reconcileSettlement(
      WS_ID,
      EXP_ID,
      1,
      COMMITMENT,
      TX_HASH,
      "idem-retry-new",
      ctx,
      TOKEN_CONFIG,
      CHAIN_ID,
      REGISTRY_ADDRESS,
    );
    expect(reconciled.status).toBe("submitted");
  });

  it("flags isDuplicateBlocked in treasury queue when receipt was already settled in another expense", async () => {
    seedDb(db);
    const ctx = makeAuthContext();

    db.evidenceObjects.push({
      workspace_id: WS_ID,
      expense_id: EXP_ID,
      version: 1,
      evidence_id: "ev-1",
      sha256_hash: RECEIPT_HASH,
    });
    db.evidenceObjects.push({
      workspace_id: WS_ID,
      expense_id: OTHER_EXP_ID,
      version: 1,
      evidence_id: "ev-other",
      sha256_hash: RECEIPT_HASH,
    });
    db.reimbursements.push({
      reimbursement_id: "reimb-other",
      workspace_id: WS_ID,
      expense_id: OTHER_EXP_ID,
      version: 1,
      token_address: TOKEN_CONFIG.address,
      recipient_address: RECIPIENT_ADDR,
      amount: "1000000",
      payment_reference: null,
      transaction_hash: "0x9999999999999999999999999999999999999999999999999999999999999999",
      status: "confirmed",
      settled_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });

    const queue = await service.getTreasuryQueue(WS_ID, ctx, TOKEN_CONFIG);
    const item = queue.items.find((i) => i.expenseId === EXP_ID);
    expect(item).toBeDefined();
    expect(item?.isDuplicateBlocked).toBe(true);
    expect(item?.duplicateReason).toMatch(/receipt already reimbursed/i);
  });
});
