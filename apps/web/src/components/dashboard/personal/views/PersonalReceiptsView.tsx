"use client";

import React from "react";
import {
  Receipt,
  ArrowLeftRight,
  ArrowRight,
  Layers,
  Search,
  ExternalLink,
  BadgeCheck,
  ShieldCheck,
  Plus,
  UploadCloud,
  Loader2,
} from "lucide-react";
import { AnimatedBackground, TextScramble, TextShimmer } from "@/components/ui/motion";
import { WatermelonAlert } from "@/components/ui/watermelon-alert";
import { WatermelonButton } from "@/components/ui/watermelon-button";
import {
  CryptoBadge,
  CryptoChainIcon,
  CryptoCoinIcon,
  detectCryptoIdentity,
  MonadLogo,
} from "@/components/ui/crypto-icon";
import { MONAD_TESTNET_CHAIN_ID, getMonadExplorerTxUrl } from "@/lib/blockchain/registry";
import type { ReceiptBundle } from "@/lib/supabase/types";
import type { DashboardTransaction } from "../types";

export interface PersonalReceiptsViewProps {
  currentView: string;
  activeLedgerTab: "transactions" | "receipts";
  setActiveLedgerTab: (tab: "transactions" | "receipts") => void;
  transactions: DashboardTransaction[];
  verifiedReceipts: ReceiptBundle[];
  filteredVerifiedReceipts: ReceiptBundle[];
  displayedTransactions: DashboardTransaction[];
  hasData: boolean;
  saveError: string | null;
  setSaveError: (err: string | null) => void;
  selectedTxIds: Set<string>;
  setSelectedTxIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedTransactionsTotal: number;
  isAllSelected: boolean;
  handleSelectAll: () => void;
  handleToggleSelect: (id: string) => void;
  handleCreateReceiptForSelected: () => void;
  handleBatchSaveOnChain: () => void;
  currencySymbol: string;
  formatTransactionDateTime: (t?: string | null) => string;
  formatCategoryName: (cat?: string | import("@/lib/supabase/types").Category | null, catId?: string | null) => string;
  receiptBundles: Record<string, ReceiptBundle>;
  savingTxId: string | null;
  savingProgressLabel: string;
  handleSaveReceipt: (tx: DashboardTransaction) => void;
  setSelectedProofTx: (tx: DashboardTransaction | null) => void;
  handleViewBundle: (bundleId: string) => void;
  onUploadReceipt?: (() => void) | undefined;
  onAddTransaction?: ((type: "fiat" | "onchain") => void) | undefined;
  subLedger: "all" | "fiat" | "onchain";
  isLoadingReceipts: boolean;
  receiptSearchQuery: string;
  setReceiptSearchQuery: (q: string) => void;
  effectiveConnectedAddress: string | null;
}

