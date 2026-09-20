import { describe, expect, it } from "vitest";
import { keccak256, stringToBytes } from "viem";
import {
  computeReasonCommitment,
  encodeRecordDecisionCalldata,
  buildClarioApprovalTypedData,
  mapDecisionTypeToOnchain,
  mapOnchainDecisionToType,
  ZERO_BYTES32,
} from "./decision";

describe("Review Decision Primitives (decision.ts)", () => {
  const dummyWorkspace =
    "0x1111111111111111111111111111111111111111111111111111111111111111" as `0x${string}`;
  const dummyExpenseId =
    "0x2222222222222222222222222222222222222222222222222222222222222222" as `0x${string}`;
  const dummyCommitment =
    "0x3333333333333333333333333333333333333333333333333333333333333333" as `0x${string}`;
  const dummyReviewer =
    "0x4444444444444444444444444444444444444444" as `0x${string}`;
  const dummyRegistry =
    "0x5555555555555555555555555555555555555555" as `0x${string}`;

  describe("computeReasonCommitment", () => {
    it("returns ZERO_BYTES32 when approving without a reason", () => {
      const commitment = computeReasonCommitment({ decision: "approve" });
      expect(commitment).toBe(ZERO_BYTES32);
    });

    it("returns ZERO_BYTES32 when approving with empty or whitespace reason", () => {
      const commitment = computeReasonCommitment({
        decision: "approve",
        reason: "   ",
      });
      expect(commitment).toBe(ZERO_BYTES32);
    });

    it("returns keccak256 hash when approving with an optional reason", () => {
      const reason = "Complies with policy";
      const expected = keccak256(stringToBytes(reason));
      const commitment = computeReasonCommitment({
        decision: "approve",
        reason,
      });
      expect(commitment).toBe(expected);
    });

    it("returns keccak256 hash when rejecting with a valid reason", () => {
      const reason = "Receipt does not match claimed amount";
      const expected = keccak256(stringToBytes(reason));
      const commitment = computeReasonCommitment({
        decision: "reject",
        reason,
      });
      expect(commitment).toBe(expected);
    });

    it("returns keccak256 hash when requesting changes with a valid reason", () => {
      const reason = "Please upload itemized receipt";
      const expected = keccak256(stringToBytes(reason));
      const commitment = computeReasonCommitment({
        decision: "request_changes",
        reason,
      });
      expect(commitment).toBe(expected);
    });

    it("throws ProtocolError when rejecting without a reason", () => {
      expect(() =>
        computeReasonCommitment({ decision: "reject" }),
      ).toThrowError(/strictly required/i);
    });

    it("throws ProtocolError when requesting changes without a reason", () => {
      expect(() =>
        computeReasonCommitment({ decision: "request_changes" }),
      ).toThrowError(/strictly required/i);
    });

    it("throws ProtocolError when reason is only whitespace for rejection", () => {
      expect(() =>
        computeReasonCommitment({ decision: "reject", reason: "   \t\n  " }),
      ).toThrowError(/strictly required/i);
    });
  });

  describe("mapDecisionTypeToOnchain & mapOnchainDecisionToType", () => {
    it("maps types correctly in both directions", () => {
      expect(mapDecisionTypeToOnchain("approve")).toBe(1);
      expect(mapDecisionTypeToOnchain("reject")).toBe(2);
      expect(mapDecisionTypeToOnchain("request_changes")).toBe(3);

      expect(mapOnchainDecisionToType(1)).toBe("approve");
      expect(mapOnchainDecisionToType(2)).toBe("reject");
      expect(mapOnchainDecisionToType(3)).toBe("request_changes");
    });

    it("returns 'none' on invalid onchain integer", () => {
      expect(mapOnchainDecisionToType(0)).toBe("none");
      expect(mapOnchainDecisionToType(4)).toBe("none");
    });
  });

  describe("encodeRecordDecisionCalldata", () => {
    it("encodes valid function calldata matching ClarioDecisionRegistryV1.recordDecision", () => {
      const calldata = encodeRecordDecisionCalldata({
        workspaceId: dummyWorkspace,
        expenseId: dummyExpenseId,
        version: 1,
        decision: "approve",
        commitment: dummyCommitment,
      });

      expect(calldata.startsWith("0x")).toBe(true);
      expect(calldata.length).toBe(2 + 8 + 6 * 64);
    });

    it("encodes rejection calldata with reason commitment", () => {
      const reasonHash = keccak256(stringToBytes("Invalid tax invoice"));
      const calldata = encodeRecordDecisionCalldata({
        workspaceId: dummyWorkspace,
        expenseId: dummyExpenseId,
        version: 2,
        decision: "reject",
        commitment: dummyCommitment,
        reasonCommitment: reasonHash,
      });

      expect(calldata.startsWith("0x")).toBe(true);
      expect(calldata.length).toBe(2 + 8 + 6 * 64);
    });

    it("normalizes non-hex string workspaceId into 32-byte hex", () => {
      const calldata = encodeRecordDecisionCalldata({
        workspaceId: "ws_acme_corp",
        expenseId: dummyExpenseId,
        version: 1,
        decision: "approve",
        commitment: dummyCommitment,
      });

      expect(calldata.startsWith("0x")).toBe(true);
      expect(calldata.length).toBe(2 + 8 + 6 * 64);
    });
  });

  describe("buildClarioApprovalTypedData", () => {
    it("builds and validates standard EIP-712 typed data envelope", () => {
      const typedData = buildClarioApprovalTypedData({
        workspaceId: dummyWorkspace,
        expenseId: dummyExpenseId,
        version: 1,
        commitment: dummyCommitment,
        decision: "approve",
        reviewer: dummyReviewer,
        policyVersion: 1,
        nonce: 0,
        deadline: 1700000000,
        chainId: 31337,
        verifyingContract: dummyRegistry,
      });

      expect(typedData.primaryType).toBe("ClarioApproval");
      expect(typedData.domain).toEqual({
        name: "ClarioApproval",
        version: "1",
        chainId: 31337,
        verifyingContract: dummyRegistry.toLowerCase(),
      });
      expect(typedData.message).toMatchObject({
        workspaceId: dummyWorkspace,
        expenseId: dummyExpenseId,
        version: 1,
        commitment: dummyCommitment,
        decision: 1,
        reasonCommitment: ZERO_BYTES32,
        policyVersion: 1,
        nonce: 0n,
        expiration: 1700000000n,
      });
    });
  });
});
