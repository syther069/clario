"use client";

import React from "react";
import type { SpendingCategoryItem } from "@/domain/analytics/financial-metrics";

export interface CategoryBreakdownCardProps {
  categories: SpendingCategoryItem[];
  currencySymbol: string;
}

export function CategoryBreakdownCard({
  categories,
  currencySymbol,
}: CategoryBreakdownCardProps) {
  return (
    <div className="neo-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-black uppercase tracking-wider text-[#121212]">
            Spending by Category
          </h2>
          <p className="text-xs text-slate-500">
            Live distribution based on verified ledger records
          </p>
        </div>
        <span className="neo-badge neo-badge-purple">
          {categories.length} Categories
        </span>
      </div>

      {categories.length > 0 ? (
        <div className="space-y-3">
          {categories.slice(0, 6).map((cat) => (
            <div key={cat.slug} className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-[#121212]">
                <span className="uppercase tracking-wide">{cat.name}</span>
                <span className="font-mono tabular-nums">
                  {currencySymbol}
                  {cat.amount.toFixed(2)} ({cat.pct}%)
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full border border-[#121212] bg-[#f3f4f6] overflow-hidden">
                <div
                  className="h-full bg-[#836EF9] transition-[width] duration-300 ease-out"
                  style={{
                    width: `${Math.min(100, Math.max(5, cat.pct))}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center text-xs font-bold text-slate-400 border-2 border-dashed border-[#121212] rounded-xl p-4 bg-[#f8f9fa]">
          No category spending recorded yet.
        </div>
      )}
    </div>
  );
}
