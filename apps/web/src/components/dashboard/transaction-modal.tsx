"use client";

import { useState } from "react";
import {
  PlusCircle,
  X,
  Wallet,
  FileText,
  ArrowLeft,
  Camera,
  Sparkles,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  ShieldCheck,
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

export type SubLedgerMode = "fiat" | "onchain";

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tx: Partial<Transaction>) => void;
  onScanReceipt?: () => void;
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
  const [view, setView] = useState<"selection" | "manual">("selection");
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !description) return;
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) return;

    const isCrypto = subLedger === "onchain";

    onSave({
      id: crypto.randomUUID(),
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
    });

    setAmount("");
    setDescription("");
    setView("selection");
    onClose();
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
              className="rounded-lg p-1.5 text-slate-500 hover:bg-[#f3f4f6] hover:text-[#121212] border border-transparent hover:border-[#121212] transition"
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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f3f0ff] text-[#836EF9] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-wider text-[#121212]">
                Record Transaction
              </h3>
              <p className="text-[11px] text-slate-500">
                {view === "selection"
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
            className="rounded-lg p-1.5 text-slate-500 hover:bg-[#f3f4f6] hover:text-[#121212] border border-transparent hover:border-[#121212] transition"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Top-Level Rail Switcher (Personal Finance vs On-Chain) */}
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
                ? "bg-[#121212] text-white border-2 border-[#121212] shadow-[2.5px_2.5px_0_0_#836EF9]"
                : "bg-white text-slate-700 border-2 border-transparent hover:border-[#121212] hover:bg-[#fafafa]"
            }`}
          >
            <CreditCard className="h-3.5 w-3.5 text-[#836EF9]" />
            <span>Personal Finance</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
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
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-[#836EF9] font-bold border border-purple-300">
              Web3
            </span>
          </motion.button>
        </div>

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
                        <Sparkles className="h-3 w-3" />
                        Gemini AI OCR
                      </span>
                      <span className="text-[10px] font-mono font-black uppercase text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-300 shadow-[1px_1px_0_0_#121212]">
                        Zero Friction
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
      </motion.div>
    </div>
  );
}
