"use client";

import React from "react";
import { TrendingUp, TrendingDown, ChartNoAxesCombined, Calendar } from "lucide-react";
import { MonadLogo } from "@/components/ui/crypto-icon";
import { BorderTrail, SlidingNumber } from "@/components/ui/motion";
import type { Subscription } from "@/lib/supabase/types";

export interface PersonalKpiCardsProps {
  subLedger: "all" | "fiat" | "onchain";
  netCashFlow: number;
  activeCurrencySymbol: string;
  currencySymbol: string;
  monthlyIncome: number;
  monthlySpending: number;
  availableBudget: number;
  totalBudgetLimit: number;
  upcomingBillsTotal: number;
  activeSubscriptionsCount: number;
  savingsRate: number;
}

export function PersonalKpiCards({
  subLedger,
  netCashFlow,
  activeCurrencySymbol,
  currencySymbol,
  monthlyIncome,
  monthlySpending,
  availableBudget,
  totalBudgetLimit,
  upcomingBillsTotal,
  activeSubscriptionsCount,
  savingsRate,
}: PersonalKpiCardsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Dominant Hero Card: Net Position & Inflow/Outflow (lg:col-span-7) */}
      <div className="lg:col-span-7 neo-card p-6 flex flex-col justify-between relative overflow-hidden bg-white">
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-black uppercase tracking-wider text-slate-500 bg-[#f8f9fa] px-2.5 py-1 rounded-md border-1.5 border-[#121212]">
                {subLedger === "onchain" ? "Web3 Net Position" : "Personal Net Cashflow"}
              </span>
              <span
                className={`text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded border border-[#121212] ${
                  netCashFlow >= 0
                    ? "bg-[#dcfce7] text-[#15803d]"
                    : "bg-[#fee2e2] text-[#b91c1c]"
                }`}
              >
                {netCashFlow >= 0 ? "Surplus" : "Deficit"}
              </span>
            </div>
            {subLedger === "onchain" ? (
              <div className="relative overflow-hidden flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-700 bg-[#f3f4f6] px-2.5 py-1 rounded border border-[#121212]">
                <MonadLogo className="h-3.5 w-3.5" />
                <span>Monad Ledger</span>
                <BorderTrail
                  size={30}
                  className="bg-[#836EF9]"
                  transition={{
                    repeat: Infinity,
                    duration: 4,
                    ease: "linear",
                  }}
                />
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-[#121212]">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Private Ledger</span>
              </div>
            )}
          </div>

          {/* Hero Number */}
          <div className="my-2">
            <div className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono tabular-nums tracking-tight text-[#121212] flex items-center">
              <span>{netCashFlow >= 0 ? "+" : "-"}</span>
              <span>{activeCurrencySymbol}</span>
              <SlidingNumber
                value={Math.round(Math.abs(netCashFlow) * 100) / 100}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500 font-medium text-pretty">
              {subLedger === "onchain"
                ? "Net crypto balance across Monad, Base, Ethereum & Arbitrum"
                : "Net recorded personal cashflow across cash, cards & bank accounts"}
            </p>
          </div>
        </div>

        {/* Dual Rail Inflow / Outflow */}
        <div className="grid grid-cols-2 gap-3 pt-4 mt-3 border-t-2 border-[#121212]">
          <div className="p-3 rounded-lg bg-[#f0fdf4] border-1.5 border-[#121212]">
            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-[#15803d]">
              <span>Monthly Inflow</span>
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
            <div className="text-lg sm:text-xl font-black font-mono tabular-nums text-[#15803d] mt-1 flex items-center">
              <span>+{activeCurrencySymbol}</span>
              <SlidingNumber value={Math.round(monthlyIncome * 100) / 100} />
            </div>
            <p className="text-[10px] text-[#166534] font-medium mt-0.5">
              Current month income
            </p>
          </div>

          <div className="p-3 rounded-lg bg-[#fef2f2] border-1.5 border-[#121212]">
            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-[#b91c1c]">
              <span>Monthly Outflow</span>
              <TrendingDown className="h-3.5 w-3.5" />
            </div>
            <div className="text-lg sm:text-xl font-black font-mono tabular-nums text-[#b91c1c] mt-1 flex items-center">
              <span>-{activeCurrencySymbol}</span>
              <SlidingNumber value={Math.round(monthlySpending * 100) / 100} />
            </div>
            <p className="text-[10px] text-[#991b1b] font-medium mt-0.5">
              Current month expenses
            </p>
          </div>
        </div>
      </div>

      {/* Supporting Operational Vitals (lg:col-span-5) */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        {/* Available Budget */}
        <div className="neo-card p-5 flex-1 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              Available Budget
            </span>
            <div className="rounded-lg bg-[#f3f0ff] p-1.5 text-[#836EF9] border border-[#121212] shadow-[1px_1px_0_0_#121212]">
              <ChartNoAxesCombined className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black font-mono tabular-nums text-[#836EF9] flex items-center">
              <span>{currencySymbol}</span>
              <SlidingNumber
                value={Math.round(availableBudget * 100) / 100}
              />
            </div>
            <div className="mt-2 w-full h-2 rounded-full border border-[#121212] bg-[#f3f4f6] overflow-hidden">
              <div
                className="h-full bg-[#836EF9] transition-[width] duration-300 ease-out"
                style={{
                  width: `${Math.min(
                    100,
                    totalBudgetLimit > 0
                      ? (monthlySpending / totalBudgetLimit) * 100
                      : 0,
                  )}%`,
                }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-500 font-semibold">
              <span>
                {totalBudgetLimit > 0
                  ? ((monthlySpending / totalBudgetLimit) * 100).toFixed(0)
                  : 0}
                % used
              </span>
              <span>
                Limit: {currencySymbol}
                {totalBudgetLimit.toFixed(0)}
              </span>
            </div>
          </div>
        </div>

        {/* Upcoming Bills & Savings Rate */}
        <div className="neo-card p-5 flex-1 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              Upcoming Obligations
            </span>
            <div className="rounded-lg bg-[#fef3c7] p-1.5 text-[#d97706] border border-[#121212] shadow-[1px_1px_0_0_#121212]">
              <Calendar className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <div className="text-2xl font-black font-mono text-[#121212]">
                {currencySymbol}
                {upcomingBillsTotal.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                {activeSubscriptionsCount} active bills & subscriptions
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Savings Rate
              </span>
              <div className="text-xl font-black font-mono text-[#059669]">
                {savingsRate}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
