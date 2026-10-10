import type { Transaction, Subscription, Category } from "@/lib/supabase/types";

export const KNOWN_CATEGORIES: Record<string, string> = {
  software_tools: "Software & Tools",
  food_dining: "Food & Dining",
  transportation: "Transportation",
  office_expenses: "Office Expenses",
  utilities: "Utilities",
  crypto_ops: "Crypto Ops",
  housing: "Housing & Rent",
  health: "Health & Medical",
  shopping: "Shopping & Retail",
  education: "Education",
  subscriptions: "Subscriptions",
  income: "Salary & Income",
  investments: "Investments",
  other: "General",
};

/**
 * Formats a category slug or object into a human-readable display label.
 */
export function formatCategoryName(
  category?: Category | string | null,
  categoryId?: string | null,
): string {
  if (!category && !categoryId) return "General";
  if (typeof category === "object" && category?.name) return category.name;
  const raw = (typeof category === "string" ? category : categoryId) || "";
  if (!raw.trim()) return "General";
  const slug = raw.toLowerCase().trim();
  if (KNOWN_CATEGORIES[slug]) {
    return KNOWN_CATEGORIES[slug]!;
  }
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Calculates total income across transactions.
 */
export function calculateTotalIncome(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

/**
 * Calculates total expenses across transactions.
 */
export function calculateTotalExpenses(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.type === "expense" || !t.type)
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

/**
 * Calculates net cash flow (Income - Expenses).
 */
export function calculateNetCashFlow(totalIncome: number, totalExpenses: number): number {
  return totalIncome - totalExpenses;
}

/**
 * Calculates income for the specified month and year.
 */
export function calculateMonthlyIncome(
  transactions: Transaction[],
  month: number,
  year: number,
): number {
  return transactions
    .filter((t) => {
      if (t.type !== "income") return false;
      const d = new Date(t.date || t.timestamp || t.created_at);
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

/**
 * Calculates spending for the specified month and year.
 */
export function calculateMonthlySpending(
  transactions: Transaction[],
  month: number,
  year: number,
): number {
  return transactions
    .filter((t) => {
      if (t.type === "income") return false;
      const d = new Date(t.date || t.timestamp || t.created_at);
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

/**
 * Calculates monthly cost of active recurring subscriptions, normalized to a monthly basis.
 */
export function calculateMonthlySubscriptionsCost(subscriptions: Subscription[]): number {
  return subscriptions
    .filter((s) => s.status === "active")
    .reduce((sum, s) => {
      const amt = Number(s.amount || 0);
      if (s.frequency === "yearly") return sum + amt / 12;
      if (s.frequency === "weekly") return sum + amt * 4.33;
      return sum + amt;
    }, 0);
}

/**
 * Calculates the savings rate percentage (0 - 100).
 */
export function calculateSavingsRate(
  monthlyIncome: number,
  monthlySpending: number,
  totalIncome: number,
  totalExpenses: number,
): number {
  if (monthlyIncome > 0) {
    return Math.max(
      0,
      Math.round(((monthlyIncome - monthlySpending) / monthlyIncome) * 100),
    );
  }
  if (totalIncome > totalExpenses && totalIncome > 0) {
    return Math.round(((totalIncome - totalExpenses) / totalIncome) * 100);
  }
  return 0;
}

/**
 * Aggregates expense amounts grouped by category slug.
 */
export function calculateCategoryTotals(transactions: Transaction[]): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const tx of transactions) {
    if (tx.type === "expense" || !tx.type) {
      const cat = String(tx.category || tx.category_id || "other");
      acc[cat] = (acc[cat] || 0) + Number(tx.amount || 0);
    }
  }
  return acc;
}

export interface SpendingCategoryItem {
  slug: string;
  name: string;
  amount: number;
  pct: number;
}

/**
 * Computes sorted list of spending categories with percentage shares.
 */
export function calculateSpendingCategories(
  categoryTotals: Record<string, number>,
  totalExpenses: number,
): SpendingCategoryItem[] {
  const list: SpendingCategoryItem[] = [];
  const denominator = totalExpenses > 0 ? totalExpenses : 1;
  for (const [slug, amount] of Object.entries(categoryTotals)) {
    if (amount > 0) {
      list.push({
        slug,
        name: formatCategoryName(slug, slug),
        amount,
        pct: Math.round((amount / denominator) * 100),
      });
    }
  }
  return list.sort((a, b) => b.amount - a.amount);
}
