import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { DatabaseClient, QueryResult } from "@clario/database";
import { ROLE_IDENTIFIERS } from "@clario/protocol";
import { GLOBAL_SCOPE } from "@/lib/auth/policy";
import { GET as getReviewQueueHandler } from "@/app/api/workspaces/[workspaceId]/reviews/route";
import { GET as getReviewDetailHandler } from "@/app/api/workspaces/[workspaceId]/expenses/[expenseId]/review/route";
import { setDatabaseClient } from "@/lib/db";
import { ExpenseService } from "@/lib/expense/service";
import {
  createSessionPayload,
  signSessionToken,
  serializeSessionCookie,
} from "@/lib/auth/session";
import { getSessionSecret } from "@/lib/auth/context";

class MockDbForReviewRoutes implements DatabaseClient {
  workspaces: Array<{
    workspace_id: string;
    name: string;
    created_by: string;
  }> = [];

  memberships: Array<{
    membership_id: string;
    workspace_id: string;
    user_id: string;
    address: string;
    status: "active" | "suspended" | "revoked";
  }> = [];

  roleGrants: Array<{
    grant_id: string;
    workspace_id: string;
    address: string;
    role: string;
    scope: string;
    revoked_at: Date | null;
  }> = [];

  expenses: Array<{
    workspace_id: string;
    expense_id: string;
    created_by: string;
    current_version: number;
    created_at: string;
    updated_at: string;
  }> = [];

  expenseVersions: Array<{
    workspace_id: string;
    expense_id: string;
    version: number;
    status: string;
    commitment: string;
    predecessor_commitment: string | null;
    manifest_hash: string | null;
    record_ciphertext: string;
    salt_ciphertext: string;
    submitted_at: string | null;
    amount: string;
    currency: string;
    recipient: string;
  }> = [];

  evidenceObjects: Array<{
    evidence_id: string;
    workspace_id: string;
    expense_id: string;
    version: number;
    original_filename: string;
    mime_type: string;
    byte_size: number;
    sha256_hash: string;
  }> = [];

  sourceTransactions: Array<{
    workspace_id: string;
    expense_id: string;
    source_chain_id: number;
    source_transaction_hash: string;
    status: string;
  }> = [];

