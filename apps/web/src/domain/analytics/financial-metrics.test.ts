import { describe, it, expect } from "vitest";
import {
  formatCategoryName,
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateNetCashFlow,
  calculateMonthlyIncome,
  calculateMonthlySpending,
  calculateMonthlySubscriptionsCost,
  calculateSavingsRate,
  calculateCategoryTotals,
  calculateSpendingCategories,
} from "./financial-metrics";
import type { Transaction, Subscription } from "@/lib/supabase/types";

describe("Domain: Financial Metrics", () => {
  const sampleTransactions: Transaction[] = [
    {
      id: "tx-1",
      user_id: "u1",
      type: "income",
      amount: 5000,
      category: "income",
      date: "2026-10-01",
      created_at: "2026-10-01T10:00:00Z",
    } as Transaction,
    {
      id: "tx-2",
      user_id: "u1",
      type: "expense",
      amount: 1200,
      category: "housing",
      date: "2026-10-02",
      created_at: "2026-10-02T10:00:00Z",
    } as Transaction,
    {
      id: "tx-3",
      user_id: "u1",
      type: "expense",
      amount: 300,
      category: "food_dining",
      date: "2026-10-03",
      created_at: "2026-10-03T10:00:00Z",
    } as Transaction,
  ];

  it("formats category names correctly", () => {
    expect(formatCategoryName("food_dining")).toBe("Food & Dining");
    expect(formatCategoryName("crypto_ops")).toBe("Crypto Ops");
    expect(formatCategoryName("custom_tag")).toBe("Custom Tag");
    expect(formatCategoryName(null)).toBe("General");
  });

  it("calculates total income, expenses, and net cash flow accurately", () => {
    const income = calculateTotalIncome(sampleTransactions);
    const expenses = calculateTotalExpenses(sampleTransactions);
    const net = calculateNetCashFlow(income, expenses);

    expect(income).toBe(5000);
    expect(expenses).toBe(1500);
    expect(net).toBe(3500);
  });

  it("calculates monthly income and spending for target month", () => {
    const monthlyInc = calculateMonthlyIncome(sampleTransactions, 9, 2026); // October is month 9 (0-indexed)
    const monthlyExp = calculateMonthlySpending(sampleTransactions, 9, 2026);

    expect(monthlyInc).toBe(5000);
    expect(monthlyExp).toBe(1500);
  });

  it("calculates savings rate percentage", () => {
    const rate = calculateSavingsRate(5000, 1500, 5000, 1500);
    expect(rate).toBe(70);
  });

  it("calculates normalized monthly subscriptions cost", () => {
    const subs: Subscription[] = [
      { id: "s1", status: "active", amount: 120, frequency: "yearly" } as Subscription,
      { id: "s2", status: "active", amount: 15, frequency: "monthly" } as Subscription,
      { id: "s3", status: "cancelled", amount: 50, frequency: "monthly" } as Subscription,
    ];

    const monthlyCost = calculateMonthlySubscriptionsCost(subs);
    // 120 / 12 = 10, plus 15 = 25
    expect(monthlyCost).toBe(25);
  });

  it("calculates category totals and ranked spending categories", () => {
    const totals = calculateCategoryTotals(sampleTransactions);
    expect(totals["housing"]).toBe(1200);
    expect(totals["food_dining"]).toBe(300);

    const ranked = calculateSpendingCategories(totals, 1500);
    expect(ranked).toHaveLength(2);
    expect(ranked[0]?.name).toBe("Housing & Rent");
    expect(ranked[0]?.pct).toBe(80);
    expect(ranked[1]?.name).toBe("Food & Dining");
    expect(ranked[1]?.pct).toBe(20);
  });
});
