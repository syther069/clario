import { encodeFunctionData, type Abi } from "viem";
import { ROLE_IDENTIFIERS, type WorkspaceRole } from "@clario/protocol";
import type { PreparedTransactionIntent, RoleAction } from "./types";

export const WORKSPACE_REGISTRY_ABI = [
  {
    type: "function",
    name: "createWorkspace",
    inputs: [
      { name: "workspaceId", type: "bytes32" },
      { name: "policyCommitment", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "grantRole",
    inputs: [
      { name: "workspaceId", type: "bytes32" },
      { name: "account", type: "address" },
      { name: "role", type: "bytes32" },
      { name: "scope", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "revokeRole",
    inputs: [
      { name: "workspaceId", type: "bytes32" },
      { name: "account", type: "address" },
      { name: "role", type: "bytes32" },
      { name: "scope", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updatePolicy",
    inputs: [
      { name: "workspaceId", type: "bytes32" },
      { name: "policyCommitment", type: "bytes32" },
    ],
    outputs: [{ name: "newPolicyVersion", type: "uint32" }],
    stateMutability: "nonpayable",
  },
] as const satisfies Abi;

export const ROLE_HUMAN_NAMES: Record<string, string> = {
  [ROLE_IDENTIFIERS.OWNER_ROLE.toLowerCase()]: "Workspace Owner",
  [ROLE_IDENTIFIERS.ADMIN_ROLE.toLowerCase()]: "Administrator",
  [ROLE_IDENTIFIERS.APPROVER_ROLE.toLowerCase()]: "Expense Approver",
  [ROLE_IDENTIFIERS.TREASURY_ROLE.toLowerCase()]: "Treasury Manager",
  [ROLE_IDENTIFIERS.AUDITOR_ROLE.toLowerCase()]: "Auditor",
};

export function getRoleHumanName(roleHash: string): string {
  return ROLE_HUMAN_NAMES[roleHash.toLowerCase()] ?? "Custom Role";
}

export function resolveRoleHash(roleOrName: string): `0x${string}` {
  if (roleOrName in ROLE_IDENTIFIERS) {
    return ROLE_IDENTIFIERS[roleOrName as WorkspaceRole] as `0x${string}`;
  }
  if (/^0x[0-9a-fA-F]{64}$/.test(roleOrName)) {
    return roleOrName.toLowerCase() as `0x${string}`;
  }
  throw new Error(`Invalid role identifier: ${roleOrName}`);
}

export function encodeCreateWorkspaceCalldata(
  workspaceId: `0x${string}`,
  policyCommitment: `0x${string}`,
): `0x${string}` {
  return encodeFunctionData({
    abi: WORKSPACE_REGISTRY_ABI,
    functionName: "createWorkspace",
    args: [workspaceId, policyCommitment],
  });
}

export function encodeGrantRoleCalldata(
  workspaceId: `0x${string}`,
  account: `0x${string}`,
  role: `0x${string}`,
  scope: `0x${string}`,
): `0x${string}` {
  return encodeFunctionData({
    abi: WORKSPACE_REGISTRY_ABI,
    functionName: "grantRole",
    args: [workspaceId, account, role, scope],
  });
}

export function encodeRevokeRoleCalldata(
  workspaceId: `0x${string}`,
  account: `0x${string}`,
  role: `0x${string}`,
  scope: `0x${string}`,
): `0x${string}` {
  return encodeFunctionData({
    abi: WORKSPACE_REGISTRY_ABI,
    functionName: "revokeRole",
    args: [workspaceId, account, role, scope],
  });
}

export function encodeUpdatePolicyCalldata(
  workspaceId: `0x${string}`,
  policyCommitment: `0x${string}`,
): `0x${string}` {
  return encodeFunctionData({
    abi: WORKSPACE_REGISTRY_ABI,
    functionName: "updatePolicy",
    args: [workspaceId, policyCommitment],
  });
}

export function prepareWorkspaceCreationIntent(params: {
  workspaceRegistryAddress: `0x${string}`;
  chainId: number;
  workspaceId: `0x${string}`;
  policyCommitment: `0x${string}`;
  workspaceName: string;
}): PreparedTransactionIntent {
  const calldata = encodeCreateWorkspaceCalldata(
    params.workspaceId,
    params.policyCommitment,
  );

  return {
    to: params.workspaceRegistryAddress,
    data: calldata,
    chainId: params.chainId,
    functionName: "createWorkspace",
    description: `Register workspace "${params.workspaceName}" on Monad and assign Owner role to creator.`,
    summary: {
      action: "create_workspace",
      workspaceId: params.workspaceId,
    },
  };
}

export function prepareRoleChangeIntent(params: {
  workspaceRegistryAddress: `0x${string}`;
  chainId: number;
  workspaceId: `0x${string}`;
  action: RoleAction;
  account: `0x${string}`;
  role: string;
  scope?: string | undefined;
}): PreparedTransactionIntent {
  const roleHash = resolveRoleHash(params.role);
  const scopeHex = (
    params.scope && /^0x[0-9a-fA-F]{64}$/.test(params.scope)
      ? params.scope.toLowerCase()
      : "0x0000000000000000000000000000000000000000000000000000000000000000"
  ) as `0x${string}`;

  const roleName = getRoleHumanName(roleHash);
  const calldata =
    params.action === "grant"
      ? encodeGrantRoleCalldata(
          params.workspaceId,
          params.account,
          roleHash,
          scopeHex,
        )
      : encodeRevokeRoleCalldata(
          params.workspaceId,
          params.account,
          roleHash,
          scopeHex,
        );

  const warnings: string[] = [];
  if (roleHash === ROLE_IDENTIFIERS.OWNER_ROLE.toLowerCase()) {
    warnings.push(
      params.action === "grant"
        ? "Caution: Granting OWNER_ROLE confers full authority to manage policies, roles, and all workspace records."
        : "Warning: Revoking an owner reduces the count of active owners in this workspace.",
    );
  }

  const isGlobal =
    scopeHex ===
    "0x0000000000000000000000000000000000000000000000000000000000000000";
  const scopeDesc = isGlobal
    ? "global workspace scope"
    : `scope ${scopeHex.slice(0, 10)}...`;

  return {
    to: params.workspaceRegistryAddress,
    data: calldata,
    chainId: params.chainId,
    functionName: params.action === "grant" ? "grantRole" : "revokeRole",
    description: `${params.action === "grant" ? "Grant" : "Revoke"} ${roleName} for account ${params.account} with ${scopeDesc}.`,
    summary: {
      action: params.action === "grant" ? "grant_role" : "revoke_role",
      workspaceId: params.workspaceId,
      account: params.account,
      role: roleHash,
      roleName,
      scope: scopeHex,
    },
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
