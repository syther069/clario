"use client";

import React from "react";
import { Plus } from "lucide-react";
import type { BudgetStatusItem } from "@/domain/budgets/budget-engine";

export interface BudgetStatusCardProps {
  budgets: BudgetStatusItem[];
  currencySymbol: string;
  onOpenCreateBudget: () => void;
}

export function BudgetStatusCard({
  budgets,
  currencySymbol,
  onOpenCreateBudget,
}: BudgetStatusCardProps) {
  return (
    <div className="neo-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-black uppercase tracking-wider text-[#121212]">
            Category Budgets
          </h2>
          <p className="text-xs text-slate-500">
            Monthly spending limits and utilization
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenCreateBudget}
          className="px-2 py-1 text-[10px] font-black uppercase tracking-wider bg-white hover:bg-[#f3f0ff] text-[#836EF9] border border-[#121212] rounded shadow-[1px_1px_0_0_#121212] flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          <span>Set Budget</span>
        </button>
      </div>

      {budgets.length > 0 ? (
        <div className="space-y-4">
          {budgets.slice(0, 4).map((b) => (
            <div
              key={b.id}
              className="p-3 rounded-lg border-2 border-[#121212] bg-white shadow-[2px_2px_0_0_#121212]"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-[#121212]">
                    {b.category}
                  </span>
                  {b.isOver && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#fee2e2] text-[#b91c1c] border border-[#b91c1c]">
                      OVER BUDGET
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono font-bold text-slate-600">
                  {currencySymbol}
                  {b.spent.toFixed(2)} / {currencySymbol}
                  {b.limit.toFixed(0)}
                </span>
              </div>
              <div className="w-full h-2 rounded-full border border-[#121212] bg-[#f3f4f6] overflow-hidden">
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
              <div className="mt-1 flex justify-between text-[10px] font-semibold text-slate-500">
                <span>{b.pct}% used</span>
                <span>
                  Remaining: {currencySymbol}
                  {b.remaining.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center text-xs font-bold text-slate-400 border-2 border-dashed border-[#121212] rounded-xl p-4 bg-[#f8f9fa]">
          No active category budgets. Set your first budget limit!
        </div>
      )}
    </div>
  );
}
