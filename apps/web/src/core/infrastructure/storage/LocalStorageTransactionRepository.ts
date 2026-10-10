import type { ITransactionRepository } from "../../domain/transaction/ports/ITransactionRepository";
import { TransactionEntity } from "../../domain/transaction/entities/Transaction";
import type { Transaction as StorageTransaction } from "@/lib/supabase/types";

export const STORAGE_KEY_TRANSACTIONS = "clario_transactions";

export function normalizeIdentityKey(id?: string | null): string {
  if (!id || typeof id !== "string") return "";
  return id.trim().toLowerCase();
}

export function getScopedKey(baseKey: string, scopeId?: string | null): string {
  if (!scopeId || !scopeId.trim()) return baseKey;
  const norm = normalizeIdentityKey(scopeId);
  return `${norm}_${baseKey}`;
}

/**
 * Clean Architecture - Infrastructure Layer
 * LocalStorageTransactionRepository
 * Implements ITransactionRepository using browser localStorage with multi-tenant scoping.
 */
export class LocalStorageTransactionRepository implements ITransactionRepository {
  public async getAll(scopeId?: string | null): Promise<TransactionEntity[]> {
    return this.getAllSync(scopeId);
  }

  public getAllSync(scopeId?: string | null): TransactionEntity[] {
    if (typeof window === "undefined" || !window.localStorage) {
      return [];
    }

    try {
      const txMap = new Map<string, TransactionEntity>();

      // 1. Read global store
      const rawGlobal = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
      if (rawGlobal) {
        const parsed = JSON.parse(rawGlobal);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && item.id) {
              txMap.set(item.id, TransactionEntity.fromDTO(item as StorageTransaction));
            }
          }
        }
      }

      // 2. Read scoped store if provided
      if (scopeId && scopeId.trim()) {
        const scopedKey = getScopedKey(STORAGE_KEY_TRANSACTIONS, scopeId);
        const rawScoped = localStorage.getItem(scopedKey);
        if (rawScoped) {
          const parsed = JSON.parse(rawScoped);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item && item.id) {
                txMap.set(item.id, TransactionEntity.fromDTO(item as StorageTransaction));
              }
            }
          }
        }
      }

      if (txMap.size > 0) {
        return Array.from(txMap.values()).sort((a, b) => {
          const timeA = new Date(a.date || a.timestamp || a.createdAt || 0).getTime();
          const timeB = new Date(b.date || b.timestamp || b.createdAt || 0).getTime();
          return timeB - timeA;
        });
      }
    } catch (err) {
      console.warn("Notice: Error reading transactions from storage repository:", err);
    }

    return [];
  }

  public async save(transactions: TransactionEntity[], scopeId?: string | null): Promise<void> {
    this.saveSync(transactions, scopeId);
  }

  public saveSync(transactions: TransactionEntity[], scopeId?: string | null): void {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }

    try {
      const dtoArray = transactions.map((t) => t.toDTO());
      const json = JSON.stringify(dtoArray);
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, json);
      if (scopeId && scopeId.trim()) {
        const scopedKey = getScopedKey(STORAGE_KEY_TRANSACTIONS, scopeId);
        localStorage.setItem(scopedKey, json);
      }
    } catch (err) {
      console.warn("Notice: Error saving transactions to storage repository:", err);
    }
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
    const current = this.getAllSync(scopeId);
    const updated = [
      transaction,
      ...current.filter((t) => t.id !== transaction.id),
    ];
    this.saveSync(updated, scopeId);
    return updated;
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

    const current = this.getAllSync(scopeId);
    const txMap = new Map<string, TransactionEntity>();
    for (const t of current) {
      txMap.set(t.id, t);
    }
    for (const t of transactions) {
      txMap.set(t.id, t);
    }

    const updated = Array.from(txMap.values()).sort((a, b) => {
      const timeA = new Date(a.date || a.timestamp || a.createdAt || 0).getTime();
      const timeB = new Date(b.date || b.timestamp || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    this.saveSync(updated, scopeId);
    return updated;
  }
}
