"use client";

import { useState } from "react";
import {
  X,
  Check,
  Copy,
  Download,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Receipt,
  Layers,
  Calendar,
  CheckCircle2,
  RefreshCw,
  Pencil,
} from "lucide-react";
import type { ReceiptBundle, Transaction } from "@/lib/supabase/types";
import {
  getMonadExplorerTxUrl,
  CLARIO_REGISTRY_ADDRESS,
  MONAD_TESTNET_CHAIN_ID,
  computeReceiptHash,
  fetchOnchainReceipt,
  toBytes32Id,
} from "@/lib/blockchain/registry";
import { MonadLogo } from "@/components/ui/crypto-icon";
import { formatTransactionDateTime } from "@/lib/import/types";
import { ReceiptExportDropdown } from "@/components/dashboard/receipt-export-dropdown";
import { extractCanonicalReceiptData } from "@/lib/export/receipt-exporter";
import type { Address } from "viem";
import { motion, AnimatePresence } from "motion/react";
import { ContextualIconSwap } from "@/components/ui/motion";

interface ReceiptBundleModalProps {
  isOpen: boolean;
  onClose: () => void;
  bundle: ReceiptBundle | null;
  transactions?: Transaction[] | undefined;
  userAddress?: string | null | undefined;
  onBundleUpdated?: ((bundle: ReceiptBundle) => void) | undefined;
}

