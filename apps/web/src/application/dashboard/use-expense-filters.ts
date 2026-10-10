"use client";

import { useState, useMemo } from "react";
import type { Transaction } from "@/lib/supabase/types";
import {
  filterExpenses,
  type ExpenseDateFilter,
  type ExpenseAmountFilter,
  type ExpenseReceiptFilter,
  type ExpenseVerificationFilter,
} from "@/domain/transactions/transaction-filter";

export interface UseExpenseFiltersParams {
  transactions: Transaction[];
}

export function useExpenseFilters({ transactions }: UseExpenseFiltersParams) {
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("all");
  const [expenseDateFilter, setExpenseDateFilter] =
    useState<ExpenseDateFilter>("all");
  const [expenseAmountFilter, setExpenseAmountFilter] =
    useState<ExpenseAmountFilter>("all");
  const [expensePaymentFilter, setExpensePaymentFilter] = useState("all");
  const [expenseReceiptFilter, setExpenseReceiptFilter] =
    useState<ExpenseReceiptFilter>("all");
  const [expenseVerificationFilter, setExpenseVerificationFilter] =
    useState<ExpenseVerificationFilter>("all");

  const filteredExpenses = useMemo(() => {
    return filterExpenses(transactions, {
      search: expenseSearch,
      category: expenseCategoryFilter,
      date: expenseDateFilter,
      amount: expenseAmountFilter,
      paymentMethod: expensePaymentFilter,
      receipt: expenseReceiptFilter,
      verification: expenseVerificationFilter,
    });
  }, [
    transactions,
    expenseSearch,
    expenseCategoryFilter,
    expenseDateFilter,
    expenseAmountFilter,
    expensePaymentFilter,
    expenseReceiptFilter,
    expenseVerificationFilter,
  ]);

  const resetFilters = () => {
    setExpenseSearch("");
    setExpenseCategoryFilter("all");
    setExpenseDateFilter("all");
    setExpenseAmountFilter("all");
    setExpensePaymentFilter("all");
    setExpenseReceiptFilter("all");
    setExpenseVerificationFilter("all");
  };

  return {
    expenseSearch,
    setExpenseSearch,
    expenseCategoryFilter,
    setExpenseCategoryFilter,
    expenseDateFilter,
    setExpenseDateFilter,
    expenseAmountFilter,
    setExpenseAmountFilter,
    expensePaymentFilter,
    setExpensePaymentFilter,
    expenseReceiptFilter,
    setExpenseReceiptFilter,
    expenseVerificationFilter,
    setExpenseVerificationFilter,
    filteredExpenses,
    resetFilters,
  };
}
