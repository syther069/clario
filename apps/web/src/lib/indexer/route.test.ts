import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { DatabaseClient, QueryResult } from "@clario/database";
import { ROLE_IDENTIFIERS } from "@clario/protocol";
import { GLOBAL_SCOPE } from "@/lib/auth/policy";
import { setDatabaseClient } from "@/lib/db";
import { GET as getStatusHandler } from "@/app/api/workspaces/[workspaceId]/indexer/status/route";
import { POST as postReplayHandler } from "@/app/api/workspaces/[workspaceId]/indexer/replay/route";
import {
  createSessionPayload,
  signSessionToken,
  serializeSessionCookie,
} from "@/lib/auth/session";
import { getSessionSecret } from "@/lib/auth/context";

const TEST_WORKSPACE_ID =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TEST_OWNER = "0x2222222222222222222222222222222222222222";
const TEST_OTHER_USER = "0x9999999999999999999999999999999999999999";

class MockDbForIndexerRoutes implements DatabaseClient {
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

  projectionWorkspaces: Array<{
    workspace_id: string;
    owner_address: string;
    policy_commitment: string;
    current_policy_version: number;
    created_at_block: string;
    created_at_tx: string;
    updated_at: Date;
  }> = [];

  projectionRoleGrants: Array<{
    grant_id: string;
    workspace_id: string;
    account_address: string;
    role: string;
    scope: string;
    active: boolean;
    granted_at_block: string;
    granted_at_tx: string;
    revoked_at_block: string | null;
    revoked_at_tx: string | null;
  }> = [];

  projectionPolicyVersions: Array<{
    workspace_id: string;
    policy_version: number;
    policy_commitment: string;
    updated_at_block: string;
    updated_at_tx: string;
    indexed_at: Date;
  }> = [];

  indexedEvents: Array<{
    event_name: string;
    contract_address: string;
    block_number: string;
    block_hash: string;
    transaction_hash: string;
    log_index: number;
    payload: Record<string, unknown>;
  }> = [];

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    const s = sql.replace(/\s+/g, " ").trim().toUpperCase();

    if (s === "BEGIN" || s === "COMMIT" || s === "ROLLBACK") {
      return { rows: [] };
    }

    if (s.includes("FROM WORKSPACES WHERE WORKSPACE_ID = $1")) {
      const rows = this.workspaces.filter(
        (w) => w.workspace_id === params[0],
      ) as unknown as T[];
      return { rows };
    }

    if (s.includes("FROM MEMBERSHIPS")) {
      const rows = this.memberships.filter(
        (m) =>
          m.workspace_id === params[0] &&
          (m.user_id === params[1] ||
            m.address.toLowerCase() === String(params[2] ?? "").toLowerCase()),
      ) as unknown as T[];
      return { rows };
    }

    if (s.includes("FROM ROLE_GRANTS")) {
      const rows = this.roleGrants.filter(
        (rg) =>
          rg.workspace_id === params[0] &&
          rg.address.toLowerCase() === (params[1] as string)?.toLowerCase() &&
          rg.revoked_at === null,
      ) as unknown as T[];
      return { rows };
    }

    if (s.includes("FROM PROJECTION_WORKSPACES WHERE WORKSPACE_ID = $1")) {
      const match = this.projectionWorkspaces.find(
        (w) => w.workspace_id === params[0],
      );
      return { rows: match ? [match as unknown as T] : [] };
    }

    if (s.includes("FROM PROJECTION_ROLE_GRANTS WHERE WORKSPACE_ID = $1")) {
      const matches = this.projectionRoleGrants.filter(
        (r) => r.workspace_id === params[0],
      );
      return { rows: matches as unknown as T[] };
    }

    if (s.includes("FROM PROJECTION_POLICY_VERSIONS WHERE WORKSPACE_ID = $1")) {
      const matches = this.projectionPolicyVersions.filter(
        (p) => p.workspace_id === params[0],
      );
      return { rows: matches as unknown as T[] };
    }

    if (s.startsWith("DELETE FROM PROJECTION_")) {
      return { rows: [] };
    }

    if (s.includes("FROM INDEXED_EVENTS WHERE CHAIN_ID = $1")) {
      return { rows: this.indexedEvents as unknown as T[] };
    }

    if (s.startsWith("SELECT COUNT(*) AS COUNT FROM PROJECTION_")) {
      return { rows: [{ count: 0 }] as unknown as T[] };
    }

    return { rows: [] };
  }
}

