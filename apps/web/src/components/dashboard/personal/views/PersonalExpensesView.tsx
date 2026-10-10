"use client";

import React from "react";
import {
  Download,
  UploadCloud,
  Plus,
  Receipt,
  Search,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { MonadLogo } from "@/components/ui/crypto-icon";
import { WatermelonButton } from "@/components/ui/watermelon-button";
import { NeoSelect } from "@/components/ui/neo-select";
import {
  ToolbarExpandable,
  ToolbarCollapsed,
  ToolbarExpanded,
  ToolbarToggle,
} from "@/components/ui/motion";
import { formatCategoryName } from "@/domain/analytics/financial-metrics";
import type {
  ExpenseDateFilter,
  ExpenseAmountFilter,
  ExpenseReceiptFilter,
  ExpenseVerificationFilter,
} from "@/domain/transactions/transaction-filter";
import type { Transaction } from "@/lib/supabase/types";

export interface PersonalExpensesViewProps {
  subLedger: "all" | "fiat" | "onchain";
  currencySymbol: string;
  totalExpenses: number;
  filteredExpenses: Transaction[];
  activeTransactionsCount: number;
  totalExpensesCount: number;
  selectedTxIds: Set<string>;
  onToggleSelect: (txId: string) => void;
  onSelectAll: () => void;
  isAllSelected: boolean;
  onCreateReceiptForSelected: () => void;
  onBatchSaveOnChain: () => void;
  onExportExpensesCSV: () => void;
  onUploadReceipt?: (() => void) | undefined;
  onAddTransaction?: ((subLedger?: "fiat" | "onchain") => void) | undefined;
  onSelectProofTx: (tx: Transaction) => void;
  expenseSearch: string;
  onSearchChange: (val: string) => void;
  expenseCategoryFilter: string;
  onCategoryFilterChange: (val: string) => void;
  expenseDateFilter: ExpenseDateFilter;
  onDateFilterChange: (val: ExpenseDateFilter) => void;
  expenseAmountFilter: ExpenseAmountFilter;
  onAmountFilterChange: (val: ExpenseAmountFilter) => void;
  expensePaymentFilter: string;
  onPaymentFilterChange: (val: string) => void;
  expenseReceiptFilter: ExpenseReceiptFilter;
  onReceiptFilterChange: (val: ExpenseReceiptFilter) => void;
  expenseVerificationFilter: ExpenseVerificationFilter;
  onVerificationFilterChange: (val: ExpenseVerificationFilter) => void;
  onResetFilters: () => void;
}

export function PersonalExpensesView({
  subLedger,
  currencySymbol,
  totalExpenses,
  filteredExpenses,
  activeTransactionsCount,
  totalExpensesCount,
  selectedTxIds,
  onToggleSelect,
  onSelectAll,
  isAllSelected,
  onCreateReceiptForSelected,
  onBatchSaveOnChain,
  onExportExpensesCSV,
  onUploadReceipt,
  onAddTransaction,
  onSelectProofTx,
  expenseSearch,
  onSearchChange,
  expenseCategoryFilter,
  onCategoryFilterChange,
  expenseDateFilter,
  onDateFilterChange,
  expenseAmountFilter,
  onAmountFilterChange,
  expensePaymentFilter,
  onPaymentFilterChange,
  expenseReceiptFilter,
  onReceiptFilterChange,
  expenseVerificationFilter,
  onVerificationFilterChange,
  onResetFilters,
}: PersonalExpensesViewProps) {
  const hasActiveFilters =
    Boolean(expenseSearch) ||
    expenseCategoryFilter !== "all" ||
    expenseDateFilter !== "all" ||
    expenseAmountFilter !== "all" ||
    expensePaymentFilter !== "all" ||
    expenseReceiptFilter !== "all" ||
    expenseVerificationFilter !== "all";

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-wider text-[#121212]">
            Personal Expenses
          </h2>
          <p className="text-xs text-slate-500">
            Filter by category, date, amount, merchant, and Monad verification.
          </p>
        </div>

        {/* Actions: Add Expense, Import, Create Receipt, Export */}
        <div className="flex flex-wrap items-center gap-2.5">
          {selectedTxIds.size > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCreateReceiptForSelected}
                className="neo-btn neo-btn-secondary !py-2 !px-3 text-xs font-mono font-black uppercase flex items-center gap-1.5 shadow-[2px_2px_0_0_#121212] cursor-pointer"
              >
                <Receipt className="h-4 w-4 text-[#836EF9]" />
                <span>Create Receipt ({selectedTxIds.size})</span>
              </button>
              <button
                type="button"
                onClick={onBatchSaveOnChain}
                className="neo-btn neo-btn-primary !py-2 !px-3 text-xs font-mono font-black uppercase flex items-center gap-1.5 shadow-[2px_2px_0_0_#121212] cursor-pointer"
              >
                <MonadLogo className="h-4 w-4" />
                <span>Save on Chain ({selectedTxIds.size})</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onExportExpensesCSV}
            className="neo-btn neo-btn-secondary cursor-pointer"
            title="Download CSV"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>

          {onUploadReceipt && (
            <button
              type="button"
              onClick={onUploadReceipt}
              className="neo-btn neo-btn-secondary cursor-pointer"
            >
              <UploadCloud className="h-4 w-4 text-[#836EF9]" />
              <span>Import / Scan</span>
            </button>
          )}

          {onAddTransaction && (
            <WatermelonButton
              type="button"
              variant="primary"
              size="sm"
              textMorph
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() =>
                onAddTransaction(subLedger === "onchain" ? "onchain" : "fiat")
              }
            >
              {subLedger === "onchain" ? "Log On-Chain TX" : "Add Expense"}
            </WatermelonButton>
          )}
        </div>
      </div>

      {/* 3 Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="neo-card p-5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Total Outflow
          </span>
          <div className="text-2xl font-black font-mono text-[#b91c1c] mt-1">
            -{currencySymbol}
            {totalExpenses.toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Total recorded personal spending
          </p>
        </div>
        <div className="neo-card p-5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Matching Expenses
          </span>
          <div className="text-2xl font-black font-mono text-[#121212] mt-1">
            {filteredExpenses.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Of {activeTransactionsCount} total expenses
          </p>
        </div>
        <div className="neo-card p-5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Average Expense
          </span>
          <div className="text-2xl font-black font-mono text-[#836EF9] mt-1">
            {currencySymbol}
            {(totalExpenses / Math.max(1, totalExpensesCount)).toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Per transaction average
          </p>
        </div>
      </div>

      {/* Complete Filters Toolbar */}
      <div className="neo-card p-4 bg-white space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Merchant / Description search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search merchant, notes, description..."
              value={expenseSearch}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border-2 border-[#121212] rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
            />
          </div>

          {/* Category Filter */}
          <NeoSelect
            value={expenseCategoryFilter}
            onChange={onCategoryFilterChange}
            options={[
              { value: "all", label: "All Categories" },
              { value: "food", label: "Food & Dining" },
              { value: "transport", label: "Transportation" },
              { value: "shopping", label: "Shopping" },
              { value: "utilities", label: "Bills & Utilities" },
              { value: "software", label: "Software & Tools" },
              { value: "health", label: "Health & Medical" },
              { value: "housing", label: "Housing" },
              { value: "other", label: "General / Other" },
            ]}
          />

          {/* Date Filter */}
          <NeoSelect
            value={expenseDateFilter}
            onChange={(val) => onDateFilterChange(val as ExpenseDateFilter)}
            options={[
              { value: "all", label: "All Time" },
              { value: "7d", label: "Last 7 Days" },
              { value: "30d", label: "Last 30 Days" },
              { value: "month", label: "This Month" },
              { value: "year", label: "This Year" },
            ]}
          />

          {/* Amount Filter */}
          <NeoSelect
            value={expenseAmountFilter}
            onChange={(val) => onAmountFilterChange(val as ExpenseAmountFilter)}
            options={[
              { value: "all", label: "Any Amount" },
              { value: "under50", label: `Under ${currencySymbol}50` },
              {
                value: "50to200",
                label: `${currencySymbol}50 - ${currencySymbol}200`,
              },
              { value: "over200", label: `Over ${currencySymbol}200` },
            ]}
          />
        </div>

        {/* Sub-filters row */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <ToolbarExpandable className="border-2 border-[#121212] bg-[#f9fafb]">
            <ToolbarCollapsed className="gap-2 px-3 py-1.5">
              <span className="text-[10px] font-mono font-black uppercase text-slate-500 tracking-wider">
                Extra Filters
              </span>
              {(expensePaymentFilter !== "all" ||
                expenseReceiptFilter !== "all" ||
                expenseVerificationFilter !== "all") && (
                <span className="w-2 h-2 rounded-full bg-[#836EF9]" />
              )}
              <ToolbarToggle className="px-2 py-0.5 rounded bg-white border border-[#121212] text-[#121212] hover:bg-[#836EF9] hover:text-white">
                Configure ▾
              </ToolbarToggle>
            </ToolbarCollapsed>
            <ToolbarExpanded className="flex-wrap gap-2.5 p-2 bg-white">
              <span className="text-[10px] font-mono font-black uppercase text-slate-400">
                Filters:
              </span>
              {/* Payment Method */}
              <NeoSelect
                size="sm"
                value={expensePaymentFilter}
                onChange={onPaymentFilterChange}
                options={[
                  { value: "all", label: "All Payment Methods" },
                  { value: "card", label: "Card" },
                  { value: "bank", label: "Bank Transfer" },
                  { value: "cash", label: "Cash" },
                  { value: "crypto", label: "Crypto / Web3" },
                ]}
              />

              {/* Receipt Status */}
              <NeoSelect
                size="sm"
                value={expenseReceiptFilter}
                onChange={(val) =>
                  onReceiptFilterChange(val as ExpenseReceiptFilter)
                }
                options={[
                  { value: "all", label: "All Receipt Statuses" },
                  { value: "has_receipt", label: "Has Receipt / Hash" },
                  { value: "no_receipt", label: "Missing Receipt" },
                ]}
              />

              {/* Monad Verification Status */}
              <NeoSelect
                size="sm"
                value={expenseVerificationFilter}
                onChange={(val) =>
                  onVerificationFilterChange(val as ExpenseVerificationFilter)
                }
                options={[
                  { value: "all", label: "All Monad States" },
                  { value: "verified", label: "Monad Verified (On-Chain)" },
                  { value: "unverified", label: "Unanchored (Off-Chain)" },
                ]}
              />

              <ToolbarToggle className="px-2 py-1 rounded bg-[#121212] text-white hover:bg-slate-800">
                Done ✕
              </ToolbarToggle>
            </ToolbarExpanded>
          </ToolbarExpandable>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="text-[10px] font-bold uppercase text-[#836EF9] hover:underline cursor-pointer"
            >
              Reset All Filters
            </button>
          )}
        </div>
      </div>

      {/* Interactive Expenses Table */}
      <div className="neo-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b-2 border-[#121212] bg-[#f9fafb]">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={onSelectAll}
                    className="h-4 w-4 rounded border-2 border-[#121212] text-[#836EF9] focus:ring-[#836EF9]"
                  />
                </th>
                <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                  Date
                </th>
                <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                  Merchant
                </th>
                <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                  Category
                </th>
                <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                  Payment
                </th>
                <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600 text-right">
                  Amount
                </th>
                <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                  Receipt / Proof
                </th>
                <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y border-b border-[#121212]">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-[#121212]">
                      No expenses matched your filter.
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try clearing some filters or log a new expense.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((tx) => {
                  const isSelected = selectedTxIds.has(tx.id);
                  return (
                    <tr
                      key={tx.id}
                      className={`transition ${isSelected ? "bg-[#f3f0ff]/50" : "hover:bg-[#f3f0ff]/20"}`}
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSelect(tx.id)}
                          className="h-4 w-4 rounded border-2 border-[#121212] text-[#836EF9] focus:ring-[#836EF9]"
                        />
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {tx.date || tx.timestamp?.split("T")[0]}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#121212]">
                        {tx.merchant}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-[#f3f0ff] text-[#836EF9] border border-[#121212]">
                          {formatCategoryName(tx.category, tx.category_id)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {tx.payment_method || "Card"}
                      </td>
                      <td className="py-3 px-4 font-mono font-black tabular-nums text-[#b91c1c] text-right">
                        -{currencySymbol}
                        {Number(tx.amount).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        {tx.monad_tx_hash ||
                        tx.blockchain_status === "confirmed" ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#dcfce7] text-[#15803d] border border-[#121212] flex items-center gap-1 w-fit">
                            <ShieldCheck className="h-3 w-3" />
                            Monad Verified
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold">
                            Unanchored
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onSelectProofTx(tx)}
                          className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider border border-[#121212] rounded bg-white hover:bg-[#f3f0ff] shadow-[1px_1px_0_0_#121212] transition cursor-pointer"
                        >
                          Proof
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
