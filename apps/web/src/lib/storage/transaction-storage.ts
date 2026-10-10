import type { Transaction, ReceiptBundle } from "@/lib/supabase/types";
import {
  container,
  TransactionEntity,
  normalizeIdentityKey,
  getScopedKey,
  STORAGE_KEY_TRANSACTIONS,
} from "@/core";

export { normalizeIdentityKey, getScopedKey, STORAGE_KEY_TRANSACTIONS };

/**
 * Retrieves stored transactions from the Clean Architecture repository.
 * Checks scoped key first, then falls back to global key.
 */
export function getStoredTransactions(userOrWallet?: string | null): Transaction[] {
  const entities = container.getTransactionsUseCase.execute(userOrWallet);
  return entities.map((e) => e.toDTO());
}

/**
 * Persists transactions list to the Clean Architecture repository.
 */
export function saveStoredTransactions(
  transactions: Transaction[],
  userOrWallet?: string | null,
): void {
  const entities = transactions.map((t) => TransactionEntity.fromDTO(t));
  container.transactionRepository.saveSync(entities, userOrWallet);
}

/**
 * Adds or updates a single transaction via UpsertTransactionUseCase.
 * Dispatches domain events across the decoupled event bus.
 */
export function upsertStoredTransaction(
  transaction: Transaction,
  userOrWallet?: string | null,
): Transaction[] {
  const entity = TransactionEntity.fromDTO(transaction);
  const updated = container.upsertTransactionUseCase.execute(entity, userOrWallet);
  return updated.map((e) => e.toDTO());
}

/**
 * Adds or updates multiple transactions in batch via UpsertTransactionUseCase.
 */
export function upsertStoredTransactions(
  transactions: Transaction[],
  userOrWallet?: string | null,
): Transaction[] {
  if (!transactions || transactions.length === 0) {
    return getStoredTransactions(userOrWallet);
  }
  const entities = transactions.map((t) => TransactionEntity.fromDTO(t));
  const updated = container.upsertTransactionUseCase.executeBatch(entities, userOrWallet);
  return updated.map((e) => e.toDTO());
}

/**
 * Extracts and restores all transactions embedded inside saved receipt bundles
 * via ExtractReceiptTransactionsUseCase.
 */
export function extractTransactionsFromReceiptBundles(
  bundles: ReceiptBundle[] | Record<string, ReceiptBundle>,
): Transaction[] {
  const entities = container.extractReceiptTransactionsUseCase.execute(bundles);
  return entities.map((e) => e.toDTO());
}
