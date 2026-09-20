import { randomBytes, randomUUID } from "node:crypto";
import { ROLE_IDENTIFIERS, ProtocolError } from "@clario/protocol";
import {
  withTransaction,
  type DatabaseClient,
  type HexString,
} from "@clario/database";
import {
  AuthorizationPolicy,
  type AuthContext,
  GLOBAL_SCOPE,
} from "../auth/policy";
import {
  prepareRoleChangeIntent,
  prepareWorkspaceCreationIntent,
  resolveRoleHash,
  getRoleHumanName,
} from "./calldata";
import type {
  PreparedTransactionIntent,
  PrepareRoleParams,
  ReconcileRoleParams,
  WorkspaceMemberDetails,
  WorkspaceSummary,
} from "./types";

export interface WorkspaceConfig {
  readonly workspaceRegistryAddress: `0x${string}`;
  readonly chainId: number;
}

export function getDefaultWorkspaceConfig(): WorkspaceConfig {
  const addr = (process.env.NEXT_PUBLIC_WORKSPACE_REGISTRY_ADDRESS ??
    "0x1000000000000000000000000000000000000001") as `0x${string}`;
  const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? "31337", 10);
  return {
    workspaceRegistryAddress: addr,
    chainId,
  };
}

export class WorkspaceService {
  private readonly policy: AuthorizationPolicy;
  private readonly config: WorkspaceConfig;

  constructor(
    private readonly db: DatabaseClient,
    policy?: AuthorizationPolicy,
    config?: WorkspaceConfig,
  ) {
    this.policy = policy ?? new AuthorizationPolicy(db);
    this.config = config ?? getDefaultWorkspaceConfig();
  }

  /**
   * Creates a workspace, registers the creator as initial Owner,
   * and prepares the onchain transaction intent for registration.
   */
  async createWorkspace(params: {
    name: string;
    context: AuthContext;
    policyCommitment?: `0x${string}` | undefined;
  }): Promise<{
    workspaceId: HexString;
    name: string;
    preparedTransaction: PreparedTransactionIntent;
  }> {
    const trimmedName = params.name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      throw new ProtocolError("INVALID_IDENTIFIER", {
        message: "Workspace name must be at least 2 characters.",
      });
    }

    const workspaceId = ("0x" +
      randomBytes(32).toString("hex")) as `0x${string}`;

    const policyCommitment =
      params.policyCommitment ??
      ("0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`);

    const createdAt = new Date().toISOString();
    const creatorAddress = params.context.address.toLowerCase();

    await withTransaction(this.db, async (tx) => {
      // 1. Insert workspace
      await tx.query(
        `INSERT INTO workspaces (workspace_id, name, created_by, created_at)
         VALUES ($1, $2, $3, $4);`,
        [workspaceId, trimmedName, creatorAddress, createdAt],
      );

      // 2. Insert initial policy version 1
      await tx.query(
        `INSERT INTO workspace_policies (
           workspace_id, policy_version, commitment, effective_from_block, created_at
         ) VALUES ($1, 1, $2, 0, $3);`,
        [workspaceId, policyCommitment, createdAt],
      );

      // 3. Insert membership for creator
      const membershipId = randomUUID();
      await tx.query(
        `INSERT INTO memberships (membership_id, workspace_id, user_id, address, status, created_at)
         VALUES ($1, $2, $3, $4, 'active', $5);`,
        [
          membershipId,
          workspaceId,
          params.context.userId,
          creatorAddress,
          createdAt,
        ],
      );

      // 4. Grant OWNER_ROLE with global scope to creator
      const grantId = randomUUID();
      await tx.query(
        `INSERT INTO role_grants (
           grant_id, workspace_id, address, role, scope, granted_by, granted_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7);`,
        [
          grantId,
          workspaceId,
          creatorAddress,
          ROLE_IDENTIFIERS.OWNER_ROLE.toLowerCase(),
          GLOBAL_SCOPE.toLowerCase(),
          creatorAddress,
          createdAt,
        ],
      );
    });

    const preparedTransaction = prepareWorkspaceCreationIntent({
      workspaceRegistryAddress: this.config.workspaceRegistryAddress,
      chainId: this.config.chainId,
      workspaceId,
      policyCommitment,
      workspaceName: trimmedName,
    });

    return {
      workspaceId,
      name: trimmedName,
      preparedTransaction,
    };
  }

