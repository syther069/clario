import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { DatabaseClient, QueryResult } from "@clario/database";
import { setDatabaseClient } from "@/lib/db";
import { GET as getTimelineHandler } from "./route";
import {
  createSessionPayload,
  signSessionToken,
  serializeSessionCookie,
} from "@/lib/auth/session";
import { getSessionSecret } from "@/lib/auth/context";

const TEST_WORKSPACE =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TEST_EXPENSE =
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const TEST_OWNER = "0x1111111111111111111111111111111111111111";
const TEST_OTHER = "0x9999999999999999999999999999999999999999";

class MockDbForTimelineRoute implements DatabaseClient {
  workspaces: Array<{ workspace_id: string; created_by: string }> = [];
  roleGrants: Array<{
    workspace_id: string;
    account_address: string;
    role: string;
    revoked_at: Date | string | null;
  }> = [];
  memberships: Array<{ workspace_id: string; account_address: string }> = [];
  expenses: Array<{
    workspace_id: string;
    expense_id: string;
    created_by: string;
    current_version: number | null;
    created_at: string;
    updated_at: string;
  }> = [];
  expenseVersions: Array<Record<string, unknown>> = [];
  evidenceObjects: Array<Record<string, unknown>> = [];
  decisions: Array<Record<string, unknown>> = [];
  reimbursements: Array<Record<string, unknown>> = [];
  sourceTransactions: Array<Record<string, unknown>> = [];
  projExpenses: Array<Record<string, unknown>> = [];
  projExpenseVersions: Array<Record<string, unknown>> = [];
  projDecisions: Array<Record<string, unknown>> = [];
  projSettlements: Array<Record<string, unknown>> = [];
  chainTransactions: Array<Record<string, unknown>> = [];
  indexerCheckpoints: Array<Record<string, unknown>> = [];
  reorgedEvents: Array<Record<string, unknown>> = [];

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    const normalized = sql.toLowerCase().replace(/\s+/g, " ");

