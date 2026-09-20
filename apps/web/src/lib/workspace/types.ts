import type { HexString } from "@clario/database";

export interface WorkspaceSummary {
  readonly workspaceId: HexString;
  readonly name: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly isOwner: boolean;
  readonly memberCount: number;
  readonly activeRoles: string[];
}

export interface WorkspaceMemberDetails {
  readonly membershipId: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly address: string;
  readonly status: "active" | "suspended" | "revoked";
  readonly roles: ReadonlyArray<{
    readonly grantId: string;
    readonly role: string;
    readonly roleName: string;
    readonly scope: string;
    readonly grantedAt: string;
  }>;
}

export type RoleAction = "grant" | "revoke";

export interface PreparedTransactionIntent {
  readonly to: `0x${string}`;
  readonly data: `0x${string}`;
  readonly chainId: number;
  readonly functionName: string;
  readonly description: string;
  readonly summary: {
    readonly action:
      "create_workspace" | "grant_role" | "revoke_role" | "update_policy";
    readonly workspaceId: string;
    readonly account?: string | undefined;
    readonly role?: string | undefined;
    readonly roleName?: string | undefined;
    readonly scope?: string | undefined;
  };
  readonly warnings?: string[] | undefined;
}

export interface PrepareRoleParams {
  readonly workspaceId: string;
  readonly action: RoleAction;
  readonly account: `0x${string}`;
  readonly role: string;
  readonly scope?: string | undefined;
}

export interface ReconcileRoleParams {
  readonly workspaceId: string;
  readonly action: RoleAction;
  readonly account: `0x${string}`;
  readonly role: string;
  readonly scope: string;
  readonly txHash: `0x${string}`;
}
