"use client";

import { useState } from "react";
import {
  X,
  Receipt,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import type { Transaction, ReceiptBundle } from "@/lib/supabase/types";
import { MonadLogo } from "@/components/ui/crypto-icon";
import { formatTransactionDateTime } from "@/lib/import/types";
import {
  executeSaveReceiptBundle,
  generateReceiptNumber,
  type ReceiptBundleStep,
} from "@/lib/blockchain/save-receipt-bundle";
import type { ConnectedWallet } from "@privy-io/react-auth";
import { ClarioButton, ClarioBadge } from "@/components/ui/clario-ui";
import { motion, AnimatePresence } from "motion/react";

interface ReceiptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  userId: string;
  userAddress?: string | null | undefined;
  connectedWallet?: ConnectedWallet | null | undefined;
  onReceiptCreated?: (bundle: ReceiptBundle) => void;
  currencySymbol?: string;
  existingBundles?: ReceiptBundle[];
}

export function ReceiptPreviewModal({
  isOpen,
  onClose,
  transactions,
  userId,
  userAddress,
  connectedWallet,
  onReceiptCreated,
  currencySymbol = "$",
  existingBundles = [],
}: ReceiptPreviewModalProps) {
  const [receiptNumber] = useState(() => generateReceiptNumber());
  const [receiptName, setReceiptName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<ReceiptBundleStep>("idle");
  const [stepLabel, setStepLabel] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trimmedName = receiptName.trim();
  const isNameValid = trimmedName.length > 0 && trimmedName.length <= 80;

  const totalAmount = transactions.reduce(
    (sum, t) => sum + Number(t.amount || 0),
    0,
  );

  // Check for duplicate transactions (transactions already part of an existing verified bundle)
  const alreadyBundledTxs = transactions.filter((t) => {
    if (t.receipt_bundle_id) return true;
    return existingBundles.some(
      (b) =>
        b.verification_status === "verified" &&
        Array.isArray(b.transaction_ids) &&
        b.transaction_ids.includes(t.id),
    );
  });

  const hasDuplicateWarning = alreadyBundledTxs.length > 0;

  const handleConfirmCreate = async () => {
    setNameTouched(true);
    if (!isNameValid || isSubmitting || transactions.length === 0) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setCurrentStep("preparing");
    setStepLabel("Preparing receipt...");

    try {
      const result = await executeSaveReceiptBundle({
        transactions,
        userId,
        receiptName: trimmedName,
        userAddress,
        connectedWallet,
        customReceiptNumber: receiptNumber,
        onStepChange: (step, label) => {
          setCurrentStep(step);
          setStepLabel(label);
        },
      });

      if (result.isBlockchainVerified) {
        onReceiptCreated?.(result.receiptBundle);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else if (result.error) {
        setErrorMessage(result.error);
        setIsSubmitting(false);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to create receipt bundle on Monad.";
      setErrorMessage(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={!isSubmitting ? onClose : undefined}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="relative z-10 neo-card bg-white w-full max-w-lg overflow-hidden shadow-[6px_6px_0_0_#121212]"
          >
        {/* Header */}
        <div className="p-4 border-b-2 border-[#121212] bg-[#fbf9fe] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#836EF9]/10 border border-[#121212] flex items-center justify-center text-[#836EF9] shadow-[1px_1px_0_0_#121212]">
              <Receipt className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wide text-[#121212] text-balance">
                Create Receipt
              </h2>
            </div>
          </div>
          {!isSubmitting && (
            <button
              type="button"
              onClick={onClose}
              className="relative size-8 flex items-center justify-center rounded-md border border-[#121212] hover:bg-slate-100 transition-colors duration-150 shadow-[1px_1px_0_0_#121212] cursor-pointer after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-[#121212]" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* 1. Name Your Receipt Section */}
          <div className="bg-[#fbf9fe] border-2 border-[#121212] p-4 rounded-xl shadow-[3px_3px_0_0_#121212] space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="receipt-name-input"
                className="text-xs font-mono font-black uppercase text-[#121212] flex items-center gap-1.5"
              >
                <span>Name your receipt</span>
                <span className="text-red-500">*</span>
              </label>
              <span
                className={`text-[10px] font-mono font-bold ${
                  receiptName.length > 80 ? "text-red-600" : "text-slate-400"
                }`}
              >
                {receiptName.length}/80
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-normal text-pretty">
              Give this receipt a recognizable name so you can find it later.
            </p>
            <div className="relative">
              <input
                id="receipt-name-input"
                type="text"
                value={receiptName}
                onChange={(e) => {
                  setReceiptName(e.target.value);
                  if (!nameTouched) setNameTouched(true);
                }}
                placeholder="e.g. September Crypto Expenses"
                maxLength={80}
                disabled={isSubmitting}
                className={`w-full px-3.5 py-2.5 bg-white border-2 rounded-xl text-sm font-bold text-[#121212] placeholder-slate-400 shadow-[2px_2px_0_0_#121212] focus:outline-none transition-colors duration-150 ease-out ${
                  nameTouched && !trimmedName
                    ? "border-red-500 focus:border-red-600"
                    : "border-[#121212] focus:border-[#836EF9]"
                }`}
                autoFocus
              />
            </div>
            {nameTouched && !trimmedName && (
              <p className="text-[10px] font-mono font-bold text-red-600">
                Receipt name cannot be empty.
              </p>
            )}
          </div>

          {/* 2. Receipt Reference & Summary Pill */}
          <div className="flex items-center justify-between bg-[#f8f9fa] border-2 border-[#121212] p-3 rounded-xl shadow-[2px_2px_0_0_#121212]">
            <div>
              <span className="text-[9px] font-mono font-black uppercase text-slate-500">
                Receipt Number
              </span>
              <p className="font-mono text-sm font-black text-[#121212] tabular-nums">
                #{receiptNumber}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-mono font-black uppercase text-slate-500">
                Summary
              </span>
              <p className="font-mono text-sm font-black text-[#121212] flex items-center gap-1 justify-end tabular-nums">
                <span>{transactions.length} transactions</span>
                <span className="text-slate-400">·</span>
                <span className="text-[#836EF9] tabular-nums">
                  Total -{currencySymbol}
                  {totalAmount.toFixed(2)}
                </span>
              </p>
            </div>
          </div>

          {/* Duplicate Warning if applicable */}
          {hasDuplicateWarning && (
            <div className="p-3 bg-amber-50 border-2 border-amber-500 rounded-xl text-xs font-mono text-amber-900 shadow-[2px_2px_0_0_#121212] flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold uppercase tracking-wide">
                  Duplicate Receipt Notice
                </p>
                <p className="text-[11px] text-amber-800 mt-0.5 text-pretty">
                  {alreadyBundledTxs.length} of the selected transaction(s) are
                  already part of another receipt. Creating this bundle will
                  anchor a new snapshot commitment on Monad Testnet.
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border-2 border-red-500 rounded-xl text-xs font-mono text-red-900 shadow-[2px_2px_0_0_#121212] flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold uppercase tracking-wide">
                  Commitment Failed
                </p>
                <p className="text-[11px] text-red-800 mt-0.5">
                  {errorMessage}
                </p>
              </div>
            </div>
          )}

          {/* Transaction List Preview */}
          <div className="border-2 border-[#121212] rounded-xl overflow-hidden bg-white shadow-[2px_2px_0_0_#121212]">
            <div className="bg-[#f3f4f6] px-3 py-2 border-b-2 border-[#121212] flex items-center justify-between text-[10px] font-black uppercase font-mono text-slate-600">
              <span>Selected Transactions ({transactions.length})</span>
              <span>Amount</span>
            </div>

            <div className="divide-y divide-slate-200 max-h-44 overflow-y-auto">
              {transactions.map((tx, idx) => (
                <div
                  key={tx.id}
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
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" />
                        {tx.date || formatTransactionDateTime(tx.timestamp)}
                      </span>
                      <span>•</span>
                      <span className="uppercase">{tx.type}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono font-black text-[#121212] tabular-nums">
                      {tx.type === "income" ? "+" : "-"}
                      {currencySymbol}
                      {Number(tx.amount).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Footer */}
            <div className="bg-[#f8f9fa] border-t-2 border-[#121212] px-3 py-2.5 flex items-center justify-between">
              <span className="text-[10px] font-mono font-black uppercase text-slate-500">
                Total
              </span>
              <p className="text-sm font-mono font-black text-[#121212] tabular-nums">
                -{currencySymbol}
                {totalAmount.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>

          {/* Stepper Status when submitting */}
          {isSubmitting && (
            <div className="p-3.5 bg-white border-2 border-[#121212] rounded-xl shadow-[3px_3px_0_0_#121212] space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2.5">
                {currentStep === "verified" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                ) : (
                  <Loader2 className="h-5 w-5 text-[#836EF9] animate-spin shrink-0" />
                )}
                <div>
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-500">
                    Progress
                  </span>
                  <p className="text-xs font-mono font-black text-[#121212]">
                    {stepLabel}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t-2 border-[#121212] bg-[#fbf9fe] flex items-center justify-end gap-3">
          <ClarioButton
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </ClarioButton>

          <ClarioButton
            type="button"
            variant="primary"
            onClick={handleConfirmCreate}
            disabled={isSubmitting || !isNameValid || transactions.length === 0}
            loading={isSubmitting}
            icon={!isSubmitting ? <MonadLogo className="h-4 w-4" /> : undefined}
          >
            Create & Save Receipt
          </ClarioButton>
        </div>
      </motion.div>
    </div>
  )}
</AnimatePresence>
  );
}
