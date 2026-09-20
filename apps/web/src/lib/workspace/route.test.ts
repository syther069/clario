import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { DatabaseClient, QueryResult } from "@clario/database";
import {
  GET as listWorkspacesHandler,
  POST as createWorkspaceHandler,
} from "@/app/api/workspaces/route";
import { GET as getMembersHandler } from "@/app/api/workspaces/[workspaceId]/route";
import { POST as prepareRoleHandler } from "@/app/api/workspaces/[workspaceId]/roles/prepare/route";
import { POST as reconcileRoleHandler } from "@/app/api/workspaces/[workspaceId]/roles/reconcile/route";
import { setDatabaseClient } from "@/lib/db";
import {
  createSessionPayload,
  signSessionToken,
  serializeSessionCookie,
} from "@/lib/auth/session";
import { getSessionSecret } from "@/lib/auth/context";

class MockDbForWorkspaceRoutes implements DatabaseClient {
  workspaces: Array<{
    workspace_id: string;
    name: string;
    created_by: string;
    created_at: string;
  }> = [];

  policies: Array<{
    workspace_id: string;
    policy_version: number;
    commitment: string;
    effective_from_block: number;
    created_at: string;
  }> = [];

  memberships: Array<{
    membership_id: string;
    workspace_id: string;
    user_id: string;
    address: string;
    status: "active" | "suspended" | "revoked";
    created_at: string;
  }> = [];

  roleGrants: Array<{
    grant_id: string;
    workspace_id: string;
    address: string;
    role: string;
    scope: string;
    granted_by: string;
    granted_at: string;
    revoked_at: string | null;
  }> = [];

  chainTransactions: Array<{
    id: string;
    workspace_id: string;
    chain_family: string;
    chain_id: number;
    transaction_hash: string;
    function_name: string;
    status: string;
    submitted_at: string;
    confirmed_at: string | null;
    created_at: string;
  }> = [];

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    const s = sql.replace(/\s+/g, " ").trim();

