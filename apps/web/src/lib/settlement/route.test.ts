/**
 * Settlement API Route Integration Tests (SET-001)
 *
 * Tests the HTTP route handlers for:
 * 1. GET  /api/workspaces/[workspaceId]/settlement/queue
 * 2. POST /api/workspaces/[workspaceId]/expenses/[expenseId]/settlement/prepare
 * 3. POST /api/workspaces/[workspaceId]/expenses/[expenseId]/settlement/reconcile
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { DatabaseClient, QueryResult } from "@clario/database";
import { GET as queueHandler } from "@/app/api/workspaces/[workspaceId]/settlement/queue/route";
import { POST as prepareHandler } from "@/app/api/workspaces/[workspaceId]/expenses/[expenseId]/settlement/prepare/route";
import { POST as reconcileHandler } from "@/app/api/workspaces/[workspaceId]/expenses/[expenseId]/settlement/reconcile/route";
import { POST as confirmHandler } from "@/app/api/workspaces/[workspaceId]/expenses/[expenseId]/settlement/confirm/route";
import { GET as statusHandler } from "@/app/api/workspaces/[workspaceId]/expenses/[expenseId]/settlement/status/route";
import { POST as retryHandler } from "@/app/api/workspaces/[workspaceId]/expenses/[expenseId]/settlement/retry/route";
import { encodeEventTopics, encodeAbiParameters } from "viem";
import { SETTLEMENT_REGISTRY_ABI } from "./calldata";
import {
  ERC20_TRANSFER_EVENT_ABI,
  type MinimalTransactionReceipt,
} from "./receipt";
import { setDatabaseClient } from "@/lib/db";
import { setSettlementConfigForTesting } from "@/lib/settlement/config";
import {
  createSessionPayload,
  signSessionToken,
  serializeSessionCookie,
} from "@/lib/auth/session";
import { getSessionSecret } from "@/lib/auth/context";

const WS_ID = "0x" + "aa".repeat(32);
const EXP_ID = "0x" + "bb".repeat(32);
const COMMITMENT = "0x" + "cc".repeat(32);
const TX_HASH = "0x" + "dd".repeat(32);
const TREASURY_ADDR = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const UNAUTHORIZED_ADDR = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const RECIPIENT = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const TREASURY_ROLE_HASH =
  "0xe1dcbdb91df27212a29bc27177c840cf2f819ecf2187432e1fac86c2dd5dfca9";

class RouteMockDb implements DatabaseClient {
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
    metadata?: string | undefined;
    created_at: string;
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

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    const s = sql.replace(/\s+/g, " ").trim();

    if (s === "BEGIN" || s === "COMMIT" || s === "ROLLBACK") {
      return { rows: [], rowCount: 0 };
    }

    if (s.includes("FROM workspaces WHERE workspace_id = $1")) {
      const rows = this.workspaces.filter(
        (w) => w.workspace_id === params[0],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    if (
      s.includes("FROM memberships") &&
      s.includes("workspace_id = $1") &&
      s.includes("address = $2")
    ) {
      const rows = this.memberships.filter(
        (m) =>
          m.workspace_id === params[0] &&
          m.address.toLowerCase() === String(params[1]).toLowerCase() &&
          m.status === "active",
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    if (s.includes("FROM role_grants")) {
      const addr = String(params[1]).toLowerCase();
      const rows = this.roleGrants.filter(
        (r) =>
          r.workspace_id === params[0] &&
          r.address.toLowerCase() === addr &&
          r.revoked_at === null,
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    if (
      s.includes("FROM expense_versions ev") &&
      s.includes("WHERE ev.workspace_id = $1")
    ) {
      const rows = this.expenseVersions
        .filter(
          (ev) => ev.workspace_id === params[0] && ev.status === "submitted",
        )
        .map((ev) => {
          const dec = this.decisions.find(
            (d) =>
              d.workspace_id === ev.workspace_id &&
              d.expense_id === ev.expense_id &&
              d.version === ev.version,
          );
          const reimb = this.reimbursements.find(
            (r) =>
              r.workspace_id === ev.workspace_id &&
              r.expense_id === ev.expense_id &&
              r.version === ev.version,
          );
          return {
            expense_id: ev.expense_id,
            workspace_id: ev.workspace_id,
            version: ev.version,
            commitment: ev.commitment,
            amount: ev.amount,
            currency: ev.currency,
            recipient: ev.recipient,
            decision_type: dec?.decision_type ?? null,
            reviewer_address: dec?.reviewer_address ?? null,
            recorded_at: dec?.recorded_at ?? null,
            reimbursement_status: reimb?.status ?? null,
          };
        })
        .filter((r) => r.decision_type === "approve") as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    if (
      s.includes("FROM expense_versions") &&
      s.includes("workspace_id = $1") &&
      s.includes("expense_id = $2") &&
      s.includes("version = $3")
    ) {
      const rows = this.expenseVersions
        .filter(
          (ev) =>
            ev.workspace_id === params[0] &&
            ev.expense_id === params[1] &&
            ev.version === Number(params[2]),
        )
        .map((ev) => ({
          workspace_id: ev.workspace_id,
          expense_id: ev.expense_id,
          version: ev.version,
          commitment: ev.commitment,
          previous_commitment: ev.previous_commitment,
          amount: ev.amount,
          currency: ev.currency,
          recipient: ev.recipient,
          status: ev.status,
        })) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    if (
      s.includes("FROM expenses WHERE workspace_id = $1 AND expense_id = $2")
    ) {
      const rows = this.expenses.filter(
        (e) => e.workspace_id === params[0] && e.expense_id === params[1],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    if (s.includes("FROM decisions") && s.includes("workspace_id = $1")) {
      const onlyApprove = s.includes("decision_type = 'approve'");
      const rows = this.decisions.filter(
        (d) =>
          d.workspace_id === params[0] &&
          d.expense_id === params[1] &&
          d.version === Number(params[2]) &&
          (!params[3] || d.commitment === params[3]) &&
          (!onlyApprove || d.decision_type === "approve"),
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    if (s.includes("FROM reimbursements") && s.includes("workspace_id = $1")) {
      const rows = this.reimbursements.filter(
        (r) =>
          r.workspace_id === params[0] &&
          r.expense_id === params[1] &&
          r.version === Number(params[2]),
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    if (s.includes("INSERT INTO reimbursements")) {
      const newReimb = {
        reimbursement_id: String(params[0]),
        workspace_id: String(params[1]),
        expense_id: String(params[2]),
        version: Number(params[3]),
        token_address: String(params[4]),
        recipient_address: RECIPIENT,
        amount: "50000000",
        payment_reference: null,
        transaction_hash: String(params[6]),
        status: "submitted",
        settled_at: null,
        created_at: new Date().toISOString(),
      };
      this.reimbursements.push(newReimb);
      return { rows: [newReimb as unknown as T], rowCount: 1 };
    }

    if (s.includes("INSERT INTO chain_transactions")) {
      this.chainTransactions.push({
        transaction_id: String(params[0]),
        workspace_id: String(params[1]),
        chain_id: Number(params[2]),
        transaction_hash: String(params[3]),
        action: String(params[4]),
        status: String(params[5]),
        submitted_at: new Date().toISOString(),
      });
      return { rows: [], rowCount: 1 };
    }

    if (s.includes("INSERT INTO audit_events")) {
      this.auditEvents.push({
        workspace_id: String(params[0]),
        actor_address: String(params[1]),
        action: String(params[2]),
        resource_type: String(params[3]),
        resource_id: String(params[4]),
        metadata: params[5] ? String(params[5]) : undefined,
        created_at: new Date().toISOString(),
      });
      return { rows: [], rowCount: 1 };
    }

    if (s.includes("FROM projection_settlements")) {
      const rows = this.projectionSettlements.filter(
        (p) =>
          p.workspace_id === params[0] &&
          p.expense_id === params[1] &&
          p.version === Number(params[2]),
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    if (s.includes("FROM chain_transactions")) {
      const hashes = (params[2] as string[]) ?? [];
      const rows = this.chainTransactions.filter(
        (c) =>
          c.workspace_id === params[0] &&
          c.chain_id === Number(params[1]) &&
          hashes.some(
            (h) => h.toLowerCase() === c.transaction_hash.toLowerCase(),
          ),
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    if (s.includes("UPDATE reimbursements")) {
      const statusMatch = s.match(/status = '([^']+)'/);
      const newStatus = statusMatch ? statusMatch[1] : "failed";
      if (s.includes("WHERE reimbursement_id = $1")) {
        const id = String(params[0]);
        const reimb = this.reimbursements.find(
          (r) => r.reimbursement_id === id,
        );
        if (reimb) {
          reimb.status = newStatus!;
        }
      } else if (s.includes("WHERE reimbursement_id = $2")) {
        const hash = String(params[0]);
        const id = String(params[1]);
        const reimb = this.reimbursements.find(
          (r) => r.reimbursement_id === id,
        );
        if (reimb) {
          reimb.status = newStatus!;
          reimb.transaction_hash = hash;
          reimb.settled_at = new Date().toISOString();
        }
      } else if (
        s.includes(
          "WHERE workspace_id = $1 AND expense_id = $2 AND version = $3",
        )
      ) {
        const reimb = this.reimbursements.find(
          (r) =>
            r.workspace_id === params[0] &&
            r.expense_id === params[1] &&
            r.version === Number(params[2]),
        );
        if (reimb) {
          reimb.status = newStatus!;
          reimb.settled_at = null;
        }
      }
      return { rows: [], rowCount: 1 };
    }

    if (s.includes("UPDATE chain_transactions")) {
      const statusMatch = s.match(/status = '([^']+)'/);
      const newStatus = statusMatch ? statusMatch[1] : "failed";
      const hash = String(params[params.length - 1]);
      const ctx = this.chainTransactions.find(
        (c) => c.transaction_hash.toLowerCase() === hash.toLowerCase(),
      );
      if (ctx) {
        ctx.status = newStatus!;
      }
      return { rows: [], rowCount: 1 };
    }

    if (s.includes("INSERT INTO projection_settlements")) {
      const newProj = {
        workspace_id: String(params[0]),
        expense_id: String(params[1]),
        version: Number(params[2]),
        commitment: String(params[3]),
        token: String(params[4]),
        recipient: String(params[5]),
        amount: String(params[6]),
        payment_reference: String(params[7]),
        settled_at_block: String(params[8]),
        settled_at_tx: String(params[9]),
        indexed_at: new Date().toISOString(),
      };
      this.projectionSettlements.push(newProj);
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }
}

function makeAuth(
  address: string,
  confirmedAgoMinutes = 0,
): { cookie: string; csrfToken: string } {
  const secret = getSessionSecret();
  const now = Date.now();
  const lastConfirmedAt = now - confirmedAgoMinutes * 60 * 1000;
  const payload = createSessionPayload({
    userId: "u-1",
    address,
    lastConfirmedAt,
  });
  const token = signSessionToken(payload, secret);
  return {
    cookie: serializeSessionCookie(token),
    csrfToken: payload.csrfToken,
  };
}

describe("Settlement API Routes (SET-001)", () => {
  let db: RouteMockDb;

  beforeEach(() => {
    setSettlementConfigForTesting({
      token: {
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        decimals: 6,
        symbol: "USDC",
      },
      registryAddress: "0x1234567890123456789012345678901234567890",
      chainId: 10143,
      isFromManifest: true,
    });

    db = new RouteMockDb();
    setDatabaseClient(db);

    db.workspaces.push({ workspace_id: WS_ID, created_by: TREASURY_ADDR });
    db.memberships.push({
      membership_id: "m-1",
      workspace_id: WS_ID,
      user_id: "u-1",
      address: TREASURY_ADDR,
      status: "active",
    });
    db.roleGrants.push({
      workspace_id: WS_ID,
      address: TREASURY_ADDR,
      role: TREASURY_ROLE_HASH,
      scope: "workspace",
      revoked_at: null,
    });

    db.expenses.push({
      workspace_id: WS_ID,
      expense_id: EXP_ID,
      created_by: "0x9999999999999999999999999999999999999999",
      current_version: 1,
    });
    db.expenseVersions.push({
      workspace_id: WS_ID,
      expense_id: EXP_ID,
      version: 1,
      commitment: COMMITMENT,
      previous_commitment: null,
      amount: "50000000",
      currency: "USDC",
      recipient: RECIPIENT,
      status: "submitted",
    });
    db.decisions.push({
      workspace_id: WS_ID,
      expense_id: EXP_ID,
      version: 1,
      commitment: COMMITMENT,
      decision_type: "approve",
      reviewer_address: "0x4444444444444444444444444444444444444444",
      recorded_at: new Date().toISOString(),
    });
  });

  afterEach(() => {
    setSettlementConfigForTesting(null);
  });

  describe("GET /api/workspaces/[workspaceId]/settlement/queue", () => {
    it("rejects unauthenticated request with 401", async () => {
      const req = new Request(
        `http://localhost/api/workspaces/${WS_ID}/settlement/queue`,
        {
          method: "GET",
        },
      );
      const res = await queueHandler(req, {
        params: Promise.resolve({ workspaceId: WS_ID }),
      });
      expect(res.status).toBe(401);
    });

    it("rejects unauthorized address without TREASURY_ROLE with 401/403", async () => {
      const { cookie } = makeAuth(UNAUTHORIZED_ADDR, 1);
      const req = new Request(
        `http://localhost/api/workspaces/${WS_ID}/settlement/queue`,
        {
          method: "GET",
          headers: { cookie },
        },
      );
      const res = await queueHandler(req, {
        params: Promise.resolve({ workspaceId: WS_ID }),
      });
      expect([401, 403]).toContain(res.status);
    });

    it("returns the queue for authorized treasury member", async () => {
      const { cookie } = makeAuth(TREASURY_ADDR, 1);
      const req = new Request(
        `http://localhost/api/workspaces/${WS_ID}/settlement/queue`,
        {
          method: "GET",
          headers: { cookie },
        },
      );
      const res = await queueHandler(req, {
        params: Promise.resolve({ workspaceId: WS_ID }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.workspaceId).toBe(WS_ID);
      expect(data.total).toBe(1);
      expect(data.items[0].expenseId).toBe(EXP_ID);
      expect(data.items[0].amountDisplay).toBe("50");
    });
  });

  describe("POST /api/workspaces/[workspaceId]/expenses/[expenseId]/settlement/prepare", () => {
    it("rejects unauthenticated prepare request with 401", async () => {
      const req = new Request(
        `http://localhost/api/workspaces/${WS_ID}/expenses/${EXP_ID}/settlement/prepare`,
        { method: "POST", body: JSON.stringify({}) },
      );
      const res = await prepareHandler(req, {
        params: Promise.resolve({ workspaceId: WS_ID, expenseId: EXP_ID }),
      });
      expect(res.status).toBe(401);
    });

    it("rejects stale wallet confirmation (> 15m) with 401", async () => {
      const { cookie, csrfToken } = makeAuth(TREASURY_ADDR, 20); // 20 min ago
      const req = new Request(
        `http://localhost/api/workspaces/${WS_ID}/expenses/${EXP_ID}/settlement/prepare`,
        {
          method: "POST",
          headers: {
            cookie,
            "x-csrf-token": csrfToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      const res = await prepareHandler(req, {
        params: Promise.resolve({ workspaceId: WS_ID, expenseId: EXP_ID }),
      });
      expect(res.status).toBe(401);
    });

    it("prepares valid calldata and intent for approved expense", async () => {
      const { cookie, csrfToken } = makeAuth(TREASURY_ADDR, 2);
      const req = new Request(
        `http://localhost/api/workspaces/${WS_ID}/expenses/${EXP_ID}/settlement/prepare`,
        {
          method: "POST",
          headers: {
            cookie,
            "x-csrf-token": csrfToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      const res = await prepareHandler(req, {
        params: Promise.resolve({ workspaceId: WS_ID, expenseId: EXP_ID }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.prepared.expenseId).toBe(EXP_ID);
      expect(data.prepared.calldata).toMatch(/^0x/);
      expect(data.prepared.intent.recipient.toLowerCase()).toBe(
        RECIPIENT.toLowerCase(),
      );
      expect(data.prepared.amountDisplay).toBe("50");
    });

    it("returns 404 if expense does not exist", async () => {
      const { cookie, csrfToken } = makeAuth(TREASURY_ADDR, 2);
      const req = new Request(
        `http://localhost/api/workspaces/${WS_ID}/expenses/0x${"99".repeat(32)}/settlement/prepare`,
        {
          method: "POST",
          headers: {
            cookie,
            "x-csrf-token": csrfToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      const res = await prepareHandler(req, {
        params: Promise.resolve({
          workspaceId: WS_ID,
          expenseId: "0x" + "99".repeat(32),
        }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 422 if expense was rejected instead of approved", async () => {
      db.decisions[0]!.decision_type = "reject";
      const { cookie, csrfToken } = makeAuth(TREASURY_ADDR, 2);
      const req = new Request(
        `http://localhost/api/workspaces/${WS_ID}/expenses/${EXP_ID}/settlement/prepare`,
        {
          method: "POST",
          headers: {
            cookie,
            "x-csrf-token": csrfToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      const res = await prepareHandler(req, {
        params: Promise.resolve({ workspaceId: WS_ID, expenseId: EXP_ID }),
      });
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.error.code).toBe("APPROVAL_REQUIRED");
    });

    it("returns 422 if treasury balance is insufficient", async () => {
      const { cookie, csrfToken } = makeAuth(TREASURY_ADDR, 2);
      const req = new Request(
        `http://localhost/api/workspaces/${WS_ID}/expenses/${EXP_ID}/settlement/prepare`,
        {
          method: "POST",
          headers: {
            cookie,
            "x-csrf-token": csrfToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ treasuryBalance: "100" }), // amount is 50000000 base units ($50)
        },
      );
      const res = await prepareHandler(req, {
        params: Promise.resolve({ workspaceId: WS_ID, expenseId: EXP_ID }),
      });
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.error.code).toBe("INSUFFICIENT_BALANCE");
    });

    it("evaluates needsApproval false when sufficient allowance is provided", async () => {
      const { cookie, csrfToken } = makeAuth(TREASURY_ADDR, 2);
      const req = new Request(
        `http://localhost/api/workspaces/${WS_ID}/expenses/${EXP_ID}/settlement/prepare`,
        {
          method: "POST",
          headers: {
            cookie,
            "x-csrf-token": csrfToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ treasuryAllowance: "100000000" }), // greater than $50
        },
      );
      const res = await prepareHandler(req, {
        params: Promise.resolve({ workspaceId: WS_ID, expenseId: EXP_ID }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.prepared.needsApproval).toBe(false);
      expect(data.prepared.approveCalldata).toBeNull();
    });

    it("returns 422 if settlement configuration is missing", async () => {
      setSettlementConfigForTesting(null);
      const { cookie, csrfToken } = makeAuth(TREASURY_ADDR, 1);
      const req = new Request(
        `http://localhost/api/workspaces/${WS_ID}/expenses/${EXP_ID}/settlement/prepare`,
        {
          method: "POST",
          headers: {
            cookie,
            "x-csrf-token": csrfToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      const res = await prepareHandler(req, {
        params: Promise.resolve({ workspaceId: WS_ID, expenseId: EXP_ID }),
      });
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.error.code).toBe("UNCONFIGURED_SETTLEMENT_ASSET");
    });
  });

  describe("POST /api/workspaces/[workspaceId]/expenses/[expenseId]/settlement/reconcile", () => {
    it("validates transactionHash and idempotencyKey format", async () => {
      const { cookie, csrfToken } = makeAuth(TREASURY_ADDR, 2);
      const req = new Request(
        `http://localhost/api/workspaces/${WS_ID}/expenses/${EXP_ID}/settlement/reconcile`,
        {
          method: "POST",
          headers: {
            cookie,
            "x-csrf-token": csrfToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            version: 1,
            commitment: COMMITMENT,
            transactionHash: "not-a-hash",
            idempotencyKey: "key-1",
          }),
        },
      );
      const res = await reconcileHandler(req, {
        params: Promise.resolve({ workspaceId: WS_ID, expenseId: EXP_ID }),
      });
      expect(res.status).toBe(400);
    });

    it("records submitted transaction and returns 200 with submitted status", async () => {
      const { cookie, csrfToken } = makeAuth(TREASURY_ADDR, 2);
      const req = new Request(
        `http://localhost/api/workspaces/${WS_ID}/expenses/${EXP_ID}/settlement/reconcile`,
        {
          method: "POST",
          headers: {
            cookie,
            "x-csrf-token": csrfToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            version: 1,
            commitment: COMMITMENT,
            transactionHash: TX_HASH,
            idempotencyKey: "idemp-key-1",
          }),
        },
      );
      const res = await reconcileHandler(req, {
        params: Promise.resolve({ workspaceId: WS_ID, expenseId: EXP_ID }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.result.status).toBe("submitted");
      expect(data.result.transactionHash).toBe(TX_HASH);

      // Verify db
      expect(db.reimbursements.length).toBe(1);
      expect(db.reimbursements[0]!.status).toBe("submitted");
      expect(db.chainTransactions.length).toBe(1);
    });

    it("returns 422 if settlement configuration is missing", async () => {
      setSettlementConfigForTesting(null);
      const { cookie, csrfToken } = makeAuth(TREASURY_ADDR, 2);
      const req = new Request(
        `http://localhost/api/workspaces/${WS_ID}/expenses/${EXP_ID}/settlement/reconcile`,
        {
          method: "POST",
          headers: {
            cookie,
            "x-csrf-token": csrfToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            version: 1,
            commitment: COMMITMENT,
            transactionHash: TX_HASH,
            idempotencyKey: "idemp-key-missing-cfg",
          }),
        },
      );
      const res = await reconcileHandler(req, {
        params: Promise.resolve({ workspaceId: WS_ID, expenseId: EXP_ID }),
      });
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.error.code).toBe("UNCONFIGURED_SETTLEMENT_ASSET");
    });
  });

  describe("POST /api/workspaces/[workspaceId]/expenses/[expenseId]/settlement/confirm", () => {
    function createValidReceipt(): MinimalTransactionReceipt {
      const settlementTopics = encodeEventTopics({
        abi: SETTLEMENT_REGISTRY_ABI,
        eventName: "SettlementRecorded",
        args: {
          workspaceId: WS_ID as `0x${string}`,
          expenseId: EXP_ID as `0x${string}`,
          version: 1,
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
          COMMITMENT as `0x${string}`,
          "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          RECIPIENT as `0x${string}`,
          50000000n,
          ("0x" + "11".repeat(32)) as `0x${string}`,
        ],
      );

      const transferTopics = encodeEventTopics({
        abi: ERC20_TRANSFER_EVENT_ABI,
        eventName: "Transfer",
        args: {
          from: TREASURY_ADDR as `0x${string}`,
          to: RECIPIENT as `0x${string}`,
        },
      }) as [`0x${string}`, ...`0x${string}`[]];

      const transferData = encodeAbiParameters(
        [{ name: "value", type: "uint256" }],
        [50000000n],
      );

      return {
        status: "success",
        blockNumber: 1000,
        blockHash: "0x" + "ee".repeat(32),
        transactionHash: TX_HASH,
        to: "0x1234567890123456789012345678901234567890",
        from: TREASURY_ADDR,
        logs: [
          {
            address: "0x1234567890123456789012345678901234567890",
            data: settlementData,
            topics: settlementTopics,
            logIndex: 0,
          },
          {
            address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            data: transferData,
            topics: transferTopics,
            logIndex: 1,
          },
        ],
      };
    }

    it("rejects unauthenticated request with 401", async () => {
      const req = new Request(
        `http://localhost/api/workspaces/${WS_ID}/expenses/${EXP_ID}/settlement/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionHash: TX_HASH }),
        },
      );
      const res = await confirmHandler(req, {
        params: Promise.resolve({ workspaceId: WS_ID, expenseId: EXP_ID }),
      });
      expect(res.status).toBe(401);
    });

    it("rejects request missing both receipt and transactionHash with 400", async () => {
      const { cookie, csrfToken } = makeAuth(TREASURY_ADDR, 1);
      const req = new Request(
        `http://localhost/api/workspaces/${WS_ID}/expenses/${EXP_ID}/settlement/confirm`,
        {
          method: "POST",
          headers: {
            cookie,
            "x-csrf-token": csrfToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      const res = await confirmHandler(req, {
        params: Promise.resolve({ workspaceId: WS_ID, expenseId: EXP_ID }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe("INVALID_REQUEST");
    });

    it("successfully confirms settlement and marks confirmed on valid receipt", async () => {
      // Seed submitted reimbursement
      db.reimbursements.push({
        reimbursement_id: "reimb-route-1",
        workspace_id: WS_ID,
        expense_id: EXP_ID,
        version: 1,
        token_address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        recipient_address: RECIPIENT,
        amount: "50000000",
        payment_reference: null,
        transaction_hash: TX_HASH,
        status: "submitted",
        settled_at: null,
        created_at: new Date().toISOString(),
      });
      db.chainTransactions.push({
        transaction_id: "tx-route-1",
        workspace_id: WS_ID,
        chain_id: 10143,
        transaction_hash: TX_HASH,
        action: "reimburse",
        status: "submitted",
        submitted_at: new Date().toISOString(),
      });

      const receipt = createValidReceipt();
      const { cookie, csrfToken } = makeAuth(TREASURY_ADDR, 1);
      const req = new Request(
        `http://localhost/api/workspaces/${WS_ID}/expenses/${EXP_ID}/settlement/confirm`,
        {
          method: "POST",
          headers: {
            cookie,
            "x-csrf-token": csrfToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ receipt, transactionHash: TX_HASH }),
        },
      );
      const res = await confirmHandler(req, {
        params: Promise.resolve({ workspaceId: WS_ID, expenseId: EXP_ID }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.result.confirmed).toBe(true);
      expect(data.result.status).toBe("confirmed");
    });
  });

  describe("GET /api/workspaces/[workspaceId]/expenses/[expenseId]/settlement/status", () => {
    it("returns settlement status and history", async () => {
      db.reimbursements.push({
        reimbursement_id: "reimb-status-1",
        workspace_id: WS_ID,
        expense_id: EXP_ID,
        version: 1,
        token_address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        recipient_address: RECIPIENT,
        amount: "50000000",
        payment_reference: null,
        transaction_hash: TX_HASH,
        status: "submitted",
        settled_at: null,
        created_at: new Date().toISOString(),
      });

      const { cookie } = makeAuth(TREASURY_ADDR, 1);
      const req = new Request(
        `http://localhost/api/workspaces/${WS_ID}/expenses/${EXP_ID}/settlement/status`,
        {
          method: "GET",
          headers: { cookie },
        },
      );
      const res = await statusHandler(req, {
        params: Promise.resolve({ workspaceId: WS_ID, expenseId: EXP_ID }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.result.status).toBe("submitted");
      expect(data.result.attempts.length).toBe(1);
      expect(data.result.canRetry).toBe(false);
    });
  });

  describe("POST /api/workspaces/[workspaceId]/expenses/[expenseId]/settlement/retry", () => {
    it("allows retry when previous attempt failed", async () => {
      db.reimbursements.push({
        reimbursement_id: "reimb-retry-1",
        workspace_id: WS_ID,
        expense_id: EXP_ID,
        version: 1,
        token_address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        recipient_address: RECIPIENT,
        amount: "50000000",
        payment_reference: null,
        transaction_hash: TX_HASH,
        status: "failed",
        settled_at: null,
        created_at: new Date().toISOString(),
      });

      const { cookie, csrfToken } = makeAuth(TREASURY_ADDR, 1);
      const req = new Request(
        `http://localhost/api/workspaces/${WS_ID}/expenses/${EXP_ID}/settlement/retry`,
        {
          method: "POST",
          headers: {
            cookie,
            "x-csrf-token": csrfToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      const res = await retryHandler(req, {
        params: Promise.resolve({ workspaceId: WS_ID, expenseId: EXP_ID }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.result.success).toBe(true);
    });

    it("rejects retry when reimbursement is already confirmed", async () => {
      db.reimbursements.push({
        reimbursement_id: "reimb-confirmed-1",
        workspace_id: WS_ID,
        expense_id: EXP_ID,
        version: 1,
        token_address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        recipient_address: RECIPIENT,
        amount: "50000000",
        payment_reference: null,
        transaction_hash: TX_HASH,
        status: "confirmed",
        settled_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });

      const { cookie, csrfToken } = makeAuth(TREASURY_ADDR, 1);
      const req = new Request(
        `http://localhost/api/workspaces/${WS_ID}/expenses/${EXP_ID}/settlement/retry`,
        {
          method: "POST",
          headers: {
            cookie,
            "x-csrf-token": csrfToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      const res = await retryHandler(req, {
        params: Promise.resolve({ workspaceId: WS_ID, expenseId: EXP_ID }),
      });
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.error.code).toBe("DUPLICATE_SETTLEMENT");
    });
  });
});
