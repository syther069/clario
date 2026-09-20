import { describe, expect, it } from "vitest";
import type { DatabaseClient, QueryResult } from "@clario/database";
import {
  AuthorizationPolicy,
  GLOBAL_SCOPE,
  RecordNotFoundError,
  type AuthContext,
} from "./policy";
import { createSessionPayload } from "./session";
import { ROLE_IDENTIFIERS } from "@clario/protocol";

// Mock database client backed by in-memory tables for deterministic policy matrix testing
class MockDatabaseClient implements DatabaseClient {
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
  evidenceObjects: Array<{
    evidence_id: string;
    workspace_id: string;
    expense_id: string;
    version: number;
  }> = [];

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    // Workspaces query
    if (sql.includes("FROM workspaces WHERE workspace_id = $1")) {
      const rows = this.workspaces.filter(
        (w) => w.workspace_id === params[0],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Memberships query
    if (sql.includes("FROM memberships")) {
      const rows = this.memberships.filter(
        (m) =>
          m.workspace_id === params[0] &&
          (m.user_id === params[1] ||
            m.address.toLowerCase() === String(params[2]).toLowerCase()),
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Role grants query
    if (sql.includes("FROM role_grants")) {
      const rows = this.roleGrants.filter(
        (rg) =>
          rg.workspace_id === params[0] &&
          rg.address.toLowerCase() === String(params[1]).toLowerCase() &&
          rg.revoked_at === null,
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Expenses query
    if (sql.includes("FROM expenses")) {
      const rows = this.expenses.filter(
        (e) => e.workspace_id === params[0] && e.expense_id === params[1],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Evidence query
    if (sql.includes("FROM evidence_objects")) {
      const rows = this.evidenceObjects.filter(
        (ev) =>
          ev.workspace_id === params[0] &&
          ev.expense_id === params[1] &&
          ev.evidence_id === params[2],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    return { rows: [], rowCount: 0 };
  }
}

function makeContext(
  address: string,
  userId = "11111111-1111-1111-1111-111111111111",
  lastConfirmedAt = Date.now(),
): AuthContext {
  const session = createSessionPayload({
    userId,
    address,
    lastConfirmedAt,
  });
  return { userId, address: session.address, session };
}

describe("Server-Side Workspace Authorization Policy Matrix (APP-002)", () => {
  const WS_A =
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const WS_B =
    "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

  const OWNER_ADDR = "0x1111111111111111111111111111111111111111";
  const SUBMITTER_ADDR = "0x2222222222222222222222222222222222222222";
  const APPROVER_ADDR = "0x3333333333333333333333333333333333333333";
  const TREASURY_ADDR = "0x4444444444444444444444444444444444444444";
  const ADMIN_ADDR = "0x5555555555555555555555555555555555555555";
  const OUTSIDER_ADDR = "0x9999999999999999999999999999999999999999";

  const EXP_1 =
    "0x0000000000000000000000000000000000000000000000000000000000000001";
  const EVID_1 = "10000000-0000-0000-0000-000000000001";

  let mockDb: MockDatabaseClient;
  let policy: AuthorizationPolicy;

  function setupFixture() {
    mockDb = new MockDatabaseClient();
    policy = new AuthorizationPolicy(mockDb);

    // Seed Workspace A
    mockDb.workspaces.push({
      workspace_id: WS_A,
      created_by: OWNER_ADDR,
      name: "Workspace A",
    });

    // Seed Workspace B
    mockDb.workspaces.push({
      workspace_id: WS_B,
      created_by: "0x8888888888888888888888888888888888888888",
      name: "Workspace B",
    });

    // Active memberships in Workspace A
    mockDb.memberships.push(
      {
        membership_id: "m-owner",
        workspace_id: WS_A,
        user_id: "u-owner",
        address: OWNER_ADDR,
        status: "active",
      },
      {
        membership_id: "m-submitter",
        workspace_id: WS_A,
        user_id: "u-sub",
        address: SUBMITTER_ADDR,
        status: "active",
      },
      {
        membership_id: "m-approver",
        workspace_id: WS_A,
        user_id: "u-app",
        address: APPROVER_ADDR,
        status: "active",
      },
      {
        membership_id: "m-treasury",
        workspace_id: WS_A,
        user_id: "u-tr",
        address: TREASURY_ADDR,
        status: "active",
      },
      {
        membership_id: "m-admin",
        workspace_id: WS_A,
        user_id: "u-adm",
        address: ADMIN_ADDR,
        status: "active",
      },
    );

    // Active Role Grants in Workspace A
    mockDb.roleGrants.push(
      {
        grant_id: "rg-app",
        workspace_id: WS_A,
        address: APPROVER_ADDR,
        role: ROLE_IDENTIFIERS.APPROVER_ROLE,
        scope: GLOBAL_SCOPE,
        revoked_at: null,
      },
      {
        grant_id: "rg-tr",
        workspace_id: WS_A,
        address: TREASURY_ADDR,
        role: ROLE_IDENTIFIERS.TREASURY_ROLE,
        scope: GLOBAL_SCOPE,
        revoked_at: null,
      },
      {
        grant_id: "rg-adm",
        workspace_id: WS_A,
        address: ADMIN_ADDR,
        role: ROLE_IDENTIFIERS.ADMIN_ROLE,
        scope: GLOBAL_SCOPE,
        revoked_at: null,
      },
    );

    // Seed Expense 1 in Workspace A (submitted by Submitter)
    mockDb.expenses.push({
      workspace_id: WS_A,
      expense_id: EXP_1,
      created_by: SUBMITTER_ADDR,
      current_version: 1,
    });

    // Seed Evidence 1 in Expense 1
    mockDb.evidenceObjects.push({
      evidence_id: EVID_1,
      workspace_id: WS_A,
      expense_id: EXP_1,
      version: 1,
    });
  }

  describe("Workspace Membership", () => {
    setupFixture();

    it("allows active member to load membership", async () => {
      setupFixture();
      const ctx = makeContext(SUBMITTER_ADDR);
      const mem = await policy.getMembership(WS_A, ctx);
      expect(mem.status).toBe("active");
      expect(mem.isOwner).toBe(false);
    });

    it("recognizes workspace creator as Owner with universal authority", async () => {
      setupFixture();
      const ctx = makeContext(OWNER_ADDR);
      const mem = await policy.getMembership(WS_A, ctx);
      expect(mem.isOwner).toBe(true);
      expect(policy.hasRole(mem, "OWNER_ROLE")).toBe(true);
      expect(policy.hasRole(mem, "APPROVER_ROLE")).toBe(true);
      expect(policy.hasRole(mem, "TREASURY_ROLE")).toBe(true);
    });

    it("fails closed with UNAUTHORIZED if account is not a member", async () => {
      setupFixture();
      const ctx = makeContext(OUTSIDER_ADDR);
      await expect(policy.getMembership(WS_A, ctx)).rejects.toThrow(
        /not an active member/i,
      );
    });

    it("fails closed with UNAUTHORIZED if membership is suspended or revoked", async () => {
      setupFixture();
      mockDb.memberships.find((m) => m.address === SUBMITTER_ADDR)!.status =
        "revoked";
      const ctx = makeContext(SUBMITTER_ADDR);
      await expect(policy.getMembership(WS_A, ctx)).rejects.toThrow(
        /not an active member/i,
      );
    });

    it("fails closed with RecordNotFoundError for non-existent workspace", async () => {
      setupFixture();
      const ctx = makeContext(OWNER_ADDR);
      await expect(
        policy.getMembership(
          "0x9999999999999999999999999999999999999999999999999999999999999999",
          ctx,
        ),
      ).rejects.toThrow(RecordNotFoundError);
    });
  });

  describe("Multi-Tenant Isolation and Object Enumeration Defense", () => {
    it("fails closed with RecordNotFoundError (404) when querying an expense from another workspace", async () => {
      setupFixture();
      // Expense exists in Workspace A. User is member of Workspace B.
      mockDb.memberships.push({
        membership_id: "m-b-user",
        workspace_id: WS_B,
        user_id: "u-b",
        address: OUTSIDER_ADDR,
        status: "active",
      });

      const ctx = makeContext(OUTSIDER_ADDR);

      // Attempting to query EXP_1 (from WS_A) inside WS_B must fail closed with 404
      await expect(
        policy.authorizeExpense(WS_B, EXP_1, ctx, "read"),
      ).rejects.toThrow(RecordNotFoundError);
    });

    it("returns identical RecordNotFoundError for non-existent vs cross-workspace IDs (zero existence leak)", async () => {
      setupFixture();
      const ctx = makeContext(SUBMITTER_ADDR);
      const fakeId =
        "0x1234567890123456789012345678901234567890123456789012345678901234";

      await expect(
        policy.authorizeExpense(WS_A, fakeId, ctx, "read"),
      ).rejects.toThrow(RecordNotFoundError);
    });
  });

  describe("Role Enforcement & Scope Hierarchy", () => {
    it("hierarchical scope: global scope grant authorizes action on any target scope", async () => {
      setupFixture();
      const ctx = makeContext(APPROVER_ADDR);
      const mem = await policy.getMembership(WS_A, ctx);

      const specificScope =
        "0x0000000000000000000000000000000000000000000000000000000000000042";

      // Global scope grant matches specific scope
      expect(policy.hasRole(mem, "APPROVER_ROLE", specificScope)).toBe(true);
    });

    it("specific scope: a specific scope grant does NOT authorize a different scope", async () => {
      setupFixture();
      const scopedApprover = "0x6666666666666666666666666666666666666666";
      const scopeDeptA =
        "0x0000000000000000000000000000000000000000000000000000000000000001";
      const scopeDeptB =
        "0x0000000000000000000000000000000000000000000000000000000000000002";

      mockDb.memberships.push({
        membership_id: "m-scoped",
        workspace_id: WS_A,
        user_id: "u-scoped",
        address: scopedApprover,
        status: "active",
      });

      mockDb.roleGrants.push({
        grant_id: "rg-dept-a",
        workspace_id: WS_A,
        address: scopedApprover,
        role: ROLE_IDENTIFIERS.APPROVER_ROLE,
        scope: scopeDeptA,
        revoked_at: null,
      });

      const ctx = makeContext(scopedApprover);
      const mem = await policy.getMembership(WS_A, ctx);

      expect(policy.hasRole(mem, "APPROVER_ROLE", scopeDeptA)).toBe(true);
      expect(policy.hasRole(mem, "APPROVER_ROLE", scopeDeptB)).toBe(false);
    });

    it("role revocation: immediately blocks privileged role checks", async () => {
      setupFixture();
      const grant = mockDb.roleGrants.find((g) => g.address === APPROVER_ADDR)!;
      grant.revoked_at = new Date();

      const ctx = makeContext(APPROVER_ADDR);
      const mem = await policy.getMembership(WS_A, ctx);

      expect(policy.hasRole(mem, "APPROVER_ROLE")).toBe(false);
    });
  });

  describe("Founder Invariant: Self-Approval Prohibition", () => {
    it("strictly prevents a submitter from approving their own expense even if they hold APPROVER_ROLE", async () => {
      setupFixture();
      // Give Submitter the APPROVER_ROLE
      mockDb.roleGrants.push({
        grant_id: "rg-sub-approver",
        workspace_id: WS_A,
        address: SUBMITTER_ADDR,
        role: ROLE_IDENTIFIERS.APPROVER_ROLE,
        scope: GLOBAL_SCOPE,
        revoked_at: null,
      });

      const ctx = makeContext(SUBMITTER_ADDR);

      // Submitter holds APPROVER_ROLE
      const mem = await policy.getMembership(WS_A, ctx);
      expect(policy.hasRole(mem, "APPROVER_ROLE")).toBe(true);

      // Attempting to approve their own expense must fail closed
      await expect(
        policy.authorizeExpense(WS_A, EXP_1, ctx, "approve"),
      ).rejects.toThrow(/Self-approval is prohibited/i);
    });

    it("allows an independent approver to approve the expense", async () => {
      setupFixture();
      const ctx = makeContext(APPROVER_ADDR);
      const result = await policy.authorizeExpense(WS_A, EXP_1, ctx, "approve");
      expect(result.expense.expenseId).toBe(EXP_1);
    });
  });

  describe("Architecture Rule: Admin Evidence Isolation", () => {
    it("denies evidence read access to an Admin who lacks an authorized evidence role", async () => {
      setupFixture();
      // Admin user in WS_A has ADMIN_ROLE only
      const ctx = makeContext(ADMIN_ADDR);

      await expect(
        policy.authorizeEvidence(WS_A, EXP_1, EVID_1, ctx, "read"),
      ).rejects.toThrow(
        /Administrative membership does not grant private evidence access/i,
      );
    });

    it("allows Submitter, Approver, and Owner to read evidence", async () => {
      setupFixture();
      // Submitter can read their own evidence
      const subCtx = makeContext(SUBMITTER_ADDR);
      await expect(
        policy.authorizeEvidence(WS_A, EXP_1, EVID_1, subCtx, "read"),
      ).resolves.toBeDefined();

      // Approver can read evidence
      const appCtx = makeContext(APPROVER_ADDR);
      await expect(
        policy.authorizeEvidence(WS_A, EXP_1, EVID_1, appCtx, "read"),
      ).resolves.toBeDefined();

      // Owner can read evidence
      const ownCtx = makeContext(OWNER_ADDR);
      await expect(
        policy.authorizeEvidence(WS_A, EXP_1, EVID_1, ownCtx, "read"),
      ).resolves.toBeDefined();
    });
  });

  describe("Recent Wallet Confirmation Enforcements", () => {
    it("requires recent confirmation for Treasury settlement", async () => {
      setupFixture();
      // Stale treasury session (20 mins old)
      const staleCtx = makeContext(
        TREASURY_ADDR,
        "u-tr",
        Date.now() - 20 * 60 * 1000,
      );

      await expect(
        policy.authorizeExpense(WS_A, EXP_1, staleCtx, "settle"),
      ).rejects.toThrow(/Recent wallet confirmation is required/i);

      // Fresh treasury session
      const freshCtx = makeContext(TREASURY_ADDR, "u-tr", Date.now());
      await expect(
        policy.authorizeExpense(WS_A, EXP_1, freshCtx, "settle"),
      ).resolves.toBeDefined();
    });

    it("requires recent confirmation for role management", async () => {
      setupFixture();
      const staleOwner = makeContext(
        OWNER_ADDR,
        "u-owner",
        Date.now() - 20 * 60 * 1000,
      );

      await expect(
        policy.authorizeSensitiveAction(WS_A, staleOwner, "role:manage"),
      ).rejects.toThrow(/Recent wallet confirmation is required/i);

      const freshOwner = makeContext(OWNER_ADDR, "u-owner", Date.now());
      await expect(
        policy.authorizeSensitiveAction(WS_A, freshOwner, "role:manage"),
      ).resolves.toBeDefined();
    });
  });
});