    // Workspaces
    if (s.includes("FROM workspaces WHERE workspace_id = $1")) {
      const rows = this.workspaces.filter(
        (w) => w.workspace_id === params[0],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    if (s.includes("INSERT INTO workspaces")) {
      const newWs = {
        workspace_id: params[0] as string,
        name: params[1] as string,
        created_by: params[2] as string,
        created_at: params[3] as string,
      };
      this.workspaces.push(newWs);
      return { rows: [newWs as unknown as T], rowCount: 1 };
    }

    if (s.includes("FROM workspaces w")) {
      const targetAddr = (params[0] as string)?.toLowerCase();
      const targetUser = params[1] as string;
      const userWorkspaces = this.memberships
        .filter(
          (m) =>
            m.status === "active" &&
            (m.address.toLowerCase() === targetAddr ||
              m.user_id === targetUser),
        )
        .map((m) =>
          this.workspaces.find((w) => w.workspace_id === m.workspace_id),
        )
        .filter(Boolean) as unknown as T[];
      return { rows: userWorkspaces, rowCount: userWorkspaces.length };
    }

    // Memberships
    if (
      s.includes(
        "FROM memberships WHERE workspace_id = $1 AND status = 'active'",
      )
    ) {
      const rows = this.memberships.filter(
        (m) => m.workspace_id === params[0] && m.status === "active",
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    if (s.includes("SELECT COUNT(*) as count FROM memberships")) {
      const count = this.memberships.filter(
        (m) => m.workspace_id === params[0] && m.status === "active",
      ).length;
      return {
        rows: [{ count: count.toString() }] as unknown as T[],
        rowCount: 1,
      };
    }

    if (
      s.includes("FROM memberships WHERE workspace_id = $1 AND address = $2")
    ) {
      const rows = this.memberships.filter(
        (m) =>
          m.workspace_id === params[0] &&
          m.address.toLowerCase() === (params[1] as string)?.toLowerCase(),
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    if (s.includes("FROM memberships")) {
      const targetUser = params[1] as string;
      const targetAddr = ((params[2] ?? params[1]) as string)?.toLowerCase();
      const rows = this.memberships.filter(
        (m) =>
          m.workspace_id === params[0] &&
          (m.address.toLowerCase() === targetAddr ||
            m.user_id === targetUser ||
            m.address.toLowerCase() === (params[1] as string)?.toLowerCase()),
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    if (s.includes("INSERT INTO memberships")) {
      const newMem = {
        membership_id: params[0] as string,
        workspace_id: params[1] as string,
        user_id: params[2] as string,
        address: (params[3] as string).toLowerCase(),
        status: "active" as const,
        created_at: (params[4] ?? new Date().toISOString()) as string,
      };
      this.memberships.push(newMem);
      return { rows: [newMem as unknown as T], rowCount: 1 };
    }

    // Role Grants
    if (s.includes("SELECT COUNT(*) as count FROM role_grants")) {
      const count = this.roleGrants.filter(
        (rg) =>
          rg.workspace_id === params[0] &&
          rg.role === params[1] &&
          rg.revoked_at === null,
      ).length;
      return {
        rows: [{ count: count.toString() }] as unknown as T[],
        rowCount: 1,
      };
    }

    if (s.includes("UPDATE role_grants SET revoked_at")) {
      const revokedAt = params[0] as string;
      const wsId = params[1] as string;
      const addr = (params[2] as string).toLowerCase();
      const role = params[3] as string;
      const scope = params[4] as string;
      let count = 0;
      for (const rg of this.roleGrants) {
        if (
          rg.workspace_id === wsId &&
          rg.address.toLowerCase() === addr &&
          rg.role === role &&
          rg.scope === scope &&
          rg.revoked_at === null
        ) {
          rg.revoked_at = revokedAt;
          count++;
        }
      }
      return { rows: [], rowCount: count };
    }

    if (s.includes("INSERT INTO role_grants")) {
      const newGrant = {
        grant_id: params[0] as string,
        workspace_id: params[1] as string,
        address: (params[2] as string).toLowerCase(),
        role: params[3] as string,
        scope: params[4] as string,
        granted_by: (params[5] as string).toLowerCase(),
        granted_at: params[6] as string,
        revoked_at: null,
      };
      this.roleGrants.push(newGrant);
      return { rows: [newGrant as unknown as T], rowCount: 1 };
    }

    if (
      s.includes(
        "WHERE workspace_id = $1 AND address = $2 AND role = $3 AND scope = $4 AND revoked_at IS NULL",
      )
    ) {
      const rows = this.roleGrants.filter(
        (rg) =>
          rg.workspace_id === params[0] &&
          rg.address.toLowerCase() === (params[1] as string)?.toLowerCase() &&
          rg.role === params[2] &&
          rg.scope === params[3] &&
          rg.revoked_at === null,
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    if (
      s.includes(
        "WHERE workspace_id = $1 AND address = $2 AND revoked_at IS NULL",
      )
    ) {
      const rows = this.roleGrants.filter(
        (rg) =>
          rg.workspace_id === params[0] &&
          rg.address.toLowerCase() === (params[1] as string)?.toLowerCase() &&
          rg.revoked_at === null,
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    if (s.includes("FROM role_grants")) {
      const rows = this.roleGrants.filter(
        (rg) =>
          rg.workspace_id === params[0] &&
          rg.address.toLowerCase() === (params[1] as string)?.toLowerCase() &&
          rg.revoked_at === null,
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Policies
    if (s.includes("INSERT INTO workspace_policies")) {
      const newPolicy = {
        workspace_id: params[0] as string,
        policy_version: params[1] as number,
        commitment: params[2] as string,
        effective_from_block: params[3] as number,
        created_at: params[4] as string,
      };
      this.policies.push(newPolicy);
      return { rows: [newPolicy as unknown as T], rowCount: 1 };
    }

    // Chain Transactions
    if (s.includes("INSERT INTO chain_transactions")) {
      const tx = {
        id: params[0] as string,
        workspace_id: params[1] as string,
        chain_family: "monad",
        chain_id: params[2] as number,
        transaction_hash: (params[3] as string).toLowerCase(),
        function_name: params[4] as string,
        status: "confirmed",
        submitted_at: params[5] as string,
        confirmed_at: params[6] as string,
        created_at: params[7] as string,
      };
      this.chainTransactions.push(tx);
      return { rows: [tx as unknown as T], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }

  async transaction<T>(fn: (client: DatabaseClient) => Promise<T>): Promise<T> {
    return fn(this);
  }

  async end(): Promise<void> {}
}

describe("Workspace API Routes Integration", () => {
  const ownerAddr = "0x1111111111111111111111111111111111111111" as const;
  const approverAddr = "0x2222222222222222222222222222222222222222" as const;

  let db: MockDbForWorkspaceRoutes;

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
    db = new MockDbForWorkspaceRoutes();
    setDatabaseClient(db);
  });

  afterEach(() => {
    setDatabaseClient(undefined);
  });

  describe("POST and GET /api/workspaces", () => {
    it("creates a new workspace with valid session and CSRF", async () => {
      const headers = createAuthHeaders(ownerAddr, true);
      headers["Content-Type"] = "application/json";

      const req = new Request("https://clario.local/api/workspaces", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: "Monad Treasury Operations" }),
      });

      const res = await createWorkspaceHandler(req);
      expect(res.status).toBe(201);

      const data = (await res.json()) as {
        ok: boolean;
        workspaceId: string;
        name: string;
        preparedTransaction: { functionName: string };
      };
      expect(data.ok).toBe(true);
      expect(data.name).toBe("Monad Treasury Operations");
      expect(data.preparedTransaction.functionName).toBe("createWorkspace");
    });

    it("lists workspaces for authenticated user", async () => {
      // First create one
      const headers = createAuthHeaders(ownerAddr, true);
      headers["Content-Type"] = "application/json";

      const createReq = new Request("https://clario.local/api/workspaces", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: "Alpha DAO" }),
      });
      await createWorkspaceHandler(createReq);

      // Now list
      const listHeaders = createAuthHeaders(ownerAddr, false);
      const listReq = new Request("https://clario.local/api/workspaces", {
        method: "GET",
        headers: listHeaders,
      });

      const res = await listWorkspacesHandler(listReq);
      expect(res.status).toBe(200);

      const data = (await res.json()) as {
        ok: boolean;
        workspaces: Array<{ name: string; isOwner: boolean }>;
      };
      expect(data.ok).toBe(true);
      expect(data.workspaces.length).toBe(1);
      expect(data.workspaces[0]!.name).toBe("Alpha DAO");
      expect(data.workspaces[0]!.isOwner).toBe(true);
    });
  });

  describe("GET /api/workspaces/:workspaceId", () => {
    it("returns workspace members and roles for active member", async () => {
      const headers = createAuthHeaders(ownerAddr, true);
      headers["Content-Type"] = "application/json";

      const createReq = new Request("https://clario.local/api/workspaces", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: "Alpha DAO" }),
      });
      const createRes = await createWorkspaceHandler(createReq);
      const { workspaceId } = (await createRes.json()) as {
        workspaceId: string;
      };

      const getReq = new Request(
        `https://clario.local/api/workspaces/${workspaceId}`,
        {
          method: "GET",
          headers: createAuthHeaders(ownerAddr, false),
        },
      );

      const res = await getMembersHandler(getReq, {
        params: Promise.resolve({ workspaceId }),
      });
      expect(res.status).toBe(200);

      const data = (await res.json()) as {
        ok: boolean;
        members: Array<{ address: string; roles: Array<{ roleName: string }> }>;
      };
      expect(data.ok).toBe(true);
      expect(data.members.length).toBe(1);
      expect(data.members[0]!.roles[0]!.roleName).toBe("Workspace Owner");
    });
  });

  describe("POST /api/workspaces/:workspaceId/roles/prepare & reconcile", () => {
    let wsId: string;

    beforeEach(async () => {
      const headers = createAuthHeaders(ownerAddr, true);
      headers["Content-Type"] = "application/json";

      const createReq = new Request("https://clario.local/api/workspaces", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: "Alpha DAO" }),
      });
      const createRes = await createWorkspaceHandler(createReq);
      const body = (await createRes.json()) as { workspaceId: string };
      wsId = body.workspaceId;
    });

    it("prepares calldata for granting role to new member", async () => {
      const headers = createAuthHeaders(ownerAddr, true);
      headers["Content-Type"] = "application/json";

      const req = new Request(
        `https://clario.local/api/workspaces/${wsId}/roles/prepare`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            action: "grant",
            account: approverAddr,
            role: "APPROVER_ROLE",
          }),
        },
      );

      const res = await prepareRoleHandler(req, {
        params: Promise.resolve({ workspaceId: wsId }),
      });
      expect(res.status).toBe(200);

      const data = (await res.json()) as {
        ok: boolean;
        preparedTransaction: { functionName: string; to: string };
      };
      expect(data.ok).toBe(true);
      expect(data.preparedTransaction.functionName).toBe("grantRole");
      expect(data.preparedTransaction.to).toBeDefined();
    });

    it("reconciles confirmed transaction, making role active in DB", async () => {
      const headers = createAuthHeaders(ownerAddr, true);
      headers["Content-Type"] = "application/json";
      const txHash =
        "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

      const req = new Request(
        `https://clario.local/api/workspaces/${wsId}/roles/reconcile`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            action: "grant",
            account: approverAddr,
            role: "APPROVER_ROLE",
            scope:
              "0x0000000000000000000000000000000000000000000000000000000000000000",
            txHash,
          }),
        },
      );

      const res = await reconcileRoleHandler(req, {
        params: Promise.resolve({ workspaceId: wsId }),
      });
      expect(res.status).toBe(200);

      const data = (await res.json()) as { ok: boolean; status: string };
      expect(data.ok).toBe(true);
      expect(data.status).toBe("active");

      // Verify members list now shows approver
      const getReq = new Request(
        `https://clario.local/api/workspaces/${wsId}`,
        {
          method: "GET",
          headers: createAuthHeaders(ownerAddr, false),
        },
      );
      const getRes = await getMembersHandler(getReq, {
        params: Promise.resolve({ workspaceId: wsId }),
      });
      const memberData = (await getRes.json()) as {
        members: Array<{ address: string }>;
      };
      expect(memberData.members.length).toBe(2);
    });
  });
});
