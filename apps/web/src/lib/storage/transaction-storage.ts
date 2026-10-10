import type { Transaction, ReceiptBundle } from "@/lib/supabase/types";

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
 * Retrieves stored transactions from localStorage.
 * Checks scoped key first, then falls back to global key.
 */
export function getStoredTransactions(userOrWallet?: string | null): Transaction[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  try {
    const txMap = new Map<string, Transaction>();

    // 1. Read global store
    const rawGlobal = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
    if (rawGlobal) {
      const parsed = JSON.parse(rawGlobal);
      if (Array.isArray(parsed)) {
        for (const t of parsed) {
          if (t && t.id) txMap.set(t.id, t);
        }
      }
    }

    // 2. Read scoped store if wallet/user provided
    if (userOrWallet && userOrWallet.trim()) {
      const scopedKey = getScopedKey(STORAGE_KEY_TRANSACTIONS, userOrWallet);
      const rawScoped = localStorage.getItem(scopedKey);
      if (rawScoped) {
        const parsed = JSON.parse(rawScoped);
        if (Array.isArray(parsed)) {
          for (const t of parsed) {
            if (t && t.id) txMap.set(t.id, t);
          }
        }
      }
    }

    if (txMap.size > 0) {
      return Array.from(txMap.values()).sort((a, b) => {
        const timeA = new Date(a.date || a.timestamp || a.created_at || 0).getTime();
        const timeB = new Date(b.date || b.timestamp || b.created_at || 0).getTime();
        return timeB - timeA;
      });
    }
  } catch (err) {
    console.warn("Notice: Error reading transactions from localStorage:", err);
  }

  return [];
}

/**
 * Persists transactions list to localStorage in both scoped and global keys.
 */
export function saveStoredTransactions(
  transactions: Transaction[],
  userOrWallet?: string | null,
): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    const json = JSON.stringify(transactions);
    localStorage.setItem(STORAGE_KEY_TRANSACTIONS, json);
    if (userOrWallet && userOrWallet.trim()) {
      const scopedKey = getScopedKey(STORAGE_KEY_TRANSACTIONS, userOrWallet);
      localStorage.setItem(scopedKey, json);
    }
  } catch (err) {
    console.warn("Notice: Error saving transactions to localStorage:", err);
  }
}

/**
 * Adds or updates a single transaction in localStorage.
 */
export function upsertStoredTransaction(
  transaction: Transaction,
  userOrWallet?: string | null,
): Transaction[] {
  const current = getStoredTransactions(userOrWallet);
  const updated = [
    transaction,
    ...current.filter((t) => t.id !== transaction.id),
  ];
  saveStoredTransactions(updated, userOrWallet);
  return updated;
}

/**
 * Adds or updates multiple transactions in localStorage in batch.
 */
export function upsertStoredTransactions(
  transactions: Transaction[],
  userOrWallet?: string | null,
): Transaction[] {
  if (!transactions || transactions.length === 0) {
    return getStoredTransactions(userOrWallet);
  }

  const current = getStoredTransactions(userOrWallet);
  const txMap = new Map<string, Transaction>();
  for (const t of current) {
    txMap.set(t.id, t);
  }
  for (const t of transactions) {
    txMap.set(t.id, t);
  }

  const updated = Array.from(txMap.values()).sort((a, b) => {
    const timeA = new Date(a.date || a.timestamp || a.created_at || 0).getTime();
    const timeB = new Date(b.date || b.timestamp || b.created_at || 0).getTime();
    return timeB - timeA;
  });

  saveStoredTransactions(updated, userOrWallet);
  return updated;
}

/**
 * Extracts and restores all transactions embedded inside saved receipt bundles.
 * This guarantees that even if a transaction was created within a receipt bundle,
 * it is never lost on refresh and is immediately present in the transactions ledger.
 */
