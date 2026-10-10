import type { Transaction } from "@/lib/supabase/types";
import { formatCategoryName } from "@/domain/analytics/financial-metrics";

/**
 * Builds RFC 4180 compliant CSV string for expense transactions.
 */
export function buildExpensesCsv(transactions: Transaction[]): string {
  const headers = [
    "Date",
    "Merchant",
    "Category",
    "Payment Method",
    "Amount",
    "Currency",
    "Monad Verification",
    "Transaction Hash",
  ];

  const rows = transactions.map((t) => [
    t.date || t.timestamp?.split("T")[0] || "",
    `"${(t.merchant || "").replace(/"/g, '""')}"`,
    `"${formatCategoryName(t.category, t.category_id)}"`,
    `"${t.payment_method || "Card"}"`,
    t.amount,
    t.currency || "USD",
    t.monad_tx_hash ? "Verified" : "Unanchored",
    t.monad_tx_hash || t.blockchain_tx_hash || "",
  ]);

  return [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
}

/**
 * Initiates browser download of CSV string. Safe for SSR (no-op if window is undefined).
 */
export function triggerCsvDownload(csvString: string, filename: string): void {
  if (typeof window === "undefined" || !document) return;
  const csvContent = "data:text/csv;charset=utf-8," + csvString;
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
