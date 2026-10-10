"use client";

import React, { useState } from "react";
import { Plus, Search, BadgeCheck, Receipt } from "lucide-react";
import { MonadLogo } from "@/components/ui/crypto-icon";
import { WatermelonButton } from "@/components/ui/watermelon-button";
import { formatCategoryName } from "@/domain/analytics/financial-metrics";
import { getMonadExplorerTxUrl } from "@/lib/blockchain/registry";
import type { Transaction } from "@/lib/supabase/types";

export interface IncomeStreamBreakdownItem {
  name: string;
  amount: number;
  pct: number;
}

export interface PersonalIncomeViewProps {
  currencySymbol: string;
  totalIncome: number;
  averageMonthlyIncome: number;
  largestIncomeTx: Transaction | null;
  monthlyIncome: number;
  incomeSourcesBreakdown: IncomeStreamBreakdownItem[];
  incomeTransactions: Transaction[];
  onAddTransaction?: ((subLedger?: "fiat" | "onchain") => void) | undefined;
  onSelectProofTx: (tx: Transaction) => void;
  onSaveReceipt: (tx: Transaction) => void;
  savingTxId: string | null;
}

export function PersonalIncomeView({
  currencySymbol,
  totalIncome,
  averageMonthlyIncome,
  largestIncomeTx,
  monthlyIncome,
  incomeSourcesBreakdown,
  incomeTransactions,
  onAddTransaction,
  onSelectProofTx,
  onSaveReceipt,
  savingTxId,
}: PersonalIncomeViewProps) {
  const [incomeSearch, setIncomeSearch] = useState("");

  const filteredIncome = React.useMemo(() => {
    if (!incomeSearch.trim()) return incomeTransactions;
    const q = incomeSearch.toLowerCase().trim();
    return incomeTransactions.filter(
      (t) =>
        (t.merchant || "").toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q) ||
        (t.notes || "").toLowerCase().includes(q),
    );
  }, [incomeTransactions, incomeSearch]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-wider text-[#121212]">
            Personal Income & Earnings
          </h2>
          <p className="text-xs text-slate-500">
            Track salary, freelance contracts, investment dividends, and incoming deposits.
          </p>
        </div>
        {onAddTransaction && (
          <WatermelonButton
            type="button"
            variant="primary"
            size="sm"
            textMorph
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => onAddTransaction("fiat")}
          >
            Log Income
          </WatermelonButton>
        )}
      </div>

      {/* 4 KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="neo-card p-5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Total Income
          </span>
          <div className="text-2xl font-black font-mono text-[#15803d] mt-1">
            +{currencySymbol}
            {totalIncome.toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            All-time recorded deposits
          </p>
        </div>

        <div className="neo-card p-5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Average Monthly
          </span>
          <div className="text-2xl font-black font-mono text-[#836EF9] mt-1">
            {currencySymbol}
            {averageMonthlyIncome.toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Based on active history
          </p>
        </div>

        <div className="neo-card p-5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Largest Source
          </span>
          <div className="text-2xl font-black font-mono tabular-nums text-[#121212] mt-1 truncate">
            {largestIncomeTx
              ? `+${currencySymbol}${Number(largestIncomeTx.amount).toFixed(2)}`
              : "None"}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">
            {largestIncomeTx?.merchant || "No inflows recorded"}
          </p>
        </div>

        <div className="neo-card p-5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Income This Month
          </span>
          <div className="text-2xl font-black font-mono text-[#15803d] mt-1">
            +{currencySymbol}
            {monthlyIncome.toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Calendar month to date
          </p>
        </div>
      </div>

      {/* Income Sources Distribution */}
      <div className="neo-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-black uppercase tracking-wider text-[#121212]">
              Income by Stream
            </h3>
          </div>
          <span className="neo-badge neo-badge-purple">
            {incomeSourcesBreakdown.length} Sources
          </span>
        </div>

        {incomeSourcesBreakdown.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {incomeSourcesBreakdown.map((src) => (
              <div
                key={src.name}
                className="p-3 rounded-lg border-2 border-[#121212] bg-white shadow-[2px_2px_0_0_#121212]"
              >
                <div className="flex justify-between text-xs font-bold text-[#121212] mb-1.5">
                  <span className="uppercase tracking-wide">
                    {src.name}
                  </span>
                  <span className="font-mono tabular-nums text-[#15803d]">
                    +{currencySymbol}
                    {src.amount.toFixed(2)} ({src.pct}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full border border-[#121212] bg-[#f3f4f6] overflow-hidden">
                  <div
                    className="h-full bg-[#15803d] transition-[width] duration-300 ease-out"
                    style={{
                      width: `${Math.min(100, Math.max(5, src.pct))}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-400 font-bold">
            No income stream breakdown available.
          </div>
        )}
      </div>

      {/* Searchable Income Table */}
      <div className="neo-card overflow-hidden">
        <div className="p-4 border-b-2 border-[#121212] bg-[#f9fafb] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-[#121212]">
            Recorded Income History
          </h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by source or notes..."
              value={incomeSearch}
              onChange={(e) => setIncomeSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-[#121212] rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#836EF9]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b-2 border-[#121212] bg-[#f9fafb]">
                <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                  Date
                </th>
                <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                  Source / Payer
                </th>
                <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                  Stream Category
                </th>
                <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600 text-right">
                  Amount
                </th>
                <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                  Status
                </th>
                <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y border-b border-[#121212]">
              {filteredIncome.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-semibold">
                    No income transactions logged yet.
                  </td>
                </tr>
              ) : (
                filteredIncome.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#f3f0ff]/30 transition">
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {tx.date || tx.timestamp?.split("T")[0]}
                    </td>
                    <td className="py-3 px-4 font-bold text-[#121212]">
                      {tx.merchant}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-[#dcfce7] text-[#15803d] border border-[#121212]">
                        {formatCategoryName(tx.category, tx.category_id)}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-black tabular-nums text-[#15803d] text-right">
                      +{currencySymbol}
                      {Number(tx.amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[#15803d]">
                        <BadgeCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
                        <span>Cleared</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectProofTx(tx)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono font-black uppercase rounded-lg border-2 border-[#121212] bg-white text-[#121212] hover:bg-[#fbf9fe] shadow-[1.5px_1.5px_0_0_#121212] transition cursor-pointer"
                          title="Create / View Receipt"
                        >
                          <Receipt className="h-3 w-3 text-[#836EF9]" />
                          <span>Receipt</span>
                        </button>
                        {tx.blockchain_tx_hash ||
                        tx.monad_tx_hash ||
                        tx.verification_state === "verified" ||
                        tx.blockchain_status === "confirmed" ? (
                          <a
                            href={getMonadExplorerTxUrl(
                              tx.blockchain_tx_hash || tx.monad_tx_hash || "",
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-bold rounded-lg border border-[#836EF9] bg-[#f3f0ff] text-[#836EF9] hover:underline"
                            title="Verified on Monad Testnet"
                          >
                            <MonadLogo className="h-2.5 w-2.5" />
                            <span>Verified</span>
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSaveReceipt(tx)}
                            disabled={savingTxId === tx.id}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-bold rounded-lg border border-[#121212] bg-[#836EF9] text-white hover:bg-[#7257f8] shadow-[1.5px_1.5px_0_0_#121212] transition cursor-pointer disabled:opacity-50"
                            title="Save on Monad Testnet (optional)"
                          >
                            <MonadLogo className="h-2.5 w-2.5 text-white" />
                            <span>Save on Chain</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
