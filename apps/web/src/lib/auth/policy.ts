import {
  ROLE_IDENTIFIERS,
  type WorkspaceRole,
  ProtocolError,
} from "@clario/protocol";
import type { DatabaseClient } from "@clario/database";
import type { SessionPayload } from "./session";

export const GLOBAL_SCOPE =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export const MAX_CONFIRMATION_AGE_MS = 15 * 60 * 1000; // 15 minutes

export interface AuthContext {
  readonly userId: string;
  readonly address: `0x${string}`;
  readonly session: SessionPayload;
}

export interface WorkspaceMembershipInfo {
  readonly membershipId: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly address: string;
  readonly status: "active" | "suspended" | "revoked";
  readonly isOwner: boolean;
  readonly roles: ReadonlyArray<{
    role: string;
    scope: string;
  }>;
}

export interface ExpenseRecordHeader {
  readonly workspaceId: string;
  readonly expenseId: string;
  readonly createdBy: string;
  readonly currentVersion: number | null;
}

export interface EvidenceRecordHeader {
  readonly evidenceId: string;
  readonly workspaceId: string;
  readonly expenseId: string;
  readonly version: number;
}

/**
 * Custom error indicating a private record was not found in the specified workspace.
 * Fails closed without revealing whether the record exists in another workspace.
 */
export class RecordNotFoundError extends Error {
  readonly code = "NOT_FOUND";
  readonly status = 404;

  constructor(
    message = "The requested record was not found or is not accessible.",
  ) {
    super(message);
    this.name = "RecordNotFoundError";
  }
}

/**
 * Asserts that the authenticated session was confirmed with a wallet signature recently.
 * Required for sensitive operations: role changes, sensitive exports, and treasury actions.
 */
export function assertRecentConfirmation(
  session: SessionPayload,
  maxAgeMs = MAX_CONFIRMATION_AGE_MS,
): void {
  const age = Date.now() - session.lastConfirmedAt;
  if (age > maxAgeMs) {
    throw new ProtocolError("UNAUTHORIZED", {
      message:
        "Recent wallet confirmation is required for this sensitive action. Please confirm with your wallet.",
    });
  }
}

/**
 * Resolves a role string or enum to its standard 32-byte hash.
 */
export function resolveRoleHash(role: WorkspaceRole | string): string {
  if (role in ROLE_IDENTIFIERS) {
    return ROLE_IDENTIFIERS[role as WorkspaceRole];
  }
  if (/^0x[0-9a-fA-F]{64}$/.test(role)) {
    return role.toLowerCase();
  }
  throw new Error(`Invalid or unrecognized role identifier: ${role}`);
}

export class AuthorizationPolicy {
  constructor(private readonly db: DatabaseClient) {}

  /**
   * Loads active workspace membership and all active role grants for an actor.
   * Fails closed if the actor is not an active member.
   */
  async getMembership(
    workspaceId: string,
    context: AuthContext,
  ): Promise<WorkspaceMembershipInfo> {
    if (!workspaceId || typeof workspaceId !== "string") {
      throw new ProtocolError("UNAUTHORIZED", {
        message: "A valid workspaceId is required.",
      });
    }

    // 1. Check workspace existence and creator
    const wsRes = await this.db.query<{
      workspace_id: string;
      created_by: string;
    }>(
      `SELECT workspace_id, created_by FROM workspaces WHERE workspace_id = $1;`,
      [workspaceId],
    );

    if (wsRes.rows.length === 0) {
      throw new RecordNotFoundError("Workspace not found.");
    }

    const workspace = wsRes.rows[0];
    const isCreator =
      workspace?.created_by.toLowerCase() === context.address.toLowerCase();

    // 2. Query membership table
    const memRes = await this.db.query<{
      membership_id: string;
      workspace_id: string;
      user_id: string;
      address: string;
      status: "active" | "suspended" | "revoked";
    }>(
      `SELECT membership_id, workspace_id, user_id, address, status
       FROM memberships
       WHERE workspace_id = $1 AND (user_id = $2 OR LOWER(address) = LOWER($3))
       LIMIT 1;`,
      [workspaceId, context.userId, context.address],
    );

    let membership = memRes.rows[0];

    // If user is workspace creator but no membership row exists, grant active owner membership
    if (!membership && isCreator) {
      membership = {
        membership_id: "owner-auto-membership",
        workspace_id: workspaceId,
        user_id: context.userId,
        address: context.address,
        status: "active",
      };
    }

    if (!membership || membership.status !== "active") {
      throw new ProtocolError("UNAUTHORIZED", {
        message: "Account is not an active member of this workspace.",
      });
    }

    // 3. Load active role grants
    const rolesRes = await this.db.query<{
      role: string;
      scope: string;
    }>(
      `SELECT role, scope
       FROM role_grants
       WHERE workspace_id = $1 AND LOWER(address) = LOWER($2) AND revoked_at IS NULL;`,
      [workspaceId, context.address],
    );

    const roles = rolesRes.rows.map((r) => ({
      role: r.role.toLowerCase(),
      scope: r.scope.toLowerCase(),
    }));

    // If workspace creator, add OWNER_ROLE if not already explicit
    const ownerRoleHash = ROLE_IDENTIFIERS.OWNER_ROLE.toLowerCase();
    const hasOwnerRole =
      isCreator ||
      roles.some(
        (r) =>
          r.role === ownerRoleHash &&
          (r.scope === GLOBAL_SCOPE.toLowerCase() || r.scope === "0x0"),
      );

    return {
      membershipId: membership.membership_id,
      workspaceId,
      userId: context.userId,
      address: context.address,
      status: membership.status,
      isOwner: hasOwnerRole,
      roles,
    };
  }

