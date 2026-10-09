import { describe, it, expect } from "vitest";
import {
  canonicalizeJsonClient,
  AUTHENTIC_RECORD_BASELINE,
  CLARIO_EXPENSE_V1_DOMAIN,
  MONAD_TESTNET_CHAIN_ID,
  CLARIO_REGISTRY_ADDRESS,
  safeGetAddress,
} from "./interactive-proof-visualizer";
import { keccak256, stringToBytes, encodeAbiParameters } from "viem";

describe("InteractiveProofVisualizer Cryptographic Engine", () => {
  it("RFC 8785 canonical JSON sorts all keys lexicographically without whitespace outside quotes", () => {
    const raw = {
      vendor: "AWS Cloud Infrastructure",
      amount: "500.00",
      currency: "USD",
      meta: { zebra: 1, alpha: 2 },
    };

    const canonical = canonicalizeJsonClient(raw);
    expect(canonical).toBe(
      '{"amount":"500.00","currency":"USD","meta":{"alpha":2,"zebra":1},"vendor":"AWS Cloud Infrastructure"}',
    );
  });

  it("produces deterministic 32-byte Keccak-256 privateRecordHash from canonical JSON", () => {
    const record = {
      amount: AUTHENTIC_RECORD_BASELINE.amount,
      currency: AUTHENTIC_RECORD_BASELINE.currency,
      date: AUTHENTIC_RECORD_BASELINE.date,
      expenseId: AUTHENTIC_RECORD_BASELINE.expenseId,
      recipient: safeGetAddress(AUTHENTIC_RECORD_BASELINE.recipient),
      vendor: AUTHENTIC_RECORD_BASELINE.vendor,
      version: AUTHENTIC_RECORD_BASELINE.version,
      workspaceId: AUTHENTIC_RECORD_BASELINE.workspaceId,
    };

    const canonical = canonicalizeJsonClient(record);
    const hash = keccak256(stringToBytes(canonical));

    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(hash).toBe(
      keccak256(stringToBytes(canonicalizeJsonClient(record))),
    );
  });

  it("generates authentic onchain commitment anchored to Monad Testnet (Chain ID 10143)", () => {
    const record = {
      amount: AUTHENTIC_RECORD_BASELINE.amount,
      currency: AUTHENTIC_RECORD_BASELINE.currency,
      date: AUTHENTIC_RECORD_BASELINE.date,
      expenseId: AUTHENTIC_RECORD_BASELINE.expenseId,
      recipient: safeGetAddress(AUTHENTIC_RECORD_BASELINE.recipient),
      vendor: AUTHENTIC_RECORD_BASELINE.vendor,
      version: AUTHENTIC_RECORD_BASELINE.version,
      workspaceId: AUTHENTIC_RECORD_BASELINE.workspaceId,
    };

    const canonical = canonicalizeJsonClient(record);
    const privateRecordHash = keccak256(stringToBytes(canonical));

    const encoded = encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "uint256" },
        { type: "address" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "uint32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
      ],
      [
        CLARIO_EXPENSE_V1_DOMAIN,
        MONAD_TESTNET_CHAIN_ID,
        CLARIO_REGISTRY_ADDRESS,
        AUTHENTIC_RECORD_BASELINE.workspaceId,
        AUTHENTIC_RECORD_BASELINE.expenseId,
        AUTHENTIC_RECORD_BASELINE.version,
        privateRecordHash,
        AUTHENTIC_RECORD_BASELINE.evidenceSha256,
        AUTHENTIC_RECORD_BASELINE.salt,
      ],
    );

    const commitment = keccak256(encoded);
    expect(commitment).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("tamper simulation: altering amount from $500.00 to $5,000.00 triggers cryptographic divergence (Avalanche Effect)", () => {
    // 1. Authentic Commitment
    const authenticPayload = {
      amount: "500.00",
      currency: "USD",
      date: AUTHENTIC_RECORD_BASELINE.date,
      expenseId: AUTHENTIC_RECORD_BASELINE.expenseId,
      recipient: safeGetAddress(AUTHENTIC_RECORD_BASELINE.recipient),
      vendor: AUTHENTIC_RECORD_BASELINE.vendor,
      version: AUTHENTIC_RECORD_BASELINE.version,
      workspaceId: AUTHENTIC_RECORD_BASELINE.workspaceId,
    };
    const authenticHash = keccak256(
      stringToBytes(canonicalizeJsonClient(authenticPayload)),
    );
    const authenticCommitment = keccak256(
      encodeAbiParameters(
        [
          { type: "bytes32" },
          { type: "uint256" },
          { type: "address" },
          { type: "bytes32" },
          { type: "bytes32" },
          { type: "uint32" },
          { type: "bytes32" },
          { type: "bytes32" },
          { type: "bytes32" },
        ],
        [
          CLARIO_EXPENSE_V1_DOMAIN,
          MONAD_TESTNET_CHAIN_ID,
          CLARIO_REGISTRY_ADDRESS,
          AUTHENTIC_RECORD_BASELINE.workspaceId,
          AUTHENTIC_RECORD_BASELINE.expenseId,
          AUTHENTIC_RECORD_BASELINE.version,
          authenticHash,
          AUTHENTIC_RECORD_BASELINE.evidenceSha256,
          AUTHENTIC_RECORD_BASELINE.salt,
        ],
      ),
    );

    // 2. Tampered Payload (Inflation Attack)
    const tamperedPayload = {
      ...authenticPayload,
      amount: "5000.00",
    };
    const tamperedHash = keccak256(
      stringToBytes(canonicalizeJsonClient(tamperedPayload)),
    );
    const tamperedCommitment = keccak256(
      encodeAbiParameters(
        [
          { type: "bytes32" },
          { type: "uint256" },
          { type: "address" },
          { type: "bytes32" },
          { type: "bytes32" },
          { type: "uint32" },
          { type: "bytes32" },
          { type: "bytes32" },
          { type: "bytes32" },
        ],
        [
          CLARIO_EXPENSE_V1_DOMAIN,
          MONAD_TESTNET_CHAIN_ID,
          CLARIO_REGISTRY_ADDRESS,
          AUTHENTIC_RECORD_BASELINE.workspaceId,
          AUTHENTIC_RECORD_BASELINE.expenseId,
          AUTHENTIC_RECORD_BASELINE.version,
          tamperedHash,
          AUTHENTIC_RECORD_BASELINE.evidenceSha256,
          AUTHENTIC_RECORD_BASELINE.salt,
        ],
      ),
    );

    // Assert absolute divergence
    expect(tamperedCommitment).not.toBe(authenticCommitment);
    expect(tamperedHash).not.toBe(authenticHash);
  });

  it("tamper simulation: even a 1-character edit (e.g. $500.00 -> $500.01) completely changes the 256-bit commitment", () => {
    const authenticPayload = {
      amount: "500.00",
      currency: "USD",
      date: AUTHENTIC_RECORD_BASELINE.date,
      expenseId: AUTHENTIC_RECORD_BASELINE.expenseId,
      recipient: safeGetAddress(AUTHENTIC_RECORD_BASELINE.recipient),
      vendor: AUTHENTIC_RECORD_BASELINE.vendor,
      version: AUTHENTIC_RECORD_BASELINE.version,
      workspaceId: AUTHENTIC_RECORD_BASELINE.workspaceId,
    };
    const typoPayload = {
      ...authenticPayload,
      amount: "500.01",
    };

    const hash1 = keccak256(stringToBytes(canonicalizeJsonClient(authenticPayload)));
    const hash2 = keccak256(stringToBytes(canonicalizeJsonClient(typoPayload)));

    expect(hash1).not.toBe(hash2);
  });
});