  /**
   * Lists all workspaces where the current authenticated user has an active membership.
   */
  async listUserWorkspaces(context: AuthContext): Promise<WorkspaceSummary[]> {
    const address = context.address.toLowerCase();

    const res = await this.db.query<{
      workspace_id: string;
      name: string;
      created_by: string;
      created_at: string | Date;
    }>(
      `SELECT w.workspace_id, w.name, w.created_by, w.created_at
       FROM workspaces w
       INNER JOIN memberships m ON w.workspace_id = m.workspace_id
       WHERE (m.address = $1 OR m.user_id = $2) AND m.status = 'active'
       ORDER BY w.created_at DESC;`,
      [address, context.userId],
    );

    const summaries: WorkspaceSummary[] = [];

    for (const row of res.rows) {
      const wsId = row.workspace_id;
      const isOwner = row.created_by.toLowerCase() === address;

      // Count members
      const countRes = await this.db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM memberships WHERE workspace_id = $1 AND status = 'active';`,
        [wsId],
      );
      const memberCount = parseInt(countRes.rows[0]?.count ?? "1", 10);

      // Get user roles in this workspace
      const roleRes = await this.db.query<{ role: string }>(
        `SELECT role FROM role_grants WHERE workspace_id = $1 AND address = $2 AND revoked_at IS NULL;`,
        [wsId, address],
      );
      const activeRoles = roleRes.rows.map((r) => r.role);

      summaries.push({
        workspaceId: wsId as HexString,
        name: row.name,
        createdBy: row.created_by,
        createdAt:
          typeof row.created_at === "string"
            ? row.created_at
            : row.created_at.toISOString(),
        isOwner,
        memberCount,
        activeRoles,
      });
    }

    return summaries;
  }

  /**
   * Returns complete member and role roster for a workspace.
   */
  async getWorkspaceMembers(
    workspaceId: string,
    context: AuthContext,
  ): Promise<{
    workspaceId: string;
    members: WorkspaceMemberDetails[];
  }> {
    // Caller must be an active member
    await this.policy.getMembership(workspaceId, context);

    const memRes = await this.db.query<{
      membership_id: string;
      workspace_id: string;
      user_id: string;
      address: string;
      status: "active" | "suspended" | "revoked";
    }>(
      `SELECT membership_id, workspace_id, user_id, address, status
       FROM memberships
       WHERE workspace_id = $1 AND status = 'active'
       ORDER BY created_at ASC;`,
      [workspaceId],
    );

    const members: WorkspaceMemberDetails[] = [];

    for (const m of memRes.rows) {
      const grantsRes = await this.db.query<{
        grant_id: string;
        role: string;
        scope: string;
        granted_at: string | Date;
      }>(
        `SELECT grant_id, role, scope, granted_at
         FROM role_grants
         WHERE workspace_id = $1 AND address = $2 AND revoked_at IS NULL;`,
        [workspaceId, m.address.toLowerCase()],
      );

      const roles = grantsRes.rows.map((g) => ({
        grantId: g.grant_id,
        role: g.role,
        roleName: getRoleHumanName(g.role),
        scope: g.scope,
        grantedAt:
          typeof g.granted_at === "string"
            ? g.granted_at
            : g.granted_at.toISOString(),
      }));

      members.push({
        membershipId: m.membership_id,
        workspaceId: m.workspace_id,
        userId: m.user_id,
        address: m.address,
        status: m.status,
        roles,
      });
    }

    return { workspaceId, members };
  }

  /**
   * Prepares onchain calldata for granting or revoking a scoped role.
   * Enforces that Administrators cannot grant or revoke OWNER or ADMIN roles.
   * Enforces that the last owner of a workspace cannot be revoked.
   */
  async prepareRoleChange(
    params: PrepareRoleParams,
    context: AuthContext,
  ): Promise<PreparedTransactionIntent> {
    const { workspaceId, action, account, role, scope } = params;

    const callerMembership = await this.policy.getMembership(
      workspaceId,
      context,
    );

    const roleHash = resolveRoleHash(role);
    const isOwnerRole = roleHash === ROLE_IDENTIFIERS.OWNER_ROLE.toLowerCase();
    const isAdminRole = roleHash === ROLE_IDENTIFIERS.ADMIN_ROLE.toLowerCase();

    // 1. Authorization check:
    // Only Owner can grant/revoke OWNER or ADMIN roles
    if (isOwnerRole || isAdminRole) {
      if (!callerMembership.isOwner) {
        throw new ProtocolError("UNAUTHORIZED", {
          message: `Only a workspace owner can ${action} ${getRoleHumanName(roleHash)}.`,
        });
      }
    } else {
      // Other roles can be granted/revoked by Owner or Admin
      const isAdmin = this.policy.hasRole(callerMembership, "ADMIN_ROLE");
      if (!callerMembership.isOwner && !isAdmin) {
        throw new ProtocolError("UNAUTHORIZED", {
          message: `Only an Owner or Administrator can ${action} ${getRoleHumanName(roleHash)}.`,
        });
      }
    }

    // 2. Last Owner Protection:
    if (action === "revoke" && isOwnerRole) {
      const ownerCountRes = await this.db.query<{ count: string }>(
        `SELECT COUNT(*) as count
         FROM role_grants
         WHERE workspace_id = $1 AND role = $2 AND revoked_at IS NULL;`,
        [workspaceId, ROLE_IDENTIFIERS.OWNER_ROLE.toLowerCase()],
      );
      const activeOwners = parseInt(ownerCountRes.rows[0]?.count ?? "0", 10);
      if (activeOwners <= 1) {
        throw new ProtocolError("UNAUTHORIZED", {
          message:
            "Cannot revoke the last owner of a workspace. Assign another owner first.",
        });
      }
    }

    // 3. Prepare intent
    return prepareRoleChangeIntent({
      workspaceRegistryAddress: this.config.workspaceRegistryAddress,
      chainId: this.config.chainId,
      workspaceId: workspaceId as `0x${string}`,
      action,
      account,
      role: roleHash,
      scope,
    });
  }

  /**
   * Authoritatively reconciles a confirmed onchain transaction into the database state.
   * Invoked after the Monad receipt or event has been confirmed.
   */
  async reconcileRoleTransaction(
    params: ReconcileRoleParams,
    context: AuthContext,
  ): Promise<{ ok: boolean; status: "active" | "revoked" }> {
    const { workspaceId, action, account, role, scope, txHash } = params;

    // Caller must have membership
    await this.policy.getMembership(workspaceId, context);

    const roleHash = resolveRoleHash(role);
    const normalizedAccount = account.toLowerCase();
    const normalizedScope = (scope || GLOBAL_SCOPE).toLowerCase();
    const now = new Date().toISOString();

    await withTransaction(this.db, async (tx) => {
      // Ensure member row exists
      const memRes = await tx.query<{ membership_id: string }>(
        `SELECT membership_id FROM memberships WHERE workspace_id = $1 AND address = $2;`,
        [workspaceId, normalizedAccount],
      );

      if (memRes.rows.length === 0) {
        await tx.query(
          `INSERT INTO memberships (membership_id, workspace_id, user_id, address, status, created_at)
           VALUES ($1, $2, $3, $4, 'active', $5);`,
          [
            randomUUID(),
            workspaceId,
            `user-${normalizedAccount}`,
            normalizedAccount,
            now,
          ],
        );
      }

      if (action === "grant") {
        // Upsert grant
        const existingGrant = await tx.query<{ grant_id: string }>(
          `SELECT grant_id FROM role_grants
           WHERE workspace_id = $1 AND address = $2 AND role = $3 AND scope = $4 AND revoked_at IS NULL;`,
          [workspaceId, normalizedAccount, roleHash, normalizedScope],
        );

        if (existingGrant.rows.length === 0) {
          await tx.query(
            `INSERT INTO role_grants (
               grant_id, workspace_id, address, role, scope, granted_by, granted_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7);`,
            [
              randomUUID(),
              workspaceId,
              normalizedAccount,
              roleHash,
              normalizedScope,
              context.address.toLowerCase(),
              now,
            ],
          );
        }
      } else {
        // Revoke
        await tx.query(
          `UPDATE role_grants
           SET revoked_at = $1
           WHERE workspace_id = $2 AND address = $3 AND role = $4 AND scope = $5 AND revoked_at IS NULL;`,
          [now, workspaceId, normalizedAccount, roleHash, normalizedScope],
        );
      }

      // Record transaction
      await tx.query(
        `INSERT INTO chain_transactions (
           id, workspace_id, chain_family, chain_id, transaction_hash,
           function_name, status, submitted_at, confirmed_at, created_at
         ) VALUES ($1, $2, 'monad', $3, $4, $5, 'confirmed', $6, $7, $8)
         ON CONFLICT (chain_id, transaction_hash) DO UPDATE SET status = 'confirmed', confirmed_at = $7;`,
        [
          randomUUID(),
          workspaceId,
          this.config.chainId,
          txHash.toLowerCase(),
          action === "grant" ? "grantRole" : "revokeRole",
          now,
          now,
          now,
        ],
      );
    });

    return {
      ok: true,
      status: action === "grant" ? "active" : "revoked",
    };
  }
}
