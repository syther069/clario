/**
 * Settlement Lifecycle & Reconcile Integration Tests (SET-002)
 *
 * Tests the complete reimbursement lifecycle:
 * 1. Receipt event validation (SettlementRecorded and ERC-20 Transfer logs).
 * 2. Reverted and failed transaction handling (safe retry, never marks confirmed).
 * 3. Successful receipt-validated confirmation (atomically updates operational & projection tables).
 * 4. Idempotency on repeat confirmation.
 * 5. Settlement status query with attempts history, proof, and retry eligibility.
 * 6. Failed reimbursement retry workflow.
 * 7. Reorg retraction handling.
 * 8. Authoritative TREASURY_ROLE and recent confirmation enforcement.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { encodeEventTopics, encodeAbiParameters } from "viem";
import type { DatabaseClient, QueryResult } from "@clario/database";
import {
  SettlementService,
  SettlementPreConditionError,
  type SettlementTokenConfig,
} from "./service";
import {
  ERC20_TRANSFER_EVENT_ABI,
  type MinimalTransactionReceipt,
  type MinimalReceiptLog,
} from "./receipt";
import { SETTLEMENT_REGISTRY_ABI } from "./calldata";
import { type AuthContext, GLOBAL_SCOPE } from "../auth/policy";

// ---------------------------------------------------------------------------
// Constants & Fixtures
// ---------------------------------------------------------------------------

const WS_ID = "0x" + "aa".repeat(32);
const EXPENSE_ID = "0x" + "bb".repeat(32);
const COMMITMENT_V1 =
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const REGISTRY_ADDR = "0x2222222222222222222222222222222222222222";
const USDC_ADDR = "0x754704Bc059F8C67012fEd69BC8A327a5aafb603";
const RECIPIENT_ADDR = "0x4444444444444444444444444444444444444444";
const TREASURY_OPERATOR = "0x5555555555555555555555555555555555555555";
const CHAIN_ID = 10143;
const AMOUNT_BASE_UNITS = 100_000_000n; // 100 USDC (6 decimals)
const PAYMENT_REF =
  "0x9999999999999999999999999999999999999999999999999999999999999999";
const TX_HASH_1 =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const TREASURY_ROLE_HASH =
  "0xe1dcbdb91df27212a29bc27177c840cf2f819ecf2187432e1fac86c2dd5dfca9";

const TOKEN_CONFIG: SettlementTokenConfig = {
  address: USDC_ADDR,
  decimals: 6,
  symbol: "USDC",
};

// ---------------------------------------------------------------------------
// Mock Database
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
    token_address: string;
    recipient_address: string;
    amount: string;
    payment_reference: string;
    transaction_hash: string | null;
    status: string;
    settled_at: string | null;
    created_at: string;
    updated_at?: string;
  }> = [];
  chainTransactions: Array<{
    transaction_id: string;
    workspace_id: string;
    chain_id: number;
    transaction_hash: string;
    action: string;
    status: string;
    submitted_at: string;
    confirmed_at: string | null;
    block_number: string | null;
  }> = [];
  projectionSettlements: Array<{
    workspace_id: string;
    expense_id: string;
    version: number;
    commitment: string;
    token: string;
    recipient: string;
    amount: string;
    payment_reference: string;
    settled_at_block: string;
    settled_at_tx: string;
    indexed_at: string;
  }> = [];
  auditEvents: Array<{
    workspace_id: string;
    actor_address: string;
    event_type: string;
    entity_type: string;
    entity_id: string;
    metadata: string;
    occurred_at: string;
  }> = [];

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    const normalizedSql = sql.trim().replace(/\s+/g, " ").toLowerCase();

    // Workspaces
    if (normalizedSql.includes("from workspaces where workspace_id")) {
      const wsId = params?.[0] as string;
      const rows = this.workspaces.filter((w) => w.workspace_id === wsId);
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    // Memberships
    if (normalizedSql.includes("from memberships")) {
      const wsId = params?.[0] as string;
      const userId = params?.[1] as string;
      const addr = params?.[2] as string;
      const rows = this.memberships.filter(
        (m) =>
          m.workspace_id === wsId &&
          (m.user_id === userId ||
            m.address.toLowerCase() === addr?.toLowerCase()),
      );
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    // Role grants
    if (normalizedSql.includes("from role_grants")) {
      const wsId = params?.[0] as string;
      const addr = params?.[1] as string;
      const rows = this.roleGrants.filter(
        (r) =>
          r.workspace_id === wsId &&
          (r.account_address ?? r.address)?.toLowerCase() ===
            addr?.toLowerCase() &&
          r.revoked_at === null,
      );
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    // Expenses lookup
    if (
      normalizedSql.includes("from expenses") &&
      normalizedSql.includes("workspace_id = $1 and expense_id = $2")
    ) {
      const wsId = params?.[0] as string;
      const expId = params?.[1] as string;
      const rows = this.expenses.filter(
        (e) => e.workspace_id === wsId && e.expense_id === expId,
      );
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    // Expense versions lookup
    if (
      normalizedSql.includes("from expense_versions") &&
      normalizedSql.includes("version = $3")
    ) {
      const wsId = params?.[0] as string;
      const expId = params?.[1] as string;
      const ver = Number(params?.[2]);
      const rows = this.expenseVersions.filter(
        (ev) =>
          ev.workspace_id === wsId &&
          ev.expense_id === expId &&
          ev.version === ver,
      );
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    // Reimbursements lookup
    if (
      normalizedSql.includes("from reimbursements") &&
      normalizedSql.includes("workspace_id = $1 and expense_id = $2")
    ) {
      const wsId = params?.[0] as string;
      const expId = params?.[1] as string;
      const ver = Number(params?.[2]);
      const rows = this.reimbursements.filter(
        (r) =>
          r.workspace_id === wsId &&
          r.expense_id === expId &&
          r.version === ver,
      );
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    // DELETE FROM projection_settlements (must precede 'from projection_settlements' check!)
    if (normalizedSql.includes("delete from projection_settlements")) {
      const wsId = params?.[0] as string;
      const expId = params?.[1] as string;
      const ver = Number(params?.[2]);
      this.projectionSettlements = this.projectionSettlements.filter(
        (p) =>
          !(
            p.workspace_id === wsId &&
            p.expense_id === expId &&
            p.version === ver
          ),
      );
      return { rows: [], rowCount: 1 };
    }

    // Projection settlements lookup
    if (normalizedSql.includes("from projection_settlements")) {
      const wsId = params?.[0] as string;
      const expId = params?.[1] as string;
      const ver = Number(params?.[2]);
      const rows = this.projectionSettlements.filter(
        (p) =>
          p.workspace_id === wsId &&
          p.expense_id === expId &&
          p.version === ver,
      );
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    // Chain transactions lookup
    if (normalizedSql.includes("from chain_transactions")) {
      const wsId = params?.[0] as string;
      const chainId = Number(params?.[1]);
      const hashes = (params?.[2] as string[]) ?? [];
      const rows = this.chainTransactions.filter(
        (ctx) =>
          ctx.workspace_id === wsId &&
          ctx.chain_id === chainId &&
          hashes.some(
            (h) => h.toLowerCase() === ctx.transaction_hash.toLowerCase(),
          ),
      );
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    // UPDATE reimbursements
    if (normalizedSql.includes("update reimbursements set status")) {
      const statusMatch = normalizedSql.match(/status = '([^']+)'/);
      const newStatus = statusMatch ? statusMatch[1] : "failed";
      if (normalizedSql.includes("where reimbursement_id = $1")) {
        const id = params?.[0] as string;
        const reimb = this.reimbursements.find(
          (r) => r.reimbursement_id === id,
        );
        if (reimb) {
          reimb.status = newStatus!;
          reimb.updated_at = new Date().toISOString();
        }
      } else if (normalizedSql.includes("where reimbursement_id = $2")) {
        const hash = params?.[0] as string;
        const id = params?.[1] as string;
        const reimb = this.reimbursements.find(
          (r) => r.reimbursement_id === id,
        );
        if (reimb) {
          reimb.status = newStatus!;
          reimb.transaction_hash = hash;
          reimb.settled_at = new Date().toISOString();
          reimb.updated_at = new Date().toISOString();
        }
      } else if (
        normalizedSql.includes(
          "workspace_id = $1 and expense_id = $2 and version = $3",
        )
      ) {
        const wsId = params?.[0] as string;
        const expId = params?.[1] as string;
        const ver = Number(params?.[2]);
        const reimb = this.reimbursements.find(
          (r) =>
            r.workspace_id === wsId &&
            r.expense_id === expId &&
            r.version === ver,
        );
        if (reimb) {
          reimb.status = newStatus!;
          reimb.settled_at = null;
          reimb.updated_at = new Date().toISOString();
        }
      }
      return { rows: [], rowCount: 1 };
    }

    // UPDATE chain_transactions
    if (normalizedSql.includes("update chain_transactions set status")) {
      const statusMatch = normalizedSql.match(/status = '([^']+)'/);
      const newStatus = statusMatch ? statusMatch[1] : "failed";
      if (
        normalizedSql.includes(
          "where chain_id = $1 and lower(transaction_hash) = lower($2)",
        )
      ) {
        const chainId = Number(params?.[0]);
        const hash = params?.[1] as string;
        const ctx = this.chainTransactions.find(
          (c) =>
            c.chain_id === chainId &&
            c.transaction_hash.toLowerCase() === hash.toLowerCase(),
        );
        if (ctx) {
          ctx.status = newStatus!;
        }
      } else if (
        normalizedSql.includes(
          "block_number = $1 where chain_id = $2 and lower(transaction_hash) = lower($3)",
        )
      ) {
        const blockNum = params?.[0] as string;
        const chainId = Number(params?.[1]);
        const hash = params?.[2] as string;
        const ctx = this.chainTransactions.find(
          (c) =>
            c.chain_id === chainId &&
            c.transaction_hash.toLowerCase() === hash.toLowerCase(),
        );
        if (ctx) {
          ctx.status = newStatus!;
          ctx.block_number = blockNum;
          ctx.confirmed_at = new Date().toISOString();
        }
      }
      return { rows: [], rowCount: 1 };
    }

    // INSERT INTO projection_settlements
    if (normalizedSql.includes("insert into projection_settlements")) {
      const wsId = params?.[0] as string;
      const expId = params?.[1] as string;
      const ver = Number(params?.[2]);
      const commitment = params?.[3] as string;
      const token = params?.[4] as string;
      const recipient = params?.[5] as string;
      const amount = params?.[6] as string;
      const paymentRef = params?.[7] as string;
      const blockNum = params?.[8] as string;
      const txHash = params?.[9] as string;

      const existingIdx = this.projectionSettlements.findIndex(
        (p) =>
          p.workspace_id === wsId &&
          p.expense_id === expId &&
          p.version === ver,
      );
      const newProj = {
        workspace_id: wsId,
        expense_id: expId,
        version: ver,
        commitment,
        token,
        recipient,
        amount,
        payment_reference: paymentRef,
        settled_at_block: blockNum,
        settled_at_tx: txHash,
        indexed_at: new Date().toISOString(),
      };
      if (existingIdx >= 0) {
        this.projectionSettlements[existingIdx] = newProj;
      } else {
        this.projectionSettlements.push(newProj);
      }
      return { rows: [], rowCount: 1 };
    }

    // INSERT INTO audit_events
    if (normalizedSql.includes("insert into audit_events")) {
      const match = normalizedSql.match(/'(reimbursement_[a-z_]+)'/);
      const eventType = (match ? match[1] : undefined) ?? String(params?.[2]);
      const isReorg = eventType === "reimbursement_reorg_retracted";
      this.auditEvents.push({
        workspace_id: String(params?.[0]),
        actor_address: isReorg ? "system" : String(params?.[1]),
        event_type: eventType,
        entity_type: "reimbursement",
        entity_id: isReorg ? String(params?.[1]) : String(params?.[2]),
        metadata: isReorg ? String(params?.[2]) : String(params?.[3]),
        occurred_at: new Date().toISOString(),
      });
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }
}

function makeAuthContext(
  address: string,
  confirmedAgoMinutes = 0,
): AuthContext {
  const now = Date.now();
  const lastConfirmedAt = now - confirmedAgoMinutes * 60 * 1000;
  return {
    userId: "u-1",
    address: address as `0x${string}`,
    user: { id: "u-1", address },
    session: {
      userId: "u-1",
      address,
      confirmedAt: new Date(lastConfirmedAt).toISOString(),
      lastConfirmedAt,
      csrfToken: "mock-csrf-token",
    },
  } as unknown as AuthContext;
}

function createReceiptFixture(
  overrides: {
    status?: "success" | "reverted" | 0 | 1;
    destination?: string;
    workspaceId?: string;
    expenseId?: string;
    version?: number;
    commitment?: string;
    token?: string;
    recipient?: string;
    amount?: bigint;
    includeSettlementLog?: boolean;
    includeTransferLog?: boolean;
  } = {},
): MinimalTransactionReceipt {
  const status = overrides.status ?? "success";
  const to = overrides.destination ?? REGISTRY_ADDR;
  const wsId = overrides.workspaceId ?? WS_ID;
  const expId = overrides.expenseId ?? EXPENSE_ID;
  const ver = overrides.version ?? 1;
  const commit = overrides.commitment ?? COMMITMENT_V1;
  const token = (overrides.token ?? USDC_ADDR) as `0x${string}`;
  const recipient = (overrides.recipient ?? RECIPIENT_ADDR) as `0x${string}`;
  const amount = overrides.amount ?? AMOUNT_BASE_UNITS;
  const includeSettlement = overrides.includeSettlementLog ?? true;
  const includeTransfer = overrides.includeTransferLog ?? true;

  const logs: MinimalReceiptLog[] = [];

  if (includeSettlement) {
    const wsHex = (
      wsId.startsWith("0x")
        ? wsId
        : "0x" + Buffer.from(wsId, "utf8").toString("hex").padEnd(64, "0")
    ) as `0x${string}`;
    const expHex = (
      expId.startsWith("0x")
        ? expId
        : "0x" + Buffer.from(expId, "utf8").toString("hex").padEnd(64, "0")
    ) as `0x${string}`;

    const settlementTopics = encodeEventTopics({
      abi: SETTLEMENT_REGISTRY_ABI,
      eventName: "SettlementRecorded",
      args: {
        workspaceId: wsHex,
        expenseId: expHex,
        version: ver,
      },
    }) as [`0x${string}`, ...`0x${string}`[]];

    const settlementData = encodeAbiParameters(
      [
        { name: "commitment", type: "bytes32" },
        { name: "token", type: "address" },
        { name: "recipient", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "paymentReference", type: "bytes32" },
      ],
      [
        commit as `0x${string}`,
        token,
        recipient,
        amount,
        PAYMENT_REF as `0x${string}`,
      ],
    );

    logs.push({
      address: to,
      data: settlementData,
      topics: settlementTopics,
      logIndex: 0,
    });
  }

  if (includeTransfer) {
    const transferTopics = encodeEventTopics({
      abi: ERC20_TRANSFER_EVENT_ABI,
      eventName: "Transfer",
      args: {
        from: TREASURY_OPERATOR as `0x${string}`,
        to: recipient,
      },
    }) as [`0x${string}`, ...`0x${string}`[]];

    const transferData = encodeAbiParameters(
      [{ name: "value", type: "uint256" }],
      [amount],
    );

    logs.push({
      address: token,
      data: transferData,
      topics: transferTopics,
      logIndex: 1,
    });
  }

  return {
    status,
    blockNumber: 123456n,
    blockHash:
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    transactionHash: TX_HASH_1,
    to,
    from: TREASURY_OPERATOR,
    logs,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SET-002: Settlement Lifecycle & Reconciliation", () => {
  let db: MockDb;
  let service: SettlementService;
  let authContext: AuthContext;

  beforeEach(() => {
    db = new MockDb();
    service = new SettlementService(db);
    authContext = makeAuthContext(TREASURY_OPERATOR, 0);

    // Setup base workspace, user, and treasury role
    db.workspaces.push({ workspace_id: WS_ID, created_by: "u-owner" });
    db.memberships.push({
      membership_id: "m-1",
      workspace_id: WS_ID,
      user_id: "u-1",
      address: TREASURY_OPERATOR,
      status: "active",
    });
    db.roleGrants.push({
      workspace_id: WS_ID,
      address: TREASURY_OPERATOR,
      account_address: TREASURY_OPERATOR,
      role: TREASURY_ROLE_HASH,
      scope: GLOBAL_SCOPE,
      revoked_at: null,
    });

    // Setup expense and version 1
    db.expenses.push({
      workspace_id: WS_ID,
      expense_id: EXPENSE_ID,
      created_by: "u-submitter",
      current_version: 1,
    });
    db.expenseVersions.push({
      workspace_id: WS_ID,
      expense_id: EXPENSE_ID,
      version: 1,
      commitment: COMMITMENT_V1,
      previous_commitment: null,
      amount: AMOUNT_BASE_UNITS.toString(),
      currency: "USDC",
      recipient: RECIPIENT_ADDR,
      status: "current",
    });
    db.decisions.push({
      workspace_id: WS_ID,
      expense_id: EXPENSE_ID,
      version: 1,
      commitment: COMMITMENT_V1,
      decision_type: "approve",
      reviewer_address: "0xreviewer",
      recorded_at: new Date().toISOString(),
    });

    // Existing submitted reimbursement
    db.reimbursements.push({
      reimbursement_id: "reimb-001",
      workspace_id: WS_ID,
      expense_id: EXPENSE_ID,
      version: 1,
      token_address: USDC_ADDR,
      recipient_address: RECIPIENT_ADDR,
      amount: AMOUNT_BASE_UNITS.toString(),
      payment_reference: PAYMENT_REF,
      transaction_hash: TX_HASH_1,
      status: "submitted",
      settled_at: null,
      created_at: new Date().toISOString(),
    });
    db.chainTransactions.push({
      transaction_id: "tx-001",
      workspace_id: WS_ID,
      chain_id: CHAIN_ID,
      transaction_hash: TX_HASH_1,
      action: "reimburse",
      status: "submitted",
      submitted_at: new Date().toISOString(),
      confirmed_at: null,
      block_number: null,
    });
  });

  describe("confirmSettlement", () => {
    it("successfully confirms settlement when valid receipt is provided", async () => {
      const receipt = createReceiptFixture();

      const result = await service.confirmSettlement(
        WS_ID,
        EXPENSE_ID,
        authContext,
        {
          receipt,
          transactionHash: TX_HASH_1,
          chainId: CHAIN_ID,
          registryAddress: REGISTRY_ADDR,
          tokenConfig: TOKEN_CONFIG,
        },
      );

      expect(result.confirmed).toBe(true);
      expect(result.status).toBe("confirmed");
      expect(result.transactionHash).toBe(TX_HASH_1);
      expect(result.proof).toBeDefined();
      expect(result.proof?.blockNumber).toBe("123456");
      expect(result.proof?.paymentReference).toBe(PAYMENT_REF);
      expect(result.proof?.amountDisplay).toBe("100");
      expect(result.proof?.amountBaseUnits).toBe(AMOUNT_BASE_UNITS.toString());
      expect(result.proof?.explorerUrl).toContain(TX_HASH_1);

      // Verify DB updates
      const reimb = db.reimbursements[0]!;
      expect(reimb.status).toBe("confirmed");
      expect(reimb.settled_at).not.toBeNull();

      const ctx = db.chainTransactions[0]!;
      expect(ctx.status).toBe("confirmed");
      expect(ctx.block_number).toBe("123456");

      expect(db.projectionSettlements.length).toBe(1);
      const proj = db.projectionSettlements[0]!;
      expect(proj.amount).toBe(AMOUNT_BASE_UNITS.toString());
      expect(proj.settled_at_tx).toBe(TX_HASH_1);

      // Verify audit log
      const audit = db.auditEvents.find(
        (a) => a.event_type === "reimbursement_confirmed",
      );
      expect(audit).toBeDefined();
      expect(audit?.actor_address).toBe(TREASURY_OPERATOR.toLowerCase());
    });

    it("handles onchain reverted transactions by marking failed without throwing unhandled error", async () => {
      const receipt = createReceiptFixture({ status: "reverted" });

      const result = await service.confirmSettlement(
        WS_ID,
        EXPENSE_ID,
        authContext,
        {
          receipt,
          transactionHash: TX_HASH_1,
          chainId: CHAIN_ID,
          registryAddress: REGISTRY_ADDR,
          tokenConfig: TOKEN_CONFIG,
        },
      );

      expect(result.confirmed).toBe(false);
      expect(result.status).toBe("failed");
      expect(result.reason).toContain("reverted");

      // Verify DB marks failed
      const reimb = db.reimbursements[0]!;
      expect(reimb.status).toBe("failed");

      const ctx = db.chainTransactions[0]!;
      expect(ctx.status).toBe("failed");

      // Verify audit log
      const audit = db.auditEvents.find(
        (a) => a.event_type === "reimbursement_failed",
      );
      expect(audit).toBeDefined();

      // No projection created
      expect(db.projectionSettlements.length).toBe(0);
    });

    it("returns idempotent result when already confirmed", async () => {
      // First confirmation
      const receipt = createReceiptFixture();
      await service.confirmSettlement(WS_ID, EXPENSE_ID, authContext, {
        receipt,
        transactionHash: TX_HASH_1,
        chainId: CHAIN_ID,
        registryAddress: REGISTRY_ADDR,
        tokenConfig: TOKEN_CONFIG,
      });

      // Second confirmation
      const result2 = await service.confirmSettlement(
        WS_ID,
        EXPENSE_ID,
        authContext,
        {
          receipt,
          transactionHash: TX_HASH_1,
          chainId: CHAIN_ID,
          registryAddress: REGISTRY_ADDR,
          tokenConfig: TOKEN_CONFIG,
        },
      );

      expect(result2.confirmed).toBe(true);
      expect(result2.status).toBe("confirmed");
      expect(result2.proof?.amountDisplay).toBe("100");
    });

    it("rejects confirmation if destination contract does not match settlement registry", async () => {
      const receipt = createReceiptFixture({
        destination: "0x3333333333333333333333333333333333333333",
      });

      await expect(
        service.confirmSettlement(WS_ID, EXPENSE_ID, authContext, {
          receipt,
          transactionHash: TX_HASH_1,
          chainId: CHAIN_ID,
          registryAddress: REGISTRY_ADDR,
          tokenConfig: TOKEN_CONFIG,
        }),
      ).rejects.toThrow(SettlementPreConditionError);
    });

    it("rejects confirmation if recipient in SettlementRecorded does not match expected", async () => {
      const receipt = createReceiptFixture({
        recipient: "0x8888888888888888888888888888888888888888",
      });

      await expect(
        service.confirmSettlement(WS_ID, EXPENSE_ID, authContext, {
          receipt,
          transactionHash: TX_HASH_1,
          chainId: CHAIN_ID,
          registryAddress: REGISTRY_ADDR,
          tokenConfig: TOKEN_CONFIG,
        }),
      ).rejects.toThrow(/RECEIPT_VALIDATION_FAILED/);
    });

    it("rejects confirmation if amount in SettlementRecorded does not match expected", async () => {
      const receipt = createReceiptFixture({
        amount: 50_000_000n, // 50 USDC instead of 100 USDC
      });

      await expect(
        service.confirmSettlement(WS_ID, EXPENSE_ID, authContext, {
          receipt,
          transactionHash: TX_HASH_1,
          chainId: CHAIN_ID,
          registryAddress: REGISTRY_ADDR,
          tokenConfig: TOKEN_CONFIG,
        }),
      ).rejects.toThrow(/RECEIPT_VALIDATION_FAILED/);
    });

    it("rejects confirmation if ERC-20 Transfer log is missing", async () => {
      const receipt = createReceiptFixture({
        includeTransferLog: false,
      });

      await expect(
        service.confirmSettlement(WS_ID, EXPENSE_ID, authContext, {
          receipt,
          transactionHash: TX_HASH_1,
          chainId: CHAIN_ID,
          registryAddress: REGISTRY_ADDR,
          tokenConfig: TOKEN_CONFIG,
        }),
      ).rejects.toThrow(/RECEIPT_VALIDATION_FAILED/);
    });

    it("fails with 401 when wallet confirmation is expired", async () => {
      const expiredAuth = makeAuthContext(TREASURY_OPERATOR, 60); // 60 min ago
      const receipt = createReceiptFixture();

      await expect(
        service.confirmSettlement(WS_ID, EXPENSE_ID, expiredAuth, {
          receipt,
          transactionHash: TX_HASH_1,
          chainId: CHAIN_ID,
          registryAddress: REGISTRY_ADDR,
          tokenConfig: TOKEN_CONFIG,
        }),
      ).rejects.toThrow(/wallet confirmation/i);
    });

    it("fails with 403 when actor does not have TREASURY_ROLE", async () => {
      const nonTreasuryAuth = makeAuthContext("0xnon-treasury", 0);
      db.memberships.push({
        membership_id: "m-2",
        workspace_id: WS_ID,
        user_id: "u-2",
        address: "0xnon-treasury",
        status: "active",
      });
      const receipt = createReceiptFixture();

      await expect(
        service.confirmSettlement(WS_ID, EXPENSE_ID, nonTreasuryAuth, {
          receipt,
          transactionHash: TX_HASH_1,
          chainId: CHAIN_ID,
          registryAddress: REGISTRY_ADDR,
          tokenConfig: TOKEN_CONFIG,
        }),
      ).rejects.toThrow(/TREASURY_ROLE/i);
    });
  });

  describe("getSettlementStatus", () => {
    it("returns submitted status when pending confirmation", async () => {
      const status = await service.getSettlementStatus(
        WS_ID,
        EXPENSE_ID,
        authContext,
        CHAIN_ID,
        6,
      );

      expect(status.status).toBe("submitted");
      expect(status.canRetry).toBe(false);
      expect(status.proof).toBeNull();
      expect(status.attempts.length).toBe(1);
      expect(status.attempts[0]?.transactionHash).toBe(TX_HASH_1);
    });

    it("returns failed status with canRetry = true when last attempt failed", async () => {
      db.reimbursements[0]!.status = "failed";

      const status = await service.getSettlementStatus(
        WS_ID,
        EXPENSE_ID,
        authContext,
        CHAIN_ID,
        6,
      );

      expect(status.status).toBe("failed");
      expect(status.canRetry).toBe(true);
      expect(status.proof).toBeNull();
    });

    it("returns confirmed status with proof when confirmed onchain", async () => {
      db.reimbursements[0]!.status = "confirmed";
      db.reimbursements[0]!.settled_at = new Date().toISOString();
      db.projectionSettlements.push({
        workspace_id: WS_ID,
        expense_id: EXPENSE_ID,
        version: 1,
        commitment: COMMITMENT_V1,
        token: USDC_ADDR,
        recipient: RECIPIENT_ADDR,
        amount: AMOUNT_BASE_UNITS.toString(),
        payment_reference: PAYMENT_REF,
        settled_at_block: "123456",
        settled_at_tx: TX_HASH_1,
        indexed_at: new Date().toISOString(),
      });

      const status = await service.getSettlementStatus(
        WS_ID,
        EXPENSE_ID,
        authContext,
        CHAIN_ID,
        6,
      );

      expect(status.status).toBe("confirmed");
      expect(status.canRetry).toBe(false);
      expect(status.proof).toBeDefined();
      expect(status.proof?.amountDisplay).toBe("100");
      expect(status.proof?.blockNumber).toBe("123456");
    });
  });

  describe("retryFailedReimbursement", () => {
    it("allows retry when previous attempt is failed", async () => {
      db.reimbursements[0]!.status = "failed";

      const retryResult = await service.retryFailedReimbursement(
        WS_ID,
        EXPENSE_ID,
        authContext,
      );

      expect(retryResult.success).toBe(true);
      expect(retryResult.expenseId).toBe(EXPENSE_ID);
      expect(retryResult.version).toBe(1);

      // Status marked cancelled so next attempt can proceed
      expect(db.reimbursements[0]!.status).toBe("cancelled");

      const audit = db.auditEvents.find(
        (a) => a.event_type === "reimbursement_retry_reset",
      );
      expect(audit).toBeDefined();
    });

    it("blocks retry when reimbursement is already confirmed (duplicate guard)", async () => {
      db.reimbursements[0]!.status = "confirmed";

      await expect(
        service.retryFailedReimbursement(WS_ID, EXPENSE_ID, authContext),
      ).rejects.toThrow(/DUPLICATE_SETTLEMENT/);
    });

    it("blocks retry when reimbursement is actively submitted / in progress", async () => {
      db.reimbursements[0]!.status = "submitted";

      await expect(
        service.retryFailedReimbursement(WS_ID, EXPENSE_ID, authContext),
      ).rejects.toThrow(/PENDING_SETTLEMENT/);
    });
  });

  describe("handleReorgRetraction", () => {
    it("retracts confirmed settlement upon reorg detection", async () => {
      db.reimbursements[0]!.status = "confirmed";
      db.projectionSettlements.push({
        workspace_id: WS_ID,
        expense_id: EXPENSE_ID,
        version: 1,
        commitment: COMMITMENT_V1,
        token: USDC_ADDR,
        recipient: RECIPIENT_ADDR,
        amount: AMOUNT_BASE_UNITS.toString(),
        payment_reference: PAYMENT_REF,
        settled_at_block: "123456",
        settled_at_tx: TX_HASH_1,
        indexed_at: new Date().toISOString(),
      });

      await service.handleReorgRetraction(
        WS_ID,
        EXPENSE_ID,
        1,
        TX_HASH_1,
        CHAIN_ID,
      );

      // Reimbursement reverted to failed
      expect(db.reimbursements[0]!.status).toBe("failed");
      expect(db.reimbursements[0]!.settled_at).toBeNull();

      // Chain transaction marked reorged
      expect(db.chainTransactions[0]!.status).toBe("reorged");

      // Projection deleted
      expect(db.projectionSettlements.length).toBe(0);

      // Audit event logged
      const audit = db.auditEvents.find(
        (a) => a.event_type === "reimbursement_reorg_retracted",
      );
      expect(audit).toBeDefined();
    });
  });
});