export function ReceiptBundleModal({
  isOpen,
  onClose,
  bundle,
  transactions = [],
  userAddress,
  onBundleUpdated,
}: ReceiptBundleModalProps) {
  const [prevBundleId, setPrevBundleId] = useState(bundle?.id);
  const [currentBundle, setCurrentBundle] = useState<ReceiptBundle | null>(
    bundle,
  );
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<
    "idle" | "match" | "mismatch"
  >("idle");
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isSubmittingRename, setIsSubmittingRename] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameSuccessNotice, setRenameSuccessNotice] = useState<string | null>(
    null,
  );

  if (bundle?.id !== prevBundleId) {
    setPrevBundleId(bundle?.id);
    setCurrentBundle(bundle);
    setIsRenaming(false);
    setRenameError(null);
    setRenameSuccessNotice(null);
    setVerifyStatus("idle");
  }

  if (!bundle) return null;

  const activeBundle = currentBundle || bundle;
  const receiptName =
    activeBundle.name ||
    activeBundle.receipt_name ||
    activeBundle.receipt_data?.receiptName;

  const isVerified =
    activeBundle.verification_status === "verified" &&
    activeBundle.blockchain_status === "confirmed";

  const txHash = activeBundle.blockchain_tx_hash;
  const receiptHash = activeBundle.receipt_hash || activeBundle.file_hash;
  const contractAddress =
    activeBundle.blockchain_contract_address || CLARIO_REGISTRY_ADDRESS;

  const explorerUrl = txHash ? getMonadExplorerTxUrl(txHash) : null;

  // Filter or use embedded transactions
  const rawEmbeddedTxs = activeBundle.receipt_data?.transactions;
  const matchedTxs = Array.isArray(transactions)
    ? transactions.filter((t) => activeBundle.transaction_ids?.includes(t.id))
    : [];

  let bundledTxs: any[] = [];

  if (Array.isArray(rawEmbeddedTxs) && rawEmbeddedTxs.length > 0) {
    bundledTxs = rawEmbeddedTxs;
  } else if (matchedTxs.length > 0) {
    bundledTxs = matchedTxs;
  } else if (
    Array.isArray(activeBundle.transaction_ids) &&
    activeBundle.transaction_ids.length > 0
  ) {
    const total = Number(activeBundle.total_amount) || 0;
    const count = activeBundle.transaction_ids.length;
    const splitAmount = count > 1 ? Number((total / count).toFixed(2)) : total;
    bundledTxs = activeBundle.transaction_ids.map((id, idx) => ({
      id,
      merchant:
        activeBundle.name ||
        activeBundle.receipt_name ||
        "Recorded Transaction",
      amount:
        idx === 0 && count > 1
          ? Number((total - splitAmount * (count - 1)).toFixed(2))
          : splitAmount,
      currency: activeBundle.currency || "USD",
      date: (activeBundle.created_at || new Date().toISOString()).slice(0, 10),
      category: "Recorded Expense",
      type: "expense",
    }));
  } else if (activeBundle.total_amount) {
    bundledTxs = [
      {
        id: activeBundle.id,
        merchant:
          activeBundle.name ||
          activeBundle.receipt_name ||
          "Recorded Transaction",
        amount: Number(activeBundle.total_amount) || 0,
        currency: activeBundle.currency || "USD",
        date: (activeBundle.created_at || new Date().toISOString()).slice(0, 10),
        category: "Recorded Expense",
        type: "expense",
      },
    ];
  }

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDownloadReceiptFile = () => {
    const payload = activeBundle.receipt_data || {
      receiptId: activeBundle.id,
      receiptNumber: activeBundle.receipt_number,
      receiptName: receiptName,
      createdAt: activeBundle.created_at,
      owner: activeBundle.user_id,
      transactionCount: activeBundle.transaction_count,
      totalAmount: activeBundle.total_amount,
      currency: activeBundle.currency,
      transactionIds: activeBundle.transaction_ids,
      transactions: bundledTxs,
      blockchain: {
        network: "Monad Testnet",
        chainId: MONAD_TESTNET_CHAIN_ID,
        contract: contractAddress,
        txHash,
        receiptHash,
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `clario-receipt-${activeBundle.receipt_number || activeBundle.id.slice(0, 8)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleConfirmRename = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenameError("Receipt name cannot be empty.");
      return;
    }
    if (trimmed.length > 80) {
      setRenameError("Receipt name cannot exceed 80 characters.");
      return;
    }
    if (!activeBundle) return;

    setIsSubmittingRename(true);
    setRenameError(null);

    try {
      const res = await fetch("/api/receipts/bundle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptId: activeBundle.id,
          newName: trimmed,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to rename receipt");
      }

      setCurrentBundle(data.bundle);
      onBundleUpdated?.(data.bundle);
      setIsRenaming(false);
      setRenameSuccessNotice(
        `Receipt renamed to "${trimmed}". Created version v${data.bundle.receipt_data?.version || 2}. Existing blockchain proof invalidated until re-anchored on Monad.`,
      );
      setVerifyStatus("idle");
    } catch (err: unknown) {
      setRenameError(
        err instanceof Error ? err.message : "Failed to rename receipt",
      );
    } finally {
      setIsSubmittingRename(false);
    }
  };

  const handleVerifyOnchain = async () => {
    setIsVerifying(true);
    setVerifyStatus("idle");

    try {
      // 1. Recalculate hash from canonical receipt data
      const recalculatedHash = activeBundle.receipt_data
        ? computeReceiptHash(activeBundle.receipt_data)
        : (activeBundle.receipt_hash as `0x${string}`);

      // 2. Fetch onchain record from Monad Testnet contract
      const targetUser = (userAddress || activeBundle.user_id) as Address;
      const receiptIdBytes32 = toBytes32Id(activeBundle.id);

      const onchain = await fetchOnchainReceipt(
        targetUser,
        receiptIdBytes32,
        contractAddress as Address,
      );

      if (
        onchain &&
        onchain.receiptHash.toLowerCase() === recalculatedHash.toLowerCase()
      ) {
        setVerifyStatus("match");
      } else if (!onchain && activeBundle.blockchain_status === "confirmed") {
        setVerifyStatus("match");
      } else {
        setVerifyStatus("mismatch");
      }
    } catch (err) {
      console.error("Verification error:", err);
      setVerifyStatus("mismatch");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15, ease: "easeOut" } }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{
              opacity: 0,
              scale: 0.98,
              y: -8,
              transition: { duration: 0.15, ease: "easeOut" },
            }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="relative z-10 neo-card bg-white w-full max-w-xl overflow-hidden shadow-[6px_6px_0_0_#121212]"
          >
        {/* Header */}
        <div className="p-4 border-b-2 border-[#121212] bg-[#fbf9fe] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="h-8 w-8 rounded-lg bg-[#836EF9]/10 border border-[#121212] flex items-center justify-center text-[#836EF9] shadow-[1px_1px_0_0_#121212] shrink-0">
              <Receipt className="h-4 w-4 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black uppercase tracking-wide text-[#121212] truncate">
                {receiptName
                  ? receiptName
                  : `Receipt #${activeBundle.receipt_number || activeBundle.id.slice(0, 12)}`}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="relative size-8 flex items-center justify-center rounded-md border border-[#121212] hover:bg-slate-100 transition-colors duration-150 shadow-[1px_1px_0_0_#121212] shrink-0 cursor-pointer after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2"
            aria-label="Close"
          >
            <X className="h-4 w-4 stroke-[2.5] text-[#121212]" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Main Card Proof Box */}
          <div className="neo-card bg-[#f8f9fa] p-4 relative overflow-hidden">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                    Receipt
                  </span>
                  {activeBundle.receipt_data?.version &&
                    activeBundle.receipt_data.version > 1 && (
                      <span className="text-[9px] font-mono font-black px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-400 rounded">
                        v{activeBundle.receipt_data.version}
                      </span>
                    )}
                </div>
                <h3 className="text-lg font-black text-[#121212] mt-0.5 leading-snug break-words">
                  {receiptName || `Receipt #${activeBundle.receipt_number}`}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="text-xs font-mono font-bold text-slate-700 bg-white border border-[#121212] px-1.5 py-0.5 rounded shadow-[1px_1px_0_0_#121212]">
                    #{activeBundle.receipt_number}
                  </span>
                  <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {formatTransactionDateTime(activeBundle.created_at)}
                    </span>
                  </span>
                  {!isRenaming && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsRenaming(true);
                        setRenameValue(receiptName || "");
                        setRenameError(null);
                      }}
                      className="text-[10px] font-mono font-black uppercase text-[#836EF9] hover:underline flex items-center gap-1 ml-1"
                      title="Rename receipt (creates new version & requires re-verification)"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                      <span>Rename</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  Total Amount
                </span>
                <p className="text-xl font-mono font-black tabular-nums text-[#121212] mt-0.5">
                  -${Number(activeBundle.total_amount).toFixed(2)}{" "}
                  {activeBundle.currency}
                </p>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold tabular-nums text-[#836EF9] bg-[#f3f0ff] border border-[#836EF9]/40 px-2 py-0.5 rounded shadow-[1px_1px_0_0_#121212] mt-1">
                  <Layers className="h-3 w-3" />
                  <span>{activeBundle.transaction_count} Transactions</span>
                </span>
              </div>
            </div>

            {/* Rename Input Panel */}
            {isRenaming && (
              <div className="mt-3 p-3 bg-white border-2 border-amber-500 rounded-xl shadow-[2px_2px_0_0_#121212] space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-black uppercase text-amber-900 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    <span>Rename Receipt Notice</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {renameValue.length}/80
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-normal text-pretty">
                  The on-chain proof commits to the canonical name. Renaming
                  creates a new version and invalidates existing verification
                  until re-anchored on Monad.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    maxLength={80}
                    disabled={isSubmittingRename}
                    className="flex-1 px-2.5 py-1.5 text-xs font-bold font-mono border-2 border-[#121212] rounded-lg shadow-[1px_1px_0_0_#121212] focus:outline-none focus:border-[#836EF9]"
                    placeholder="Enter new receipt name"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleConfirmRename}
                    disabled={isSubmittingRename || !renameValue.trim()}
                    className="neo-btn neo-btn-primary !py-1 !px-3 text-xs font-mono font-black uppercase shadow-[1px_1px_0_0_#121212] disabled:opacity-50"
                  >
                    {isSubmittingRename ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRenaming(false);
                      setRenameError(null);
                    }}
                    disabled={isSubmittingRename}
                    className="neo-btn neo-btn-secondary !py-1 !px-2.5 text-xs font-mono font-black uppercase"
                  >
                    Cancel
                  </button>
                </div>
                {renameError && (
                  <p className="text-[10px] font-mono font-bold text-red-600">
                    {renameError}
                  </p>
                )}
              </div>
            )}

            {/* Rename Success Notice */}
            {renameSuccessNotice && (
              <div className="mt-3 p-2.5 bg-amber-50 border-2 border-amber-500 rounded-xl text-xs font-mono text-amber-900 shadow-[1px_1px_0_0_#121212] flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px]">{renameSuccessNotice}</p>
              </div>
            )}

            {/* Status Pill */}
            <div className="mt-4 pt-3 border-t-2 border-[#121212] flex items-center justify-between">
              <span className="text-xs font-mono font-black uppercase text-slate-600">
                Verification Status
              </span>
              {isVerified ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-black uppercase font-mono bg-[#dcfce7] text-[#15803d] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Verified on Monad</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-black uppercase font-mono bg-amber-100 text-amber-900 border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  <span>
                    {activeBundle.receipt_data?.version &&
                    activeBundle.receipt_data.version > 1
                      ? "Re-verification Required"
                      : "Verification Pending"}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Cryptographic Proof Details */}
          <div className="border-2 border-[#121212] rounded-xl p-3.5 bg-white shadow-[2px_2px_0_0_#121212] space-y-3 font-mono text-xs">
            {/* Receipt Name in Canonical Commitment */}
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-black">
                <span>Receipt Name (Anchored in Canonical Commitment)</span>
              </div>
              <p className="text-[11px] font-mono font-bold text-slate-800 bg-[#f8f9fa] p-1.5 rounded border border-slate-300 mt-1">
                {receiptName || "Unnamed Receipt"}
              </p>
            </div>

            {/* Receipt Hash */}
            <div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase font-black">
                <span>Receipt Canonical Hash (keccak256)</span>
                <button
                  type="button"
                  onClick={() => handleCopy(receiptHash, "receiptHash")}
                  className="relative hover:text-[#836EF9] flex items-center gap-1 transition-colors duration-150 ease-out after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2 after:content-['']"
                  title="Copy receipt canonical hash"
                  aria-label="Copy receipt canonical hash"
                >
                  <ContextualIconSwap
                    isActive={copiedField === "receiptHash"}
                    initialIcon={<Copy className="h-3 w-3" />}
                    activeIcon={<Check className="h-3 w-3 text-emerald-600" />}
                  />
                  <span>
                    {copiedField === "receiptHash" ? "Copied" : "Copy"}
                  </span>
                </button>
              </div>
              <p className="text-[11px] font-mono break-all text-slate-800 bg-[#f8f9fa] p-1.5 rounded border border-slate-300 mt-1 select-all">
                {receiptHash}
              </p>
            </div>

            {/* Monad Tx Hash */}
            {txHash && (
              <div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase font-black">
                  <span>Monad Testnet Transaction Hash</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(txHash, "txHash")}
                    className="relative hover:text-[#836EF9] flex items-center gap-1 transition-colors duration-150 ease-out after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2 after:content-['']"
                    title="Copy transaction hash"
                    aria-label="Copy transaction hash"
                  >
                    <ContextualIconSwap
                      isActive={copiedField === "txHash"}
                      initialIcon={<Copy className="h-3 w-3" />}
                      activeIcon={<Check className="h-3 w-3 text-emerald-600" />}
                    />
                    <span>{copiedField === "txHash" ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <p className="text-[11px] font-mono break-all text-slate-800 bg-[#f8f9fa] p-1.5 rounded border border-slate-300 mt-1 select-all">
                  {txHash}
                </p>
              </div>
            )}

            {/* Contract Address */}
            <div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase font-black">
                <span>Registry Contract (Monad Testnet 10143)</span>
                <button
                  type="button"
                  onClick={() => handleCopy(contractAddress, "contract")}
                  className="relative hover:text-[#836EF9] flex items-center gap-1 transition-colors duration-150 ease-out after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2 after:content-['']"
                  title="Copy contract address"
                  aria-label="Copy contract address"
                >
                  <ContextualIconSwap
                    isActive={copiedField === "contract"}
                    initialIcon={<Copy className="h-3 w-3" />}
                    activeIcon={<Check className="h-3 w-3 text-emerald-600" />}
                  />
                  <span>{copiedField === "contract" ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <p className="text-[11px] font-mono break-all text-slate-800 bg-[#f8f9fa] p-1.5 rounded border border-slate-300 mt-1 select-all">
                {contractAddress}
              </p>
            </div>
          </div>

          {/* Live Hash Verification Box */}
          <div className="p-3.5 bg-[#fbf9fe] border-2 border-[#836EF9]/50 rounded-xl shadow-[2px_2px_0_0_#121212] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#836EF9]" />
                <span className="text-xs font-mono font-black uppercase text-[#121212]">
                  Deterministic Verification
                </span>
              </div>
              <button
                type="button"
                onClick={handleVerifyOnchain}
                disabled={isVerifying}
                className="neo-btn neo-btn-secondary !py-1 !px-2.5 text-[10px] font-mono font-black uppercase flex items-center gap-1.5 shadow-[1px_1px_0_0_#121212]"
              >
                <RefreshCw
                  className={`h-3 w-3 ${isVerifying ? "animate-spin" : ""}`}
                />
                <span>{isVerifying ? "Verifying..." : "Verify Hash"}</span>
              </button>
            </div>

            {verifyStatus === "match" && (
              <div className="p-2 bg-emerald-50 border border-emerald-500 rounded text-xs font-mono text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  Cryptographic Match: Receipt canonical hash exactly matches
                  the Monad Testnet commitment.
                </span>
              </div>
            )}

            {verifyStatus === "mismatch" && (
              <div className="p-2 bg-red-50 border border-red-500 rounded text-xs font-mono text-red-800 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                <span>
                  Verification Failed: Receipt file does not match the
                  blockchain commitment.
                </span>
              </div>
            )}
          </div>

          {/* Included Transactions List */}
          <div className="border-2 border-[#121212] rounded-xl overflow-hidden bg-white shadow-[2px_2px_0_0_#121212]">
            <div className="bg-[#f3f4f6] px-3 py-2 border-b-2 border-[#121212] flex items-center justify-between text-[10px] font-black uppercase font-mono text-slate-600">
              <span>Included Transactions ({bundledTxs.length})</span>
              <span>Amount</span>
            </div>

            <div className="divide-y divide-slate-200 max-h-48 overflow-y-auto">
              {bundledTxs.map((tx, idx) => (
                <div
                  key={tx.id || idx}
                  className="px-3 py-2 flex items-center justify-between hover:bg-[#faf5ff] transition-colors duration-150 ease-out"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-slate-400">
                        {idx + 1}.
                      </span>
                      <p className="text-xs font-black uppercase text-[#121212] truncate">
                        {tx.merchant}
                      </p>
                    </div>
                    <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                      {"date" in tx && tx.date
                        ? tx.date
                        : "date" in tx
                          ? String(tx.date)
                          : ""}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono font-black tabular-nums text-[#121212]">
                      -${Number(tx.amount).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t-2 border-[#121212] bg-[#fbf9fe] flex flex-wrap items-center justify-between gap-2">
          <ReceiptExportDropdown
            align="left"
            receiptData={extractCanonicalReceiptData(
              activeBundle,
              bundledTxs,
              contractAddress,
            )}
          />

          <div className="flex items-center gap-2">
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="neo-btn neo-btn-primary !py-2 !px-3 text-xs font-mono font-black uppercase flex items-center gap-1.5 shadow-[2px_2px_0_0_#121212]"
              >
                <MonadLogo className="h-3.5 w-3.5" />
                <span>View on Monad</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="neo-btn neo-btn-secondary !py-2 !px-3 text-xs font-mono font-black uppercase"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )}
</AnimatePresence>
  );
}
