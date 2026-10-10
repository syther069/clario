import type { TransactionEntity } from "../entities/Transaction";

/**
 * Clean Architecture - Domain Port
 * Interface: ITransactionRepository
 * Defines contract for transaction persistence and querying.
 */
export interface ITransactionRepository {
  getAll(scopeId?: string | null): Promise<TransactionEntity[]>;
  getAllSync(scopeId?: string | null): TransactionEntity[];
  save(transactions: TransactionEntity[], scopeId?: string | null): Promise<void>;
  saveSync(transactions: TransactionEntity[], scopeId?: string | null): void;
  upsert(transaction: TransactionEntity, scopeId?: string | null): Promise<TransactionEntity[]>;
  upsertSync(transaction: TransactionEntity, scopeId?: string | null): TransactionEntity[];
  upsertBatch(transactions: TransactionEntity[], scopeId?: string | null): Promise<TransactionEntity[]>;
  upsertBatchSync(transactions: TransactionEntity[], scopeId?: string | null): TransactionEntity[];
}
