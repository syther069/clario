import type { Budget, Transaction } from "@/lib/supabase/types";
import { formatCategoryName } from "@/domain/analytics/financial-metrics";

export interface BudgetStatusItem {
  id: string;
  category: string;
  limit: number;
  spent: number;
  remaining: number;
  pct: number;
  isOver: boolean;
}

/**
 * Calculates sum of monthly budget limits.
 */
export function calculateTotalBudgetLimit(budgets: Budget[]): number {
  return budgets.reduce((sum, b) => sum + Number(b.amount_limit || 0), 0);
}

/**
 * Calculates remaining available budget after current spending.
 */
export function calculateAvailableBudget(totalBudgetLimit: number, monthlySpending: number): number {
  return Math.max(0, totalBudgetLimit - monthlySpending);
}

/**
 * Evaluates budget progress, spent amounts, percentages, and overrun flags for all budgets.
 */
export function calculateBudgetStatusList(
  budgets: Budget[],
  transactions: Transaction[],
): BudgetStatusItem[] {
  return budgets.map((b) => {
    const catKey = String(b.category_id || b.category || "other").toLowerCase();
    const spent = transactions
      .filter((t) => {
        if (t.type !== "expense") return false;
        const txCat = String(t.category_id || t.category || "other").toLowerCase();
        return (
          txCat === catKey || txCat.includes(catKey) || catKey.includes(txCat)
        );
      })
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const limit = Number(b.amount_limit || 1);
    const remaining = Math.max(0, limit - spent);
    const pct = Math.min(100, Math.round((spent / limit) * 100));
    const isOver = spent > limit;

    return {
      id: b.id,
      category: formatCategoryName(b.category, b.category_id),
      limit,
      spent,
      remaining,
      pct,
      isOver,
    };
  });
}