  decisions: Array<{
    workspace_id: string;
    expense_id: string;
    version: number;
    decision_type: "approve" | "reject" | "request_changes";
    reviewer_address: string;
    recorded_at: string;
    reason_commitment: string | null;
  }> = [];

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
      return { rows: [], rowCount: 0 };
    }

    // Workspaces
    if (sql.includes("FROM workspaces WHERE workspace_id = $1")) {
      const rows = this.workspaces.filter(
        (w) => w.workspace_id === params[0],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Memberships
    if (sql.includes("FROM memberships")) {
      const rows = this.memberships.filter(
        (m) =>
          m.workspace_id === params[0] &&
          (m.user_id === params[1] ||
            m.address.toLowerCase() === String(params[2] ?? "").toLowerCase()),
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Role Grants
    if (sql.includes("FROM role_grants")) {
      const rows = this.roleGrants.filter(
        (rg) =>
          rg.workspace_id === params[0] &&
          rg.address.toLowerCase() === (params[1] as string)?.toLowerCase() &&
          rg.revoked_at === null,
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Expenses: SELECT workspace_id, expense_id, created_by, current_version FROM expenses
    if (
      sql.includes(
        "SELECT expense_id, workspace_id, created_by, current_version, created_at, updated_at",
      ) ||
      sql.includes(
        "SELECT workspace_id, expense_id, created_by, current_version",
      )
    ) {
      const rows = this.expenses.filter(
        (e) => e.workspace_id === params[0] && e.expense_id === params[1],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Insert into expenses
    if (sql.includes("INSERT INTO expenses")) {
      const now = new Date().toISOString();
      this.expenses.push({
        workspace_id: params[0] as string,
        expense_id: params[1] as string,
        created_by: params[2] as string,
        current_version: (params[3] as number) ?? 1,
        created_at: now,
        updated_at: now,
      });
      return { rows: [], rowCount: 1 };
    }

    // Update expenses current_version
    if (sql.includes("UPDATE expenses SET current_version = $1")) {
      const exp = this.expenses.find(
        (e) => e.workspace_id === params[1] && e.expense_id === params[2],
      );
      if (exp) {
        exp.current_version = params[0] as number;
        exp.updated_at = new Date().toISOString();
      }
      return { rows: [], rowCount: exp ? 1 : 0 };
    }

    // Update expenses updated_at
    if (sql.includes("UPDATE expenses SET updated_at = NOW()")) {
      const exp = this.expenses.find(
        (e) => e.workspace_id === params[0] && e.expense_id === params[1],
      );
      if (exp) {
        exp.updated_at = new Date().toISOString();
      }
      return { rows: [], rowCount: exp ? 1 : 0 };
    }

    // Insert into expense_versions
    if (sql.includes("INSERT INTO expense_versions")) {
      this.expenseVersions.push({
        workspace_id: params[0] as string,
        expense_id: params[1] as string,
        version: params[2] as number,
        predecessor_commitment: null,
        commitment: (params[3] as string) || "0x" + "00".repeat(32),
        manifest_hash: null,
        salt_ciphertext: params[4] as string,
        record_ciphertext: params[5] as string,
        amount: params[6] as string,
        currency: params[7] as string,
        recipient: params[8] as string,
        status: "draft",
        submitted_at: null,
      });
      return { rows: [], rowCount: 1 };
    }

    // Draft query for submission
    if (
      sql.includes(
        "FROM expense_versions WHERE workspace_id = $1 AND expense_id = $2 AND status = 'draft'",
      )
    ) {
      const rows = this.expenseVersions.filter(
        (v) =>
          v.workspace_id === params[0] &&
          v.expense_id === params[1] &&
          v.status === "draft",
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Review Queue query
    if (
      sql.includes("FROM expenses e") &&
      sql.includes("JOIN expense_versions ev")
    ) {
      const rows: Array<Record<string, unknown>> = [];
      for (const e of this.expenses) {
        if (e.workspace_id !== params[0]) continue;
        const ev = this.expenseVersions.find(
          (v) =>
            v.workspace_id === e.workspace_id &&
            v.expense_id === e.expense_id &&
            v.version === e.current_version &&
            v.status !== "draft",
        );
        if (!ev) continue;

        const evidenceCount = this.evidenceObjects.filter(
          (eo) =>
            eo.workspace_id === e.workspace_id &&
            eo.expense_id === e.expense_id &&
            eo.version === ev.version,
        ).length;

        const st = this.sourceTransactions.find(
          (s) =>
            s.workspace_id === e.workspace_id && s.expense_id === e.expense_id,
        );

        const d = this.decisions.find(
          (dec) =>
            dec.workspace_id === e.workspace_id &&
            dec.expense_id === e.expense_id &&
            dec.version === ev.version,
        );

        rows.push({
          expense_id: e.expense_id,
          workspace_id: e.workspace_id,
          created_by: e.created_by,
          current_version: e.current_version,
          created_at: e.created_at,
          updated_at: e.updated_at,
          version: ev.version,
          status: ev.status,
          commitment: ev.commitment,
          predecessor_commitment: ev.predecessor_commitment,
          manifest_hash: ev.manifest_hash,
          record_ciphertext: ev.record_ciphertext,
          submitted_at: ev.submitted_at,
          amount: ev.amount,
          currency: ev.currency,
          recipient: ev.recipient,
          evidence_count: String(evidenceCount),
          source_chain_id: st ? st.source_chain_id : null,
          source_transaction_hash: st ? st.source_transaction_hash : null,
          source_status: st ? st.status : null,
          decision_type: d ? d.decision_type : null,
          reviewer_address: d ? d.reviewer_address : null,
          decision_recorded_at: d ? d.recorded_at : null,
          reason_commitment: d ? d.reason_commitment : null,
        });
      }
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    // Expense Versions by version
    if (sql.includes("FROM expense_versions") && sql.includes("version = $3")) {
      const rows = this.expenseVersions.filter(
        (v) =>
          v.workspace_id === params[0] &&
          v.expense_id === params[1] &&
          v.version === params[2],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Evidence Objects by version
    if (sql.includes("FROM evidence_objects") && sql.includes("version = $3")) {
      const rows = this.evidenceObjects.filter(
        (eo) =>
          eo.workspace_id === params[0] &&
          eo.expense_id === params[1] &&
          eo.version === params[2],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Source transactions
    if (
      sql.includes("FROM source_transactions") &&
      sql.includes("expense_id = $2")
    ) {
      const rows = this.sourceTransactions.filter(
        (st) => st.workspace_id === params[0] && st.expense_id === params[1],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Decisions by version
    if (sql.includes("FROM decisions") && sql.includes("version = $3")) {
      const rows = this.decisions.filter(
        (d) =>
          d.workspace_id === params[0] &&
          d.expense_id === params[1] &&
          d.version === params[2],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    return { rows: [], rowCount: 0 };
  }
}

describe("Review API Route Handlers", () => {
  let mockDb: MockDbForReviewRoutes;
  const secret = getSessionSecret();

  const workspaceId = "0x" + "11".repeat(32);
  const ownerAddress = "0x1111111111111111111111111111111111111111";
  const approverAddress = "0x2222222222222222222222222222222222222222";
  const submitterAddress = "0x3333333333333333333333333333333333333333";

  let approverAuthCookie: string;
  let submitterAuthCookie: string;

  beforeEach(async () => {
    mockDb = new MockDbForReviewRoutes();
    setDatabaseClient(mockDb);

    mockDb.workspaces.push({
      workspace_id: workspaceId,
      name: "Engineering DAO",
      created_by: ownerAddress,
    });

    mockDb.memberships.push(
      {
        membership_id: "mem-owner",
        workspace_id: workspaceId,
        user_id: "usr-owner",
        address: ownerAddress,
        status: "active",
      },
      {
        membership_id: "mem-approver",
        workspace_id: workspaceId,
        user_id: "usr-approver",
        address: approverAddress,
        status: "active",
      },
      {
        membership_id: "mem-submitter",
        workspace_id: workspaceId,
        user_id: "usr-submitter",
        address: submitterAddress,
        status: "active",
      },
    );

    mockDb.roleGrants.push({
      grant_id: "rg-approver",
      workspace_id: workspaceId,
      address: approverAddress,
      role: ROLE_IDENTIFIERS.APPROVER_ROLE,
      scope: GLOBAL_SCOPE,
      revoked_at: null,
    });

    // Setup sessions
    const approverSession = createSessionPayload({
      userId: "usr-approver",
      address: approverAddress,
    });
    approverAuthCookie = serializeSessionCookie(
      signSessionToken(approverSession, secret),
      { secure: false },
    );

    const submitterSession = createSessionPayload({
      userId: "usr-submitter",
      address: submitterAddress,
    });
    submitterAuthCookie = serializeSessionCookie(
      signSessionToken(submitterSession, secret),
      { secure: false },
    );

    // Create a submitted expense via ExpenseService
    const expenseService = new ExpenseService(mockDb);
    const draft = await expenseService.createDraft({
      workspaceId,
      payload: {
        title: "Developer Workstation",
        businessPurpose: "Hardware for new core engineer",
        category: "equipment",
        project: "engineering",
        merchant: "Apple Store",
        claimAmount: "2500.00",
        claimAsset: "0x0000000000000000000000000000000000001001",
        recipient: submitterAddress,
        paymentSource: "manual",
      },
      context: {
        userId: "usr-submitter",
        address: submitterAddress,
        session: submitterSession,
      },
    });

    // Mark as submitted
    const exp = mockDb.expenses.find((e) => e.expense_id === draft.expenseId);
    if (exp) {
      exp.current_version = 1;
    }
    const existingV1 = mockDb.expenseVersions.find(
      (v) =>
        v.workspace_id === workspaceId &&
        v.expense_id === draft.expenseId &&
        v.version === 1,
    );
    if (existingV1) {
      existingV1.status = "submitted";
      existingV1.commitment = "0x" + "aa".repeat(32);
      existingV1.predecessor_commitment = "0x" + "00".repeat(32);
      existingV1.manifest_hash = "0x" + "bb".repeat(32);
      existingV1.submitted_at = new Date().toISOString().slice(0, 19) + "Z";
    }
  });

  afterEach(() => {
    setDatabaseClient(null as unknown as DatabaseClient);
  });

  describe("GET /api/workspaces/[workspaceId]/reviews", () => {
    it("returns 401 when request is unauthenticated", async () => {
      const req = new Request(
        `http://localhost/api/workspaces/${workspaceId}/reviews`,
      );
      const res = await getReviewQueueHandler(req, {
        params: Promise.resolve({ workspaceId }),
      });
      expect(res.status).toBe(401);
    });

    it("returns 403 when user has only SUBMITTER_ROLE", async () => {
      const req = new Request(
        `http://localhost/api/workspaces/${workspaceId}/reviews`,
        {
          headers: { cookie: submitterAuthCookie },
        },
      );
      const res = await getReviewQueueHandler(req, {
        params: Promise.resolve({ workspaceId }),
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error?.code).toBe("UNAUTHORIZED");
    });

    it("returns 200 with queue items when user is an authorized approver", async () => {
      const req = new Request(
        `http://localhost/api/workspaces/${workspaceId}/reviews`,
        {
          headers: { cookie: approverAuthCookie },
        },
      );
      const res = await getReviewQueueHandler(req, {
        params: Promise.resolve({ workspaceId }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.items.length).toBe(1);
      expect(data.items[0].title).toBe("Developer Workstation");
      expect(data.items[0].canApprove).toBe(true);
      expect(data.reviewerRole.hasApproverRole).toBe(true);
    });
  });

  describe("GET /api/workspaces/[workspaceId]/expenses/[expenseId]/review", () => {
    it("returns 401 when request is unauthenticated", async () => {
      const targetExpenseId = mockDb.expenses[0]!.expense_id;
      const req = new Request(
        `http://localhost/api/workspaces/${workspaceId}/expenses/${targetExpenseId}/review`,
      );
      const res = await getReviewDetailHandler(req, {
        params: Promise.resolve({ workspaceId, expenseId: targetExpenseId }),
      });
      expect(res.status).toBe(401);
    });

    it("returns 200 with full review detail and Proof Spine for approver", async () => {
      const targetExpenseId = mockDb.expenses[0]!.expense_id;
      const req = new Request(
        `http://localhost/api/workspaces/${workspaceId}/expenses/${targetExpenseId}/review`,
        {
          headers: { cookie: approverAuthCookie },
        },
      );
      const res = await getReviewDetailHandler(req, {
        params: Promise.resolve({ workspaceId, expenseId: targetExpenseId }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.review.title).toBe("Developer Workstation");
      expect(data.review.isCurrentVersion).toBe(true);
      expect(data.review.proofSpine.length).toBe(4);
    });
  });
});
