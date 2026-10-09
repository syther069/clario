"use client";

import { useState } from "react";
import {
  PlusCircle,
  X,
  Wallet,
  FileText,
  ArrowLeft,
  Camera,
  ScanText,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  ShieldCheck,
  Check,
  Loader2,
  Receipt,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import type { Transaction } from "@/lib/supabase/types";
import { TransactionImportDialog } from "@/components/transaction-import-dialog";
import type { NormalizedTransaction } from "@/lib/import/types";
import { useClarioAuth } from "@/lib/auth/use-clario-auth";
import {
  MonadLogo,
  EthereumLogo,
  BaseLogo,
  UsdcLogo,
  UsdtLogo,
  AlchemyLogo,
  detectCryptoIdentity,
  CryptoChainIcon,
  CryptoCoinIcon,
} from "@/components/ui/crypto-icon";
import { ClarioButton, ClarioBadge } from "@/components/ui/clario-ui";
import { WatermelonButton } from "@/components/ui/watermelon-button";
import { motion, AnimatePresence } from "motion/react";
import { NeoSelect } from "@/components/ui/neo-select";
import { NeoDatePicker } from "@/components/ui/neo-date-picker";
import { executeSaveTransaction } from "@/lib/blockchain/save-transaction";
import { getMonadExplorerTxUrl } from "@/lib/blockchain/registry";
import { TransactionShareModal } from "./transaction-share-modal";

export type SubLedgerMode = "fiat" | "onchain";

function formatCategoryLabel(category?: unknown): string {
  if (!category) return "General";
  if (typeof category === "string") {
    return category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (typeof category === "object" && category !== null && "name" in category) {
    return String((category as { name: string }).name);
  }
  return "General";
}

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tx: Partial<Transaction>) => void;
  onScanReceipt?: () => void;
  onViewReceipt?: ((tx: Transaction) => void) | undefined;
  userId?: string | undefined;
  userAddress?: string | undefined;
  workspaceId?: string | undefined;
  hasConnectedWallet?: boolean | undefined;
  onConnectWallet?: (() => void) | undefined;
  initialSubLedger?: SubLedgerMode | undefined;
}

const SUPPORTED_CURRENCIES = [
  { code: "USD", symbol: "$", label: "USD ($)" },
  { code: "INR", symbol: "₹", label: "INR (₹)" },
  { code: "EUR", symbol: "€", label: "EUR (€)" },
  { code: "GBP", symbol: "£", label: "GBP (£)" },
];

