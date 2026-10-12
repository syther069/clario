import type { ITransactionRepository } from "../../domain/transaction/ports/ITransactionRepository";
import { TransactionEntity } from "../../domain/transaction/entities/Transaction";
import type { Transaction as StorageTransaction } from "@/lib/supabase/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  ClarioIndexedDB,
  indexedDBService,
  STORES,
} from "./indexeddb/ClarioIndexedDB";
import {
  SyncQueueManager,
  syncQueueManager,
} from "./indexeddb/SyncQueueManager";
import {
  STORAGE_KEY_TRANSACTIONS,
  getScopedKey,
} from "./LocalStorageTransactionRepository";

function getLocalStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== "undefined" && (globalThis as any).localStorage) {
    return (globalThis as any).localStorage;
  }
  return null;
}

/**
 * Clean Architecture - Infrastructure Layer
 * SupabaseTransactionRepository
 *
 * 3-tier hybrid persistence model:
 * - L1: In-Memory Map (synchronous reads/writes for 100% backward compatibility)
 * - L2: IndexedDB (hundreds of MBs client storage, offline-first) with LocalStorage fallback
 * - L3: Supabase PostgreSQL (cloud sync with Row-Level Security)
 */
export class SupabaseTransactionRepository implements ITransactionRepository {
  // L1 In-Memory Cache: Map<id, TransactionEntity>
  private readonly memoryCache = new Map<string, TransactionEntity>();
  private isHydrated = false;
  private isSupabaseSyncing = false;

  constructor(
    private readonly idb: ClarioIndexedDB = indexedDBService,
    private readonly queue: SyncQueueManager = syncQueueManager,
  ) {
    this.seedFromLocalStorage();
    this.hydrateFromIndexedDB().catch((err) =>
      console.warn("Notice: IndexedDB transaction hydration error:", err),
    );
  }