export function extractTransactionsFromReceiptBundles(
  bundles: ReceiptBundle[] | Record<string, ReceiptBundle>,
): Transaction[] {
  const bundleList = Array.isArray(bundles) ? bundles : Object.values(bundles);
  const txMap = new Map<string, Transaction>();

  for (const b of bundleList) {
    if (!b) continue;
    const isConfirmed =
      b.blockchain_status === "confirmed" ||
      b.verification_status === "verified" ||
      Boolean(b.blockchain_tx_hash);
    const txHash = b.blockchain_tx_hash || null;

    if (Array.isArray(b.receipt_data?.transactions) && b.receipt_data.transactions.length > 0) {
      for (const t of b.receipt_data.transactions) {
        if (!t || !t.id) continue;
        txMap.set(t.id, {
          id: t.id,
          user_id: b.user_id || b.wallet_address || "user_default",
          type: (t.type as "expense" | "income" | "transfer") || "expense",
          amount: Number(t.amount) || 0,
          currency: t.currency || b.currency || "USD",
          merchant: t.merchant || b.name || "Expense",
          description: t.merchant || b.name || "Expense",
          category: t.category || "other",
          category_id: t.category || "other",
          date:
            t.date ||
            b.created_at?.slice(0, 10) ||
            new Date().toISOString().slice(0, 10),
          timestamp: t.date || b.created_at || new Date().toISOString(),
          payment_method: isConfirmed ? "Onchain (Monad)" : "Card",
          verification_state: isConfirmed ? "verified" : "unverified",
          verification_status: isConfirmed ? "verified" : "unverified",
          blockchain_status: isConfirmed ? "confirmed" : null,
          blockchain_network: b.blockchain_network || "Monad Testnet",
          blockchain_chain_id: b.blockchain_chain_id || 10143,
          blockchain_contract_address: b.blockchain_contract_address || null,
          blockchain_tx_hash: txHash,
          monad_tx_hash: txHash,
          monad_block: b.monad_block || null,
          blockchain_data_hash: b.receipt_hash || null,
          receipt_bundle_id: b.id,
          status: "cleared",
          source: isConfirmed ? "onchain_monad" : "manual",
          version: 1,
          created_at: b.created_at || new Date().toISOString(),
          updated_at: b.updated_at || b.created_at || new Date().toISOString(),
        });
      }
    } else {
      // Fallback: bundle itself represents a saved receipt transaction!
      const txId = (b.transaction_ids && b.transaction_ids[0]) || `tx_${b.id.replace(/[^a-zA-Z0-9]/g, "")}`;
      txMap.set(txId, {
        id: txId,
        user_id: b.user_id || b.wallet_address || "user_default",
        type: "expense",
        amount: Number(b.total_amount) || 0,
        currency: b.currency || "USD",
        merchant: b.name || b.receipt_name || "Saved Receipt",
        description: b.name || b.receipt_name || "Saved Receipt",
        category: "other",
        category_id: "other",
        date: b.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        timestamp: b.created_at || new Date().toISOString(),
        payment_method: isConfirmed ? "Onchain (Monad)" : "Card",
        verification_state: isConfirmed ? "verified" : "unverified",
        verification_status: isConfirmed ? "verified" : "unverified",
        blockchain_status: isConfirmed ? "confirmed" : null,
        blockchain_network: b.blockchain_network || "Monad Testnet",
        blockchain_chain_id: b.blockchain_chain_id || 10143,
        blockchain_contract_address: b.blockchain_contract_address || null,
        blockchain_tx_hash: txHash,
        monad_tx_hash: txHash,
        monad_block: b.monad_block || null,
        blockchain_data_hash: b.receipt_hash || null,
        receipt_bundle_id: b.id,
        status: "cleared",
        source: isConfirmed ? "onchain_monad" : "manual",
        version: 1,
        created_at: b.created_at || new Date().toISOString(),
        updated_at: b.updated_at || b.created_at || new Date().toISOString(),
      });
    }
  }

  return Array.from(txMap.values());
}
