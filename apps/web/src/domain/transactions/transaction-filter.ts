import type { Transaction } from "@/lib/supabase/types";

export type ExpenseDateFilter = "all" | "7d" | "30d" | "month" | "year";
export type ExpenseAmountFilter = "all" | "under50" | "50to200" | "over200";
export type ExpenseReceiptFilter = "all" | "has_receipt" | "no_receipt";
export type ExpenseVerificationFilter = "all" | "verified" | "unverified";

export interface ExpenseFilterCriteria {
  search?: string;
  category?: string;
  date?: ExpenseDateFilter;
  amount?: ExpenseAmountFilter;
  paymentMethod?: string;
  receipt?: ExpenseReceiptFilter;
  verification?: ExpenseVerificationFilter;
}

/**
 * Distinguishes whether a transaction is considered On-Chain (Web3) or Fiat.
 */
export function isTxOnChain(t: Transaction): boolean {
  const pm = (t.payment_method || "").toLowerCase();
  const isExplicitFiat =
    pm.includes("cash") ||
    pm.includes("upi") ||
    pm.includes("credit card") ||
    pm.includes("debit card") ||
    pm.includes("bank transfer") ||
    pm.includes("card");

  if (isExplicitFiat) {
    return false;
  }

  return Boolean(
    t.blockchain_tx_hash ||
      t.monad_tx_hash ||
      t.source === "onchain_monad" ||
      t.source === "onchain_other" ||
      t.category === "crypto_ops" ||
      t.category_id === "crypto_ops" ||
      pm.includes("onchain") ||
      pm.includes("eth") ||
      pm.includes("monad") ||
      pm.includes("usdc") ||
      pm.includes("usdt") ||
      pm.includes("base") ||
      pm.includes("arbitrum"),
  );
}

/**
 * Filters expense transactions by search term, category, date, amount range, payment method, receipt, and verification.
 */
export function filterExpenses(
  transactions: Transaction[],
  criteria: ExpenseFilterCriteria,
  referenceDate: Date = new Date(),
): Transaction[] {
  const now = new Date(referenceDate);

  return transactions.filter((t) => {
    if (t.type !== "expense") return false;

    // Search filter
    if (criteria.search && criteria.search.trim()) {
      const q = criteria.search.toLowerCase();
      const m = (t.merchant || "").toLowerCase();
      const d = (t.description || "").toLowerCase();
      const n = (t.notes || "").toLowerCase();
      if (!m.includes(q) && !d.includes(q) && !n.includes(q)) return false;
    }

    // Category filter
    if (criteria.category && criteria.category !== "all") {
      const cat = String(t.category_id || t.category || "").toLowerCase();
      if (!cat.includes(criteria.category.toLowerCase())) return false;
    }

    // Date filter
    if (criteria.date && criteria.date !== "all") {
      const txDate = new Date(t.date || t.timestamp || t.created_at);
      const diffDays =
        (now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24);
      if (criteria.date === "7d" && diffDays > 7) return false;
      if (criteria.date === "30d" && diffDays > 30) return false;
      if (
        criteria.date === "month" &&
        (txDate.getMonth() !== now.getMonth() ||
          txDate.getFullYear() !== now.getFullYear())
      )
        return false;
      if (criteria.date === "year" && txDate.getFullYear() !== now.getFullYear())
        return false;
    }

    // Amount filter
    if (criteria.amount && criteria.amount !== "all") {
      const amt = Number(t.amount || 0);
      if (criteria.amount === "under50" && amt >= 50) return false;
      if (criteria.amount === "50to200" && (amt < 50 || amt > 200)) return false;
      if (criteria.amount === "over200" && amt <= 200) return false;
    }

    // Payment method filter
    if (criteria.paymentMethod && criteria.paymentMethod !== "all") {
      const pm = (t.payment_method || "").toLowerCase();
      if (!pm.includes(criteria.paymentMethod.toLowerCase())) return false;
    }

    // Receipt filter
    if (criteria.receipt && criteria.receipt !== "all") {
      const hasReceipt = Boolean(
        t.receipt_id || t.receipt_bundle_id || t.blockchain_data_hash,
      );
      if (criteria.receipt === "has_receipt" && !hasReceipt) return false;
      if (criteria.receipt === "no_receipt" && hasReceipt) return false;
    }

    // Verification filter
    if (criteria.verification && criteria.verification !== "all") {
      const isVerified = Boolean(
        t.monad_tx_hash ||
          t.verification_status === "verified" ||
          t.blockchain_status === "confirmed",
      );
      if (criteria.verification === "verified" && !isVerified) return false;
      if (criteria.verification === "unverified" && isVerified) return false;
    }

    return true;
  });
}

/**
 * Filters income transactions by search query.
 */
export function filterIncome(
  transactions: Transaction[],
  query?: string,
): Transaction[] {
  const incomeTxs = transactions.filter((t) => t.type === "income");
  if (!query || !query.trim()) return incomeTxs;
  const q = query.toLowerCase().trim();
  return incomeTxs.filter(
    (t) =>
      (t.merchant || "").toLowerCase().includes(q) ||
      (t.description || "").toLowerCase().includes(q) ||
      (t.notes || "").toLowerCase().includes(q),
  );
}
