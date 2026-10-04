import { describe, it, expect } from "vitest";
import {
  canonicalizeJson,
  toBytes32Id,
  buildCanonicalTransaction,
  computeTransactionDataHash,
  getMonadExplorerTxUrl,
  getMonadExplorerAddressUrl,
  MONAD_TESTNET_CHAIN_ID,
  MONAD_TESTNET_RPC,
} from "./registry";

describe("Clario Monad Blockchain Registry Module", () => {
  it("verifies Monad Testnet network constants", () => {
    expect(MONAD_TESTNET_CHAIN_ID).toBe(10143);
    expect(MONAD_TESTNET_RPC).toBe("https://testnet-rpc.monad.xyz");
  });

  it("converts string UUID to bytes32 hex deterministic hash", () => {
    const id1 = "c0a80101-0000-0000-0000-000000000001";
    const bytes32_1 = toBytes32Id(id1);
    expect(bytes32_1).toMatch(/^0x[0-9a-fA-F]{64}$/);

    // Same id produces identical bytes32
    expect(toBytes32Id(id1)).toBe(bytes32_1);

    // If already bytes32 hex, returns lowercase
    const existingBytes32 =
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    expect(toBytes32Id(existingBytes32)).toBe(existingBytes32);
  });

  it("canonicalizeJson deterministically sorts keys according to RFC 8785", () => {
    const objA = { z: 1, a: 2, m: 3 };
    const objB = { a: 2, m: 3, z: 1 };

    expect(canonicalizeJson(objA)).toBe('{"a":2,"m":3,"z":1}');
    expect(canonicalizeJson(objA)).toBe(canonicalizeJson(objB));
  });

  it("builds canonical transaction excluding sensitive private data", () => {
    const tx = {
      id: "tx-uuid-1234",
      amount: 49.99,
      currency: "usd",
      merchant: "Monad Node Hosting",
      description: "Cloud compute instance for testnet validator",
      category: "software_tools",
      notes: "Private employee memo: reimbursement for cloud hosting",
      receipt_id: "receipt-secret-999",
      timestamp: "2026-10-01T12:00:00.000Z",
      version: 1,
    };

    const canonical = buildCanonicalTransaction(tx);

    expect(canonical).toEqual({
      transactionId: "tx-uuid-1234",
      amount: 49.99,
      currency: "USD",
      merchant: "Monad Node Hosting",
      category: "software_tools",
      timestamp: "2026-10-01T12:00:00.000Z",
      version: 1,
    });

    // Assert sensitive fields are NOT in canonical commitment
    expect(canonical).not.toHaveProperty("notes");
    expect(canonical).not.toHaveProperty("receipt_id");
    expect(canonical).not.toHaveProperty("receipt");
  });

  it("computes deterministic keccak256 dataHash for identical transactions", () => {
    const txA = {
      id: "tx-uuid-42",
      amount: 100,
      currency: "USD",
      merchant: "GitHub Copilot",
      category: "software_tools",
      timestamp: "2026-10-01T00:00:00.000Z",
    };

    const txB = {
      timestamp: "2026-10-01T00:00:00.000Z",
      merchant: "GitHub Copilot",
      category: "software_tools",
      currency: "USD",
      amount: 100,
      id: "tx-uuid-42",
    };

    const hashA = computeTransactionDataHash(txA);
    const hashB = computeTransactionDataHash(txB);

    expect(hashA).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(hashA).toBe(hashB);
  });

  it("formats Monad Testnet block explorer URLs correctly", () => {
    const txHash =
      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    const address = "0x1234567890123456789012345678901234567890";

    expect(getMonadExplorerTxUrl(txHash)).toBe(
      `https://testnet.monadexplorer.com/tx/${txHash}`,
    );
    expect(getMonadExplorerAddressUrl(address)).toBe(
      `https://testnet.monadexplorer.com/address/${address}`,
    );
  });
});
