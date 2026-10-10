"use client";

import React from "react";
import { ArrowRight, TrendingUp, TrendingDown, ShieldCheck } from "lucide-react";
import { MonadLogo, CryptoBadge } from "@/components/ui/crypto-icon";
import { formatCategoryName } from "@/domain/analytics/financial-metrics";
import type { SpendingCategoryItem } from "@/domain/analytics/financial-metrics";
import type { BudgetStatusItem } from "@/domain/budgets/budget-engine";
import type { CashFlowBucket, CashFlowPeriod } from "@/domain/analytics/cashflow-calculator";
import type { Transaction, Subscription } from "@/lib/supabase/types";
import { getMonadExplorerTxUrl } from "@/lib/blockchain/registry";
import { PersonalKpiCards } from "../components/PersonalKpiCards";
import { QuickAddExpenseCard } from "../components/QuickAddExpenseCard";
import { CashFlowChartCard } from "../components/CashFlowChartCard";
import { UpcomingBillsCard } from "../components/UpcomingBillsCard";
import { CategoryBreakdownCard } from "../components/CategoryBreakdownCard";
import { BudgetStatusCard } from "../components/BudgetStatusCard";

export interface PersonalOverviewViewProps {
  subLedger: "all" | "fiat" | "onchain";
  netCashFlow: number;
  activeCurrencySymbol: string;
  currencySymbol: string;
  currencyCode: string;
  userId: string;
  monthlyIncome: number;
  monthlySpending: number;
  availableBudget: number;
  totalBudgetLimit: number;
  upcomingBillsTotal: number;
  activeSubscriptionsCount: number;
  savingsRate: number;
  onAddExpense?: ((tx: Transaction) => void) | undefined;
  chartData: CashFlowBucket[];
  cashFlowPeriod: CashFlowPeriod;
  onPeriodChange: (period: CashFlowPeriod) => void;
  hasData: boolean;
  localSubscriptions: Subscription[];
  onOpenAddSubscription: () => void;
  spendingCategories: SpendingCategoryItem[];
  budgetStatuses: BudgetStatusItem[];
  onOpenCreateBudget: () => void;
  latestTransactions: Transaction[];
  onNavigateToExpenses: () => void;
  onSelectProofTx: (tx: Transaction) => void;
  onSaveReceipt: (tx: Transaction) => void;
  savingTxId: string | null;
  savingProgressLabel: string;
}

