import { describe, expect, it, beforeEach } from "vitest";
import type { DatabaseClient, QueryResult } from "@clario/database";
import { ROLE_IDENTIFIERS } from "@clario/protocol";
import { WorkspaceService } from "./service";
import { createSessionPayload } from "../auth/session";
import type { AuthContext } from "../auth/policy";

class MockDbForWorkspace implements DatabaseClient {
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
      // List user workspaces
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

    // Role Grants - check specific queries first
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
    if (sql.includes("INSERT INTO workspace_policies")) {
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
    if (sql.includes("INSERT INTO chain_transactions")) {
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

describe("WorkspaceService Workflow", () => {
  let db: MockDbForWorkspace;
  let service: WorkspaceService;

  const ownerAddr = "0x1111111111111111111111111111111111111111" as const;
  const adminAddr = "0x2222222222222222222222222222222222222222" as const;
  const approverAddr = "0x3333333333333333333333333333333333333333" as const;
  const employeeAddr = "0x4444444444444444444444444444444444444444" as const;

  const makeContext = (address: `0x${string}`): AuthContext => {
    const session = createSessionPayload({
      userId: `user-${address}`,
      address,
    });
    return {
      userId: session.userId,
      address,
      session,
    };
  };

  beforeEach(() => {
    db = new MockDbForWorkspace();
    service = new WorkspaceService(db);
  });

  describe("Workspace Creation", () => {
    it("creates workspace and registers creator as Owner in DB and prepared calldata", async () => {
      const ownerCtx = makeContext(ownerAddr);

      const result = await service.createWorkspace({
        name: "Acme Crypto Lab",
        context: ownerCtx,
      });

      expect(result.workspaceId).toMatch(/^0x[0-9a-f]{64}$/);
      expect(result.name).toBe("Acme Crypto Lab");
      expect(result.preparedTransaction.functionName).toBe("createWorkspace");
      expect(result.preparedTransaction.summary.action).toBe(
        "create_workspace",
      );

      // Verify DB state
      expect(db.workspaces.length).toBe(1);
      expect(db.memberships.length).toBe(1);
      expect(db.roleGrants.length).toBe(1);
      expect(db.policies.length).toBe(1);

      expect(db.roleGrants[0]!.role).toBe(
        ROLE_IDENTIFIERS.OWNER_ROLE.toLowerCase(),
      );
      expect(db.roleGrants[0]!.address).toBe(ownerAddr.toLowerCase());
    });

    it("rejects invalid workspace names", async () => {
      const ownerCtx = makeContext(ownerAddr);

      await expect(
        service.createWorkspace({
          name: " ",
          context: ownerCtx,
        }),
      ).rejects.toThrow(/Workspace name must be at least 2 characters/);
    });
  });

  describe("Role Preparation & Authority Constraints", () => {
    let wsId: string;

    beforeEach(async () => {
      const ownerCtx = makeContext(ownerAddr);
      const created = await service.createWorkspace({
        name: "Test Workspace",
        context: ownerCtx,
      });
      wsId = created.workspaceId;

      // Add Admin member
      db.memberships.push({
        membership_id: "m-admin",
        workspace_id: wsId,
        user_id: `user-${adminAddr}`,
        address: adminAddr.toLowerCase(),
        status: "active",
        created_at: new Date().toISOString(),
      });
      db.roleGrants.push({
        grant_id: "rg-admin",
        workspace_id: wsId,
        address: adminAddr.toLowerCase(),
        role: ROLE_IDENTIFIERS.ADMIN_ROLE.toLowerCase(),
        scope:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        granted_by: ownerAddr.toLowerCase(),
        granted_at: new Date().toISOString(),
        revoked_at: null,
      });
    });

    it("allows Owner to prepare granting APPROVER_ROLE", async () => {
      const ownerCtx = makeContext(ownerAddr);

      const intent = await service.prepareRoleChange(
        {
          workspaceId: wsId,
          action: "grant",
          account: approverAddr,
          role: "APPROVER_ROLE",
        },
        ownerCtx,
      );

      expect(intent.functionName).toBe("grantRole");
      expect(intent.summary.roleName).toBe("Expense Approver");
    });

    it("allows Admin to prepare granting APPROVER_ROLE", async () => {
      const adminCtx = makeContext(adminAddr);

      const intent = await service.prepareRoleChange(
        {
          workspaceId: wsId,
          action: "grant",
          account: approverAddr,
          role: "APPROVER_ROLE",
        },
        adminCtx,
      );

      expect(intent.functionName).toBe("grantRole");
      expect(intent.summary.roleName).toBe("Expense Approver");
    });

    it("DENIES Admin from preparing grant of OWNER_ROLE (Admin restriction)", async () => {
      const adminCtx = makeContext(adminAddr);

      await expect(
        service.prepareRoleChange(
          {
            workspaceId: wsId,
            action: "grant",
            account: employeeAddr,
            role: "OWNER_ROLE",
          },
          adminCtx,
        ),
      ).rejects.toThrow(/Only a workspace owner can grant Workspace Owner/);
    });

    it("DENIES Admin from preparing grant of ADMIN_ROLE (Admin restriction)", async () => {
      const adminCtx = makeContext(adminAddr);

      await expect(
        service.prepareRoleChange(
          {
            workspaceId: wsId,
            action: "grant",
            account: employeeAddr,
            role: "ADMIN_ROLE",
          },
          adminCtx,
        ),
      ).rejects.toThrow(/Only a workspace owner can grant Administrator/);
    });

    it("PREVENTS revoking the only remaining Owner (CannotRevokeLastOwner)", async () => {
      const ownerCtx = makeContext(ownerAddr);

      await expect(
        service.prepareRoleChange(
          {
            workspaceId: wsId,
            action: "revoke",
            account: ownerAddr,
            role: "OWNER_ROLE",
          },
          ownerCtx,
        ),
      ).rejects.toThrow(/Cannot revoke the last owner of a workspace/);
    });

    it("allows revoking an owner when multiple owners exist", async () => {
      const secondOwner = "0x5555555555555555555555555555555555555555" as const;
      db.memberships.push({
        membership_id: "m-owner2",
        workspace_id: wsId,
        user_id: `user-${secondOwner}`,
        address: secondOwner.toLowerCase(),
        status: "active",
        created_at: new Date().toISOString(),
      });
      db.roleGrants.push({
        grant_id: "rg-owner2",
        workspace_id: wsId,
        address: secondOwner.toLowerCase(),
        role: ROLE_IDENTIFIERS.OWNER_ROLE.toLowerCase(),
        scope:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        granted_by: ownerAddr.toLowerCase(),
        granted_at: new Date().toISOString(),
        revoked_at: null,
      });

      const ownerCtx = makeContext(ownerAddr);
      const intent = await service.prepareRoleChange(
        {
          workspaceId: wsId,
          action: "revoke",
          account: secondOwner,
          role: "OWNER_ROLE",
        },
        ownerCtx,
      );

      expect(intent.functionName).toBe("revokeRole");
    });
  });

  describe("Onchain Transaction Reconciliation", () => {
    let wsId: string;

    beforeEach(async () => {
      const ownerCtx = makeContext(ownerAddr);
      const created = await service.createWorkspace({
        name: "Test Workspace",
        context: ownerCtx,
      });
      wsId = created.workspaceId;
    });

    it("reconciles confirmed grantRole on Monad, making role active in DB", async () => {
      const ownerCtx = makeContext(ownerAddr);
      const dummyTxHash =
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;

      const result = await service.reconcileRoleTransaction(
        {
          workspaceId: wsId,
          action: "grant",
          account: approverAddr,
          role: "APPROVER_ROLE",
          scope:
            "0x0000000000000000000000000000000000000000000000000000000000000000",
          txHash: dummyTxHash,
        },
        ownerCtx,
      );

      expect(result.ok).toBe(true);
      expect(result.status).toBe("active");

      // Verify DB role grant exists
      const approverGrants = db.roleGrants.filter(
        (rg) =>
          rg.address.toLowerCase() === approverAddr.toLowerCase() &&
          rg.revoked_at === null,
      );
      expect(approverGrants.length).toBe(1);
      expect(approverGrants[0]!.role).toBe(
        ROLE_IDENTIFIERS.APPROVER_ROLE.toLowerCase(),
      );

      // Verify chain transaction recorded
      expect(db.chainTransactions.length).toBe(1);
      expect(db.chainTransactions[0]!.status).toBe("confirmed");
    });

    it("reconciles confirmed revokeRole on Monad, setting revoked_at timestamp", async () => {
      const ownerCtx = makeContext(ownerAddr);
      const dummyTxHash1 =
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
      const dummyTxHash2 =
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;

      // Grant first
      await service.reconcileRoleTransaction(
        {
          workspaceId: wsId,
          action: "grant",
          account: approverAddr,
          role: "APPROVER_ROLE",
          scope:
            "0x0000000000000000000000000000000000000000000000000000000000000000",
          txHash: dummyTxHash1,
        },
        ownerCtx,
      );

      // Then revoke
      const res = await service.reconcileRoleTransaction(
        {
          workspaceId: wsId,
          action: "revoke",
          account: approverAddr,
          role: "APPROVER_ROLE",
          scope:
            "0x0000000000000000000000000000000000000000000000000000000000000000",
          txHash: dummyTxHash2,
        },
        ownerCtx,
      );

      expect(res.ok).toBe(true);
      expect(res.status).toBe("revoked");

      // Verify revoked_at is populated
      const grant = db.roleGrants.find(
        (rg) => rg.address.toLowerCase() === approverAddr.toLowerCase(),
      );
      expect(grant?.revoked_at).not.toBeNull();
    });
  });
});
