import { describe, expect, it } from "vitest";
import { decodeFunctionData } from "viem";
import { ROLE_IDENTIFIERS } from "@clario/protocol";
import {
  encodeCreateWorkspaceCalldata,
  encodeGrantRoleCalldata,
  encodeRevokeRoleCalldata,
  encodeUpdatePolicyCalldata,
  getRoleHumanName,
  prepareRoleChangeIntent,
  prepareWorkspaceCreationIntent,
  resolveRoleHash,
  WORKSPACE_REGISTRY_ABI,
} from "./calldata";

describe("Workspace Registry Calldata and Intent Preparation", () => {
  const testWorkspaceId =
    "0x1111111111111111111111111111111111111111111111111111111111111111" as const;
  const testPolicyCommitment =
    "0x2222222222222222222222222222222222222222222222222222222222222222" as const;
  const testAccount = "0x3333333333333333333333333333333333333333" as const;
  const testRegistry = "0x4444444444444444444444444444444444444444" as const;
  const globalScope =
    "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

  describe("Function Calldata Encoding and Decoding", () => {
    it("encodes and decodes createWorkspace calldata cleanly", () => {
      const calldata = encodeCreateWorkspaceCalldata(
        testWorkspaceId,
        testPolicyCommitment,
      );

      const decoded = decodeFunctionData({
        abi: WORKSPACE_REGISTRY_ABI,
        data: calldata,
      });

      expect(decoded.functionName).toBe("createWorkspace");
      expect(decoded.args?.[0]).toBe(testWorkspaceId);
      expect(decoded.args?.[1]).toBe(testPolicyCommitment);
    });

    it("encodes and decodes grantRole calldata cleanly", () => {
      const approverRole = ROLE_IDENTIFIERS.APPROVER_ROLE as `0x${string}`;
      const calldata = encodeGrantRoleCalldata(
        testWorkspaceId,
        testAccount,
        approverRole,
        globalScope,
      );

      const decoded = decodeFunctionData({
        abi: WORKSPACE_REGISTRY_ABI,
        data: calldata,
      });

      expect(decoded.functionName).toBe("grantRole");
      expect(decoded.args?.[0]).toBe(testWorkspaceId);
      expect((decoded.args?.[1] as string).toLowerCase()).toBe(
        testAccount.toLowerCase(),
      );
      expect(decoded.args?.[2]).toBe(approverRole);
      expect(decoded.args?.[3]).toBe(globalScope);
    });

    it("encodes and decodes revokeRole calldata cleanly", () => {
      const treasuryRole = ROLE_IDENTIFIERS.TREASURY_ROLE as `0x${string}`;
      const calldata = encodeRevokeRoleCalldata(
        testWorkspaceId,
        testAccount,
        treasuryRole,
        globalScope,
      );

      const decoded = decodeFunctionData({
        abi: WORKSPACE_REGISTRY_ABI,
        data: calldata,
      });

      expect(decoded.functionName).toBe("revokeRole");
      expect(decoded.args?.[0]).toBe(testWorkspaceId);
      expect((decoded.args?.[1] as string).toLowerCase()).toBe(
        testAccount.toLowerCase(),
      );
      expect(decoded.args?.[2]).toBe(treasuryRole);
      expect(decoded.args?.[3]).toBe(globalScope);
    });

    it("encodes and decodes updatePolicy calldata cleanly", () => {
      const calldata = encodeUpdatePolicyCalldata(
        testWorkspaceId,
        testPolicyCommitment,
      );

      const decoded = decodeFunctionData({
        abi: WORKSPACE_REGISTRY_ABI,
        data: calldata,
      });

      expect(decoded.functionName).toBe("updatePolicy");
      expect(decoded.args?.[0]).toBe(testWorkspaceId);
      expect(decoded.args?.[1]).toBe(testPolicyCommitment);
    });
  });

  describe("Role Hash and Human Name Resolution", () => {
    it("resolves role names to standard 32-byte hashes", () => {
      expect(resolveRoleHash("APPROVER_ROLE")).toBe(
        ROLE_IDENTIFIERS.APPROVER_ROLE.toLowerCase(),
      );
      expect(resolveRoleHash("OWNER_ROLE")).toBe(
        ROLE_IDENTIFIERS.OWNER_ROLE.toLowerCase(),
      );
    });

    it("maps standard hashes to human friendly titles", () => {
      expect(getRoleHumanName(ROLE_IDENTIFIERS.OWNER_ROLE)).toBe(
        "Workspace Owner",
      );
      expect(getRoleHumanName(ROLE_IDENTIFIERS.APPROVER_ROLE)).toBe(
        "Expense Approver",
      );
      expect(getRoleHumanName(ROLE_IDENTIFIERS.TREASURY_ROLE)).toBe(
        "Treasury Manager",
      );
    });
  });

  describe("Transaction Intent Generation", () => {
    it("generates structured intent for workspace creation", () => {
      const intent = prepareWorkspaceCreationIntent({
        workspaceRegistryAddress: testRegistry,
        chainId: 31337,
        workspaceId: testWorkspaceId,
        policyCommitment: testPolicyCommitment,
        workspaceName: "Engineering Team",
      });

      expect(intent.to).toBe(testRegistry);
      expect(intent.chainId).toBe(31337);
      expect(intent.functionName).toBe("createWorkspace");
      expect(intent.description).toContain("Engineering Team");
      expect(intent.summary.action).toBe("create_workspace");
    });

    it("generates structured intent for granting a scoped role with warnings on Owner grant", () => {
      const intent = prepareRoleChangeIntent({
        workspaceRegistryAddress: testRegistry,
        chainId: 31337,
        workspaceId: testWorkspaceId,
        action: "grant",
        account: testAccount,
        role: "OWNER_ROLE",
      });

      expect(intent.to).toBe(testRegistry);
      expect(intent.functionName).toBe("grantRole");
      expect(intent.summary.roleName).toBe("Workspace Owner");
      expect(intent.warnings).toBeDefined();
      expect(intent.warnings?.[0]).toContain("confers full authority");
    });

    it("generates structured intent for revoking an operational role without owner warning", () => {
      const intent = prepareRoleChangeIntent({
        workspaceRegistryAddress: testRegistry,
        chainId: 31337,
        workspaceId: testWorkspaceId,
        action: "revoke",
        account: testAccount,
        role: "APPROVER_ROLE",
      });

      expect(intent.functionName).toBe("revokeRole");
      expect(intent.summary.roleName).toBe("Expense Approver");
      expect(intent.warnings).toBeUndefined();
    });
  });
});
