import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { DatabaseClient, QueryResult } from "@clario/database";
import { ROLE_IDENTIFIERS } from "@clario/protocol";
import { POST as uploadHandler } from "@/app/api/expenses/[expenseId]/evidence/route";
import {
  GET as downloadHandler,
  DELETE as deleteHandler,
} from "@/app/api/expenses/[expenseId]/evidence/[evidenceId]/route";
import { setDatabaseClient } from "@/lib/db";
import {
  createSessionPayload,
  signSessionToken,
  serializeSessionCookie,
} from "@/lib/auth/session";
import { getSessionSecret } from "@/lib/auth/context";
import { setDefaultStorageDriver, MemoryStorageDriver } from "./storage";

class MockDbForRoutes implements DatabaseClient {
  workspaces: Array<{
    workspace_id: string;
    created_by: string;
    name: string;
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
  }> = [];

  expenseVersions: Array<{
    workspace_id: string;
    expense_id: string;
    version: number;
    status: string;
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
    encryption_metadata: string;
    created_at: string;
  }> = [];

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
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
          (m.address.toLowerCase() === (params[1] as string)?.toLowerCase() ||
            m.user_id === params[1]),
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

    // Expenses
    if (sql.includes("FROM expenses")) {
      const rows = this.expenses.filter(
        (e) => e.workspace_id === params[0] && e.expense_id === params[1],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Expense versions
    if (sql.includes("FROM expense_versions")) {
      const rows = this.expenseVersions.filter(
        (ev) =>
          ev.workspace_id === params[0] &&
          ev.expense_id === params[1] &&
          ev.version === params[2],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Insert evidence_objects
    if (sql.includes("INSERT INTO evidence_objects")) {
      const newObj = {
        evidence_id: params[0] as string,
        workspace_id: params[1] as string,
        expense_id: params[2] as string,
        version: params[3] as number,
        storage_key: params[4] as string,
        sha256_hash: params[5] as string,
        byte_length: params[6] as number,
        mime_type: params[7] as string,
        encryption_metadata: params[8] as string,
        created_at: params[9] as string,
      };
      this.evidenceObjects.push(newObj);
      return { rows: [newObj as unknown as T], rowCount: 1 };
    }

    // Delete evidence_objects
    if (sql.includes("DELETE FROM evidence_objects")) {
      const before = this.evidenceObjects.length;
      this.evidenceObjects = this.evidenceObjects.filter(
        (eo) =>
          !(
            eo.workspace_id === params[0] &&
            eo.expense_id === params[1] &&
            eo.evidence_id === params[2]
          ),
      );
      return { rows: [], rowCount: before - this.evidenceObjects.length };
    }

    // Query evidence_objects
    if (sql.includes("FROM evidence_objects")) {
      const rows = this.evidenceObjects.filter(
        (eo) =>
          eo.workspace_id === params[0] &&
          eo.expense_id === params[1] &&
          eo.evidence_id === params[2],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    return { rows: [], rowCount: 0 };
  }

  async transaction<T>(fn: (client: DatabaseClient) => Promise<T>): Promise<T> {
    return fn(this);
  }

  async end(): Promise<void> {}
}

describe("Evidence API Routes Integration", () => {
  const wsId =
    "0x1111111111111111111111111111111111111111111111111111111111111111";
  const expId =
    "0x2222222222222222222222222222222222222222222222222222222222222222";
  const submitterAddr = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
  const adminAddr = "0xcccccccccccccccccccccccccccccccccccccccc" as const;

  let db: MockDbForRoutes;
  let memoryStorage: MemoryStorageDriver;

  const createAuthHeaders = (
    address: `0x${string}`,
    includeCsrf = true,
  ): Record<string, string> => {
    const payload = createSessionPayload({
      userId: `user-${address}`,
      address,
    });
    const secret = getSessionSecret();
    const token = signSessionToken(payload, secret);
    const cookie = serializeSessionCookie(token);

    const headers: Record<string, string> = {
      Cookie: cookie,
    };

    if (includeCsrf) {
      headers["x-csrf-token"] = payload.csrfToken;
    }

    return headers;
  };

  beforeEach(() => {
    db = new MockDbForRoutes();
    setDatabaseClient(db);

    memoryStorage = new MemoryStorageDriver();
    setDefaultStorageDriver(memoryStorage);

    // Workspace
    db.workspaces.push({
      workspace_id: wsId,
      created_by: submitterAddr,
      name: "Engineering Lab",
    });

    // Memberships
    db.memberships.push(
      {
        membership_id: "m-submitter",
        workspace_id: wsId,
        user_id: `user-${submitterAddr}`,
        address: submitterAddr,
        status: "active",
      },
      {
        membership_id: "m-admin",
        workspace_id: wsId,
        user_id: `user-${adminAddr}`,
        address: adminAddr,
        status: "active",
      },
    );

    // Roles
    db.roleGrants.push({
      grant_id: "rg-admin",
      workspace_id: wsId,
      address: adminAddr,
      role: ROLE_IDENTIFIERS.ADMIN_ROLE,
      scope:
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      revoked_at: null,
    });

    // Expense
    db.expenses.push({
      workspace_id: wsId,
      expense_id: expId,
      created_by: submitterAddr,
      current_version: 1,
    });

    // Version
    db.expenseVersions.push({
      workspace_id: wsId,
      expense_id: expId,
      version: 1,
      status: "draft",
    });
  });

  afterEach(() => {
    setDatabaseClient(undefined);
    setDefaultStorageDriver(null);
  });

  describe("POST /api/expenses/:expenseId/evidence", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const req = new Request(
        `https://clario.local/api/expenses/${expId}/evidence`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: wsId,
            version: 1,
            data: Buffer.from("test").toString("base64"),
          }),
        },
      );

      const res = await uploadHandler(req, {
        params: Promise.resolve({ expenseId: expId }),
      });
      expect(res.status).toBe(401);
    });

    it("rejects mutation requests missing CSRF token with 401", async () => {
      const headers = createAuthHeaders(submitterAddr, false); // No CSRF
      headers["Content-Type"] = "application/json";

      const req = new Request(
        `https://clario.local/api/expenses/${expId}/evidence`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            workspaceId: wsId,
            version: 1,
            data: Buffer.from("test").toString("base64"),
          }),
        },
      );

      const res = await uploadHandler(req, {
        params: Promise.resolve({ expenseId: expId }),
      });
      expect(res.status).toBe(401);
    });

    it("successfully uploads evidence via JSON payload", async () => {
      const headers = createAuthHeaders(submitterAddr, true);
      headers["Content-Type"] = "application/json";

      const payloadBytes = Buffer.from(
        "Invoice for $500 software subscription",
      );
      const req = new Request(
        `https://clario.local/api/expenses/${expId}/evidence`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            workspaceId: wsId,
            version: 1,
            data: payloadBytes.toString("base64"),
            mimeType: "text/plain",
            filename: "invoice.txt",
          }),
        },
      );

      const res = await uploadHandler(req, {
        params: Promise.resolve({ expenseId: expId }),
      });
      expect(res.status).toBe(201);

      const data = (await res.json()) as {
        ok: boolean;
        evidence: {
          evidenceId: string;
          sha256Hash: string;
          byteLength: number;
        };
      };
      expect(data.ok).toBe(true);
      expect(data.evidence.evidenceId).toBeDefined();
      expect(data.evidence.byteLength).toBe(payloadBytes.length);
    });
  });

  describe("GET and DELETE /api/expenses/:expenseId/evidence/:evidenceId", () => {
    let evidenceId: string;
    const testContent = Buffer.from("Receipt content: $230 Hotel reservation");

    beforeEach(async () => {
      const headers = createAuthHeaders(submitterAddr, true);
      headers["Content-Type"] = "application/json";

      const uploadReq = new Request(
        `https://clario.local/api/expenses/${expId}/evidence`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            workspaceId: wsId,
            version: 1,
            data: testContent.toString("base64"),
            mimeType: "text/plain",
          }),
        },
      );

      const res = await uploadHandler(uploadReq, {
        params: Promise.resolve({ expenseId: expId }),
      });
      const data = (await res.json()) as {
        evidence: { evidenceId: string };
      };
      evidenceId = data.evidence.evidenceId;
    });

    it("allows submitter to download evidence with appropriate security headers", async () => {
      const headers = createAuthHeaders(submitterAddr, false); // GET doesn't require CSRF

      const req = new Request(
        `https://clario.local/api/expenses/${expId}/evidence/${evidenceId}?workspaceId=${wsId}`,
        {
          method: "GET",
          headers,
        },
      );

      const res = await downloadHandler(req, {
        params: Promise.resolve({ expenseId: expId, evidenceId }),
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("Content-Disposition")).toContain("attachment");

      const bodyBuf = Buffer.from(await res.arrayBuffer());
      expect(bodyBuf.equals(testContent)).toBe(true);
    });

    it("allows preview mode with inline disposition", async () => {
      const headers = createAuthHeaders(submitterAddr, false);

      const req = new Request(
        `https://clario.local/api/expenses/${expId}/evidence/${evidenceId}?workspaceId=${wsId}&preview=true`,
        {
          method: "GET",
          headers,
        },
      );

      const res = await downloadHandler(req, {
        params: Promise.resolve({ expenseId: expId, evidenceId }),
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Disposition")).toBe("inline");
    });

    it("DENIES admin from downloading private evidence (Admin Isolation)", async () => {
      const headers = createAuthHeaders(adminAddr, false);

      const req = new Request(
        `https://clario.local/api/expenses/${expId}/evidence/${evidenceId}?workspaceId=${wsId}`,
        {
          method: "GET",
          headers,
        },
      );

      const res = await downloadHandler(req, {
        params: Promise.resolve({ expenseId: expId, evidenceId }),
      });
      expect(res.status).toBe(401);
    });

    it("deletes draft evidence with valid CSRF", async () => {
      const headers = createAuthHeaders(submitterAddr, true);

      const req = new Request(
        `https://clario.local/api/expenses/${expId}/evidence/${evidenceId}?workspaceId=${wsId}`,
        {
          method: "DELETE",
          headers,
        },
      );

      const res = await deleteHandler(req, {
        params: Promise.resolve({ expenseId: expId, evidenceId }),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as { ok: boolean; deleted: boolean };
      expect(data.ok).toBe(true);
      expect(data.deleted).toBe(true);

      // Subsequent GET returns 404
      const getReq = new Request(
        `https://clario.local/api/expenses/${expId}/evidence/${evidenceId}?workspaceId=${wsId}`,
        {
          method: "GET",
          headers: createAuthHeaders(submitterAddr, false),
        },
      );
      const getRes = await downloadHandler(getReq, {
        params: Promise.resolve({ expenseId: expId, evidenceId }),
      });
      expect(getRes.status).toBe(404);
    });
  });
});
