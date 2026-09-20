import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { DatabaseClient, QueryResult } from "@clario/database";
import {
  GET as listExpensesHandler,
  POST as createExpenseHandler,
} from "@/app/api/workspaces/[workspaceId]/expenses/route";
import {
  GET as getExpenseHandler,
  PUT as updateExpenseHandler,
  DELETE as deleteExpenseHandler,
} from "@/app/api/workspaces/[workspaceId]/expenses/[expenseId]/route";
import { setDatabaseClient } from "@/lib/db";
import {
  createSessionPayload,
  signSessionToken,
  serializeSessionCookie,
} from "@/lib/auth/session";
import { getSessionSecret } from "@/lib/auth/context";

class MockDbForExpenseRoutes implements DatabaseClient {
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
    if (s.includes("FROM memberships")) {
      const rows = this.memberships.filter(
        (m) =>
          m.workspace_id === params[0] &&
          (m.address.toLowerCase() === (params[1] as string)?.toLowerCase() ||
            m.user_id === params[1]),
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Role Grants
    if (s.includes("FROM role_grants")) {
      const rows = this.roleGrants.filter(
        (rg) =>
          rg.workspace_id === params[0] &&
          rg.address.toLowerCase() === (params[1] as string)?.toLowerCase() &&
          rg.revoked_at === null,
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Expenses: SELECT workspace_id, expense_id, created_by, current_version
    if (
      s.includes(
        "SELECT workspace_id, expense_id, created_by, current_version",
      ) &&
      s.includes("FROM expenses")
    ) {
      const rows = this.expenses.filter(
        (e) => e.workspace_id === params[0] && e.expense_id === params[1],
      ) as unknown as T[];
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

    // Update expenses unlink current_version
    if (s.includes("UPDATE expenses SET current_version = NULL")) {
      const exp = this.expenses.find(
        (e) => e.workspace_id === params[0] && e.expense_id === params[1],
      );
      if (exp) {
        exp.current_version = null;
      }
      return { rows: [], rowCount: exp ? 1 : 0 };
    }

    // Delete expenses
    if (s.includes("DELETE FROM expenses")) {
      this.expenses = this.expenses.filter(
        (e) => !(e.workspace_id === params[0] && e.expense_id === params[1]),
      );
      return { rows: [], rowCount: 1 };
    }

    // List expenses
    if (
      s.includes("FROM expenses e") &&
      s.includes("JOIN expense_versions ev")
    ) {
      const results: Record<string, unknown>[] = [];
      for (const e of this.expenses.filter(
        (x) => x.workspace_id === params[0],
      )) {
        const ev = this.expenseVersions.find(
          (v) =>
            v.workspace_id === e.workspace_id &&
            v.expense_id === e.expense_id &&
            v.version === e.current_version,
        );
        if (ev) {
          const evidenceCount = this.evidenceObjects.filter(
            (o) =>
              o.workspace_id === e.workspace_id &&
              o.expense_id === e.expense_id &&
              o.version === ev.version,
          ).length;

          results.push({
            expense_id: e.expense_id,
            workspace_id: e.workspace_id,
            created_by: e.created_by,
            current_version: e.current_version,
            created_at: e.created_at,
            updated_at: e.updated_at,
            status: ev.status,
            amount: ev.amount,
            currency: ev.currency,
            recipient: ev.recipient,
            record_ciphertext: ev.record_ciphertext,
            evidence_count: evidenceCount.toString(),
          });
        }
      }
      return { rows: results as unknown as T[], rowCount: results.length };
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

    // Update expense_versions
    if (s.includes("UPDATE expense_versions")) {
      const ev = this.expenseVersions.find(
        (v) =>
          v.workspace_id === params[4] &&
          v.expense_id === params[5] &&
          v.version === params[6],
      );
      if (ev) {
        ev.record_ciphertext = params[0] as string;
        ev.amount = params[1] as string;
        ev.currency = params[2] as string;
        ev.recipient = params[3] as string;
      }
      return { rows: [], rowCount: ev ? 1 : 0 };
    }

    // Delete from expense_versions
    if (s.includes("DELETE FROM expense_versions")) {
      this.expenseVersions = this.expenseVersions.filter(
        (v) => !(v.workspace_id === params[0] && v.expense_id === params[1]),
      );
      return { rows: [], rowCount: 1 };
    }

    // Select from expense_versions
    if (s.includes("FROM expense_versions")) {
      const rows = this.expenseVersions.filter(
        (ev) =>
          ev.workspace_id === params[0] &&
          ev.expense_id === params[1] &&
          ev.version === params[2],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Evidence objects
    if (s.includes("DELETE FROM evidence_objects")) {
      this.evidenceObjects = this.evidenceObjects.filter(
        (eo) => !(eo.workspace_id === params[0] && eo.expense_id === params[1]),
      );
      return { rows: [], rowCount: 1 };
    }

    if (s.includes("FROM evidence_objects")) {
      const rows = this.evidenceObjects.filter(
        (eo) =>
          eo.workspace_id === params[0] &&
          eo.expense_id === params[1] &&
          eo.version === params[2],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    return { rows: [], rowCount: 0 };
  }
}

describe("Expense API Route Handlers", () => {
  let mockDb: MockDbForExpenseRoutes;
  const WS_ID =
    "0x1111111111111111111111111111111111111111111111111111111111111111";
  const USER_ADDR: `0x${string}` = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  function createAuthHeader(address: `0x${string}`): {
    Cookie: string;
    "x-csrf-token": string;
  } {
    const payload = createSessionPayload({
      userId: `user-${address.slice(2, 8)}`,
      address,
    });
    const token = signSessionToken(payload, getSessionSecret());
    const cookieStr = serializeSessionCookie(token);
    return {
      Cookie: cookieStr.split(";")[0]!,
      "x-csrf-token": payload.csrfToken,
    };
  }

  beforeEach(() => {
    mockDb = new MockDbForExpenseRoutes();
    setDatabaseClient(mockDb);

    mockDb.workspaces.push({
      workspace_id: WS_ID,
      name: "Engineering Workspace",
      created_by: USER_ADDR,
    });

    mockDb.memberships.push({
      membership_id: "mem-1",
      workspace_id: WS_ID,
      user_id: "user-aaaaaa",
      address: USER_ADDR,
      status: "active",
    });
  });

  afterEach(() => {
    setDatabaseClient(null as unknown as DatabaseClient);
  });

  it("GET /api/workspaces/[wsId]/expenses rejects unauthenticated request with 401", async () => {
    const req = new Request(
      `http://localhost/api/workspaces/${WS_ID}/expenses`,
    );
    const res = await listExpensesHandler(req, {
      params: Promise.resolve({ workspaceId: WS_ID }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("POST and GET /api/workspaces/[wsId]/expenses creates and lists draft", async () => {
    const authHeaders = createAuthHeader(USER_ADDR);

    // 1. Create draft
    const postReq = new Request(
      `http://localhost/api/workspaces/${WS_ID}/expenses`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          payload: {
            title: "Server Infrastructure",
            claimAmount: "120.00",
            category: "hosting",
          },
        }),
      },
    );

    const postRes = await createExpenseHandler(postReq, {
      params: Promise.resolve({ workspaceId: WS_ID }),
    });
    expect(postRes.status).toBe(201);
    const postBody = await postRes.json();
    expect(postBody.ok).toBe(true);
    expect(postBody.draft.payload.title).toBe("Server Infrastructure");
    const expenseId = postBody.draft.expenseId;

    // 2. List drafts
    const getReq = new Request(
      `http://localhost/api/workspaces/${WS_ID}/expenses`,
      {
        headers: authHeaders,
      },
    );
    const listRes = await listExpensesHandler(getReq, {
      params: Promise.resolve({ workspaceId: WS_ID }),
    });
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.expenses).toHaveLength(1);
    expect(listBody.expenses[0].expenseId).toBe(expenseId);
  });

  it("GET, PUT, and DELETE /api/workspaces/[wsId]/expenses/[expId] updates and deletes draft", async () => {
    const authHeaders = createAuthHeader(USER_ADDR);

    // Create initial draft
    const postReq = new Request(
      `http://localhost/api/workspaces/${WS_ID}/expenses`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          payload: { title: "Draft v1", claimAmount: "50.00" },
        }),
      },
    );
    const postRes = await createExpenseHandler(postReq, {
      params: Promise.resolve({ workspaceId: WS_ID }),
    });
    const { draft } = await postRes.json();
    const expenseId = draft.expenseId;

    // GET single draft
    const getReq = new Request(
      `http://localhost/api/workspaces/${WS_ID}/expenses/${expenseId}`,
      { headers: authHeaders },
    );
    const getRes = await getExpenseHandler(getReq, {
      params: Promise.resolve({ workspaceId: WS_ID, expenseId }),
    });
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.draft.payload.title).toBe("Draft v1");

    // PUT autosave update
    const putReq = new Request(
      `http://localhost/api/workspaces/${WS_ID}/expenses/${expenseId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          payload: { title: "Draft v1 Updated", claimAmount: "75.00" },
        }),
      },
    );
    const putRes = await updateExpenseHandler(putReq, {
      params: Promise.resolve({ workspaceId: WS_ID, expenseId }),
    });
    expect(putRes.status).toBe(200);
    const putBody = await putRes.json();
    expect(putBody.draft.payload.title).toBe("Draft v1 Updated");
    expect(putBody.draft.amount).toBe("75000000");

    // DELETE draft
    const delReq = new Request(
      `http://localhost/api/workspaces/${WS_ID}/expenses/${expenseId}`,
      {
        method: "DELETE",
        headers: authHeaders,
      },
    );
    const delRes = await deleteExpenseHandler(delReq, {
      params: Promise.resolve({ workspaceId: WS_ID, expenseId }),
    });
    expect(delRes.status).toBe(200);
    const delBody = await delRes.json();
    expect(delBody.success).toBe(true);
    expect(delBody.expenseId).toBe(expenseId);
  });
});
