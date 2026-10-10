"use client";

import React from "react";
import { Plus, Layers, AlertTriangle, Trash2 } from "lucide-react";
import type { BudgetStatusItem } from "@/domain/budgets/budget-engine";

export interface PersonalBudgetsViewProps {
  currencySymbol: string;
  totalBudgetLimit: number;
  monthlySpending: number;
  availableBudget: number;
  budgetsCount: number;
  budgetStatusList: BudgetStatusItem[];
  onOpenCreateBudget: () => void;
  onDeleteBudget: (budgetId: string) => void;
}

export function PersonalBudgetsView({
  currencySymbol,
  totalBudgetLimit,
  monthlySpending,
  availableBudget,
  budgetsCount,
  budgetStatusList,
  onOpenCreateBudget,
  onDeleteBudget,
}: PersonalBudgetsViewProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-wider text-[#121212]">
            Personal Budgets & Spending Limits
          </h2>
          <p className="text-xs text-slate-500">
            Set category thresholds to prevent lifestyle creep and track remaining capacity.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenCreateBudget}
          className="neo-btn neo-btn-primary cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Create Category Budget</span>
        </button>
      </div>

      {/* Monthly Budget Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="neo-card p-4">
          <span className="text-[10px] font-black uppercase text-slate-500">
            Total Monthly Limit
          </span>
          <div className="text-2xl font-black font-mono text-[#121212] mt-1">
            {currencySymbol}
            {totalBudgetLimit.toFixed(2)}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Across {budgetsCount} budgets
          </p>
        </div>

        <div className="neo-card p-4">
          <span className="text-[10px] font-black uppercase text-slate-500">
            Current Spent
          </span>
          <div className="text-2xl font-black font-mono text-[#b91c1c] mt-1">
            {currencySymbol}
            {monthlySpending.toFixed(2)}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Spent this month
          </p>
        </div>

        <div className="neo-card p-4">
          <span className="text-[10px] font-black uppercase text-slate-500">
            Remaining Buffer
          </span>
          <div className="text-2xl font-black font-mono text-[#836EF9] mt-1">
            {currencySymbol}
            {availableBudget.toFixed(2)}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Left before limit
          </p>
        </div>

        <div className="neo-card p-4">
          <span className="text-[10px] font-black uppercase text-slate-500">
            Overall Utilization
          </span>
          <div className="text-2xl font-black font-mono text-[#121212] mt-1">
            {totalBudgetLimit > 0
              ? Math.round((monthlySpending / totalBudgetLimit) * 100)
              : 0}
            %
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Of monthly allowance
          </p>
        </div>
      </div>

      {/* Category Budgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {budgetStatusList.length === 0 ? (
          <div className="col-span-full rounded-xl border-2 border-dashed border-[#121212] p-12 text-center bg-white">
            <Layers className="h-10 w-10 text-slate-400 mx-auto mb-2" />
            <h3 className="text-sm font-black uppercase tracking-wider text-[#121212]">
              No Budgets Configured
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Create category-specific limits to stay in control of outlays.
            </p>
            <button
              type="button"
              onClick={onOpenCreateBudget}
              className="mt-4 neo-btn neo-btn-primary mx-auto cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Create First Budget</span>
            </button>
          </div>
        ) : (
          budgetStatusList.map((b) => (
            <div key={b.id} className="neo-card p-5 relative">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-[#121212]">
                    {b.category}
                  </h3>
                  {b.isOver ? (
                    <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-[#fee2e2] text-[#b91c1c] border border-[#b91c1c]">
                      <AlertTriangle className="h-3 w-3" />
                      OVER BUDGET BY {currencySymbol}
                      {(b.spent - b.limit).toFixed(2)}
                    </span>
                  ) : b.pct > 80 ? (
                    <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-[#fef3c7] text-[#d97706] border border-[#d97706]">
                      NEAR LIMIT ({b.pct}%)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-[#ecfdf5] text-[#059669] border border-[#059669]">
                      ON TRACK ({b.pct}%)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteBudget(b.id)}
                  className="p-1 text-slate-400 hover:text-[#b91c1c] transition cursor-pointer"
                  title="Delete budget"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="flex justify-between text-xs font-mono font-bold text-slate-600 mt-3 mb-1.5">
                <span>
                  Spent: {currencySymbol}
                  {b.spent.toFixed(2)}
                </span>
                <span>
                  Limit: {currencySymbol}
                  {b.limit.toFixed(2)}
                </span>
              </div>

              <div className="w-full h-3 rounded-full border border-[#121212] bg-[#f3f4f6] overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    b.isOver
                      ? "bg-[#b91c1c]"
                      : b.pct > 75
                        ? "bg-[#f59e0b]"
                        : "bg-[#836EF9]"
                  }`}
                  style={{ width: `${Math.min(100, b.pct)}%` }}
                />
              </div>

              <div className="mt-2 flex justify-between text-[11px] font-semibold text-slate-500">
                <span>{b.pct}% used</span>
                <span>
                  {b.isOver
                    ? `Exceeded: -${currencySymbol}${(b.spent - b.limit).toFixed(2)}`
                    : `Remaining: ${currencySymbol}${b.remaining.toFixed(2)}`}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
