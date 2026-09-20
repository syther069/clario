import { describe, expect, it } from "vitest";
import {
  CLARIO_APPROVAL_DOMAIN_NAME,
  CLARIO_APPROVAL_DOMAIN_VERSION,
  CLARIO_APPROVAL_EIP712_TYPES,
  CLARIO_APPROVAL_PRIMARY_TYPE,
  type ClarioApprovalMessage,
  type ClarioApprovalTypedData,
  isApprovalExpired,
  parseClarioApprovalDomain,
  parseClarioApprovalMessage,
  validateClarioApprovalTypedData,
} from "./approval.js";
import { OnchainDecision } from "./lifecycle.js";
import { ProtocolError } from "./errors.js";

describe("Approval Typed Data (EIP-712)", () => {
  const hex32A =
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const hex32B =
    "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const addressA = "0x1111111111111111111111111111111111111111";

  const validDomain = {
    name: CLARIO_APPROVAL_DOMAIN_NAME,
    version: CLARIO_APPROVAL_DOMAIN_VERSION,
    chainId: 10143,
    verifyingContract: addressA,
  };

  const validMessage = {
    workspaceId: hex32A,
    expenseId: hex32B,
    version: 1,
    commitment: hex32A,
    decision: OnchainDecision.Approve,
    reasonCommitment: hex32B,
    policyVersion: 1,
    nonce: 0n,
    expiration: 1800000000n,
  };

  it("validates a complete, correctly formed ClarioApproval typed data structure", () => {
    const raw = {
      domain: validDomain,
      types: CLARIO_APPROVAL_EIP712_TYPES,
      primaryType: CLARIO_APPROVAL_PRIMARY_TYPE,
      message: validMessage,
    };

    const typedData: ClarioApprovalTypedData =
      validateClarioApprovalTypedData(raw);
    expect(typedData.primaryType).toBe("ClarioApproval");
    expect(typedData.domain.chainId).toBe(10143);
    expect(typedData.message.decision).toBe(OnchainDecision.Approve);
    expect(typedData.message.nonce).toBe(0n);
    expect(typedData.message.expiration).toBe(1800000000n);
  });

  describe("Domain validation", () => {
    it("rejects domain with incorrect name", () => {
      expect(() =>
        parseClarioApprovalDomain({
          ...validDomain,
          name: "OtherApproval",
        }),
      ).toThrow(ProtocolError);
    });

    it("rejects domain with incorrect version", () => {
      expect(() =>
        parseClarioApprovalDomain({
          ...validDomain,
          version: "2",
        }),
      ).toThrow(ProtocolError);
    });

    it("rejects domain with invalid chainId", () => {
      expect(() =>
        parseClarioApprovalDomain({
          ...validDomain,
          chainId: 0,
        }),
      ).toThrow(ProtocolError);

      expect(() =>
        parseClarioApprovalDomain({
          ...validDomain,
          chainId: -1,
        }),
      ).toThrow(ProtocolError);
    });

    it("rejects domain with invalid verifying contract", () => {
      expect(() =>
        parseClarioApprovalDomain({
          ...validDomain,
          verifyingContract: "0x123",
        }),
      ).toThrow(ProtocolError);
    });
  });

  describe("Message validation", () => {
    it("accepts Approve, Reject, and RequestChanges decisions", () => {
      const decisions = [
        OnchainDecision.Approve,
        OnchainDecision.Reject,
        OnchainDecision.RequestChanges,
      ];

      for (const d of decisions) {
        const parsed = parseClarioApprovalMessage({
          ...validMessage,
          decision: d,
        });
        expect(parsed.decision).toBe(d);
      }
    });

    it("rejects decision None (0)", () => {
      expect(() =>
        parseClarioApprovalMessage({
          ...validMessage,
          decision: OnchainDecision.None,
        }),
      ).toThrow(ProtocolError);
    });

    it("rejects invalid decision enum values", () => {
      expect(() =>
        parseClarioApprovalMessage({
          ...validMessage,
          decision: 99,
        }),
      ).toThrow(ProtocolError);
    });

    it("rejects zero or negative expiration", () => {
      expect(() =>
        parseClarioApprovalMessage({
          ...validMessage,
          expiration: 0n,
        }),
      ).toThrow(ProtocolError);

      expect(() =>
        parseClarioApprovalMessage({
          ...validMessage,
          expiration: -10n,
        }),
      ).toThrow(ProtocolError);
    });

    it("rejects negative nonce", () => {
      expect(() =>
        parseClarioApprovalMessage({
          ...validMessage,
          nonce: -1n,
        }),
      ).toThrow(ProtocolError);
    });

    it("rejects nonce or expiration exceeding uint256 bounds", () => {
      const tooLarge = 1n << 256n;
      expect(() =>
        parseClarioApprovalMessage({
          ...validMessage,
          nonce: tooLarge,
        }),
      ).toThrow(ProtocolError);

      expect(() =>
        parseClarioApprovalMessage({
          ...validMessage,
          expiration: tooLarge,
        }),
      ).toThrow(ProtocolError);
    });

    it("rejects malformed workspace, expense, version, and commitment", () => {
      expect(() =>
        parseClarioApprovalMessage({
          ...validMessage,
          workspaceId: "bad",
        }),
      ).toThrow(ProtocolError);

      expect(() =>
        parseClarioApprovalMessage({
          ...validMessage,
          expenseId: "bad",
        }),
      ).toThrow(ProtocolError);

      expect(() =>
        parseClarioApprovalMessage({
          ...validMessage,
          version: 0,
        }),
      ).toThrow(ProtocolError);

      expect(() =>
        parseClarioApprovalMessage({
          ...validMessage,
          commitment: "bad",
        }),
      ).toThrow(ProtocolError);
    });
  });

  describe("isApprovalExpired helper", () => {
    const msg: ClarioApprovalMessage = parseClarioApprovalMessage({
      ...validMessage,
      expiration: 1000n,
    });

    it("returns false if current timestamp is strictly before expiration", () => {
      expect(isApprovalExpired(msg, 999n)).toBe(false);
      expect(isApprovalExpired(msg, 999)).toBe(false);
    });

    it("returns true if current timestamp is equal to or past expiration", () => {
      expect(isApprovalExpired(msg, 1000n)).toBe(true);
      expect(isApprovalExpired(msg, 1001n)).toBe(true);
      expect(isApprovalExpired(msg, 1001)).toBe(true);
    });
  });
});