export function PersonalOverviewView({
  subLedger,
  netCashFlow,
  activeCurrencySymbol,
  currencySymbol,
  currencyCode,
  userId,
  monthlyIncome,
  monthlySpending,
  availableBudget,
  totalBudgetLimit,
  upcomingBillsTotal,
  activeSubscriptionsCount,
  savingsRate,
  onAddExpense,
  chartData,
  cashFlowPeriod,
  onPeriodChange,
  hasData,
  localSubscriptions,
  onOpenAddSubscription,
  spendingCategories,
  budgetStatuses,
  onOpenCreateBudget,
  latestTransactions,
  onNavigateToExpenses,
  onSelectProofTx,
  onSaveReceipt,
  savingTxId,
  savingProgressLabel,
}: PersonalOverviewViewProps) {
  return (
    <>
      <PersonalKpiCards
        subLedger={subLedger}
        netCashFlow={netCashFlow}
        activeCurrencySymbol={activeCurrencySymbol}
        currencySymbol={currencySymbol}
        monthlyIncome={monthlyIncome}
        monthlySpending={monthlySpending}
        availableBudget={availableBudget}
        totalBudgetLimit={totalBudgetLimit}
        upcomingBillsTotal={upcomingBillsTotal}
        activeSubscriptionsCount={activeSubscriptionsCount}
        savingsRate={savingsRate}
      />

      {subLedger !== "onchain" && (
        <QuickAddExpenseCard
          currencySymbol={currencySymbol}
          currencyCode={currencyCode}
          userId={userId}
          onAddExpense={onAddExpense}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CashFlowChartCard
          chartData={chartData}
          cashFlowPeriod={cashFlowPeriod}
          onPeriodChange={onPeriodChange}
          hasData={hasData}
        />
        <UpcomingBillsCard
          subscriptions={localSubscriptions}
          currencySymbol={currencySymbol}
          onOpenAddSubscription={onOpenAddSubscription}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryBreakdownCard
          categories={spendingCategories}
          currencySymbol={currencySymbol}
        />
        <BudgetStatusCard
          budgets={budgetStatuses}
          currencySymbol={currencySymbol}
          onOpenCreateBudget={onOpenCreateBudget}
        />
      </div>

      {/* Quick Ledger Activity (Overview Feed) */}
      <div className="neo-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-black uppercase tracking-wider text-[#121212]">
              Latest Transactions & Verification
            </h2>
            <p className="text-xs text-slate-500">
              Recent expenditures and cryptographic record proofs on Monad
            </p>
          </div>

          <button
            type="button"
            onClick={onNavigateToExpenses}
            className="neo-btn neo-btn-secondary text-[11px] font-black uppercase cursor-pointer"
          >
            <span>View All In Ledger</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {latestTransactions.length > 0 ? (
          <div className="divide-y-2 divide-[#121212] border-2 border-[#121212] rounded-lg overflow-hidden bg-white shadow-[2px_2px_0_0_#121212]">
            {latestTransactions.slice(0, 5).map((tx) => {
              const isExpense = tx.type === "expense";
              const isVerified =
                tx.verification_state === "verified" ||
                tx.verification_state === "anchored_onchain" ||
                tx.verification_status === "verified" ||
                tx.blockchain_status === "confirmed" ||
                Boolean(
                  tx.monad_tx_hash ||
                    tx.blockchain_tx_hash ||
                    tx.receipt_bundle_id,
                );
              const effectiveTxHash =
                tx.monad_tx_hash || tx.blockchain_tx_hash || null;

              return (
                <div
                  key={tx.id}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-[#fafafa] transition"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-9 w-9 rounded-lg border-1.5 border-[#121212] flex items-center justify-center font-mono font-black text-xs shrink-0 shadow-[1px_1px_0_0_#121212] ${
                        isExpense
                          ? "bg-[#fee2e2] text-[#b91c1c]"
                          : "bg-[#dcfce7] text-[#15803d]"
                      }`}
                    >
                      {isExpense ? (
                        <TrendingDown className="h-4 w-4" />
                      ) : (
                        <TrendingUp className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-wide text-[#121212]">
                          {tx.merchant || tx.description}
                        </span>
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 bg-[#f3f4f6] text-slate-600 rounded border border-[#121212]">
                          {formatCategoryName(tx.category, tx.category_id)}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {tx.date || tx.timestamp?.slice(0, 10)} ·{" "}
                        {tx.payment_method || "Card"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <div className="text-right">
                      <div
                        className={`text-sm font-black font-mono tabular-nums tracking-tight ${
                          isExpense ? "text-[#b91c1c]" : "text-[#15803d]"
                        }`}
                      >
                        {isExpense ? "-" : "+"}
                        {tx.currency && tx.currency !== "USD"
                          ? tx.currency === "INR"
                            ? "₹"
                            : tx.currency === "EUR"
                              ? "€"
                              : tx.currency === "GBP"
                                ? "£"
                                : tx.currency
                          : activeCurrencySymbol}
                        {Number(tx.amount || 0).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                      <div className="flex items-center gap-1.5 justify-end mt-0.5">
                        {isVerified ? (
                          <button
                            type="button"
                            onClick={() => onSelectProofTx(tx)}
                            className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase text-[#836EF9] bg-[#f3f0ff] px-2 py-0.5 rounded border border-[#121212] hover:bg-[#e9e4ff] cursor-pointer"
                          >
                            <ShieldCheck className="h-3 w-3" />
                            <span>Proof Spine</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={savingTxId === tx.id}
                            onClick={() => onSaveReceipt(tx)}
                            className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase text-slate-600 bg-white hover:bg-[#f3f0ff] hover:text-[#836EF9] px-2 py-0.5 rounded border border-[#121212] cursor-pointer"
                          >
                            <MonadLogo className="h-3 w-3" />
                            <span>
                              {savingTxId === tx.id
                                ? savingProgressLabel || "Saving..."
                                : "Save On Monad"}
                            </span>
                          </button>
                        )}
                        {effectiveTxHash && (
                          <a
                            href={getMonadExplorerTxUrl(effectiveTxHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-mono text-slate-400 hover:text-[#836EF9]"
                          >
                            ↗
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-xs font-bold text-slate-400 border-2 border-dashed border-[#121212] rounded-xl p-4 bg-[#f8f9fa]">
            No recent transaction activity recorded.
          </div>
        )}
      </div>
    </>
  );
}