export function PersonalReceiptsView({
  currentView,
  activeLedgerTab,
  setActiveLedgerTab,
  transactions,
  verifiedReceipts,
  filteredVerifiedReceipts,
  displayedTransactions,
  hasData,
  saveError,
  setSaveError,
  selectedTxIds,
  setSelectedTxIds,
  selectedTransactionsTotal,
  isAllSelected,
  handleSelectAll,
  handleToggleSelect,
  handleCreateReceiptForSelected,
  handleBatchSaveOnChain,
  currencySymbol,
  formatTransactionDateTime,
  formatCategoryName,
  receiptBundles,
  savingTxId,
  savingProgressLabel,
  handleSaveReceipt,
  setSelectedProofTx,
  handleViewBundle,
  onUploadReceipt,
  onAddTransaction,
  subLedger,
  isLoadingReceipts,
  receiptSearchQuery,
  setReceiptSearchQuery,
  effectiveConnectedAddress,
}: PersonalReceiptsViewProps) {
  if (currentView !== "overview" && currentView !== "receipts") {
    return null;
  }

  return (
    <div className="neo-card overflow-hidden">
      {/* Ledger Header with Montally Neo-Brutalist Tabs */}
      <div className="p-5 border-b-2 border-[#121212] bg-[#f9fafb] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="neo-badge neo-badge-purple">
              • MONAD TESTNET (10143)
            </span>
          </div>
          <h2 className="text-base font-black uppercase tracking-wider text-[#121212]">
            Recent Transactions & Evidence
          </h2>
          <p className="text-xs text-slate-500">
            Universal ledger with cryptographic integrity verification
          </p>
        </div>

        {/* Ledger Navigation Tabs with AnimatedBackground */}
        <div className="flex items-center gap-1.5 bg-[#f3f4f6] p-1 rounded-xl border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
          <AnimatedBackground
            defaultValue={activeLedgerTab}
            className="bg-white border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] rounded-lg"
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 30,
            }}
          >
            {[
              {
                id: "transactions",
                label: "Transactions",
                icon: ArrowLeftRight,
                count: transactions.length,
              },
              {
                id: "receipts",
                label: "Saved Receipts",
                icon: Receipt,
                count: verifiedReceipts.length,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeLedgerTab === tab.id;
              return (
                <button
                  key={tab.id}
                  data-id={tab.id}
                  type="button"
                  onClick={() => setActiveLedgerTab(tab.id as "transactions" | "receipts")}
                  className={`group inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-black uppercase tracking-wider transition-colors shrink-0 cursor-pointer ${
                    isActive
                      ? "text-[#121212]"
                      : "text-slate-600 hover:text-[#121212]"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      isActive ? "text-[#836EF9]" : "text-slate-500 group-hover:text-[#121212]"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="shrink-0">{tab.label}</span>
                  <span
                    className={`inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 text-[10px] font-mono font-black rounded-full border border-[#121212] leading-none shrink-0 transition-colors ${
                      isActive
                        ? "bg-[#f3f0ff] text-[#836EF9]"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </AnimatedBackground>
        </div>
      </div>

      {saveError && (
        <div className="mx-5 mt-4">
          <WatermelonAlert
            variant="error"
            title="Save Error"
            description={saveError}
            onClose={() => setSaveError(null)}
          />
        </div>
      )}

      {/* TAB 1: TRANSACTIONS VIEW */}
      {activeLedgerTab === "transactions" && (
        <>
          {hasData ? (
            <div className="overflow-x-auto">
              {/* Ledger Toolbar with ALL button & actions */}
              <div className="px-5 py-3 border-b-2 border-[#121212] bg-[#fbf9fe] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTxIds(new Set())}
                    className="neo-btn bg-white text-[#121212] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] hover:bg-[#faf5ff] active:translate-x-[1px] active:translate-y-[1px] !py-1.5 !px-3.5 text-xs font-mono font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <Layers className="h-3.5 w-3.5 text-[#836EF9]" />
                    <span>ALL</span>
                    <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 text-[10px] font-mono font-black rounded-md bg-[#836EF9]/10 text-[#836EF9] border border-[#836EF9]/30">
                      {transactions.length}
                    </span>
                  </button>
                </div>

                {selectedTxIds.size > 0 ? (
                  <div className="flex flex-wrap items-center gap-2.5 animate-in fade-in">
                    <div className="flex items-center gap-2 px-2.5 py-1 bg-white border border-[#121212] rounded-md shadow-[1px_1px_0_0_#121212]">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-[#836EF9] text-white text-[11px] font-mono font-black">
                        {selectedTxIds.size}
                      </span>
                      <span className="text-xs font-mono font-black text-[#121212]">
                        Total {currencySymbol}
                        {selectedTransactionsTotal.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedTxIds(new Set())}
                      className="neo-btn neo-btn-secondary !py-1 !px-2.5 text-xs font-mono font-bold uppercase"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateReceiptForSelected}
                      className="neo-btn neo-btn-secondary !py-1.5 !px-3.5 text-xs font-mono font-black uppercase flex items-center gap-1.5 shadow-[2px_2px_0_0_#121212]"
                    >
                      <Receipt className="h-3.5 w-3.5 text-[#836EF9]" />
                      <span>Create Receipt</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleBatchSaveOnChain}
                      className="neo-btn neo-btn-primary !py-1.5 !px-3.5 text-xs font-mono font-black uppercase flex items-center gap-1.5 shadow-[2px_2px_0_0_#121212]"
                    >
                      <MonadLogo className="h-3.5 w-3.5" />
                      <span>Save on Chain</span>
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                    {transactions.length}{" "}
                    {transactions.length === 1 ? "Record" : "Records"} Indexed
                  </span>
                )}
              </div>

              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f3f4f6] border-b-2 border-[#121212] text-[10px] font-black uppercase tracking-wider text-[#121212]">
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleSelectAll}
                        className="h-4 w-4 rounded border-2 border-[#121212] text-[#836EF9] focus:ring-[#836EF9] cursor-pointer"
                        title={
                          isAllSelected
                            ? "Deselect all"
                            : "Select all displayed"
                        }
                      />
                    </th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Merchant / Details</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">
                      Receipt / Proof
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-[#121212]">
                  {displayedTransactions.map((t) => (
                    <tr
                      key={t.id}
                      className={`hover:bg-[#faf5ff] transition ${
                        selectedTxIds.has(t.id) ? "bg-[#f5f3ff]" : ""
                      }`}
                    >
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedTxIds.has(t.id)}
                          onChange={() => handleToggleSelect(t.id)}
                          className="h-4 w-4 rounded border-2 border-[#121212] text-[#836EF9] focus:ring-[#836EF9] cursor-pointer"
                        />
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {formatTransactionDateTime(t.timestamp)}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {(() => {
                            const cryptoInfo =
                              detectCryptoIdentity(t.merchant) ||
                              detectCryptoIdentity(t.description);

                            if (cryptoInfo) {
                              return (
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#121212] bg-[#fbf9fe] shadow-[1px_1px_0_0_#121212] p-1">
                                  {cryptoInfo.kind === "chain" ? (
                                    <CryptoChainIcon
                                      chain={cryptoInfo.identifier}
                                      className="h-5 w-5"
                                    />
                                  ) : (
                                    <CryptoCoinIcon
                                      symbol={cryptoInfo.identifier}
                                      className="h-5 w-5"
                                    />
                                  )}
                                </div>
                              );
                            }

                            return (
                              <div
                                className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black border border-[#121212] shadow-[1px_1px_0_0_#121212] ${
                                  t.type === "income"
                                    ? "bg-[#dcfce7] text-[#15803d]"
                                    : "bg-[#f3f4f6] text-[#121212]"
                                }`}
                              >
                                {t.merchant.slice(0, 1).toUpperCase()}
                              </div>
                            );
                          })()}
                          <div>
                            <p className="text-xs font-black uppercase tracking-wide text-[#121212]">
                              {t.merchant}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              {t.description && t.description !== t.merchant
                                ? t.description
                                : `v${t.version}`}
                            </p>
                            {t.receipt_bundle_id ? (
                              (() => {
                                const b = receiptBundles[t.receipt_bundle_id];
                                const bundleName =
                                  b?.name ||
                                  b?.receipt_name ||
                                  b?.receipt_data?.receiptName;
                                return (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleViewBundle(t.receipt_bundle_id!)
                                    }
                                    className="inline-flex items-center gap-1 mt-1 text-[9px] font-mono font-black uppercase text-[#836EF9] hover:underline bg-[#f3f0ff] border border-[#836EF9]/40 px-1.5 py-0.5 rounded shadow-[1px_1px_0_0_#121212] active:translate-x-[1px] active:translate-y-[1px] max-w-[200px]"
                                    title={
                                      bundleName
                                        ? `Receipt: "${bundleName}" (Click to view)`
                                        : "Click to view Receipt Bundle proof"
                                    }
                                  >
                                    <Receipt className="h-2.5 w-2.5 shrink-0" />
                                    <span className="truncate">
                                      Receipt:{" "}
                                      {bundleName || "Monad Bundle Verified"}
                                    </span>
                                  </button>
                                );
                              })()
                            ) : t.verification_state === "verified" ||
                              t.blockchain_status === "confirmed" ? (
                              <button
                                type="button"
                                onClick={() => setSelectedProofTx(t)}
                                className="inline-flex items-center gap-1 mt-1 text-[9px] font-mono font-black uppercase text-[#836EF9] hover:underline bg-[#f3f0ff] border border-[#836EF9]/40 px-1.5 py-0.5 rounded shadow-[1px_1px_0_0_#121212] active:translate-x-[1px] active:translate-y-[1px]"
                                title="Click to view Monad on-chain proof"
                              >
                                <MonadLogo className="h-2.5 w-2.5" />
                                <span>Monad Verified</span>
                              </button>
                            ) : (
                              <div className="mt-1 flex items-center gap-1 text-[9px] font-mono font-bold uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-300 w-fit">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                <span>
                                  Local Record • Not yet saved on Monad
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="text-[11px] font-mono font-bold uppercase tracking-wider bg-white border border-[#121212] px-2 py-0.5 rounded shadow-[1px_1px_0_0_#121212] text-slate-800">
                          {formatCategoryName(t.category, t.category_id)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`neo-badge ${
                            t.type === "income"
                              ? "neo-badge-green"
                              : "neo-badge-red"
                          }`}
                        >
                          {t.type}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <CryptoBadge
                          text={t.payment_method?.trim() || "Unspecified"}
                        />
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <p
                          className={`text-sm font-black font-mono tabular-nums ${
                            t.type === "income"
                              ? "text-[#15803d]"
                              : "text-[#121212]"
                          }`}
                        >
                          {t.type === "income" ? "+" : "-"}
                          {currencySymbol}
                          {Number(t.amount).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {t.receipt_bundle_id ? (
                          (() => {
                            const b = receiptBundles[t.receipt_bundle_id];
                            const bundleName =
                              b?.name ||
                              b?.receipt_name ||
                              b?.receipt_data?.receiptName;
                            return (
                              <button
                                type="button"
                                onClick={() =>
                                  handleViewBundle(t.receipt_bundle_id!)
                                }
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-black uppercase rounded-lg border-2 border-[#121212] bg-[#f3f0ff] text-[#836EF9] shadow-[2px_2px_0_0_#121212] hover:bg-[#e7e1fe] transition active:translate-x-[1px] active:translate-y-[1px]"
                                title={
                                  bundleName
                                    ? `View Receipt: ${bundleName}`
                                    : "Click to view Monad on-chain receipt bundle"
                                }
                              >
                                <Receipt className="h-3 w-3" />
                                <span>View Receipt</span>
                              </button>
                            );
                          })()
                        ) : t.verification_state === "verified" ||
                          t.blockchain_status === "confirmed" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedProofTx(t)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-black uppercase rounded-lg border-2 border-[#121212] bg-[#f3f0ff] text-[#836EF9] shadow-[2px_2px_0_0_#121212] hover:bg-[#e7e1fe] transition active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
                              title="Click to view Monad on-chain proof receipt"
                            >
                              <MonadLogo className="h-3 w-3" />
                              <span>View Proof</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedProofTx(t)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono font-black uppercase rounded-lg border-2 border-[#121212] bg-white text-[#121212] hover:bg-[#fbf9fe] shadow-[1.5px_1.5px_0_0_#121212] transition cursor-pointer"
                              title="Create Receipt"
                            >
                              <Receipt className="h-3 w-3 text-[#836EF9]" />
                              <span>Receipt</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveReceipt(t)}
                              disabled={savingTxId === t.id}
                              className="neo-btn neo-btn-primary !py-1 !px-2.5 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-[2px_2px_0_0_#121212] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50"
                              title="Create transaction on Monad Testnet and permanently save receipt (optional)"
                            >
                              {savingTxId === t.id ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin text-white" />
                                  <TextShimmer className="text-white font-mono text-[10px]">
                                    {savingProgressLabel || "Saving..."}
                                  </TextShimmer>
                                </>
                              ) : (
                                <>
                                  <MonadLogo className="h-3 w-3" />
                                  <span>Save on Chain</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center p-6 bg-[#f8f9fa]">
              <div className="h-12 w-12 rounded-xl bg-white flex items-center justify-center mb-3 text-[#836EF9] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
                <Receipt className="h-6 w-6" />
              </div>
              <p className="text-sm font-black uppercase tracking-wider text-[#121212]">
                No transactions recorded
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Drag-and-drop a receipt image, import transactions, or add
                an expense manually to start tracking with cryptographic proof.
              </p>
              <div className="mt-5 flex gap-3">
                <WatermelonButton
                  type="button"
                  variant="primary"
                  size="sm"
                  textMorph
                  onClick={onUploadReceipt}
                >
                  Scan Receipt
                </WatermelonButton>
                <WatermelonButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  textMorph
                  onClick={() => onAddTransaction?.("fiat")}
                >
                  Manual Entry
                </WatermelonButton>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: DEDICATED SAVED RECEIPTS VIEW */}
      {activeLedgerTab === "receipts" && (
        <div>
          {isLoadingReceipts && verifiedReceipts.length === 0 ? (
            <div className="py-14 flex flex-col items-center justify-center text-center p-6 bg-[#f8f9fa]">
              <Loader2 className="h-8 w-8 text-[#836EF9] animate-spin mb-3" />
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#121212]">
                Syncing verified receipts from Monad Testnet...
              </p>
            </div>
          ) : verifiedReceipts.length === 0 ? (
            transactions.length === 0 ? (
              <div className="py-14 flex flex-col items-center justify-center text-center p-6 bg-[#f8f9fa]">
                <div className="h-14 w-14 rounded-2xl bg-white flex items-center justify-center mb-3 text-[#836EF9] border-2 border-[#121212] shadow-[3px_3px_0_0_#121212]">
                  <Receipt className="h-7 w-7" />
                </div>
                <p className="text-sm font-black text-[#121212]">
                  No Saved Receipts Yet
                </p>
                <p className="text-xs text-slate-600 mt-1 max-w-sm">
                  Receipts you save and verify on Monad will appear here. A cryptographic fingerprint proves payment authenticity while keeping invoice details private.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <WatermelonButton
                    type="button"
                    variant="primary"
                    size="sm"
                    textMorph
                    leftIcon={<Plus className="h-3.5 w-3.5" />}
                    onClick={() => onAddTransaction?.(subLedger === "onchain" ? "onchain" : "fiat")}
                  >
                    Log Expense
                  </WatermelonButton>
                  {onUploadReceipt && (
                    <WatermelonButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      textMorph
                      leftIcon={<UploadCloud className="h-3.5 w-3.5 text-[#836EF9]" />}
                      onClick={onUploadReceipt}
                    >
                      Scan Receipt
                    </WatermelonButton>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-14 flex flex-col items-center justify-center text-center p-6 bg-[#f8f9fa]">
                <div className="h-14 w-14 rounded-2xl bg-white flex items-center justify-center mb-3 text-[#836EF9] border-2 border-[#121212] shadow-[3px_3px_0_0_#121212]">
                  <ShieldCheck className="h-7 w-7" />
                </div>
                <p className="text-sm font-black text-[#121212]">
                  No Verified Receipts Yet
                </p>
                <p className="text-xs text-slate-600 mt-1 max-w-md">
                  You have {transactions.length} local transaction
                  {transactions.length === 1 ? "" : "s"}. Select transactions in the ledger and click &quot;Create Receipt&quot; or &quot;Save on Chain&quot; to record an immutable Monad proof.
                </p>
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveLedgerTab("transactions")}
                    className="neo-btn neo-btn-primary flex items-center gap-1.5 shadow-[2px_2px_0_0_#121212] cursor-pointer"
                  >
                    <span>View Transactions</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          ) : (
            <div>
              {/* Search & Filter Bar */}
              <div className="p-4 border-b-2 border-[#121212] bg-[#fbf9fe] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="neo-badge neo-badge-purple flex items-center gap-1 font-mono font-black">
                    <MonadLogo className="h-3 w-3" />
                    <span>
                      • {verifiedReceipts.length} SAVED ON MONAD TESTNET
                    </span>
                  </span>
                  <span className="text-[11px] font-mono font-bold text-slate-500">
                    Chain ID: {MONAD_TESTNET_CHAIN_ID}
                  </span>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={receiptSearchQuery}
                    onChange={(e) => setReceiptSearchQuery(e.target.value)}
                    placeholder="Search receipts by name or hash..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs font-mono font-bold bg-white border-2 border-[#121212] rounded-lg shadow-[2px_2px_0_0_#121212] focus:outline-none focus:border-[#836EF9]"
                  />
                </div>
              </div>

              {filteredVerifiedReceipts.length === 0 ? (
                <div className="py-10 text-center p-6 bg-[#f8f9fa]">
                  <p className="text-xs font-mono font-bold uppercase text-slate-500">
                    No receipts match your search filter &quot;
                    {receiptSearchQuery}&quot;
                  </p>
                  <button
                    type="button"
                    onClick={() => setReceiptSearchQuery("")}
                    className="mt-3 neo-btn neo-btn-secondary !py-1 !px-3 text-xs font-mono"
                  >
                    Clear Filter
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#f3f4f6] border-b-2 border-[#121212] text-[10px] font-black uppercase tracking-wider text-[#121212]">
                        <th className="py-3 px-4">Receipt Name & ID</th>
                        <th className="py-3 px-4">Transactions</th>
                        <th className="py-3 px-4">Created Date</th>
                        <th className="py-3 px-4">Signing Wallet</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">
                          Total Amount
                        </th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-[#121212]">
                      {filteredVerifiedReceipts.map((r) => {
                        const rName =
                          r.name ||
                          r.receipt_name ||
                          r.receipt_data?.receiptName ||
                          "Receipt Bundle";
                        const rNumber =
                          r.receipt_number ||
                          `CR-${r.id.slice(0, 8).toUpperCase()}`;
                        const txCount =
                          r.transaction_count ||
                          r.transaction_ids?.length ||
                          1;
                        const txHash = r.blockchain_tx_hash;
                        const explorerUrl = txHash
                          ? getMonadExplorerTxUrl(txHash)
                          : null;
                        const walletAddr =
                          r.wallet_address ||
                          effectiveConnectedAddress ||
                          null;

                        return (
                          <tr
                            key={r.id}
                            className="hover:bg-[#faf5ff] transition"
                          >
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f3f0ff] text-[#836EF9] border-2 border-[#121212] shadow-[1px_1px_0_0_#121212]">
                                  <Receipt className="h-4 w-4" />
                                </div>
                                <div>
                                  <p className="text-xs font-black uppercase tracking-wide text-[#121212]">
                                    {rName}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] font-mono font-bold text-slate-500">
                                      {rNumber}
                                    </span>
                                    {txHash && (
                                      <a
                                        href={explorerUrl!}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[9px] font-mono text-[#836EF9] hover:underline flex items-center gap-0.5"
                                        title={`Monad Tx: ${txHash}`}
                                      >
                                        <span className="font-mono">
                                          <TextScramble
                                            duration={0.6}
                                            characterSet="0123456789abcdef"
                                          >
                                            {`${txHash.slice(0, 6)}...${txHash.slice(-4)}`}
                                          </TextScramble>
                                        </span>
                                        <ExternalLink className="h-2.5 w-2.5" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className="text-[11px] font-mono font-bold uppercase tracking-wider bg-white border border-[#121212] px-2 py-0.5 rounded shadow-[1px_1px_0_0_#121212] text-slate-800 flex items-center gap-1 w-fit">
                                <Layers className="h-3 w-3 text-slate-500" />
                                <span>
                                  {txCount} {txCount === 1 ? "txn" : "txns"}
                                </span>
                              </span>
                            </td>

                            <td className="py-3.5 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                              {formatTransactionDateTime(r.created_at)}
                            </td>

                            <td className="py-3.5 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                              {walletAddr && walletAddr.startsWith("0x") ? (
                                <span className="text-[11px] font-mono font-bold text-slate-700">
                                  {walletAddr.slice(0, 6)}...
                                  {walletAddr.slice(-4)}
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono text-slate-500">
                                  Clario Account
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className="neo-badge neo-badge-purple flex items-center gap-1 font-mono font-black text-[10px] w-fit">
                                <BadgeCheck
                                  className="h-3 w-3 text-[#836EF9]"
                                  aria-hidden="true"
                                />
                                <span>MONAD VERIFIED</span>
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <p className="text-sm font-black font-mono text-[#121212]">
                                -{currencySymbol}
                                {Number(r.total_amount).toLocaleString(
                                  "en-US",
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  },
                                )}
                              </p>
                              <p className="text-[9px] font-mono font-bold text-slate-500 uppercase">
                                Monad Testnet
                              </p>
                            </td>

                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleViewBundle(r.id)}
                                  className="neo-btn neo-btn-secondary !py-1 !px-2.5 text-[10px] font-mono font-black uppercase flex items-center gap-1 shadow-[1px_1px_0_0_#121212] active:translate-x-[1px] active:translate-y-[1px]"
                                  title="View verified receipt details and proof"
                                >
                                  <Receipt className="h-3 w-3 text-[#836EF9]" />
                                  <span>VIEW RECEIPT</span>
                                </button>
                                {explorerUrl && (
                                  <a
                                    href={explorerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-black uppercase rounded-lg border-2 border-[#121212] bg-[#f3f0ff] text-[#836EF9] hover:bg-[#e7e1fe] shadow-[1px_1px_0_0_#121212] transition active:translate-x-[1px] active:translate-y-[1px]"
                                    title="View on Monad Testnet Explorer"
                                  >
                                    <MonadLogo className="h-3 w-3" />
                                    <ExternalLink className="h-2.5 w-2.5" />
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
