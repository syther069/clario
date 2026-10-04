import { describe, it, expect, beforeEach } from "vitest";
import {
  SavedReceiptsStorageService,
  normalizeWalletAddress,
  isValidEvmAddress,
} from "./saved-receipts-storage";
import type { ReceiptBundle } from "@/lib/supabase/types";

describe("SavedReceiptsStorageService", () => {
  let storage: SavedReceiptsStorageService;

  const walletA = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
  const walletAUppercase = "0x742D35CC6634C0532925A3B844BC454E4438F44E";
  const walletB = "0x5342d35Cc6634C0532925a3b844Bc454e4438f999";

  beforeEach(() => {
    storage = new SavedReceiptsStorageService();
  });

  it("normalizes EVM wallet address to lowercase", () => {
    expect(normalizeWalletAddress(walletAUppercase)).toBe(
      walletA.toLowerCase(),
    );
    expect(isValidEvmAddress(walletA)).toBe(true);
    expect(isValidEvmAddress("not-an-address")).toBe(false);
  });

  it("persists receipt and associates it with normalized wallet address", async () => {
    const mockBundle: ReceiptBundle = {
      id: "receipt_test_1",
      user_id: walletA,
      wallet_address: walletA,
      name: "Coffee Shop Monad",
      receipt_name: "Coffee Shop Monad",
      receipt_number: "CR-2026-001",
      file_hash: "0xhash1",
      receipt_hash: "0xhash1",
      transaction_count: 1,
      total_amount: 4.5,
      currency: "USD",
      transaction_ids: ["tx_1"],
      receipt_data: {
        receiptId: "receipt_test_1",
        receiptNumber: "CR-2026-001",
        receiptName: "Coffee Shop Monad",
        createdAt: new Date().toISOString(),
        owner: walletA,
        transactionCount: 1,
        totalAmount: 4.5,
        currency: "USD",
        transactionIds: ["tx_1"],
        transactions: [
          {
            id: "tx_1",
            amount: 4.5,
            currency: "USD",
            merchant: "Coffee Shop Monad",
            category: "Food",
            date: "2026-10-03",
            type: "expense",
          },
        ],
        version: 1,
      },
      blockchain_network: "Monad Testnet",
      blockchain_status: "confirmed",
      blockchain_tx_hash: "0xtxhash1",
      verification_status: "verified",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { success, receipt } = await storage.saveReceipt({
      bundle: mockBundle,
      userAddress: walletAUppercase,
      txHash: "0xtxhash1",
      chain: "Monad Testnet",
    });

    expect(success).toBe(true);
    expect(receipt.wallet_address).toBe(walletA.toLowerCase());

    // Query with different casing should return the exact saved receipt
    const receiptsLower = await storage.getReceiptsByWallet(
      walletA.toLowerCase(),
    );
    const receiptsUpper = await storage.getReceiptsByWallet(walletAUppercase);

    expect(receiptsLower.length).toBeGreaterThanOrEqual(1);
    expect(receiptsUpper.length).toBe(receiptsLower.length);
    expect(receiptsUpper[0]?.id).toBe("receipt_test_1");
    expect(receiptsUpper[0]?.blockchain_tx_hash).toBe("0xtxhash1");
  });

  it("enforces connected-wallet security: Wallet B cannot read Wallet A's receipts", async () => {
    const receiptsB = await storage.getReceiptsByWallet(walletB);
    const hasWalletAReceipt = receiptsB.some((r) => r.id === "receipt_test_1");
    expect(hasWalletAReceipt).toBe(false);
  });

  it("guarantees duplicate protection: saving same transaction twice is idempotent", async () => {
    const mockBundle: ReceiptBundle = {
      id: "receipt_test_idempotent",
      user_id: walletA,
      wallet_address: walletA,
      name: "Server Hosting",
      receipt_name: "Server Hosting",
      receipt_number: "CR-2026-002",
      file_hash: "0xhash2",
      receipt_hash: "0xhash2",
      transaction_count: 1,
      total_amount: 50.0,
      currency: "USD",
      transaction_ids: ["tx_2"],
      receipt_data: {
        receiptId: "receipt_test_idempotent",
        receiptNumber: "CR-2026-002",
        receiptName: "Server Hosting",
        createdAt: new Date().toISOString(),
        owner: walletA,
        transactionCount: 1,
        totalAmount: 50.0,
        currency: "USD",
        transactionIds: ["tx_2"],
        transactions: [
          {
            id: "tx_2",
            amount: 50.0,
            currency: "USD",
            merchant: "Server Hosting",
            category: "Infrastructure",
            date: "2026-10-03",
            type: "expense",
          },
        ],
        version: 1,
      },
      blockchain_network: "Monad Testnet",
      blockchain_status: "confirmed",
      blockchain_tx_hash: "0xtxhash2",
      verification_status: "verified",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save first time
    await storage.saveReceipt({
      bundle: mockBundle,
      userAddress: walletA,
      txHash: "0xtxhash2",
      chain: "Monad Testnet",
    });

    const countBefore = (await storage.getReceiptsByWallet(walletA)).filter(
      (r) => r.blockchain_tx_hash === "0xtxhash2",
    ).length;
    expect(countBefore).toBe(1);

    // Save second time with same transaction
    await storage.saveReceipt({
      bundle: { ...mockBundle, total_amount: 55.0 },
      userAddress: walletA,
      txHash: "0xtxhash2",
      chain: "Monad Testnet",
    });

    const matchingReceipts = (
      await storage.getReceiptsByWallet(walletA)
    ).filter((r) => r.blockchain_tx_hash === "0xtxhash2");
    expect(matchingReceipts.length).toBe(1);
    expect(matchingReceipts[0]?.total_amount).toBe(55.0);
  });
});
