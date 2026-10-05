"use client";

import { useState } from "react";
import {
  X,
  Check,
  Copy,
  Download,
  ExternalLink,
  ShieldCheck,
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

  if (!transaction) return null;

  const isVerified =
    transaction.verification_state === "verified" ||
    transaction.blockchain_status === "confirmed";

  const txHash = transaction.blockchain_tx_hash || transaction.monad_tx_hash;
  const dataHash =
    transaction.blockchain_data_hash || transaction.commitment_hash;
  const contractAddress =
    transaction.blockchain_contract_address || CLARIO_REGISTRY_ADDRESS;

  const explorerUrl = txHash ? getMonadExplorerTxUrl(txHash) : null;
  const contractUrl = contractAddress
    ? getMonadExplorerAddressUrl(contractAddress)
    : null;

  const handleCopySummary = () => {
    const lines = [
      `🏛️ CLARIO MONAD VERIFIED RECORD`,
      `--------------------------------`,
      `Merchant: ${transaction.merchant}`,
      `Amount: $${Number(transaction.amount).toFixed(2)} ${transaction.currency || "USD"}`,
      `Type: ${transaction.type.toUpperCase()}`,
      `Date: ${transaction.date || transaction.timestamp}`,
      `Network: Monad Testnet (Chain ID ${MONAD_TESTNET_CHAIN_ID})`,
      `Status: ${isVerified ? "VERIFIED ON-CHAIN" : "SAVED (PENDING ON-CHAIN)"}`,
      ...(txHash ? [`Monad Tx: ${txHash}`, `Explorer: ${explorerUrl}`] : []),
      ...(dataHash ? [`Data Commitment: ${dataHash}`] : []),
      `Contract: ${contractAddress}`,
    ];

    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadReceipt = () => {
    const receiptData = {
      protocol: "Clario Financial Intelligence",
      standard: "Monad Transaction Commitment v1",
      network: {
        name: "Monad Testnet",
        chainId: MONAD_TESTNET_CHAIN_ID,
        rpc: "https://testnet-rpc.monad.xyz",
      },
      contract: {
        name: "ClarioTransactionRegistry",
        address: contractAddress,
      },
      record: {
        id: transaction.id,
        merchant: transaction.merchant,
        amount: transaction.amount,
        currency: transaction.currency || "USD",
        type: transaction.type,
        category: transaction.category || transaction.category_id,
        timestamp: transaction.timestamp,
        date: transaction.date,
        version: transaction.version || 1,
      },
      cryptographicProof: {
        dataHash: dataHash || null,
        transactionHash: txHash || null,
        verifiedState: transaction.verification_state,
        blockchainStatus: transaction.blockchain_status || "unverified",
        explorerUrl: explorerUrl || null,
      },
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(receiptData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `clario-monad-proof-${transaction.id.slice(0, 8)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
        <div className="p-4 border-b-2 border-[#121212] bg-[#fbf9fe] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-[#836EF9]/10 border border-[#121212] flex items-center justify-center text-[#836EF9] shadow-[1px_1px_0_0_#121212]">
              <MonadLogo className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wide text-[#121212]">
                Monad Transaction Proof
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md border border-[#121212] hover:bg-slate-100 transition shadow-[1px_1px_0_0_#121212]"
          >
            <X className="h-4 w-4 text-[#121212]" />
          </button>
        </div>

        {/* Card Body */}
        <div className="p-5 space-y-4">
          {/* Main Card Proof Box */}
          <div className="neo-card bg-[#f8f9fa] p-4 relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  Transaction Merchant
                </p>
                <h3 className="text-base font-black uppercase text-[#121212] mt-0.5">
                  {transaction.merchant}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {transaction.date || transaction.timestamp}
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`neo-badge ${
                    isVerified ? "neo-badge-purple" : "neo-badge-yellow"
                  }`}
                >
                  {isVerified ? "• MONAD VERIFIED" : "• UNVERIFIED"}
                </span>
                <p className="text-lg font-black font-mono text-[#121212] mt-2">
                  ${Number(transaction.amount).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Proof Metadata Table */}
            <div className="mt-4 pt-3 border-t-2 border-[#121212] space-y-2 text-xs font-mono">
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
                        <span>View</span>
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
                    {contractAddress.slice(0, 8)}...{contractAddress.slice(-6)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Privacy Seal Notice */}
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

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              onClick={handleCopySummary}
              className="neo-btn neo-btn-secondary flex-1 flex items-center justify-center gap-1.5 text-xs"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Copied Summary!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Proof Summary</span>
                </>
              )}
            </button>

            <ReceiptExportDropdown
              receiptData={extractTransactionReceiptData(
                transaction,
                contractAddress,
              )}
            />
          </div>

          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="neo-btn neo-btn-primary w-full flex items-center justify-center gap-1.5 text-xs"
            >
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
