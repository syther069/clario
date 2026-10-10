"use client";

import { useMemo } from "react";
import type { Transaction, Budget, Subscription } from "@/lib/supabase/types";
import {
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateNetCashFlow,
  calculateMonthlyIncome,
  calculateMonthlySpending,
  calculateSavingsRate,
  calculateMonthlySubscriptionsCost,
  calculateCategoryTotals,
  calculateSpendingCategories,
  type SpendingCategoryItem,
} from "@/domain/analytics/financial-metrics";
import {
  calculateCashFlowSeries,
  type CashFlowPeriod,
  type CashFlowBucket,
} from "@/domain/analytics/cashflow-calculator";
import {
  calculateTotalBudgetLimit,
  calculateAvailableBudget,
  calculateBudgetStatusList,
  type BudgetStatusItem,
} from "@/domain/budgets/budget-engine";

export interface UsePersonalMetricsParams {
  activeTransactions: Transaction[];
  localBudgets: Budget[];
  localSubscriptions: Subscription[];
  cashFlowPeriod: CashFlowPeriod;
}

export interface UsePersonalMetricsResult {
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  monthlyIncome: number;
  monthlySpending: number;
  savingsRate: number;
  totalBudgetLimit: number;
  availableBudget: number;
  monthlySubscriptionsCost: number;
  upcomingBillsTotal: number;
  monthlyRecurringSpend: number;
  yearlyProjectedRecurring: number;
  categoryTotals: Record<string, number>;
  spendingCategoriesWithData: SpendingCategoryItem[];
  budgetStatusList: BudgetStatusItem[];
  chartData: CashFlowBucket[];
}

export function usePersonalMetrics({
  activeTransactions,
  localBudgets,
  localSubscriptions,
  cashFlowPeriod,
}: UsePersonalMetricsParams): UsePersonalMetricsResult {
  const totalIncome = useMemo(
    () => calculateTotalIncome(activeTransactions),
    [activeTransactions],
  );

  const totalExpenses = useMemo(
    () => calculateTotalExpenses(activeTransactions),
    [activeTransactions],
  );

  const netCashFlow = useMemo(
    () => calculateNetCashFlow(totalIncome, totalExpenses),
    [totalIncome, totalExpenses],
  );

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const monthlyIncome = useMemo(
    () => calculateMonthlyIncome(activeTransactions, currentMonth, currentYear),
    [activeTransactions, currentMonth, currentYear],
  );

  const monthlySpending = useMemo(
    () => calculateMonthlySpending(activeTransactions, currentMonth, currentYear),
    [activeTransactions, currentMonth, currentYear],
  );

  const totalBudgetLimit = useMemo(
    () => calculateTotalBudgetLimit(localBudgets),
    [localBudgets],
  );

  const availableBudget = useMemo(
    () => calculateAvailableBudget(totalBudgetLimit, monthlySpending),
    [totalBudgetLimit, monthlySpending],
  );

  const monthlySubscriptionsCost = useMemo(
    () => calculateMonthlySubscriptionsCost(localSubscriptions),
    [localSubscriptions],
  );

  const upcomingBillsTotal = monthlySubscriptionsCost;
  const monthlyRecurringSpend = monthlySubscriptionsCost;
  const yearlyProjectedRecurring = monthlySubscriptionsCost * 12;

  const savingsRate = useMemo(
    () =>
      calculateSavingsRate(
        monthlyIncome,
        monthlySpending,
        totalIncome,
        totalExpenses,
      ),
    [monthlyIncome, monthlySpending, totalIncome, totalExpenses],
  );

  const categoryTotals = useMemo(
    () => calculateCategoryTotals(activeTransactions),
    [activeTransactions],
  );

  const spendingCategoriesWithData = useMemo(
    () => calculateSpendingCategories(categoryTotals, totalExpenses),
    [categoryTotals, totalExpenses],
  );

  const budgetStatusList = useMemo(
    () => calculateBudgetStatusList(localBudgets, activeTransactions),
    [localBudgets, activeTransactions],
  );

  const chartData = useMemo(
    () => calculateCashFlowSeries(activeTransactions, cashFlowPeriod),
    [activeTransactions, cashFlowPeriod],
  );

  return {
    totalIncome,
    totalExpenses,
    netCashFlow,
    monthlyIncome,
    monthlySpending,
    savingsRate,
    totalBudgetLimit,
    availableBudget,
    monthlySubscriptionsCost,
    upcomingBillsTotal,
    monthlyRecurringSpend,
    yearlyProjectedRecurring,
    categoryTotals,
    spendingCategoriesWithData,
    budgetStatusList,
    chartData,
  };
}