  /**
   * Immediately seeds L1 in-memory cache from localStorage if available,
   * ensuring synchronous calls have immediate data on first frame.
   */
  private seedFromLocalStorage(): void {
    const storage = getLocalStorage();
    if (!storage) return;

    try {
      const raw = storage.getItem(STORAGE_KEY_TRANSACTIONS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && item.id) {
              this.memoryCache.set(
                item.id,
                TransactionEntity.fromDTO(item as StorageTransaction),
              );
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  /**
   * Hydrates L1 memory cache from L2 IndexedDB and migrates any legacy localStorage items.
   */
  public async hydrateFromIndexedDB(): Promise<void> {
    if (!this.idb.isSupported()) {
      this.isHydrated = true;
      return;
    }

    try {
      const idbRecords = await this.idb.getAll<StorageTransaction>(
        STORES.TRANSACTIONS,
      );

      if (idbRecords && idbRecords.length > 0) {
        for (const item of idbRecords) {
          if (item && item.id) {
            this.memoryCache.set(item.id, TransactionEntity.fromDTO(item));
          }
        }
      } else if (this.memoryCache.size > 0) {
        // Auto-migrate legacy localStorage records into IndexedDB
        const legacyItems = Array.from(this.memoryCache.values()).map((e) =>
          e.toDTO(),
        );
        await this.idb.putBatch(STORES.TRANSACTIONS, legacyItems);
      }
    } catch (err) {
      console.warn("Hydrate from IndexedDB error:", err);
    } finally {
      this.isHydrated = true;
    }
  }

  public async getAll(scopeId?: string | null): Promise<TransactionEntity[]> {
    const cached = this.getAllSync(scopeId);

    // Trigger background cloud sync if online and not currently running
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (isOnline) {
      this.syncWithSupabase(scopeId).catch((err) =>
        console.warn("Background Supabase transaction sync error:", err),
      );
    }

    return cached;
  }

  public getAllSync(scopeId?: string | null): TransactionEntity[] {
    const list = Array.from(this.memoryCache.values());

    // Filter by scope if provided
    const filtered =
      scopeId && scopeId.trim()
        ? list.filter((t) => {
            const norm = scopeId.trim().toLowerCase();
            const uid = (t.userId || "").toLowerCase();
            return uid === norm || uid === "";
          })
        : list;

    return filtered.sort((a, b) => {
      const timeA = new Date(
        a.timestamp || a.date || a.createdAt || 0,
      ).getTime();
      const timeB = new Date(
        b.timestamp || b.date || b.createdAt || 0,
      ).getTime();
      return timeB - timeA;
    });
  }

  public async save(
    transactions: TransactionEntity[],
    scopeId?: string | null,
  ): Promise<void> {
    this.saveSync(transactions, scopeId);
  }

  public saveSync(
    transactions: TransactionEntity[],
    scopeId?: string | null,
  ): void {
    // 1. Update L1 In-Memory Cache
    for (const t of transactions) {
      this.memoryCache.set(t.id, t);
    }

    const dtoList = transactions.map((t) => t.toDTO());

    // 2. Persist to L2 IndexedDB asynchronously
    if (this.idb.isSupported()) {
      this.idb
        .putBatch(STORES.TRANSACTIONS, dtoList)
        .catch((err) =>
          console.warn("IndexedDB transaction batch save error:", err),
        );
    }

    // 3. Mirror to localStorage as a safety net
    const storage = getLocalStorage();
    if (storage) {
      try {
        const fullList = Array.from(this.memoryCache.values()).map((t) =>
          t.toDTO(),
        );
        const json = JSON.stringify(fullList);
        storage.setItem(STORAGE_KEY_TRANSACTIONS, json);
        if (scopeId && scopeId.trim()) {
          const scopedKey = getScopedKey(STORAGE_KEY_TRANSACTIONS, scopeId);
          storage.setItem(scopedKey, JSON.stringify(dtoList));
        }
      } catch {
        // storage quota fallback
      }
    }

    // 4. Trigger cloud background upsert
    this.backgroundCloudUpsert(dtoList, scopeId).catch(() => {});
  }

  public async upsert(
    transaction: TransactionEntity,
    scopeId?: string | null,
  ): Promise<TransactionEntity[]> {
    return this.upsertSync(transaction, scopeId);
  }

  public upsertSync(
    transaction: TransactionEntity,
    scopeId?: string | null,
  ): TransactionEntity[] {
    // 1. Update L1 In-Memory Cache
    this.memoryCache.set(transaction.id, transaction);

    const dto = transaction.toDTO();

    // 2. Persist to L2 IndexedDB asynchronously
    if (this.idb.isSupported()) {
      this.idb
        .put(STORES.TRANSACTIONS, dto)
        .catch((err) => console.warn("IndexedDB transaction put error:", err));
    }

    // 3. Mirror to localStorage
    const storage = getLocalStorage();
    if (storage) {
      try {
        const fullList = Array.from(this.memoryCache.values()).map((t) =>
          t.toDTO(),
        );
        storage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(fullList));
      } catch {
        // ignore
      }
    }

    // 4. Cloud background upsert or queue
    this.backgroundCloudUpsert([dto], scopeId).catch(() => {});

    return this.getAllSync(scopeId);
  }

  public async upsertBatch(
    transactions: TransactionEntity[],
    scopeId?: string | null,
  ): Promise<TransactionEntity[]> {
    return this.upsertBatchSync(transactions, scopeId);
  }

  public upsertBatchSync(
    transactions: TransactionEntity[],
    scopeId?: string | null,
  ): TransactionEntity[] {
    if (!transactions || transactions.length === 0) {
      return this.getAllSync(scopeId);
    }

    for (const t of transactions) {
      this.memoryCache.set(t.id, t);
    }

    const dtoList = transactions.map((t) => t.toDTO());

    if (this.idb.isSupported()) {
      this.idb
        .putBatch(STORES.TRANSACTIONS, dtoList)
        .catch((err) =>
          console.warn("IndexedDB transaction batch error:", err),
        );
    }

    const storage = getLocalStorage();
    if (storage) {
      try {
        const fullList = Array.from(this.memoryCache.values()).map((t) =>
          t.toDTO(),
        );
        storage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(fullList));
      } catch {
        // ignore
      }
    }

    this.backgroundCloudUpsert(dtoList, scopeId).catch(() => {});

    return this.getAllSync(scopeId);
  }

  /**
   * Syncs transactions from Supabase PostgreSQL, updating L1 and L2 caches.
   */
  public async syncWithSupabase(scopeId?: string | null): Promise<void> {
    if (this.isSupabaseSyncing) return;
    this.isSupabaseSyncing = true;

    try {
      const supabase = getSupabaseClient(scopeId || undefined);
      let query = supabase.from("transactions").select("*");

      if (scopeId && scopeId.trim()) {
        query = query.eq("user_id", scopeId.trim());
      }

      query = query.order("created_at", { ascending: false }).limit(200);

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        for (const raw of data) {
          if (raw && raw.id) {
            const entity = TransactionEntity.fromDTO(raw as StorageTransaction);
            this.memoryCache.set(raw.id, entity);
          }
        }

        if (this.idb.isSupported()) {
          await this.idb.putBatch(STORES.TRANSACTIONS, data);
        }
      }
    } catch (err) {
      console.warn("Supabase transaction query warning:", err);
    } finally {
      this.isSupabaseSyncing = false;
    }
  }

  private async backgroundCloudUpsert(
    dtos: StorageTransaction[],
    scopeId?: string | null,
  ): Promise<void> {
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (!isOnline) {
      for (const dto of dtos) {
        await this.queue.enqueue({
          entityType: STORES.TRANSACTIONS,
          action: "upsert",
          payload: dto,
          scopeId,
        });
      }
      return;
    }

    try {
      const supabase = getSupabaseClient(scopeId || undefined);
      const { error } = await supabase.from("transactions").upsert(dtos);
      if (error) {
        for (const dto of dtos) {
          await this.queue.enqueue({
            entityType: STORES.TRANSACTIONS,
            action: "upsert",
            payload: dto,
            scopeId,
          });
        }
      }
    } catch {
      for (const dto of dtos) {
        await this.queue.enqueue({
          entityType: STORES.TRANSACTIONS,
          action: "upsert",
          payload: dto,
          scopeId,
        });
      }
    }
  }
}
