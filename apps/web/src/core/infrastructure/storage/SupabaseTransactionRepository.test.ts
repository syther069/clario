import { describe, it, expect, beforeEach, vi } from "vitest";
import { SupabaseTransactionRepository } from "./SupabaseTransactionRepository";
import { TransactionEntity } from "../../domain/transaction/entities/Transaction";
import { ClarioIndexedDB } from "./indexeddb/ClarioIndexedDB";
import { SyncQueueManager } from "./indexeddb/SyncQueueManager";

const cloudData = [
  {
    id: "cloud-tx-1",
    user_id: "user-1",
    amount: 99.99,
    currency: "USD",
    type: "expense" as const,
    merchant: "AWS Cloud",
    timestamp: "2026-10-12T10:00:00Z",
    date: "2026-10-12",
    created_at: "2026-10-12T10:00:00Z",
    updated_at: "2026-10-12T10:00:00Z",
    status: "cleared" as const,
    source: "manual" as const,
    version: 1,
    verification_state: "unverified" as const,
  },
];

const createQueryBuilder = () => {
  const builder: any = {
    eq: () => builder,
    order: () => builder,
    limit: () => Promise.resolve({ data: cloudData, error: null }),
  };
  return builder;
};

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseClient: () => ({
    from: () => ({
      select: () => createQueryBuilder(),
      upsert: () => Promise.resolve({ error: null }),
    }),
  }),
}));

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
  key: () => null,
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

Object.defineProperty(globalThis, "navigator", {
  value: { onLine: true },
  writable: true,
  configurable: true,
});

describe("SupabaseTransactionRepository (Hybrid Persistence)", () => {
  let mockIdb: ClarioIndexedDB;
  let mockQueue: SyncQueueManager;
  let repo: SupabaseTransactionRepository;

  beforeEach(() => {
    localStorageMock.clear();
    mockIdb = new ClarioIndexedDB();
    vi.spyOn(mockIdb, "isSupported").mockReturnValue(false);

    mockQueue = new SyncQueueManager(mockIdb);
    vi.spyOn(mockQueue, "enqueue").mockResolvedValue();

    repo = new SupabaseTransactionRepository(mockIdb, mockQueue);
  });

  it("stores and retrieves transactions synchronously via L1 cache", () => {
    const tx = TransactionEntity.fromDTO({
      id: "tx-local-1",
      user_id: "user-1",
      amount: 45.5,
      currency: "USD",
      type: "expense",
      merchant: "Coffee Roasters",
      timestamp: "2026-10-12T09:00:00Z",
      date: "2026-10-12",
      created_at: "2026-10-12T09:00:00Z",
      updated_at: "2026-10-12T09:00:00Z",
      status: "cleared",
      source: "manual",
      version: 1,
      verification_state: "unverified",
    });

    const updated = repo.upsertSync(tx);
    expect(updated).toHaveLength(1);
    expect(updated[0]?.id).toBe("tx-local-1");

    const fetched = repo.getAllSync();
    expect(fetched).toHaveLength(1);
    expect(fetched[0]?.merchant).toBe("Coffee Roasters");
  });

  it("seeds from legacy localStorage if present on boot", () => {
    localStorageMock.setItem(
      "clario_transactions",
      JSON.stringify([
        {
          id: "tx-legacy-1",
          user_id: "user-1",
          amount: 120,
          currency: "USD",
          type: "expense",
          merchant: "Office Supplies",
          timestamp: "2026-10-11T12:00:00Z",
          date: "2026-10-11",
          created_at: "2026-10-11T12:00:00Z",
          updated_at: "2026-10-11T12:00:00Z",
          status: "cleared",
          source: "manual",
          version: 1,
          verification_state: "unverified",
        },
      ]),
    );

    const newRepo = new SupabaseTransactionRepository(mockIdb, mockQueue);
    const transactions = newRepo.getAllSync();
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.id).toBe("tx-legacy-1");
    expect(transactions[0]?.merchant).toBe("Office Supplies");
  });

  it("handles batch upserts and sorts by timestamp descending", () => {
    const tx1 = TransactionEntity.fromDTO({
      id: "tx-batch-1",
      user_id: "user-1",
      amount: 10,
      currency: "USD",
      type: "expense",
      merchant: "Past Transaction",
      timestamp: "2026-10-01T10:00:00Z",
      date: "2026-10-01",
      created_at: "2026-10-01T10:00:00Z",
      updated_at: "2026-10-01T10:00:00Z",
      status: "cleared",
      source: "manual",
      version: 1,
      verification_state: "unverified",
    });

    const tx2 = TransactionEntity.fromDTO({
      id: "tx-batch-2",
      user_id: "user-1",
      amount: 20,
      currency: "USD",
      type: "expense",
      merchant: "Recent Transaction",
      timestamp: "2026-10-12T10:00:00Z",
      date: "2026-10-12",
      created_at: "2026-10-12T10:00:00Z",
      updated_at: "2026-10-12T10:00:00Z",
      status: "cleared",
      source: "manual",
      version: 1,
      verification_state: "unverified",
    });

    const results = repo.upsertBatchSync([tx1, tx2]);
    expect(results).toHaveLength(2);
    // Recent should be first
    expect(results[0]?.id).toBe("tx-batch-2");
    expect(results[1]?.id).toBe("tx-batch-1");
  });

  it("fetches from Supabase and merges into memory cache during getAll", async () => {
    await repo.syncWithSupabase("user-1");

    const updated = repo.getAllSync("user-1");
    expect(updated.some((t) => t.id === "cloud-tx-1")).toBe(true);
  });
});
