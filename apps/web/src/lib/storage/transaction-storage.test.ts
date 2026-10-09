import { describe, it, expect, beforeEach } from "vitest";
import {
  getStoredTransactions,
  saveStoredTransactions,
  upsertStoredTransaction,
  upsertStoredTransactions,
  extractTransactionsFromReceiptBundles,
  STORAGE_KEY_TRANSACTIONS,
} from "./transaction-storage";
import {
  getStoredReceiptBundles,
  saveStoredReceiptBundle,
  saveStoredReceiptBundles,
  mergeReceiptBundles,
  STORAGE_KEY_RECEIPTS,
} from "@/lib/receipts/receipt-client-storage";
import type { Transaction, ReceiptBundle } from "@/lib/supabase/types";

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const key in store) delete store[key];
  },
};

// @ts-expect-error test environment polyfill
globalThis.localStorage = localStorageMock;
// @ts-expect-error test environment polyfill
globalThis.window = { localStorage: localStorageMock };

describe("Transaction & Receipt Client Storage Engine", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("stores and retrieves transactions across scoped and global keys", () => {
    const mockTx: Transaction = {
      id: "tx-test-1",
      user_id: "0x1234567890abcdef1234567890abcdef12345678",
      type: "expense",
      amount: 45.5,
      currency: "USD",
      merchant: "Acme Cloud",
      category: "hosting",
      date: "2026-10-09",
      timestamp: "2026-10-09T12:00:00Z",
      payment_method: "Credit Card",
      verification_state: "unverified",
      verification_status: "unverified",
      blockchain_status: null,
      status: "cleared",
      source: "manual",
      version: 1,
      created_at: "2026-10-09T12:00:00Z",
      updated_at: "2026-10-09T12:00:00Z",
    };

    upsertStoredTransaction(mockTx, "0x1234567890abcdef1234567890abcdef12345678");

    // Can read via scoped address
    const fromScoped = getStoredTransactions("0x1234567890abcdef1234567890abcdef12345678");
    expect(fromScoped).toHaveLength(1);
    expect(fromScoped[0]?.id).toBe("tx-test-1");

    // Can read via global key
    const fromGlobal = getStoredTransactions(null);
    expect(fromGlobal).toHaveLength(1);
    expect(fromGlobal[0]?.merchant).toBe("Acme Cloud");
  });

  it("extracts and restores transactions from receipt bundles with Monad verified status", () => {
    const mockBundle: ReceiptBundle = {
      id: "bundle-alpha",
      user_id: "0xuser",
      wallet_address: "0xuser",
      name: "Office Supplies Multi-Receipt",
      receipt_number: "CR-2026-001",
      file_hash: "0xhash123",
      total_amount: 120.0,
      currency: "USD",
      transaction_count: 2,
      transaction_ids: ["tx-1", "tx-2"],
      receipt_hash: "0xhash123",
      blockchain_network: "Monad Testnet",
      blockchain_status: "confirmed",
      blockchain_tx_hash: "0xmonadtxhash789",
      verification_status: "verified",
      receipt_data: {
        receiptId: "bundle-alpha",
        receiptNumber: "CR-2026-001",
        receiptName: "Office Supplies Multi-Receipt",
        createdAt: "2026-10-09T10:00:00Z",
        owner: "0xuser",
        transactionCount: 2,
        totalAmount: 120.0,
        currency: "USD",
        transactionIds: ["tx-1", "tx-2"],
        transactions: [
          {
            id: "tx-1",
            amount: 70.0,
            currency: "USD",
            merchant: "Office Depot",
            category: "Supplies",
            date: "2026-10-09",
            type: "expense",
          },
          {
            id: "tx-2",
            amount: 50.0,
            currency: "USD",
            merchant: "Paper Co",
            category: "Supplies",
            date: "2026-10-09",
            type: "expense",
          },
        ],
        version: 1,
      },
      created_at: "2026-10-09T10:00:00Z",
      updated_at: "2026-10-09T10:00:00Z",
    };

    const extracted = extractTransactionsFromReceiptBundles([mockBundle]);
    expect(extracted).toHaveLength(2);

    const tx1 = extracted.find((t) => t.id === "tx-1");
    expect(tx1).toBeDefined();
    expect(tx1?.amount).toBe(70.0);
    expect(tx1?.merchant).toBe("Office Depot");
    expect(tx1?.receipt_bundle_id).toBe("bundle-alpha");
    expect(tx1?.verification_state).toBe("verified");
    expect(tx1?.blockchain_status).toBe("confirmed");
    expect(tx1?.monad_tx_hash).toBe("0xmonadtxhash789");

    const tx2 = extracted.find((t) => t.id === "tx-2");
    expect(tx2).toBeDefined();
    expect(tx2?.amount).toBe(50.0);
    expect(tx2?.merchant).toBe("Paper Co");
    expect(tx2?.receipt_bundle_id).toBe("bundle-alpha");
    expect(tx2?.monad_tx_hash).toBe("0xmonadtxhash789");
  });

  it("stores and merges receipt bundles without data loss", () => {
    const bundle: ReceiptBundle = {
      id: "bundle-99",
      user_id: "0xowner",
      wallet_address: "0xowner",
      name: "Dinner Expense",
      receipt_number: "CR-0099",
      file_hash: "0xhash99",
      total_amount: 85.0,
      currency: "USD",
      transaction_count: 1,
      transaction_ids: ["tx-99"],
      receipt_hash: "0xhash99",
      receipt_data: {
        receiptId: "bundle-99",
        receiptNumber: "CR-0099",
        receiptName: "Dinner Expense",
        createdAt: "2026-10-09T14:00:00Z",
        owner: "0xowner",
        transactionCount: 1,
        totalAmount: 85.0,
        currency: "USD",
        transactionIds: ["tx-99"],
        transactions: [],
        version: 1,
      },
      blockchain_network: "Monad Testnet",
      blockchain_status: "confirmed",
      blockchain_tx_hash: "0xtxmonad99",
      verification_status: "verified",
      created_at: "2026-10-09T14:00:00Z",
      updated_at: "2026-10-09T14:00:00Z",
    };

    saveStoredReceiptBundle(bundle, "0xowner");

    const retrieved = getStoredReceiptBundles("0xowner");
    expect(retrieved["bundle-99"]).toBeDefined();
    expect(retrieved["bundle-99"]?.name).toBe("Dinner Expense");
    expect(retrieved["bundle-99"]?.blockchain_tx_hash).toBe("0xtxmonad99");

    // Merging incoming bundle with richer data preserves properties
    const updated = mergeReceiptBundles(retrieved, {
      "bundle-99": {
        ...bundle,
        name: "Dinner Expense (Renamed)",
      },
    });

    expect(updated["bundle-99"]?.name).toBe("Dinner Expense (Renamed)");
    expect(updated["bundle-99"]?.blockchain_tx_hash).toBe("0xtxmonad99");
  });
});