  /**
   * Evaluates if a member has a given role, considering hierarchical scope matching.
   * Global scope (0x0...0) matches any specific scope.
   */
  hasRole(
    membership: WorkspaceMembershipInfo,
    requiredRole: WorkspaceRole | string,
    targetScope = GLOBAL_SCOPE,
  ): boolean {
    // Owner role has universal authority within workspace
    if (membership.isOwner) {
      return true;
    }

    const requiredHash = resolveRoleHash(requiredRole).toLowerCase();
    const normalizedTargetScope = targetScope.toLowerCase();
    const normalizedGlobalScope = GLOBAL_SCOPE.toLowerCase();

    return membership.roles.some((grant) => {
      if (grant.role !== requiredHash) return false;
      // Exact scope match or global scope grant
      return (
        grant.scope === normalizedTargetScope ||
        grant.scope === normalizedGlobalScope ||
        grant.scope === "0x0"
      );
    });
  }

  /**
   * Asserts that a member has a specific role, or throws UNAUTHORIZED.
   */
  assertRole(
    membership: WorkspaceMembershipInfo,
    requiredRole: WorkspaceRole | string,
    targetScope = GLOBAL_SCOPE,
    actionDescription?: string,
  ): void {
    if (!this.hasRole(membership, requiredRole, targetScope)) {
      throw new ProtocolError("UNAUTHORIZED", {
        message: actionDescription
          ? `Unauthorized: ${actionDescription} requires ${String(requiredRole)}.`
          : `Unauthorized: Missing required role ${String(requiredRole)}.`,
      });
    }
  }

  /**
   * Authorizes expense access with strict multi-tenant isolation and object-level rules.
   */
  async authorizeExpense(
    workspaceId: string,
    expenseId: string,
    context: AuthContext,
    action: "read" | "edit" | "submit" | "approve" | "settle",
    targetScope = GLOBAL_SCOPE,
  ): Promise<{
    membership: WorkspaceMembershipInfo;
    expense: ExpenseRecordHeader;
  }> {
    const membership = await this.getMembership(workspaceId, context);

    // Database predicate enforces workspace isolation: WHERE workspace_id = $1 AND expense_id = $2
    const expRes = await this.db.query<{
      workspace_id: string;
      expense_id: string;
      created_by: string;
      current_version: number | null;
    }>(
      `SELECT workspace_id, expense_id, created_by, current_version
       FROM expenses
       WHERE workspace_id = $1 AND expense_id = $2;`,
      [workspaceId, expenseId],
    );

    if (expRes.rows.length === 0) {
      // Fails closed with NOT_FOUND to prevent cross-workspace enumeration
      throw new RecordNotFoundError(
        "The requested expense was not found in this workspace.",
      );
    }

    const expense = {
      workspaceId: expRes.rows[0]!.workspace_id,
      expenseId: expRes.rows[0]!.expense_id,
      createdBy: expRes.rows[0]!.created_by,
      currentVersion: expRes.rows[0]!.current_version,
    };

    const isCreator =
      expense.createdBy.toLowerCase() === context.address.toLowerCase();

    switch (action) {
      case "read": {
        // Allowed if creator, owner, admin, approver, treasury, or auditor
        const canRead =
          isCreator ||
          membership.isOwner ||
          this.hasRole(membership, "ADMIN_ROLE", targetScope) ||
          this.hasRole(membership, "APPROVER_ROLE", targetScope) ||
          this.hasRole(membership, "TREASURY_ROLE", targetScope) ||
          this.hasRole(membership, "AUDITOR_ROLE", targetScope);

        if (!canRead) {
          throw new ProtocolError("UNAUTHORIZED", {
            message: "You are not authorized to view this expense.",
          });
        }
        break;
      }

      case "edit":
      case "submit": {
        // Only creator or owner can edit or submit drafts
        if (!isCreator && !membership.isOwner) {
          throw new ProtocolError("UNAUTHORIZED", {
            message:
              "Only the submitter or a workspace owner can modify this expense.",
          });
        }
        break;
      }

      case "approve": {
        // Approver role required
        this.assertRole(
          membership,
          "APPROVER_ROLE",
          targetScope,
          "approving an expense",
        );

        // FOUNDER INVARIANT: A submitter cannot approve their own expense
        if (isCreator) {
          throw new ProtocolError("UNAUTHORIZED", {
            message:
              "Self-approval is prohibited: a submitter cannot approve their own expense.",
          });
        }
        break;
      }

      case "settle": {
        // Treasury role required
        this.assertRole(
          membership,
          "TREASURY_ROLE",
          targetScope,
          "settling an expense",
        );

        // Treasury settlement requires recent wallet confirmation
        assertRecentConfirmation(context.session);
        break;
      }
    }

    return { membership, expense };
  }