    if (
      normalized.includes(
        "from workspaces where workspace_id = $1 and lower(created_by) = lower($2)",
      ) ||
      normalized.includes(
        "from role_grants where workspace_id = $1 and lower(account_address) = lower($2)",
      ) ||
      normalized.includes(
        "from memberships where workspace_id = $1 and lower(account_address) = lower($2)",
      )
    ) {
      const [wId, addr] = params as [string, string];
      const matchOwner = this.workspaces.some(
        (w) =>
          w.workspace_id === wId &&
          w.created_by.toLowerCase() === addr.toLowerCase(),
      );
      const matchRole = this.roleGrants.some(
        (r) =>
          r.workspace_id === wId &&
          r.account_address.toLowerCase() === addr.toLowerCase() &&
          r.revoked_at === null,
      );
      const matchMember = this.memberships.some(
        (m) =>
          m.workspace_id === wId &&
          m.account_address.toLowerCase() === addr.toLowerCase(),
      );

      if (matchOwner || matchRole || matchMember) {
        return { rows: [{ "?column?": 1 } as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (
      normalized.includes(
        "from expenses where workspace_id = $1 and expense_id = $2",
      )
    ) {
      const [wId, eId] = params as [string, string];
      const matches = this.expenses.filter(
        (e) => e.workspace_id === wId && e.expense_id === eId,
      );
      return { rows: matches as unknown as T[], rowCount: matches.length };
    }

    if (
      normalized.includes(
        "from expense_versions where workspace_id = $1 and expense_id = $2",
      )
    ) {
      return {
        rows: this.expenseVersions as unknown as T[],
        rowCount: this.expenseVersions.length,
      };
    }
    if (
      normalized.includes(
        "from evidence_objects where workspace_id = $1 and expense_id = $2",
      )
    ) {
      return {
        rows: this.evidenceObjects as unknown as T[],
        rowCount: this.evidenceObjects.length,
      };
    }
    if (
      normalized.includes(
        "from decisions where workspace_id = $1 and expense_id = $2",
      )
    ) {
      return {
        rows: this.decisions as unknown as T[],
        rowCount: this.decisions.length,
      };
    }
    if (
      normalized.includes(
        "from reimbursements where workspace_id = $1 and expense_id = $2",
      )
    ) {
      return {
        rows: this.reimbursements as unknown as T[],
        rowCount: this.reimbursements.length,
      };
    }
    if (
      normalized.includes(
        "from source_transactions where workspace_id = $1 and expense_id = $2",
      )
    ) {
      return {
        rows: this.sourceTransactions as unknown as T[],
        rowCount: this.sourceTransactions.length,
      };
    }
    if (
      normalized.includes(
        "from projection_expenses where workspace_id = $1 and expense_id = $2",
      )
    ) {
      return {
        rows: this.projExpenses as unknown as T[],
        rowCount: this.projExpenses.length,
      };
    }
    if (
      normalized.includes(
        "from projection_expense_versions where workspace_id = $1 and expense_id = $2",
      )
    ) {
      return {
        rows: this.projExpenseVersions as unknown as T[],
        rowCount: this.projExpenseVersions.length,
      };
    }
    if (
      normalized.includes(
        "from projection_decisions where workspace_id = $1 and expense_id = $2",
      )
    ) {
      return {
        rows: this.projDecisions as unknown as T[],
        rowCount: this.projDecisions.length,
      };
    }
    if (
      normalized.includes(
        "from projection_settlements where workspace_id = $1 and expense_id = $2",
      )
    ) {
      return {
        rows: this.projSettlements as unknown as T[],
        rowCount: this.projSettlements.length,
      };
    }
    if (
      normalized.includes("from chain_transactions where workspace_id = $1")
    ) {
      return {
        rows: this.chainTransactions as unknown as T[],
        rowCount: this.chainTransactions.length,
      };
    }
    if (normalized.includes("from indexer_checkpoints")) {
      return {
        rows: this.indexerCheckpoints as unknown as T[],
        rowCount: this.indexerCheckpoints.length,
      };
    }
    if (
      normalized.includes(
        "from indexed_events where workspace_id = $1 and (removed = true or status = 'reorged')",
      )
    ) {
      return {
        rows: this.reorgedEvents as unknown as T[],
        rowCount: this.reorgedEvents.length,
      };
    }

    return { rows: [], rowCount: 0 };
  }
}

function makeAuthCookie(address: string, userId = "user-1"): string {
  const secret = getSessionSecret();
  const payload = createSessionPayload({ userId, address });
  const token = signSessionToken(payload, secret);
  return serializeSessionCookie(token);
}

describe("GET /api/workspaces/[workspaceId]/expenses/[expenseId]/timeline", () => {
  let mockDb: MockDbForTimelineRoute;

  beforeEach(() => {
    mockDb = new MockDbForTimelineRoute();
    setDatabaseClient(mockDb);

    mockDb.workspaces.push({
      workspace_id: TEST_WORKSPACE,
      created_by: TEST_OWNER,
    });

    mockDb.expenses.push({
      workspace_id: TEST_WORKSPACE,
      expense_id: TEST_EXPENSE,
      created_by: TEST_OWNER,
      current_version: 1,
      created_at: "2026-09-17T12:00:00.000Z",
      updated_at: "2026-09-17T12:00:00.000Z",
    });
  });

  afterEach(() => {
    setDatabaseClient(null as unknown as DatabaseClient);
  });

  it("returns 401 when unauthenticated (no session cookie)", async () => {
    const req = new Request(
      `http://localhost/api/workspaces/${TEST_WORKSPACE}/expenses/${TEST_EXPENSE}/timeline`,
    );
    const res = await getTimelineHandler(req, {
      params: Promise.resolve({
        workspaceId: TEST_WORKSPACE,
        expenseId: TEST_EXPENSE,
      }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when caller is not a workspace member", async () => {
    const cookie = makeAuthCookie(TEST_OTHER, "stranger-1");
    const req = new Request(
      `http://localhost/api/workspaces/${TEST_WORKSPACE}/expenses/${TEST_EXPENSE}/timeline`,
      {
        headers: { Cookie: cookie },
      },
    );
    const res = await getTimelineHandler(req, {
      params: Promise.resolve({
        workspaceId: TEST_WORKSPACE,
        expenseId: TEST_EXPENSE,
      }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("UNAUTHORIZED");
  });

  it("returns 200 with full activity timeline and Proof Spine for authorized member", async () => {
    const cookie = makeAuthCookie(TEST_OWNER, "owner-1");
    const req = new Request(
      `http://localhost/api/workspaces/${TEST_WORKSPACE}/expenses/${TEST_EXPENSE}/timeline`,
      {
        headers: { Cookie: cookie },
      },
    );
    const res = await getTimelineHandler(req, {
      params: Promise.resolve({
        workspaceId: TEST_WORKSPACE,
        expenseId: TEST_EXPENSE,
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      expenseId: string;
      events: Array<{ id: string; type: string }>;
      indexerLag: { isLagging: boolean };
    };
    expect(body.expenseId).toBe(TEST_EXPENSE);
    expect(body.events.length).toBeGreaterThan(0);
    expect(body.events[0]?.type).toBe("draft_created");
    expect(body.indexerLag.isLagging).toBe(false);
  });

  it("returns 404 when expense does not exist", async () => {
    const cookie = makeAuthCookie(TEST_OWNER, "owner-1");
    const req = new Request(
      `http://localhost/api/workspaces/${TEST_WORKSPACE}/expenses/nonexistent/timeline`,
      {
        headers: { Cookie: cookie },
      },
    );
    const res = await getTimelineHandler(req, {
      params: Promise.resolve({
        workspaceId: TEST_WORKSPACE,
        expenseId: "nonexistent",
      }),
    });
    expect(res.status).toBe(404);
  });
});
