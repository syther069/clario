import { describe, it, expect } from "vitest";
import { calculateCashFlowSeries } from "./cashflow-calculator";
import type { Transaction } from "@/lib/supabase/types";

describe("Domain: Cash Flow Calculator", () => {
  const refDate = new Date("2026-10-10T12:00:00Z");

  const sampleTransactions: Transaction[] = [
    {
      id: "tx-1",
      type: "income",
      amount: 1000,
      date: "2026-10-08",
      created_at: "2026-10-08T10:00:00Z",
    } as Transaction,
    {
      id: "tx-2",
      type: "expense",
      amount: 250,
      date: "2026-10-09",
      created_at: "2026-10-09T10:00:00Z",
    } as Transaction,
  ];

  it("produces correct bucket count for 7D period", () => {
    const buckets = calculateCashFlowSeries(sampleTransactions, "7D", refDate);
    expect(buckets).toHaveLength(7);
    const totalIncome = buckets.reduce((acc, b) => acc + b.income, 0);
    const totalExpenses = buckets.reduce((acc, b) => acc + b.expenses, 0);
    expect(totalIncome).toBe(1000);
    expect(totalExpenses).toBe(250);
  });

  it("produces correct bucket count for 30D, 3M, 6M, and 1Y periods", () => {
    expect(calculateCashFlowSeries(sampleTransactions, "30D", refDate)).toHaveLength(6);
    expect(calculateCashFlowSeries(sampleTransactions, "3M", refDate)).toHaveLength(6);
    expect(calculateCashFlowSeries(sampleTransactions, "6M", refDate)).toHaveLength(6);
    expect(calculateCashFlowSeries(sampleTransactions, "1Y", refDate)).toHaveLength(12);
  });
});
