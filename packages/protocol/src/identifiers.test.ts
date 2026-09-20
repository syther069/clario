import { describe, expect, it } from "vitest";
import {
  type ExpenseId,
  type WorkspaceId,
  parseBytes32,
  parseChainId,
  parseCommitmentHash,
  parseDecisionId,
  parseEvmAddress,
  parseExpenseId,
  parseExpenseVersion,
  parsePaymentReference,
  parsePolicyCommitment,
  parsePolicyVersion,
  parseRequestId,
  parseWorkspaceId,
} from "./identifiers.js";

describe("Branded Public Identifiers", () => {
  const validHex32 =
    "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const validAddress = "0x1234567890abcdef1234567890abcdef12345678";

  it("parses valid hex32 identifiers with case normalization", () => {
    expect(parseEvmAddress(validAddress)).toBe(validAddress.toLowerCase());
    const upperHex32 = "0x" + "AB".repeat(32);
    const lowerHex32 = ("0x" + "ab".repeat(32)) as `0x${string}`;

    const ws = parseWorkspaceId(upperHex32);
    expect(ws).toBe(lowerHex32);

    const exp = parseExpenseId(validHex32);
    expect(exp).toBe(validHex32);

    const commit = parseCommitmentHash(validHex32);
    expect(commit).toBe(validHex32);

    const dec = parseDecisionId(validHex32);
    expect(dec).toBe(validHex32);

    const pol = parsePolicyCommitment(validHex32);
    expect(pol).toBe(validHex32);

    const pay = parsePaymentReference(validHex32);
    expect(pay).toBe(validHex32);

    const b32 = parseBytes32(validHex32);
    expect(b32).toBe(validHex32);
  });

  it("parses valid EVM address with case normalization", () => {
    const mixedAddress = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
    const parsed = parseEvmAddress(mixedAddress);
    expect(parsed).toBe(mixedAddress.toLowerCase());
  });

  it("parses valid versions and chain ID integers", () => {
    const expVer = parseExpenseVersion(1);
    expect(expVer).toBe(1);

    const polVer = parsePolicyVersion(5);
    expect(polVer).toBe(5);

    const chain = parseChainId(10143);
    expect(chain).toBe(10143);
  });

  it("parses valid safe request IDs", () => {
    const req = parseRequestId("req_1234-abcd.XYZ");
    expect(req).toBe("req_1234-abcd.XYZ");
  });

  it("rejects malformed 32-byte hex identifiers", () => {
    const badInputs = [
      "",
      "0x123", // too short
      "not-a-hex-value",
      "0x" + "gg".repeat(32), // non-hex characters
      "0x" + "00".repeat(33), // 33 bytes (too long)
      "00".repeat(32), // missing 0x prefix
      null,
      undefined,
      123,
      {},
    ];

    for (const bad of badInputs) {
      expect(() => parseWorkspaceId(bad)).toThrow();
      expect(() => parseExpenseId(bad)).toThrow();
      expect(() => parseCommitmentHash(bad)).toThrow();
      expect(() => parseDecisionId(bad)).toThrow();
      expect(() => parsePolicyCommitment(bad)).toThrow();
      expect(() => parsePaymentReference(bad)).toThrow();
      expect(() => parseBytes32(bad)).toThrow();
    }
  });

  it("rejects malformed EVM addresses", () => {
    const badAddresses = [
      "",
      "0x123",
      "0x" + "00".repeat(21), // 21 bytes
      "0x" + "zz".repeat(20), // non-hex
      "1234567890abcdef1234567890abcdef12345678", // no 0x
      null,
      undefined,
      {},
    ];

    for (const bad of badAddresses) {
      expect(() => parseEvmAddress(bad)).toThrow();
    }
  });

  it("rejects invalid numeric identifiers", () => {
    const badNumbers = [
      0, // must be >= 1
      -1,
      1.5, // non-integer
      NaN,
      Infinity,
      -Infinity,
      "1", // string instead of number
      null,
      undefined,
    ];

    for (const bad of badNumbers) {
      expect(() => parseExpenseVersion(bad)).toThrow();
      expect(() => parsePolicyVersion(bad)).toThrow();
      expect(() => parseChainId(bad)).toThrow();
    }
  });

  it("rejects invalid request IDs", () => {
    const badReqIds = [
      "",
      "a".repeat(65), // > 64 chars
      "bad spaces in id",
      "special!@#chars",
      null,
      undefined,
      123,
    ];

    for (const bad of badReqIds) {
      expect(() => parseRequestId(bad)).toThrow();
    }
  });

  it("type checks nominal branding preventing interchangeability", () => {
    // Type-level assertion: verify that TypeScript nominal types are incompatible
    const ws = parseWorkspaceId(validHex32);
    const exp = parseExpenseId(validHex32);
    const commit = parseCommitmentHash(validHex32);

    // Runtime equality holds because underlying primitives are strings
    expect(ws).toBe(exp);

    // Type checking: assignment between branded types should fail at compile-time
    // @ts-expect-error WorkspaceId cannot be assigned to ExpenseId
    const _invalidExp: ExpenseId = ws;
    // @ts-expect-error CommitmentHash cannot be assigned to WorkspaceId
    const _invalidWs: WorkspaceId = commit;
    // Suppress unused var warnings in test
    expect(_invalidExp).toBeDefined();
    expect(_invalidWs).toBeDefined();
  });
});