  /**
   * Authorizes evidence object access.
   * Enforces that administrator membership does NOT grant automatic evidence access.
   */
  async authorizeEvidence(
    workspaceId: string,
    expenseId: string,
    evidenceId: string,
    context: AuthContext,
    action: "read" | "upload" | "delete",
    targetScope = GLOBAL_SCOPE,
  ): Promise<{
    membership: WorkspaceMembershipInfo;
    expense: ExpenseRecordHeader;
    evidence: EvidenceRecordHeader;
  }> {
    // First authorize expense access
    const { membership, expense } = await this.authorizeExpense(
      workspaceId,
      expenseId,
      context,
      action === "read" ? "read" : "edit",
      targetScope,
    );

    // Query evidence object with workspace and expense predicates
    const evRes = await this.db.query<{
      evidence_id: string;
      workspace_id: string;
      expense_id: string;
      version: number;
    }>(
      `SELECT evidence_id, workspace_id, expense_id, version
       FROM evidence_objects
       WHERE workspace_id = $1 AND expense_id = $2 AND evidence_id = $3;`,
      [workspaceId, expenseId, evidenceId],
    );

    if (evRes.rows.length === 0) {
      throw new RecordNotFoundError(
        "The requested evidence was not found in this expense.",
      );
    }

    const evidence = {
      evidenceId: evRes.rows[0]!.evidence_id,
      workspaceId: evRes.rows[0]!.workspace_id,
      expenseId: evRes.rows[0]!.expense_id,
      version: evRes.rows[0]!.version,
    };

    // ARCHITECTURE RULE §8.3 & RULES.md §6.3:
    // Administrators cannot bypass evidence authorization merely because they manage membership
    if (action === "read") {
      const isCreator =
        expense.createdBy.toLowerCase() === context.address.toLowerCase();

      const hasEvidenceAccess =
        isCreator ||
        membership.isOwner ||
        this.hasRole(membership, "APPROVER_ROLE", targetScope) ||
        this.hasRole(membership, "TREASURY_ROLE", targetScope) ||
        this.hasRole(membership, "AUDITOR_ROLE", targetScope);

      if (!hasEvidenceAccess) {
        throw new ProtocolError("UNAUTHORIZED", {
          message:
            "Administrative membership does not grant private evidence access without an authorized role.",
        });
      }
    }

    return { membership, expense, evidence };
  }

  /**
   * Authorizes sensitive administrative operations: role grants, revocations, and exports.
   */
  async authorizeSensitiveAction(
    workspaceId: string,
    context: AuthContext,
    action: "role:manage" | "workspace:manage" | "export:create",
  ): Promise<WorkspaceMembershipInfo> {
    const membership = await this.getMembership(workspaceId, context);

    // All sensitive actions require recent wallet confirmation
    assertRecentConfirmation(context.session);

    switch (action) {
      case "role:manage":
      case "workspace:manage": {
        if (!membership.isOwner) {
          throw new ProtocolError("UNAUTHORIZED", {
            message:
              "Only a workspace owner with recent wallet confirmation can manage roles or workspace settings.",
          });
        }
        break;
      }

      case "export:create": {
        const canExport =
          membership.isOwner ||
          this.hasRole(membership, "AUDITOR_ROLE") ||
          this.hasRole(membership, "TREASURY_ROLE");

        if (!canExport) {
          throw new ProtocolError("UNAUTHORIZED", {
            message:
              "Only authorized auditors, treasury operators, or workspace owners can generate exports.",
          });
        }
        break;
      }
    }

    return membership;
  }
}