describe("IDX-001 — Indexer API Routes Suite", () => {
  let db: MockDbForIndexerRoutes;

  beforeEach(() => {
    db = new MockDbForIndexerRoutes();
    setDatabaseClient(db);

    db.workspaces.push({
      workspace_id: TEST_WORKSPACE_ID,
      name: "Test Workspace",
      created_by: TEST_OWNER,
    });

    db.memberships.push({
      membership_id: "m1",
      workspace_id: TEST_WORKSPACE_ID,
      user_id: "u_owner",
      address: TEST_OWNER,
      status: "active",
    });

    db.roleGrants.push({
      grant_id: "rg1",
      workspace_id: TEST_WORKSPACE_ID,
      address: TEST_OWNER,
      role: ROLE_IDENTIFIERS.OWNER_ROLE,
      scope: GLOBAL_SCOPE,
      revoked_at: null,
    });

    db.projectionWorkspaces.push({
      workspace_id: TEST_WORKSPACE_ID,
      owner_address: TEST_OWNER,
      policy_commitment:
        "0x7777777777777777777777777777777777777777777777777777777777777777",
      current_policy_version: 1,
      created_at_block: "100",
      created_at_tx:
        "0x0000000000000000000000000000000000000000000000000000000000000100",
      updated_at: new Date(),
    });

    db.projectionRoleGrants.push({
      grant_id: "g1",
      workspace_id: TEST_WORKSPACE_ID,
      account_address: TEST_OWNER,
      role: ROLE_IDENTIFIERS.OWNER_ROLE,
      scope: GLOBAL_SCOPE,
      active: true,
      granted_at_block: "100",
      granted_at_tx:
        "0x0000000000000000000000000000000000000000000000000000000000000100",
      revoked_at_block: null,
      revoked_at_tx: null,
    });
  });

  afterEach(() => {
    setDatabaseClient(undefined);
  });

  function makeAuth(
    address: string,
    userId: string,
  ): { cookie: string; csrfToken: string } {
    const secret = getSessionSecret();
    const payload = createSessionPayload({
      userId,
      address,
    });
    const token = signSessionToken(payload, secret);
    return {
      cookie: serializeSessionCookie(token),
      csrfToken: payload.csrfToken,
    };
  }

  it("GET /api/workspaces/[workspaceId]/indexer/status returns 401 without valid session", async () => {
    const req = new Request(
      "http://localhost/api/workspaces/ws1/indexer/status",
    );
    const params = Promise.resolve({ workspaceId: TEST_WORKSPACE_ID });

    const res = await getStatusHandler(req, { params });
    expect(res.status).toBe(401);
  });

  it("GET /api/workspaces/[workspaceId]/indexer/status returns projection status for authenticated user", async () => {
    const { cookie } = makeAuth(TEST_OWNER, "u_owner");
    const req = new Request(
      `http://localhost/api/workspaces/${TEST_WORKSPACE_ID}/indexer/status`,
      {
        headers: { Cookie: cookie },
      },
    );
    const params = Promise.resolve({ workspaceId: TEST_WORKSPACE_ID });

    const res = await getStatusHandler(req, { params });
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      ok: boolean;
      projection: {
        workspace: { ownerAddress: string; currentPolicyVersion: number };
        activeRoleCount: number;
      };
    };

    expect(body.ok).toBe(true);
    expect(body.projection.workspace.ownerAddress).toBe(TEST_OWNER);
    expect(body.projection.workspace.currentPolicyVersion).toBe(1);
    expect(body.projection.activeRoleCount).toBe(1);
  });

  it("POST /api/workspaces/[workspaceId]/indexer/replay rejects unauthorized callers", async () => {
    const { cookie, csrfToken } = makeAuth(TEST_OTHER_USER, "u_other");
    const req = new Request(
      `http://localhost/api/workspaces/${TEST_WORKSPACE_ID}/indexer/replay`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "x-csrf-token": csrfToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ chainId: "31337", fromBlock: "0" }),
      },
    );
    const params = Promise.resolve({ workspaceId: TEST_WORKSPACE_ID });

    const res = await postReplayHandler(req, { params });
    expect(res.status).toBe(401);
  });

  it("POST /api/workspaces/[workspaceId]/indexer/replay succeeds for authorized workspace owner", async () => {
    const { cookie, csrfToken } = makeAuth(TEST_OWNER, "u_owner");
    const req = new Request(
      `http://localhost/api/workspaces/${TEST_WORKSPACE_ID}/indexer/replay`,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "x-csrf-token": csrfToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ chainId: "31337", fromBlock: "0" }),
      },
    );
    const params = Promise.resolve({ workspaceId: TEST_WORKSPACE_ID });

    const res = await postReplayHandler(req, { params });
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      ok: boolean;
      result: { totalEventsReplayed: number; durationMs: number };
    };

    expect(body.ok).toBe(true);
    expect(body.result.totalEventsReplayed).toBe(0);
    expect(body.result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