export function TransactionModal({
  isOpen,
  onClose,
  onSave,
  onScanReceipt,
  onViewReceipt,
  userId = "user_default",
  userAddress,
  workspaceId = "00000000-0000-0000-0000-000000000001",
  hasConnectedWallet,
  onConnectWallet,
  initialSubLedger = "fiat",
}: TransactionModalProps) {
  const auth = useClarioAuth();
  const effectiveConnectedAddress =
    userAddress || auth.connectedEvmAddress || undefined;
  const isWalletConnected = hasConnectedWallet ?? auth.hasConnectedEvmWallet;
  const handleConnectWallet = onConnectWallet || auth.connectEvmWallet;

  const [subLedger, setSubLedger] = useState<SubLedgerMode>(initialSubLedger);
  const [view, setView] = useState<"selection" | "manual" | "saved_action">("selection");
  const [savedTransaction, setSavedTransaction] = useState<Transaction | null>(null);
  const [isOnChainSaving, setIsOnChainSaving] = useState(false);
  const [onChainStepLabel, setOnChainStepLabel] = useState("");
  const [onChainError, setOnChainError] = useState<string | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const [isNoWalletPopupOpen, setIsNoWalletPopupOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("food_dining");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]!);
  const [paymentMethod, setPaymentMethod] = useState("Credit Card");
  const [anchorToMonad, setAnchorToMonad] = useState(false);

  // Sync subledger and view on fresh open
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      const mode = initialSubLedger || "fiat";
      setSubLedger(mode);
      setView("selection");
      setSavedTransaction(null);
      setIsOnChainSaving(false);
      setOnChainStepLabel("");
      setOnChainError(null);
      setIsReceiptModalOpen(false);
      setIsNoWalletPopupOpen(false);
      setIsImportOpen(false);
      if (mode === "fiat") {
        setPaymentMethod("Credit Card");
        setCategory("food_dining");
      } else {
        setPaymentMethod("Onchain (Monad)");
        setCategory("crypto_ops");
      }
    }
  }

  if (!isOpen) return null;

  const currentCurrencySymbol =
    SUPPORTED_CURRENCIES.find((c) => c.code === currency)?.symbol || "$";

  const handleFetchViaAlchemy = () => {
    if (
      isWalletConnected &&
      effectiveConnectedAddress &&
      /^0x[a-fA-F0-9]{40}$/.test(effectiveConnectedAddress)
    ) {
      setIsImportOpen(true);
    } else {
      setIsNoWalletPopupOpen(true);
    }
  };

  async function handleSaveOnChain() {
    if (!savedTransaction) return;
    if (!isWalletConnected || !effectiveConnectedAddress) {
      handleConnectWallet();
      return;
    }

    setIsOnChainSaving(true);
    setOnChainError(null);
    setOnChainStepLabel("Preparing Monad Testnet anchor...");

    try {
      const userWallet =
        auth.wallets.find(
          (w) =>
            w.address.toLowerCase() ===
            (effectiveConnectedAddress || "").toLowerCase(),
        ) || auth.wallets[0] || null;

      const res = await executeSaveTransaction({
        transactionData: savedTransaction,
        userId,
        userAddress: effectiveConnectedAddress,
        connectedWallet: userWallet,
        onStepChange: (_step, label) => setOnChainStepLabel(label),
      });

      if (res.success && res.transaction) {
        setSavedTransaction(res.transaction);
        onSave(res.transaction);
      } else if (res.error) {
        setOnChainError(res.error);
      }
    } catch (err: unknown) {
      console.error("Save on chain error:", err);
      setOnChainError(err instanceof Error ? err.message : "Failed to record on Monad Testnet");
    } finally {
      setIsOnChainSaving(false);
    }
  }

  function handleCreateReceipt() {
    if (!savedTransaction) return;
    if (onViewReceipt) {
      onViewReceipt(savedTransaction);
      onClose();
    } else {
      setIsReceiptModalOpen(true);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !description) return;
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) return;

    const isCrypto = subLedger === "onchain";
    const transactionId = crypto.randomUUID();

    const newTx: Transaction = {
      id: transactionId,
      user_id: userId,
      type,
      amount: numericAmount,
      currency: isCrypto ? "USD" : currency,
      merchant: description.trim(),
      description: description.trim(),
      category,
      category_id: category,
      date,
      timestamp: new Date(date).toISOString(),
      payment_method: paymentMethod?.trim() || (isCrypto ? "Onchain (Monad)" : "Credit Card"),
      verification_state: anchorToMonad || isCrypto ? "anchored_onchain" : "unverified",
      verification_status: anchorToMonad || isCrypto ? "anchored" : "unverified",
      blockchain_status: anchorToMonad || isCrypto ? "unverified" : null,
      blockchain_network: anchorToMonad || isCrypto ? "Monad Testnet" : null,
      blockchain_chain_id: anchorToMonad || isCrypto ? 10143 : null,
      source: isCrypto ? "onchain_monad" : "manual",
      version: 1,
      status: "cleared",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Immediately save to Clario (normal saving is permanently preserved)
    onSave(newTx);
    setSavedTransaction(newTx);

    // 2. Clear inputs and transition to post-save options
    setAmount("");
    setDescription("");
    setView("saved_action");
  }

  // Transaction Import Dialog View (Full Screen Modal)
  if (isImportOpen) {
    return (
      <TransactionImportDialog
        isOpen={isImportOpen}
        workspaceId={workspaceId}
        userAddress={effectiveConnectedAddress}
        onClose={() => setIsImportOpen(false)}
        onConnectWallet={handleConnectWallet}
        onSelectTransaction={(tx: NormalizedTransaction) => {
          const displayAmount =
            tx.usdValue !== null && tx.usdValue !== undefined
              ? tx.usdValue.toFixed(2)
              : tx.formattedAmount;
          setAmount(displayAmount);
          setDescription(
            `${tx.assetSymbol} Transfer (${tx.sourceTransactionHash.slice(0, 8)}...${tx.sourceTransactionHash.slice(-6)})`,
          );
          setCategory("crypto_ops");
          const chainName =
            tx.sourceChainId === 10143
              ? "Monad Testnet"
              : tx.sourceChainId === 143
                ? "Monad"
                : tx.sourceChainId === 8453
                  ? "Base"
                  : tx.sourceChainId === 999
                    ? "Hyperliquid"
                    : tx.sourceChainId === 42161
                      ? "Arbitrum"
                      : "Ethereum";
          setPaymentMethod(`Onchain (${chainName} - ${tx.assetSymbol})`);
          if (tx.blockTimestamp) {
            setDate(new Date(tx.blockTimestamp).toISOString().split("T")[0]!);
          }
          setIsImportOpen(false);
          setSubLedger("onchain");
          setView("manual");
        }}
      />
    );
  }

  // Connect EVM Wallet Guard Popup Modal
  if (isNoWalletPopupOpen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          onClick={() => setIsNoWalletPopupOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />
        <div className="relative z-10 w-full max-w-sm rounded-2xl border-2 border-[#121212] bg-white p-6 shadow-[6px_6px_0_0_#121212] text-[#121212] animate-in fade-in zoom-in-95">
          <div className="flex items-start justify-between pb-3 border-b-2 border-[#121212]">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f3f0ff] text-[#836EF9] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-[#121212]">
                  EVM Wallet Needed
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsNoWalletPopupOpen(false)}
              className="relative size-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-[#f3f4f6] hover:text-[#121212] border border-transparent hover:border-[#121212] transition-colors duration-150 cursor-pointer after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-sm font-bold text-[#121212]">
              Connect your EVM wallet to fetch blockchain transactions.
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              To search and index transactions via Alchemy, connect an external EVM wallet (e.g. MetaMask, Phantom, Coinbase Wallet), or record your entry manually.
            </p>
          </div>

          <div className="mt-6 space-y-2.5">
            <ClarioButton
              variant="primary"
              className="w-full justify-center !py-3"
              icon={<Wallet className="h-4 w-4" />}
              onClick={() => {
                setIsNoWalletPopupOpen(false);
                handleConnectWallet();
              }}
            >
              CONNECT EVM WALLET
            </ClarioButton>

            <ClarioButton
              variant="outline"
              className="w-full justify-center !py-3"
              icon={<FileText className="h-4 w-4" />}
              onClick={() => {
                setIsNoWalletPopupOpen(false);
                setSubLedger("onchain");
                setView("manual");
              }}
            >
              RECORD TRANSACTION MANUALLY
            </ClarioButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className="relative z-10 w-full max-w-lg rounded-2xl border-2 border-[#121212] bg-white p-6 shadow-[6px_6px_0_0_#121212] text-[#121212] max-h-[92vh] overflow-y-auto"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 border-b-2 border-[#121212]">
          <div className="flex items-center gap-2.5">
            {view === "manual" && (
              <ClarioButton
                type="button"
                variant="secondary"
                size="sm"
                icon={<ArrowLeft className="h-3.5 w-3.5" />}
                onClick={() => setView("selection")}
                title="Return to selection screen"
              >
                Back
              </ClarioButton>
            )}
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] ${
                view === "saved_action"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-[#f3f0ff] text-[#836EF9]"
              }`}
            >
              {view === "saved_action" ? (
                <Check className="h-5 w-5 stroke-[2.5]" />
              ) : (
                <PlusCircle className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-wider text-[#121212]">
                {view === "saved_action"
                  ? "Entry Recorded"
                  : "Record Transaction"}
              </h3>
              <p className="text-[11px] text-slate-500">
                {view === "saved_action"
                  ? "Permanently saved to your Clario account"
                  : view === "selection"
                    ? "Choose how you want to add an entry"
                    : subLedger === "fiat"
                      ? "Personal Finance Ledger Entry"
                      : "Web3 On-Chain Activity Entry"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="relative size-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-[#f3f4f6] hover:text-[#121212] border border-transparent hover:border-[#121212] transition-colors duration-150 cursor-pointer after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Top-Level Rail Switcher (Personal Finance vs On-Chain) - only for entry creation */}
        {view !== "saved_action" && (
          <div className="mt-4 p-1.5 bg-[#f3f4f6] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] rounded-xl flex items-center gap-2">
            <motion.button
            type="button"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setSubLedger("fiat");
              setPaymentMethod("Credit Card");
              setCategory("food_dining");
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              subLedger === "fiat"
                ? "bg-[#836EF9] text-white border-2 border-[#121212] shadow-[2.5px_2.5px_0_0_#121212]"
                : "bg-white text-slate-700 border-2 border-transparent hover:border-[#121212] hover:bg-[#fafafa]"
            }`}
          >
            <CreditCard className={`h-3.5 w-3.5 ${subLedger === "fiat" ? "text-white" : "text-[#836EF9]"}`} />
            <span>Personal Finance</span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                subLedger === "fiat"
                  ? "bg-white/20 text-white border-white/40"
                  : "bg-emerald-100 text-emerald-800 border-emerald-300"
              }`}
            >
              Fiat
            </span>
          </motion.button>

          <motion.button
            type="button"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setSubLedger("onchain");
              setPaymentMethod("Onchain (Monad)");
              setCategory("crypto_ops");
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              subLedger === "onchain"
                ? "bg-[#836EF9] text-white border-2 border-[#121212] shadow-[2.5px_2.5px_0_0_#121212]"
                : "bg-white text-slate-700 border-2 border-transparent hover:border-[#121212] hover:bg-[#fafafa]"
            }`}
          >
            <MonadLogo className="h-3.5 w-3.5" />
            <span>On-Chain</span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                subLedger === "onchain"
                  ? "bg-white/20 text-white border-white/40"
                  : "bg-purple-100 text-[#836EF9] border-purple-300"
              }`}
            >
              Web3
            </span>
          </motion.button>
        </div>
        )}

        {/* VIEW 1: SELECTION SCREEN */}
        {view === "selection" ? (
          <div className="mt-5 space-y-3">
            {subLedger === "fiat" ? (
              <>
                {/* Fiat Option 1: Scan Receipt / Bill (Gemini OCR) */}
                {onScanReceipt && (
                  <motion.button
                    type="button"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99, x: 1, y: 1 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => {
                      onClose();
                      onScanReceipt();
                    }}
                    className="w-full text-left p-4 rounded-xl border-2 border-[#121212] bg-[#fbf9fe] hover:bg-[#f3edff] shadow-[3px_3px_0_0_#121212] transition-colors group flex flex-col justify-between cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-black uppercase text-[#836EF9] bg-[#f3f0ff] px-2.5 py-0.5 rounded-md border border-[#836EF9]/40 shadow-[1px_1px_0_0_#836EF9]">
                        <ScanText className="h-3 w-3" />
                        Multimodal Receipt Scan
                      </span>
                      <span className="text-[10px] font-mono font-black uppercase text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-300 shadow-[1px_1px_0_0_#121212]">
                        Local Device
                      </span>
                    </div>
                    <h4 className="text-sm font-black uppercase tracking-wider text-[#121212] group-hover:text-[#836EF9] transition-colors flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Camera className="h-4 w-4 text-[#836EF9]" />
                        Scan Bill / Invoice / Receipt
                      </span>
                      <span className="text-sm font-mono font-black">→</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Upload grocery, dining, or shopping receipts. Multimodal Gemini extracts merchant, total amount & currency.
                    </p>
                  </motion.button>
                )}

                {/* Fiat Option 2: Record Manual Expense / Income */}
                <motion.button
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99, x: 1, y: 1 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => setView("manual")}
                  className="w-full text-left p-4 rounded-xl border-2 border-[#121212] bg-white hover:bg-[#fafafa] shadow-[3px_3px_0_0_#121212] transition-colors group flex flex-col justify-between cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono font-black uppercase text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md border border-[#121212] shadow-[1px_1px_0_0_#121212]">
                      Personal Ledger Entry
                    </span>
                    <span className="text-[10px] font-mono font-black uppercase text-slate-500">
                      Cash • UPI • Cards
                    </span>
                  </div>
                  <h4 className="text-sm font-black uppercase tracking-wider text-[#121212] group-hover:text-black transition-colors flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-600" />
                      Add Personal Expense Manually
                    </span>
                    <span className="text-sm font-mono font-black">→</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Log daily spending, rent, coffee, or subscription with multi-currency ($, ₹, €, £) and payment method tagging.
                  </p>
                </motion.button>
              </>
            ) : (
              <>
                {/* On-Chain Option 1: Fetch via Alchemy API */}
                <motion.button
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99, x: 1, y: 1 }}
                  transition={{ duration: 0.15 }}
                  onClick={handleFetchViaAlchemy}
                  className="w-full text-left p-4 rounded-xl border-2 border-[#121212] bg-white hover:bg-[#f5efff] shadow-[3px_3px_0_0_#121212] transition-colors group flex flex-col justify-between cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-black uppercase text-[#0052FF] bg-[#f0f4ff] px-2.5 py-0.5 rounded-md border border-[#0052FF]/30 shadow-[1px_1px_0_0_#0052FF]">
                      <AlchemyLogo className="h-3.5 w-3.5" />
                      Alchemy Multi-Chain
                    </span>
                    <span className="text-[10px] font-mono font-black uppercase text-[#836EF9] bg-[#f3f0ff] px-2.5 py-0.5 rounded-md border border-[#836EF9]/30 shadow-[1px_1px_0_0_#121212]">
                      Monad • Base • ETH
                    </span>
                  </div>
                  <h4 className="text-sm font-black uppercase tracking-wider text-[#121212] group-hover:text-[#836EF9] transition-colors flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span>Fetch Transfers from Wallet</span>
                    </span>
                    <span className="text-sm font-mono font-black">→</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Auto-scan connected EVM address for recent transfers across Monad, Base, Ethereum & Arbitrum.
                  </p>
                </motion.button>

                {/* On-Chain Option 2: Record TX Hash Manually */}
                <motion.button
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99, x: 1, y: 1 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => setView("manual")}
                  className="w-full text-left p-4 rounded-xl border-2 border-[#121212] bg-white hover:bg-[#fafafa] shadow-[3px_3px_0_0_#121212] transition-colors group flex flex-col justify-between cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono font-black uppercase text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-md border border-purple-200 shadow-[1px_1px_0_0_#121212]">
                      Manual On-Chain Record
                    </span>
                    <span className="text-[10px] font-mono font-black uppercase text-slate-500">
                      Hash • Contract • Gas
                    </span>
                  </div>
                  <h4 className="text-sm font-black uppercase tracking-wider text-[#121212] group-hover:text-black transition-colors flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#836EF9]" />
                      <span>Add On-Chain TX Manually</span>
                    </span>
                    <span className="text-sm font-mono font-black">→</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Manually paste transaction hash, token amount, and gas spent for tracking protocol interactions.
                  </p>
                </motion.button>
              </>
            )}

            <div className="mt-6 pt-3 border-t-2 border-[#121212] flex items-center justify-end">
              <WatermelonButton
                type="button"
                variant="secondary"
                size="sm"
                textMorph
                onClick={onClose}
              >
                Cancel
              </WatermelonButton>
            </div>
          </div>
        ) : (
          /* VIEW 2: MANUAL TRANSACTION FORM */
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Inflow / Outflow Toggle */}
            <div className="flex gap-2 p-1.5 bg-[#f3f4f6] rounded-xl border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
              <motion.button
                type="button"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setType("expense")}
                className={`flex-1 rounded-lg py-2.5 text-xs font-mono font-black uppercase tracking-wider transition-all cursor-pointer ${
                  type === "expense"
                    ? "bg-[#fee2e2] text-[#b91c1c] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]"
                    : "text-slate-600 hover:text-[#121212] border-2 border-transparent hover:border-[#121212]/30"
                }`}
              >
                Expense (Outflow)
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setType("income")}
                className={`flex-1 rounded-lg py-2.5 text-xs font-mono font-black uppercase tracking-wider transition-all cursor-pointer ${
                  type === "income"
                    ? "bg-[#dcfce7] text-[#15803d] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]"
                    : "text-slate-600 hover:text-[#121212] border-2 border-transparent hover:border-[#121212]/30"
                }`}
              >
                Income (Inflow)
              </motion.button>
            </div>

            {/* Currency & Amount */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {subLedger === "fiat" && (
                <div className="sm:col-span-5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-600 block mb-1">
                    Currency
                  </label>
                  <NeoSelect
                    value={currency}
                    onChange={setCurrency}
                    options={SUPPORTED_CURRENCIES.map((c) => ({
                      value: c.code,
                      label: c.label,
                    }))}
                  />
                </div>
              )}

              <div className={subLedger === "fiat" ? "sm:col-span-7" : "sm:col-span-12"}>
                <label className="text-xs font-black uppercase tracking-wider text-slate-600 block mb-1">
                  Amount ({subLedger === "fiat" ? currentCurrencySymbol : "$ USD"})
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-600 text-xs font-mono font-bold pointer-events-none">
                    {subLedger === "fiat" ? currentCurrencySymbol : "$"}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full neo-input !pl-8 font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Description / Merchant */}
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-slate-600 block mb-1">
                {subLedger === "fiat" ? "Merchant / Description" : "Asset / Transfer Description"}
              </label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  subLedger === "fiat"
                    ? "e.g. Blue Tokai Coffee, Whole Foods, Monthly Rent"
                    : "e.g. Monad Validator Deployment, 250 USDC Transfer"
                }
                className="w-full neo-input"
              />
            </div>

            {/* Category & Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-600 block mb-1">
                  Category
                </label>
                <NeoSelect
                  value={category}
                  onChange={setCategory}
                  options={
                    subLedger === "fiat"
                      ? [
                          { value: "food_dining", label: "Food & Dining" },
                          { value: "housing", label: "Housing & Rent" },
                          { value: "transportation", label: "Transportation" },
                          { value: "shopping", label: "Shopping & Retail" },
                          { value: "utilities", label: "Utilities & Bills" },
                          { value: "software_tools", label: "Subscriptions" },
                          { value: "health", label: "Health & Medical" },
                          { value: "other", label: "Other" },
                        ]
                      : [
                          { value: "crypto_ops", label: "Crypto Operations" },
                          { value: "defi", label: "DeFi / Swap" },
                          { value: "gas_fees", label: "Gas & Protocol Fees" },
                          { value: "nft", label: "NFT & Collectibles" },
                          { value: "grant", label: "Grant / Bounty" },
                          { value: "other", label: "Other" },
                        ]
                  }
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-600 block mb-1">
                  Date
                </label>
                <NeoDatePicker value={date} onChange={setDate} />
              </div>
            </div>

            {/* Payment Method Section */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-600">
                  Payment Method
                </label>
                <span className="text-[10px] font-mono font-bold uppercase text-slate-400">
                  Quick Select
                </span>
              </div>

              {subLedger === "fiat" ? (
                /* Fiat Payment Rails */
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  {[
                    { name: "Cash", icon: Banknote },
                    { name: "UPI", icon: Smartphone },
                    { name: "Credit Card", icon: CreditCard },
                    { name: "Debit Card", icon: CreditCard },
                    { name: "Bank Transfer", icon: Building2 },
                    { name: "Apple Pay", icon: Smartphone },
                  ].map((item) => (
                    <motion.button
                      key={item.name}
                      type="button"
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setPaymentMethod(item.name)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-black uppercase rounded-lg border-2 border-[#121212] transition-all cursor-pointer ${
                        paymentMethod === item.name
                          ? "bg-[#836EF9] text-white shadow-[2px_2px_0_0_#121212]"
                          : "bg-white text-slate-800 shadow-[1.5px_1.5px_0_0_#121212] hover:bg-[#f3f4f6]"
                      }`}
                    >
                      <item.icon className="h-3 w-3" />
                      <span>{item.name}</span>
                    </motion.button>
                  ))}
                </div>
              ) : (
                /* On-Chain Payment Assets */
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  {[
                    { name: "Onchain (Monad)", label: "Monad", icon: MonadLogo },
                    { name: "Onchain (Ethereum)", label: "ETH", icon: EthereumLogo },
                    { name: "Onchain (Base)", label: "Base", icon: BaseLogo },
                    { name: "USDC", label: "USDC", icon: UsdcLogo },
                    { name: "USDT", label: "USDT", icon: UsdtLogo },
                  ].map((coin) => (
                    <motion.button
                      key={coin.name}
                      type="button"
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setPaymentMethod(coin.name)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-black uppercase rounded-lg border-2 border-[#121212] transition-all cursor-pointer ${
                        paymentMethod === coin.name
                          ? "bg-[#836EF9] text-white shadow-[2px_2px_0_0_#121212]"
                          : "bg-white text-slate-800 shadow-[1.5px_1.5px_0_0_#121212] hover:bg-[#f3f4f6]"
                      }`}
                    >
                      <coin.icon className="h-3 w-3" />
                      <span>{coin.label}</span>
                    </motion.button>
                  ))}
                </div>
              )}

              <input
                type="text"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder={
                  subLedger === "fiat"
                    ? "e.g. HDFC Credit Card, Cash in Wallet, Apple Pay"
                    : "e.g. Onchain (Monad), Base Sepolia"
                }
                className="w-full neo-input text-xs"
              />
            </div>

            {/* Optional Monad Verifiable Proof Anchor */}
            {subLedger === "fiat" && (
              <label className="flex items-start gap-2.5 p-3 rounded-xl border-2 border-[#121212] bg-[#fbf9fe] cursor-pointer shadow-[2px_2px_0_0_#121212] hover:bg-[#f3edff] transition">
                <input
                  type="checkbox"
                  checked={anchorToMonad}
                  onChange={(e) => setAnchorToMonad(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-2 border-[#121212] accent-[#836EF9]"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-[#836EF9]" />
                    <span className="text-xs font-black uppercase tracking-wider text-[#121212]">
                      Anchor Proof to Monad Testnet
                    </span>
                    <span className="text-[9px] font-mono font-bold uppercase text-[#836EF9] bg-[#f3f0ff] px-1.5 py-0.2 rounded border border-[#836EF9]/30">
                      Optional
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    Personal data remains 100% private. Creates an immutable cryptographic hash commitment for audit & reimbursement proof.
                  </p>
                </div>
              </label>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t-2 border-[#121212]">
              <WatermelonButton
                type="button"
                variant="secondary"
                size="sm"
                textMorph
                leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}
                onClick={() => setView("selection")}
              >
                Back
              </WatermelonButton>
              <div className="flex items-center gap-2">
                <WatermelonButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  textMorph
                  onClick={onClose}
                >
                  Cancel
                </WatermelonButton>
                <WatermelonButton
                  type="submit"
                  variant="primary"
                  size="sm"
                  textMorph
                >
                  Record Entry
                </WatermelonButton>
              </div>
            </div>
          </form>
        )}

        {/* VIEW 3: POST-SAVE ACTIONS (Save on Chain & Create Receipt) */}
        {view === "saved_action" && savedTransaction && (
          <div className="mt-4 space-y-4">
            {/* Success Banner */}
            <div className="p-3 bg-emerald-50 border-2 border-[#121212] rounded-xl flex items-center justify-between shadow-[2px_2px_0_0_#121212]">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black border border-[#121212] shadow-[1px_1px_0_0_#121212]">
                  <Check className="h-4 w-4 stroke-[3]" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950">
                    Entry Saved to Clario
                  </h4>
                  <p className="text-[10px] font-mono text-emerald-800">
                    Permanently stored in your connected account
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-white text-emerald-800 border border-emerald-300 shadow-[1px_1px_0_0_#121212]">
                Permanent
              </span>
            </div>

            {/* Entry Summary Card */}
            <div className="p-4 bg-[#f8f9fa] border-2 border-[#121212] rounded-xl space-y-3 shadow-[2.5px_2.5px_0_0_#121212]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                    Merchant / Description
                  </p>
                  <h3 className="text-base font-black uppercase text-[#121212] mt-0.5">
                    {savedTransaction.merchant}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {savedTransaction.date}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-800 border border-[#121212]">
                    {savedTransaction.type.toUpperCase()}
                  </span>
                  <div className="text-xl font-black font-mono tabular-nums text-[#121212] mt-1.5">
                    {savedTransaction.currency === "USD" || !savedTransaction.currency
                      ? "$"
                      : `${savedTransaction.currency} `}
                    {Number(savedTransaction.amount).toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="pt-2.5 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Category</span>
                  <span className="font-bold text-[#121212]">{formatCategoryLabel(savedTransaction.category)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Payment Method</span>
                  <span className="font-bold text-[#121212] truncate block">{savedTransaction.payment_method || "Recorded"}</span>
                </div>
              </div>

              {/* Status indicator */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs font-mono">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Verification State:</span>
                {savedTransaction.blockchain_tx_hash || savedTransaction.monad_tx_hash ? (
                  <div className="flex items-center gap-1.5">
                    <span className="neo-badge neo-badge-purple text-[10px]">
                      • VERIFIED ON MONAD
                    </span>
                    <a
                      href={getMonadExplorerTxUrl(
                        savedTransaction.blockchain_tx_hash ||
                          savedTransaction.monad_tx_hash ||
                          "",
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#836EF9] hover:underline flex items-center gap-0.5 text-[10px] font-bold"
                    >
                      <span>Explorer</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                ) : (
                  <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                    Saved in Clario (Off-chain)
                  </span>
                )}
              </div>
            </div>

            {/* Error notice if on-chain failed */}
            {onChainError && (
              <div className="p-3 bg-red-50 border-2 border-red-500 rounded-xl text-xs font-mono text-red-800 flex items-start gap-2 shadow-[2px_2px_0_0_#121212]">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold">On-chain recording notice:</p>
                  <p className="text-[11px] text-red-700 mt-0.5">{onChainError}</p>
                </div>
              </div>
            )}

            {/* Dual Primary Actions: Save on Chain + Create Receipt */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {/* Action 1: Save on Chain (optional) */}
              {savedTransaction.blockchain_tx_hash || savedTransaction.monad_tx_hash ? (
                <div className="p-3 rounded-xl border-2 border-[#836EF9] bg-[#fbf9fe] flex items-center justify-between text-xs font-mono shadow-[2.5px_2.5px_0_0_#121212]">
                  <div className="flex items-center gap-1.5 text-[#836EF9] font-black">
                    <MonadLogo className="h-4 w-4" />
                    <span>Anchored on Monad</span>
                  </div>
                  <a
                    href={getMonadExplorerTxUrl(
                      savedTransaction.blockchain_tx_hash ||
                        savedTransaction.monad_tx_hash ||
                        "",
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-bold text-[#836EF9] hover:underline flex items-center gap-0.5"
                  >
                    <span>Explorer</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isOnChainSaving}
                  onClick={handleSaveOnChain}
                  className="rounded-xl border-2 border-[#121212] bg-[#836EF9] hover:bg-[#7257f8] text-white p-3 font-mono font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 shadow-[3px_3px_0_0_#121212] transition-all active:translate-x-[1px] active:translate-y-[1px] cursor-pointer disabled:opacity-70"
                >
                  {isOnChainSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span className="text-[11px]">{onChainStepLabel || "Submitting to Monad..."}</span>
                    </>
                  ) : (
                    <>
                      <MonadLogo className="h-4 w-4 text-white" />
                      <span>Save on Chain</span>
                      <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded font-normal lowercase">
                        optional
                      </span>
                    </>
                  )}
                </button>
              )}

              {/* Action 2: Create Receipt */}
              <button
                type="button"
                onClick={handleCreateReceipt}
                className="rounded-xl border-2 border-[#121212] bg-white hover:bg-[#fbf9fe] text-[#121212] p-3 font-mono font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 shadow-[3px_3px_0_0_#121212] transition-all active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
              >
                <Receipt className="h-4 w-4 text-[#836EF9]" />
                <span>Create Receipt</span>
              </button>
            </div>

            {/* Invariant Note */}
            <p className="text-[11px] text-slate-500 font-mono text-center">
              On-chain saving is always optional. Every receipt and entry is permanently tied to your connected account.
            </p>

            {/* Bottom Actions */}
            <div className="pt-2 border-t-2 border-[#121212] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setView("manual")}
                className="text-xs font-mono font-bold text-slate-600 hover:text-[#121212] transition cursor-pointer"
              >
                + Add Another Entry
              </button>

              <WatermelonButton
                type="button"
                variant="primary"
                size="sm"
                textMorph
                onClick={() => {
                  setView("selection");
                  onClose();
                }}
              >
                Done / Continue
              </WatermelonButton>
            </div>
          </div>
        )}
      </motion.div>

      <TransactionShareModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          onClose();
        }}
        transaction={savedTransaction}
      />
    </div>
  );
}
