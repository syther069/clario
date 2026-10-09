import { describe, it, expect } from "vitest";
import { buildCanonicalReceiptBundle, computeReceiptHash } from "./registry";
import {
  generateReceiptNumber,
  executeSaveReceiptBundle,
} from "./save-receipt-bundle";
import type { Transaction } from "@/lib/supabase/types";

describe("Multi-Transaction Receipt Bundling & Canonicalization", () => {
  const mockTransactions: Transaction[] = [
    {
      id: "tx-2",
      user_id: "user-1",
      amount: 0.45,
      currency: "USD",
      merchant: "MON TRANSFER (0x380...e368)",
      type: "expense",
      category: "crypto_ops",
      timestamp: "2026-09-24T05:30:00.000Z",
      date: "2026-09-24",
      status: "cleared",
      source: "manual",
      version: 1,
      verification_state: "unverified",
      created_at: "2026-09-24T05:30:00.000Z",
      updated_at: "2026-09-24T05:30:00.000Z",
    },
    {
      id: "tx-1",
      user_id: "user-1",
      amount: 1.59,
      currency: "USD",
      merchant: "MON TRANSFER (0xdb8...50f3)",
      type: "expense",
      category: "crypto_ops",
      timestamp: "2026-07-20T05:30:00.000Z",
      date: "2026-07-20",
      status: "cleared",
      source: "manual",
      version: 1,
      verification_state: "unverified",
      created_at: "2026-07-20T05:30:00.000Z",
      updated_at: "2026-07-20T05:30:00.000Z",
    },
    {
      id: "tx-3",
      user_id: "user-1",
      amount: 8.2,
      currency: "USD",
      merchant: "ETH TRANSFER (0x742...d35e)",
      type: "expense",
      category: "crypto_ops",
      timestamp: "2026-09-26T05:30:00.000Z",
      date: "2026-09-26",
      status: "cleared",
      source: "manual",
      version: 1,
      verification_state: "unverified",
      created_at: "2026-09-26T05:30:00.000Z",
      updated_at: "2026-09-26T05:30:00.000Z",
    },
  ];

  it("should generate receipt numbers in CR-YYYY-XXXX format", () => {
    const receiptNum = generateReceiptNumber();
    expect(receiptNum).toMatch(/^CR-\d{4}-\d{4}$/);
  });

  it("should deterministically sort transactions by ID in canonical bundle", () => {
    const bundle = buildCanonicalReceiptBundle({
      receiptId: "receipt-123",
      receiptNumber: "CR-2026-0001",
      owner: "0x1111111111111111111111111111111111111111",
      transactions: mockTransactions,
      createdAt: "2026-10-01T00:00:00.000Z",
    });

    expect(bundle.transactionCount).toBe(3);
    expect(bundle.totalAmount).toBe(10.24);
    expect(bundle.transactionIds).toEqual(["tx-1", "tx-2", "tx-3"]);
    expect(bundle.transactions[0]?.id).toBe("tx-1");
    expect(bundle.transactions[1]?.id).toBe("tx-2");
    expect(bundle.transactions[2]?.id).toBe("tx-3");
  });

  it("should compute deterministic keccak256 hash regardless of input order", () => {
    const bundleA = buildCanonicalReceiptBundle({
      receiptId: "receipt-123",
      receiptNumber: "CR-2026-0001",
      owner: "0x1111111111111111111111111111111111111111",
      transactions: [
        mockTransactions[0]!,
        mockTransactions[1]!,
        mockTransactions[2]!,
      ],
      createdAt: "2026-10-01T00:00:00.000Z",
    });

    const bundleB = buildCanonicalReceiptBundle({
      receiptId: "receipt-123",
      receiptNumber: "CR-2026-0001",
      owner: "0x1111111111111111111111111111111111111111",
      transactions: [
        mockTransactions[2]!,
        mockTransactions[0]!,
        mockTransactions[1]!,
      ],
      createdAt: "2026-10-01T00:00:00.000Z",
    });

    const hashA = computeReceiptHash(bundleA);
    const hashB = computeReceiptHash(bundleB);

    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("should detect tampering when any transaction amount is altered", () => {
    const bundle = buildCanonicalReceiptBundle({
      receiptId: "receipt-123",
      receiptNumber: "CR-2026-0001",
      owner: "0x1111111111111111111111111111111111111111",
      transactions: mockTransactions,
      createdAt: "2026-10-01T00:00:00.000Z",
    });
    const originalHash = computeReceiptHash(bundle);

    const tamperedTransactions: Transaction[] = [
      ...mockTransactions.slice(0, 2),
      {
        ...mockTransactions[2]!,
        amount: 8.21, // altered amount
      },
    ];

    const tamperedBundle = buildCanonicalReceiptBundle({
      receiptId: "receipt-123",
      receiptNumber: "CR-2026-0001",
      owner: "0x1111111111111111111111111111111111111111",
      transactions: tamperedTransactions,
      createdAt: "2026-10-01T00:00:00.000Z",
    });
    const tamperedHash = computeReceiptHash(tamperedBundle);

    expect(tamperedHash).not.toBe(originalHash);
  });

  describe("Receipt Naming & Cryptographic Commitment", () => {
    it("should include trimmed receiptName in canonical bundle", () => {
      const bundle = buildCanonicalReceiptBundle({
        receiptId: "receipt-named-1",
        receiptNumber: "CR-2026-0005",
        receiptName: "   September Crypto Expenses   ",
        owner: "0x1111111111111111111111111111111111111111",
        transactions: mockTransactions,
        createdAt: "2026-10-01T00:00:00.000Z",
      });

      expect(bundle.receiptName).toBe("September Crypto Expenses");
    });

    it("should truncate receiptName to 80 characters maximum", () => {
      const longName = "A".repeat(100);
      const bundle = buildCanonicalReceiptBundle({
        receiptId: "receipt-named-2",
        receiptNumber: "CR-2026-0006",
        receiptName: longName,
        owner: "0x1111111111111111111111111111111111111111",
        transactions: mockTransactions,
        createdAt: "2026-10-01T00:00:00.000Z",
      });

      expect(bundle.receiptName.length).toBe(80);
      expect(bundle.receiptName).toBe("A".repeat(80));
    });

    it("should produce different cryptographic hashes for different receipt names", () => {
      const bundleNameA = buildCanonicalReceiptBundle({
        receiptId: "receipt-compare",
        receiptNumber: "CR-2026-0010",
        receiptName: "September Crypto Expenses",
        owner: "0x1111111111111111111111111111111111111111",
        transactions: mockTransactions,
        createdAt: "2026-10-01T00:00:00.000Z",
      });

      const bundleNameB = buildCanonicalReceiptBundle({
        receiptId: "receipt-compare",
        receiptNumber: "CR-2026-0010",
        receiptName: "October Crypto Expenses",
        owner: "0x1111111111111111111111111111111111111111",
        transactions: mockTransactions,
        createdAt: "2026-10-01T00:00:00.000Z",
      });

      const hashA = computeReceiptHash(bundleNameA);
      const hashB = computeReceiptHash(bundleNameB);

      // Demonstrates that renaming prevents silent tampering:
      // The blockchain hash binds to the exact receipt name!
      expect(hashA).not.toBe(hashB);
    });

    it("should preserve canonical hash stability for identical names with different whitespace", () => {
      const bundleA = buildCanonicalReceiptBundle({
        receiptId: "receipt-ws",
        receiptNumber: "CR-2026-0020",
        receiptName: "Q3 Business Expenses",
        owner: "0x1111111111111111111111111111111111111111",
        transactions: mockTransactions,
        createdAt: "2026-10-01T00:00:00.000Z",
      });

      const bundleB = buildCanonicalReceiptBundle({
        receiptId: "receipt-ws",
        receiptNumber: "CR-2026-0020",
        receiptName: "   Q3 Business Expenses   ",
        owner: "0x1111111111111111111111111111111111111111",
        transactions: mockTransactions,
        createdAt: "2026-10-01T00:00:00.000Z",
      });

      expect(computeReceiptHash(bundleA)).toBe(computeReceiptHash(bundleB));
    });
  });

  describe("Transaction Bundling Invariants", () => {
    it("should reject bundling transactions that already belong to a receipt bundle", async () => {
      const alreadyBundledTx: Transaction = {
        ...mockTransactions[0]!,
        id: "tx-already-bundled",
        receipt_bundle_id: "existing-bundle-999",
      };

      await expect(
        executeSaveReceiptBundle({
          transactions: [alreadyBundledTx],
          userId: "user-1",
          receiptName: "Test Receipt",
        }),
      ).rejects.toThrow(/already belong to an existing receipt bundle/);
    });
  });
});
