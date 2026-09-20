import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { DatabaseClient, QueryResult } from "@clario/database";
import { POST as prepareHandler } from "@/app/api/workspaces/[workspaceId]/expenses/[expenseId]/submit/prepare/route";
import { POST as reconcileHandler } from "@/app/api/workspaces/[workspaceId]/expenses/[expenseId]/submit/reconcile/route";
import { setDatabaseClient } from "@/lib/db";
import {
  createSessionPayload,
  signSessionToken,
  serializeSessionCookie,
} from "@/lib/auth/session";
import { getSessionSecret } from "@/lib/auth/context";
import { ExpenseService } from "./service";

class MockDbForSubmissionRoutes implements DatabaseClient {
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
    current_version: number | null;
    created_at: string;
    updated_at: string;
  }> = [];

  expenseVersions: Array<{
    workspace_id: string;
    expense_id: string;
    version: number;
    commitment: string;
    previous_commitment: string | null;
    salt_ciphertext: string;
    salt_key_reference: string;
    record_ciphertext: string;
    record_key_reference: string;
    amount: string;
    currency: string;
    recipient: string;
    status: string;
    submitted_by?: string;
    submitted_transaction_hash?: string;
    created_at: string;
  }> = [];

  evidenceObjects: Array<{
    evidence_id: string;
    workspace_id: string;
    expense_id: string;
    version: number;
    storage_key: string;
    sha256_hash: string;
    byte_length: number;
    mime_type: string;
    encryption_metadata: unknown;
    created_at: string;
  }> = [];

  chainTransactions: Array<Record<string, unknown>> = [];
  auditEvents: Array<Record<string, unknown>> = [];

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    const s = sql.replace(/\s+/g, " ").trim();

    if (s === "BEGIN" || s === "COMMIT" || s === "ROLLBACK") {
      return { rows: [], rowCount: 0 };
    }

    // Workspaces
    if (s.includes("FROM workspaces WHERE workspace_id = $1")) {
      const rows = this.workspaces.filter(
        (w) => w.workspace_id === params[0],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Memberships
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

    // Expenses query
    if (
      s.includes("FROM expenses WHERE workspace_id = $1 AND expense_id = $2")
    ) {
      const rows = this.expenses
        .filter(
          (e) => e.workspace_id === params[0] && e.expense_id === params[1],
        )
        .map((e) => ({
          expense_id: e.expense_id,
          workspace_id: e.workspace_id,
          created_by: e.created_by,
          current_version: e.current_version,
        })) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Expenses: SELECT created_at, updated_at
    if (s.includes("SELECT created_at, updated_at FROM expenses")) {
      const rows = this.expenses.filter(
        (e) => e.workspace_id === params[0] && e.expense_id === params[1],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Insert expenses
    if (s.includes("INSERT INTO expenses")) {
      const now = new Date().toISOString();
      this.expenses.push({
        workspace_id: params[0] as string,
        expense_id: params[1] as string,
        created_by: params[2] as string,
        current_version: (params[3] as number) ?? null,
        created_at: now,
        updated_at: now,
      });
      return { rows: [], rowCount: 1 };
    }

    // Update expenses current_version
    if (s.includes("UPDATE expenses SET current_version = $1")) {
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
    if (s.includes("UPDATE expenses SET updated_at = NOW()")) {
      const exp = this.expenses.find(
        (e) => e.workspace_id === params[0] && e.expense_id === params[1],
      );
      if (exp) {
        exp.updated_at = new Date().toISOString();
      }
      return { rows: [], rowCount: exp ? 1 : 0 };
    }

    // Insert expense_versions
    if (s.includes("INSERT INTO expense_versions")) {
      this.expenseVersions.push({
        workspace_id: params[0] as string,
        expense_id: params[1] as string,
        version: params[2] as number,
        commitment: params[3] as string,
        previous_commitment: null,
        salt_ciphertext: params[4] as string,
        salt_key_reference: "kek-v1",
        record_ciphertext: params[5] as string,
        record_key_reference: "kek-v1",
        amount: params[6] as string,
        currency: params[7] as string,
        recipient: params[8] as string,
        status: "draft",
        created_at: new Date().toISOString(),
      });
      return { rows: [], rowCount: 1 };
    }

    // Expense versions draft query for prepare
    if (s.includes("FROM expense_versions") && s.includes("status = 'draft'")) {
      const rows = this.expenseVersions.filter(
        (v) =>
          v.workspace_id === params[0] &&
          v.expense_id === params[1] &&
          v.status === "draft",
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Expense versions latest query for reconcile
    if (
      s.includes("FROM expense_versions") &&
      s.includes("ORDER BY version DESC LIMIT 1")
    ) {
      const filtered = this.expenseVersions
        .filter(
          (v) => v.workspace_id === params[0] && v.expense_id === params[1],
        )
        .sort((a, b) => b.version - a.version);
      const rows = (filtered[0] ? [filtered[0]] : []) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // General expense_versions query
    if (s.includes("FROM expense_versions")) {
      const rows = this.expenseVersions.filter(
        (v) =>
          v.workspace_id === params[0] &&
          v.expense_id === params[1] &&
          v.version === params[2],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Evidence objects query
    if (s.includes("FROM evidence_objects")) {
      const rows = this.evidenceObjects.filter(
        (e) =>
          e.workspace_id === params[0] &&
          e.expense_id === params[1] &&
          e.version === params[2],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Update expense_versions commitment
    if (
      s.includes("UPDATE expense_versions") &&
      s.includes("SET commitment = $1, submitted_by = $2")
    ) {
      const v = this.expenseVersions.find(
        (ev) =>
          ev.workspace_id === params[2] &&
          ev.expense_id === params[3] &&
          ev.version === params[4],
      );
      if (v) {
        v.commitment = String(params[0]);
        v.submitted_by = String(params[1]);
      }
      return { rows: [], rowCount: 1 };
    }

    // Update expense_versions on reconcile
    if (
      s.includes("UPDATE expense_versions") &&
      s.includes("SET status = 'submitted'")
    ) {
      const v = this.expenseVersions.find(
        (ev) =>
          ev.workspace_id === params[2] &&
          ev.expense_id === params[3] &&
          ev.version === params[4],
      );
      if (v) {
        v.status = "submitted";
        v.submitted_by = String(params[0]);
        v.submitted_transaction_hash = String(params[1]);
      }
      return { rows: [], rowCount: 1 };
    }

    // Update expenses current_version
    if (
      s.includes("UPDATE expenses") &&
      s.includes("SET current_version = $1")
    ) {
      const exp = this.expenses.find(
        (e) => e.workspace_id === params[1] && e.expense_id === params[2],
      );
      if (exp) {
        exp.current_version = Number(params[0]);
      }
      return { rows: [], rowCount: 1 };
    }

    // Insert into chain_transactions
    if (s.includes("INSERT INTO chain_transactions")) {
      this.chainTransactions.push({ params });
      return { rows: [], rowCount: 1 };
    }

    // Insert into audit_events
    if (s.includes("INSERT INTO audit_events")) {
      this.auditEvents.push({ params });
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }
}

describe("Expense Submission Route Handlers (EXP-003)", () => {
  let mockDb: MockDbForSubmissionRoutes;
  const workspaceId =
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const userAddress = "0x1111111111111111111111111111111111111111";
  const otherUserAddress = "0x2222222222222222222222222222222222222222";
  const secret = getSessionSecret();

  let authCookie: string;
  let otherAuthCookie: string;
  let validCsrfToken: string;
  let otherCsrfToken: string;
  let validExpenseId: string;

  beforeEach(async () => {
    mockDb = new MockDbForSubmissionRoutes();
    setDatabaseClient(mockDb);

    mockDb.workspaces.push({
      workspace_id: workspaceId,
      name: "Engineering Core",
      created_by: userAddress,
    });

    mockDb.memberships.push({
      membership_id: "mem-001",
      workspace_id: workspaceId,
      user_id: "usr-001",
      address: userAddress,
      status: "active",
    });

    const session = createSessionPayload({
      userId: "usr-001",
      address: userAddress,
    });
    const token = signSessionToken(session, secret);
    authCookie = serializeSessionCookie(token, { secure: false });
    validCsrfToken = session.csrfToken;

    const otherSession = createSessionPayload({
      userId: "usr-002",
      address: otherUserAddress,
    });
    const otherToken = signSessionToken(otherSession, secret);
    otherAuthCookie = serializeSessionCookie(otherToken, { secure: false });
    otherCsrfToken = otherSession.csrfToken;

    // Create a draft expense using ExpenseService
    const service = new ExpenseService(mockDb);
    const draft = await service.createDraft({
      workspaceId,
      payload: {
        title: "Test Submission Expense",
        businessPurpose: "Quarterly server maintenance and testing",
        category: "software",
        project: "infrastructure",
        merchant: "Cloud Services Inc",
        claimAmount: "150.50",
        claimAsset: "0x0000000000000000000000000000000000001001",
        recipient: userAddress,
        paymentSource: "manual",
      },
      context: {
        userId: "usr-001",
        session,
        address: userAddress,
      },
    });

    validExpenseId = draft.expenseId;
  });

  afterEach(() => {
    setDatabaseClient(null as unknown as DatabaseClient);
  });

  describe("POST /api/workspaces/[id]/expenses/[id]/submit/prepare", () => {
    it("fails with 401 when unauthenticated", async () => {
      const req = new Request(
        `http://localhost/api/workspaces/${workspaceId}/expenses/${validExpenseId}/submit/prepare`,
        { method: "POST" },
      );

      const res = await prepareHandler(req, {
        params: Promise.resolve({ workspaceId, expenseId: validExpenseId }),
      });

      expect(res.status).toBe(401);
    });

    it("fails with 404 when expense does not exist", async () => {
      const fakeExpenseId =
        "0x9999999999999999999999999999999999999999999999999999999999999999";
      const req = new Request(
        `http://localhost/api/workspaces/${workspaceId}/expenses/${fakeExpenseId}/submit/prepare`,
        {
          method: "POST",
          headers: {
            Cookie: authCookie,
            "x-csrf-token": validCsrfToken,
          },
        },
      );

      const res = await prepareHandler(req, {
        params: Promise.resolve({ workspaceId, expenseId: fakeExpenseId }),
      });

      expect(res.status).toBe(404);
    });

    it("fails with 404 when accessed by a non-member (isolation check)", async () => {
      const req = new Request(
        `http://localhost/api/workspaces/${workspaceId}/expenses/${validExpenseId}/submit/prepare`,
        {
          method: "POST",
          headers: {
            Cookie: otherAuthCookie,
            "x-csrf-token": otherCsrfToken,
          },
        },
      );

      const res = await prepareHandler(req, {
        params: Promise.resolve({ workspaceId, expenseId: validExpenseId }),
      });

      // Non-members are rejected with 401
      expect(res.status).toBe(401);
    });

    it("successfully prepares submission preview and calldata intent", async () => {
      const req = new Request(
        `http://localhost/api/workspaces/${workspaceId}/expenses/${validExpenseId}/submit/prepare`,
        {
          method: "POST",
          headers: {
            Cookie: authCookie,
            "x-csrf-token": validCsrfToken,
          },
        },
      );

      const res = await prepareHandler(req, {
        params: Promise.resolve({ workspaceId, expenseId: validExpenseId }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.preview).toBeDefined();

      const { intent, publicFields, privateFields, disclaimer } = data.preview;

      // Public fields verification
      expect(publicFields.workspaceId).toBe(workspaceId);
      expect(publicFields.expenseId).toBe(validExpenseId);
      expect(publicFields.version).toBe(1);
      expect(publicFields.commitment).toMatch(/^0x[0-9a-f]{64}$/);
      expect(publicFields.previousCommitment).toBe(
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      );

      // Calldata verification
      expect(intent.functionName).toBe("submitVersion");
      expect(intent.data.startsWith("0x06377857")).toBe(true);

      // Private fields present in preview for user inspection
      expect(privateFields.title).toBe("Test Submission Expense");
      expect(privateFields.merchant).toBe("Cloud Services Inc");
      expect(disclaimer).toContain("Only the cryptographic commitment");

      // Verify draft version in DB was updated with commitment
      const versionRow = mockDb.expenseVersions.find(
        (v) => v.expense_id === validExpenseId,
      );
      expect(versionRow?.commitment).toBe(publicFields.commitment);
    });
  });

  describe("POST /api/workspaces/[id]/expenses/[id]/submit/reconcile", () => {
    const validTxHash =
      "0x1234567890123456789012345678901234567890123456789012345678901234";

    it("fails with 401 when CSRF token is missing", async () => {
      const req = new Request(
        `http://localhost/api/workspaces/${workspaceId}/expenses/${validExpenseId}/submit/reconcile`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: authCookie,
          },
          body: JSON.stringify({ txHash: validTxHash }),
        },
      );

      const res = await reconcileHandler(req, {
        params: Promise.resolve({ workspaceId, expenseId: validExpenseId }),
      });

      expect(res.status).toBe(401);
    });

    it("fails with 400 when txHash is missing or invalid", async () => {
      const req = new Request(
        `http://localhost/api/workspaces/${workspaceId}/expenses/${validExpenseId}/submit/reconcile`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: authCookie,
            "x-csrf-token": validCsrfToken,
          },
          body: JSON.stringify({ txHash: "not-a-valid-hash" }),
        },
      );

      const res = await reconcileHandler(req, {
        params: Promise.resolve({ workspaceId, expenseId: validExpenseId }),
      });

      expect(res.status).toBe(400);
    });

    it("reconciles submission: transitions version to submitted and updates current_version", async () => {
      const req = new Request(
        `http://localhost/api/workspaces/${workspaceId}/expenses/${validExpenseId}/submit/reconcile`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: authCookie,
            "x-csrf-token": validCsrfToken,
          },
          body: JSON.stringify({ txHash: validTxHash }),
        },
      );

      const res = await reconcileHandler(req, {
        params: Promise.resolve({ workspaceId, expenseId: validExpenseId }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.result.status).toBe("submitted");
      expect(data.result.txHash).toBe(validTxHash);

      // Verify version in DB is now submitted
      const versionRow = mockDb.expenseVersions.find(
        (v) => v.expense_id === validExpenseId,
      );
      expect(versionRow?.status).toBe("submitted");
      expect(versionRow?.submitted_transaction_hash).toBe(validTxHash);

      // Verify expenses current_version updated
      const expRow = mockDb.expenses.find(
        (e) => e.expense_id === validExpenseId,
      );
      expect(expRow?.current_version).toBe(1);

      // Verify audit event recorded
      expect(mockDb.auditEvents.length).toBeGreaterThan(0);
    });

    it("is idempotent when re-reconciling already submitted transaction", async () => {
      // First submission
      const req1 = new Request(
        `http://localhost/api/workspaces/${workspaceId}/expenses/${validExpenseId}/submit/reconcile`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: authCookie,
            "x-csrf-token": validCsrfToken,
          },
          body: JSON.stringify({ txHash: validTxHash }),
        },
      );
      const res1 = await reconcileHandler(req1, {
        params: Promise.resolve({ workspaceId, expenseId: validExpenseId }),
      });
      expect(res1.status).toBe(200);

      // Second submission with same txHash
      const req2 = new Request(
        `http://localhost/api/workspaces/${workspaceId}/expenses/${validExpenseId}/submit/reconcile`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: authCookie,
            "x-csrf-token": validCsrfToken,
          },
          body: JSON.stringify({ txHash: validTxHash }),
        },
      );
      const res2 = await reconcileHandler(req2, {
        params: Promise.resolve({ workspaceId, expenseId: validExpenseId }),
      });
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.ok).toBe(true);
      expect(data2.result.status).toBe("submitted");
    });
  });
});
