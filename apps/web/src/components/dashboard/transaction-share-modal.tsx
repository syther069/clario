"use client";

import { useState } from "react";
import {
  X,
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
  Receipt,
  Link as LinkIcon,
  Layers,
} from "lucide-react";
import type { Transaction } from "@/lib/supabase/types";
import {
  getMonadExplorerTxUrl,
  getMonadExplorerAddressUrl,
  CLARIO_REGISTRY_ADDRESS,
  MONAD_TESTNET_CHAIN_ID,
} from "@/lib/blockchain/registry";
import { MonadLogo } from "@/components/ui/crypto-icon";
import { ReceiptExportDropdown } from "@/components/dashboard/receipt-export-dropdown";
import { extractTransactionReceiptData } from "@/lib/export/receipt-exporter";
import { motion, AnimatePresence } from "motion/react";

interface TransactionShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
}

export function TransactionShareModal({
  isOpen,
  onClose,
  transaction,
}: TransactionShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!transaction) return null;

  const txHash = transaction.blockchain_tx_hash || transaction.monad_tx_hash;
  const isVerified =
    Boolean(txHash) &&
    (transaction.verification_state === "verified" ||
      transaction.verification_status === "verified" ||
      transaction.blockchain_status === "confirmed");

  const dataHash =
    transaction.blockchain_data_hash || transaction.commitment_hash;
  const contractAddress =
    transaction.blockchain_contract_address || CLARIO_REGISTRY_ADDRESS;

  const explorerUrl = txHash ? getMonadExplorerTxUrl(txHash) : null;
  const contractUrl = contractAddress
    ? getMonadExplorerAddressUrl(contractAddress)
    : null;

  const shareableUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/receipts?txId=${transaction.id}`
      : `https://clario.app/receipts?txId=${transaction.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopySummary = () => {
    const lines = isVerified
      ? [
          `🏛️ CLARIO MONAD VERIFIED RECORD`,
          `--------------------------------`,
          `Merchant: ${transaction.merchant}`,
          `Amount: ${transaction.currency || "USD"} ${Number(transaction.amount).toFixed(2)}`,
          `Type: ${transaction.type.toUpperCase()}`,
          `Date: ${transaction.date || transaction.timestamp}`,
          `Network: Monad Testnet (Chain ID ${MONAD_TESTNET_CHAIN_ID})`,
          `Status: VERIFIED ON-CHAIN`,
          ...(txHash ? [`Monad Tx: ${txHash}`, `Explorer: ${explorerUrl}`] : []),
          ...(dataHash ? [`Data Commitment: ${dataHash}`] : []),
          `Contract: ${contractAddress}`,
          `Shareable Link: ${shareableUrl}`,
        ]
      : [
          `🧾 CLARIO TRANSACTION RECEIPT`,
          `--------------------------------`,
          `Merchant: ${transaction.merchant}`,
          `Amount: ${transaction.currency || "USD"} ${Number(transaction.amount).toFixed(2)}`,
          `Type: ${transaction.type.toUpperCase()}`,
          `Category: ${transaction.category || "General"}`,
          `Date: ${transaction.date || transaction.timestamp}`,
          `Payment: ${transaction.payment_method || "Recorded in Clario"}`,
          `Receipt ID: ${transaction.id}`,
          `Shareable Link: ${shareableUrl}`,
        ];

    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            onClick={onClose}
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
            <div
              className={`p-4 border-b-2 border-[#121212] flex items-center justify-between ${
                isVerified ? "bg-[#fbf9fe]" : "bg-[#f8f9fa]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`h-8 w-8 rounded-lg border-2 border-[#121212] flex items-center justify-center shadow-[1.5px_1.5px_0_0_#121212] ${
                    isVerified
                      ? "bg-[#836EF9] text-white"
                      : "bg-[#f3f0ff] text-[#836EF9]"
                  }`}
                >
                  {isVerified ? (
                    <MonadLogo className="h-4 w-4" />
                  ) : (
                    <Receipt className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wide text-[#121212]">
                    {isVerified
                      ? "Verified Receipt (Monad)"
                      : "Transaction Receipt"}
                  </h2>
                  <p className="text-[11px] font-mono text-slate-500">
                    {isVerified
                      ? "Cryptographic proof anchored on Monad Testnet"
                      : "Permanently stored in Clario Ledger"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-md border border-[#121212] hover:bg-slate-100 transition shadow-[1px_1px_0_0_#121212] cursor-pointer"
                aria-label="Close receipt"
              >
                <X className="h-4 w-4 text-[#121212]" />
              </button>
            </div>

            {/* Card Body */}
            <div className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              {/* Main Card Box */}
              <div className="neo-card bg-[#f8f9fa] p-4 relative overflow-hidden">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                      Merchant / Description
                    </p>
                    <h3 className="text-base font-black uppercase text-[#121212] mt-0.5">
                      {transaction.merchant}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      {transaction.date || transaction.timestamp}
                    </p>
                  </div>
                  <div className="text-right">
                    {isVerified ? (
                      <span className="neo-badge neo-badge-purple">
                        • VERIFIED ON MONAD
                      </span>
                    ) : (
                      <span className="neo-badge text-slate-700 bg-slate-100 border-[#121212]">
                        • RECORDED ENTRY
                      </span>
                    )}
                    <p className="text-lg font-black font-mono text-[#121212] mt-2">
                      {transaction.currency === "USD" || !transaction.currency
                        ? "$"
                        : `${transaction.currency} `}
                      {Number(transaction.amount).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Metadata Table */}
                <div className="mt-4 pt-3 border-t-2 border-[#121212] space-y-2 text-xs font-mono">
                  {isVerified ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 uppercase text-[10px] font-bold">
                          Network:
                        </span>
                        <span className="font-bold text-[#836EF9] flex items-center gap-1">
                          <MonadLogo className="h-3 w-3" />
                          Monad Testnet ({MONAD_TESTNET_CHAIN_ID})
                        </span>
                      </div>

                      {txHash && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-500 uppercase text-[10px] font-bold">
                            Transaction Hash:
                          </span>
                          <div className="flex items-center justify-between bg-white border border-[#121212] p-1.5 rounded shadow-[1px_1px_0_0_#121212]">
                            <span className="truncate text-[11px] text-[#121212]">
                              {txHash}
                            </span>
                            {explorerUrl && (
                              <a
                                href={explorerUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-2 text-[#836EF9] hover:underline shrink-0 flex items-center gap-0.5 text-[11px] font-bold"
                              >
                                <span>Explorer</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {dataHash && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-500 uppercase text-[10px] font-bold">
                            Data Commitment (Keccak256):
                          </span>
                          <div className="bg-white border border-[#121212] p-1.5 rounded shadow-[1px_1px_0_0_#121212]">
                            <span className="truncate block text-[11px] text-slate-700">
                              {dataHash}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 uppercase text-[10px] font-bold">
                          Registry Contract:
                        </span>
                        {contractUrl ? (
                          <a
                            href={contractUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-bold text-[#836EF9] hover:underline flex items-center gap-0.5"
                          >
                            <span>
                              {contractAddress.slice(0, 8)}...
                              {contractAddress.slice(-6)}
                            </span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ) : (
                          <span className="text-[11px] font-bold text-slate-800">
                            {contractAddress.slice(0, 8)}...
                            {contractAddress.slice(-6)}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 uppercase text-[10px] font-bold">
                          Type:
                        </span>
                        <span className="font-bold text-[#121212] uppercase">
                          {transaction.type}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 uppercase text-[10px] font-bold">
                          Category:
                        </span>
                        <span className="font-bold text-[#121212]">
                          {typeof transaction.category === "string"
                            ? transaction.category
                            : transaction.category_id || "General"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 uppercase text-[10px] font-bold">
                          Payment Method:
                        </span>
                        <span className="font-bold text-slate-800">
                          {transaction.payment_method || "Recorded Entry"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 uppercase text-[10px] font-bold">
                          Receipt ID:
                        </span>
                        <span className="text-slate-700 text-[11px]">
                          CR-{transaction.id.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 uppercase text-[10px] font-bold">
                          Storage Status:
                        </span>
                        <span className="text-emerald-700 font-bold text-[11px]">
                          Permanently Saved to Account
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Shareable Link Input & Copy Link Button */}
              <div className="p-3 bg-[#fbf9fe] border-2 border-[#121212] rounded-xl space-y-1.5 shadow-[2px_2px_0_0_#121212]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <LinkIcon className="h-3 w-3 text-[#836EF9]" />
                    Shareable Receipt Link
                  </span>
                  <span className="text-[9px] font-mono text-[#836EF9] font-bold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                    Permanent Link
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareableUrl}
                    className="w-full neo-input !py-1.5 !px-2.5 text-xs font-mono text-slate-700 flex-1 truncate bg-white select-all border-2 border-[#121212]"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="neo-btn neo-btn-secondary !py-1.5 !px-3 text-xs font-mono font-bold shrink-0 flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Privacy Notice (Only for Monad verified records) */}
              {isVerified && (
                <div className="p-3 bg-[#fbf9fe] border-2 border-[#836EF9]/30 rounded-xl flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-[#836EF9] shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    <strong className="text-[#121212]">
                      Zero Sensitive Data Leaked:
                    </strong>{" "}
                    Only the cryptographic hash of canonical transaction attributes is
                    anchored on Monad. Your receipt images and personal notes remain
                    securely private in Supabase.
                  </p>
                </div>
              )}

              {/* Action Buttons: Copy Summary & Download Dropdown */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="neo-btn neo-btn-secondary flex-1 flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Copied Summary!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>
                        {isVerified ? "Copy Proof Summary" : "Copy Summary"}
                      </span>
                    </>
                  )}
                </button>

                <div className="flex-1">
                  <ReceiptExportDropdown
                    receiptData={extractTransactionReceiptData(
                      transaction,
                      contractAddress,
                    )}
                    className="w-full"
                    align="right"
                  />
                </div>
              </div>

              {/* Monad Explorer link button if verified on chain */}
              {isVerified && explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="neo-btn neo-btn-primary w-full flex items-center justify-center gap-1.5 text-xs"
                >
                  <MonadLogo className="h-3.5 w-3.5" />
                  <span>Inspect on Monad Explorer</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
