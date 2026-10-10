import { describe, it, expect } from "vitest";
import {
  calculateTotalBudgetLimit,
  calculateAvailableBudget,
  calculateBudgetStatusList,
} from "./budget-engine";
import type { Budget, Transaction } from "@/lib/supabase/types";

describe("Domain: Budget Engine", () => {
  const sampleBudgets: Budget[] = [
    {
      id: "b-1",
      category: "food_dining",
      category_id: "food_dining",
      amount_limit: 500,
    } as unknown as Budget,
    {
      id: "b-2",
      category: "transportation",
      category_id: "transportation",
      amount_limit: 200,
    } as unknown as Budget,
  ];

  const sampleTransactions: Transaction[] = [
    {
      id: "t-1",
      type: "expense",
      category: "food_dining",
      amount: 450,
    } as Transaction,
    {
      id: "t-2",
      type: "expense",
      category: "transportation",
      amount: 250,
    } as Transaction,
  ];

  it("calculates total budget limit and available budget", () => {
    const totalLimit = calculateTotalBudgetLimit(sampleBudgets);
    expect(totalLimit).toBe(700);

    const available = calculateAvailableBudget(totalLimit, 600);
    expect(available).toBe(100);

    const overspent = calculateAvailableBudget(totalLimit, 800);
    expect(overspent).toBe(0);
  });

  it("calculates budget status list with overrun detection", () => {
    const statuses = calculateBudgetStatusList(sampleBudgets, sampleTransactions);
    expect(statuses).toHaveLength(2);

    const food = statuses.find((s) => s.id === "b-1");
    expect(food?.spent).toBe(450);
    expect(food?.remaining).toBe(50);
    expect(food?.pct).toBe(90);
    expect(food?.isOver).toBe(false);

    const transport = statuses.find((s) => s.id === "b-2");
    expect(transport?.spent).toBe(250);
    expect(transport?.remaining).toBe(0);
    expect(transport?.pct).toBe(100);
    expect(transport?.isOver).toBe(true);
  });
});
