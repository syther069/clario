import { describe, it, expect, beforeEach } from "vitest";
import {
  Money,
  TransactionEntity,
  LocalStorageTransactionRepository,
  GetTransactionsUseCase,
  UpsertTransactionUseCase,
  ExtractReceiptTransactionsUseCase,
  BrowserEventBus,
} from "./index";
import type { ReceiptBundle } from "@/lib/supabase/types";

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
  length: 0,
  key: (_idx: number) => null,
};

// Polyfill test globals safely
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

Object.defineProperty(globalThis, "window", {
  value: {
    localStorage: localStorageMock,
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  },
  writable: true,
  configurable: true,
});

describe("Clean Architecture: Domain, Application & Infrastructure Tests", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe("Domain Layer: Value Objects & Entities", () => {
    it("Money value object enforces immutable arithmetic and formatted output", () => {
      const m1 = Money.create(100.5, "USD");
      const m2 = Money.create("49.50", "USD");

      const sum = m1.add(m2);
      expect(sum.amount).toBe(150.0);
      expect(sum.currency).toBe("USD");
      expect(sum.format()).toBe("150.00");
      expect(sum.formatWithCurrency()).toBe("$150.00");

      const diff = m1.subtract(m2);
      expect(diff.amount).toBe(51.0);
    });

    it("Money value object rejects arithmetic across mismatched currencies", () => {
      const usd = Money.create(100, "USD");
      const eur = Money.create(100, "EUR");
      expect(() => usd.add(eur)).toThrowError(/Currency mismatch/);
    });

    it("TransactionEntity enforces domain invariants and DTO conversion", () => {
      const entity = new TransactionEntity({
        id: "tx-domain-1",
        userId: "0xTestUser",
        amount: 250,
        currency: "USD",
        merchant: "Supercloud Services",
        blockchainStatus: "confirmed",
        blockchainTxHash: "0xmonadhash123",
      });

      expect(entity.id).toBe("tx-domain-1");
      expect(entity.userId).toBe("0xtestuser");
      expect(entity.amount).toBe(250);
      expect(entity.isConfirmedOnchain()).toBe(true);

      const dto = entity.toDTO();
      expect(dto.id).toBe("tx-domain-1");
      expect(dto.amount).toBe(250);
      expect(dto.blockchain_tx_hash).toBe("0xmonadhash123");

      const reconstructed = TransactionEntity.fromDTO(dto);
      expect(reconstructed.id).toBe(entity.id);
      expect(reconstructed.amount).toBe(entity.amount);
    });
  });

  describe("Application & Infrastructure Layers: Use Cases & Repositories", () => {
    it("executes GetTransactionsUseCase and UpsertTransactionUseCase with event dispatch", () => {
      const eventBus = new BrowserEventBus();
      let eventFired = false;
      eventBus.subscribe("clario:transactions:updated", () => {
        eventFired = true;
      });

      const repo = new LocalStorageTransactionRepository();
      const upsertUseCase = new UpsertTransactionUseCase(repo, eventBus);
      const getUseCase = new GetTransactionsUseCase(repo);

      const entity = new TransactionEntity({
        id: "tx-app-1",
        userId: "0xWalletA",
        amount: 88.5,
        merchant: "Coffee Shop",
      });

      upsertUseCase.execute(entity, "0xWalletA");

      const list = getUseCase.execute("0xWalletA");
      expect(list).toHaveLength(1);
      expect(list[0]?.id).toBe("tx-app-1");
      expect(list[0]?.merchant).toBe("Coffee Shop");
      expect(eventFired).toBe(true);
    });

    it("executes ExtractReceiptTransactionsUseCase extracting embedded receipt transactions", () => {
      const extractUseCase = new ExtractReceiptTransactionsUseCase();
      const mockBundle = {
        id: "bundle-test-1",
        user_id: "0xuser1",
        name: "Flight Ticket",
        total_amount: 450,
        currency: "USD",
        blockchain_status: "confirmed",
        blockchain_tx_hash: "0xtxhash456",
        verification_status: "verified",
        receipt_data: {
          receiptId: "bundle-test-1",
          receiptName: "Flight Ticket",
          createdAt: "2026-10-10T10:00:00Z",
          transactions: [
            {
              id: "tx-flight-1",
              amount: 450,
              currency: "USD",
              merchant: "Skyway Airlines",
              category: "travel",
              date: "2026-10-10",
              type: "expense",
            },
          ],
        },
      } as unknown as ReceiptBundle;

      const extracted = extractUseCase.execute([mockBundle]);
      expect(extracted).toHaveLength(1);
      expect(extracted[0]?.id).toBe("tx-flight-1");
      expect(extracted[0]?.merchant).toBe("Skyway Airlines");
      expect(extracted[0]?.isConfirmedOnchain()).toBe(true);
    });
  });
});
