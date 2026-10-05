import { useState } from "react";
import { PlusCircle, X, Wallet, FileText, ArrowLeft } from "lucide-react";
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
import { WatermelonAlert } from "@/components/ui/watermelon-alert";
import { motion, AnimatePresence } from "motion/react";
import { NeoSelect } from "@/components/ui/neo-select";
import { NeoDatePicker } from "@/components/ui/neo-date-picker";

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tx: Partial<Transaction>) => void;
  userId?: string | undefined;
  userAddress?: string | undefined;
  workspaceId?: string | undefined;
  hasConnectedWallet?: boolean | undefined;
  onConnectWallet?: (() => void) | undefined;
}

export function TransactionModal({
  isOpen,
  onClose,
  onSave,
  userId = "user_default",
  userAddress,
  workspaceId = "00000000-0000-0000-0000-000000000001",
  hasConnectedWallet,
  onConnectWallet,
}: TransactionModalProps) {
  const auth = useClarioAuth();
  const effectiveConnectedAddress =
    userAddress || auth.connectedEvmAddress || undefined;
  const isWalletConnected = hasConnectedWallet ?? auth.hasConnectedEvmWallet;
  const handleConnectWallet = onConnectWallet || auth.connectEvmWallet;

  const [view, setView] = useState<"selection" | "manual">("selection");
  const [isNoWalletPopupOpen, setIsNoWalletPopupOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]!);
  const [paymentMethod, setPaymentMethod] = useState("Credit Card");
  // Reset to selection view whenever modal is freshly opened
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setView("selection");
      setIsNoWalletPopupOpen(false);
      setIsImportOpen(false);
    }
  }

  if (!isOpen) return null;

  const handleFetchViaAlchemy = () => {
    // Rule: Only allow "Fetch via Alchemy" to run when a valid EVM wallet address is actually connected
    if (
      isWalletConnected &&
      effectiveConnectedAddress &&
      /^0x[a-fA-F0-9]{40}$/.test(effectiveConnectedAddress)
    ) {
      setIsImportOpen(true);
    } else {
      // User has NO connected EVM wallet:
      // Do NOT perform the Alchemy transaction lookup!
      // Show clear popup with the 2 clear options
      setIsNoWalletPopupOpen(true);
    }
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !description) return;
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) return;

    onSave({
      id: crypto.randomUUID(),
      user_id: userId,
      type,
      amount: numericAmount,
      currency: "USD",
      merchant: description.trim(),
      description: description.trim(),
      category,
      category_id: category,
      date,
      timestamp: new Date(date).toISOString(),
      payment_method: paymentMethod?.trim() || "Credit Card",
      verification_state: "unverified",
      verification_status: "unverified",
      blockchain_status: "unverified",
      blockchain_network: "Monad Testnet",
      blockchain_chain_id: 10143,
      source: "manual",
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
          setView("manual");
        }}
      />
    );
  }

  // Requirement 1 & 2: "Connect EVM Wallet" Guard Popup Modal (Single Backdrop)
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
              Your account does not have a connected EVM wallet. To
              automatically search and index transactions via Alchemy, connect
              an external EVM wallet (e.g. MetaMask, Coinbase Wallet, Rainbow),
              or record the transaction manually.
            </p>
          </div>

          <div className="mt-6 space-y-2.5">
            {/* Option 1: CONNECT EVM WALLET */}
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

            {/* Option 2: ADD TRANSACTION MANUALLY */}
            <ClarioButton
              variant="outline"
              className="w-full justify-center !py-3"
              icon={<FileText className="h-4 w-4" />}
              onClick={() => {
                setIsNoWalletPopupOpen(false);
                setView("manual");
              }}
            >
              ADD TRANSACTION MANUALLY
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
        className="relative z-10 w-full max-w-md rounded-2xl border-2 border-[#121212] bg-white p-6 shadow-[6px_6px_0_0_#121212] text-[#121212]"
      >
        {/* VIEW 1: SELECTION SCREEN */}
        {view === "selection" ? (
          <div>
            <div className="flex items-center justify-between pb-4 border-b-2 border-[#121212]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f3f0ff] text-[#836EF9] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
                  <PlusCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-wider text-[#121212]">
                    Record Transaction
                  </h3>
                  <p className="text-xs text-slate-500">
                    Choose how you want to add an entry to your ledger
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-[#f3f4f6] hover:text-[#121212] border border-transparent hover:border-[#121212] transition"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-3.5">
              {/* Option 1: Fetch Onchain via Alchemy */}
              <button
                type="button"
                onClick={handleFetchViaAlchemy}
                className="w-full text-left p-4 rounded-xl border-2 border-[#121212] bg-[#fbf9fe] hover:bg-[#f5efff] shadow-[3px_3px_0_0_#121212] transition-all group flex flex-col justify-between active:translate-x-[1px] active:translate-y-[1px]"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase text-[#0052FF] bg-[#f0f4ff] px-2 py-0.5 rounded border border-[#0052FF]/30">
                    <AlchemyLogo className="h-3.5 w-3.5" />
                    Alchemy API
                  </span>
                  <span className="text-[10px] font-mono font-bold uppercase text-[#836EF9] bg-[#f3f0ff] px-2 py-0.5 rounded border border-[#836EF9]/30">
                    Multi-Chain EVM
                  </span>
                </div>
                <h4 className="text-sm font-black uppercase tracking-wider text-[#121212] group-hover:text-[#836EF9] transition flex items-center justify-between">
                  <span>Fetch via Alchemy (Onchain)</span>
                  <span className="text-sm font-mono font-bold">→</span>
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Automatically index transfers across Monad, Ethereum, Base &
                  Hyperliquid from your connected EVM wallet.
                </p>
              </button>

              {/* Option 2: Add Transaction Manually */}
              <button
                type="button"
                onClick={() => setView("manual")}
                className="w-full text-left p-4 rounded-xl border-2 border-[#121212] bg-white hover:bg-[#f9fafb] shadow-[3px_3px_0_0_#121212] transition-all group flex flex-col justify-between active:translate-x-[1px] active:translate-y-[1px]"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold uppercase text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-[#121212]/30">
                    Manual Ledger Entry
                  </span>
                  <span className="text-[10px] font-mono font-bold uppercase text-slate-500">
                    Direct Form
                  </span>
                </div>
                <h4 className="text-sm font-black uppercase tracking-wider text-[#121212] group-hover:text-black transition flex items-center justify-between">
                  <span>Add Transaction Manually</span>
                  <span className="text-sm font-mono font-bold">→</span>
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Enter merchant details, amount, category, date, and payment
                  method directly into your personal ledger.
                </p>
              </button>
            </div>

            <div className="mt-6 pt-3 border-t-2 border-[#121212] flex items-center justify-end">
              <ClarioButton type="button" variant="secondary" onClick={onClose}>
                Cancel
              </ClarioButton>
            </div>
          </div>
        ) : (
          /* VIEW 2: MANUAL TRANSACTION FORM */
          <div>
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#121212]">
              <div className="flex items-center gap-2.5">
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
                <div>
                  <h3 className="text-base font-black uppercase tracking-wider text-[#121212]">
                    Record Transaction
                  </h3>
                  <p className="text-[11px] text-slate-500">Manual entry</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-[#f3f4f6] hover:text-[#121212] border border-transparent hover:border-[#121212] transition"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Onchain Quick Fetch Trigger */}
            <div className="mt-3.5 p-2.5 bg-[#fbf9fe] border-2 border-[#121212] rounded-xl flex items-center justify-between shadow-[2px_2px_0_0_#121212]">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-bold uppercase text-slate-500">
                  OR IMPORT:
                </span>
                <span className="text-[10px] font-mono font-bold uppercase text-[#0052FF] bg-[#f0f4ff] px-1.5 py-0.5 rounded border border-[#0052FF]/30">
                  ALCHEMY API
                </span>
              </div>
              <ClarioButton
                type="button"
                variant="primary"
                size="sm"
                icon={<MonadLogo className="h-4 w-4" />}
                onClick={handleFetchViaAlchemy}
              >
                Fetch via Alchemy
              </ClarioButton>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Inflow / Outflow Toggle */}
              <div className="flex gap-2 p-1 bg-[#f3f4f6] rounded-xl border-2 border-[#121212]">
                <button
                  type="button"
                  onClick={() => setType("expense")}
                  className={`flex-1 rounded-lg py-2 text-xs font-black uppercase tracking-wider transition ${
                    type === "expense"
                      ? "bg-[#fee2e2] text-[#b91c1c] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]"
                      : "text-slate-600 hover:text-[#121212] border-2 border-transparent"
                  }`}
                >
                  Expense (Outflow)
                </button>
                <button
                  type="button"
                  onClick={() => setType("income")}
                  className={`flex-1 rounded-lg py-2 text-xs font-black uppercase tracking-wider transition ${
                    type === "income"
                      ? "bg-[#dcfce7] text-[#15803d] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]"
                      : "text-slate-600 hover:text-[#121212] border-2 border-transparent"
                  }`}
                >
                  Income (Inflow)
                </button>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-600">
                  Amount ($)
                </label>
                <div className="relative mt-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 text-xs font-mono font-bold pointer-events-none">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full neo-input !pl-8 font-mono font-bold"
                    style={{ paddingLeft: "2rem" }}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-600">
                  Description / Merchant
                </label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. AWS Cloud, Monad Validator Node, Client Retainer"
                  className="mt-1 w-full neo-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-600">
                    Category
                  </label>
                  <NeoSelect
                    value={category}
                    onChange={setCategory}
                    options={[
                      { value: "software_tools", label: "Software & Tools" },
                      { value: "food_dining", label: "Food & Dining" },
                      { value: "transportation", label: "Transportation" },
                      { value: "office_expenses", label: "Office Expenses" },
                      { value: "utilities", label: "Utilities" },
                      { value: "crypto_ops", label: "Crypto Operations" },
                      { value: "other", label: "Other" },
                    ]}
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-600">
                    Date
                  </label>
                  <NeoDatePicker
                    value={date}
                    onChange={setDate}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-600">
                    Payment Method
                  </label>
                  <span className="text-[10px] font-mono font-bold uppercase text-slate-400">
                    Quick Select
                  </span>
                </div>

                {/* Quick Select Crypto Badges */}
                <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("Onchain (Monad)")}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-black uppercase rounded bg-[#f3f0ff] text-[#836EF9] border border-[#121212] hover:bg-[#e7e1fe] transition shadow-[1px_1px_0_0_#121212] active:translate-x-[1px] active:translate-y-[1px]"
                  >
                    <MonadLogo className="h-3 w-3" />
                    Monad
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("Onchain (Ethereum)")}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-black uppercase rounded bg-slate-100 text-slate-800 border border-[#121212] hover:bg-slate-200 transition shadow-[1px_1px_0_0_#121212] active:translate-x-[1px] active:translate-y-[1px]"
                  >
                    <EthereumLogo className="h-3 w-3" />
                    ETH
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("Onchain (Base)")}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-black uppercase rounded bg-blue-50 text-[#0052FF] border border-[#121212] hover:bg-blue-100 transition shadow-[1px_1px_0_0_#121212] active:translate-x-[1px] active:translate-y-[1px]"
                  >
                    <BaseLogo className="h-3 w-3" />
                    Base
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("USDC")}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-black uppercase rounded bg-sky-50 text-[#2775CA] border border-[#121212] hover:bg-sky-100 transition shadow-[1px_1px_0_0_#121212] active:translate-x-[1px] active:translate-y-[1px]"
                  >
                    <UsdcLogo className="h-3 w-3" />
                    USDC
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("USDT")}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-black uppercase rounded bg-emerald-50 text-[#26A17B] border border-[#121212] hover:bg-emerald-100 transition shadow-[1px_1px_0_0_#121212] active:translate-x-[1px] active:translate-y-[1px]"
                  >
                    <UsdtLogo className="h-3 w-3" />
                    USDT
                  </button>
                </div>

                <div className="relative">
                  {(() => {
                    const match = detectCryptoIdentity(paymentMethod);
                    return match ? (
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        {match.kind === "chain" ? (
                          <CryptoChainIcon
                            chain={match.identifier}
                            className="h-4 w-4"
                          />
                        ) : (
                          <CryptoCoinIcon
                            symbol={match.identifier}
                            className="h-4 w-4"
                          />
                        )}
                      </div>
                    ) : null;
                  })()}
                  <input
                    type="text"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    placeholder="e.g. Chase Visa, Monad Testnet, Wire"
                    className={`w-full neo-input ${
                      detectCryptoIdentity(paymentMethod) ? "!pl-10" : ""
                    }`}
                    style={
                      detectCryptoIdentity(paymentMethod)
                        ? { paddingLeft: "2.5rem" }
                        : undefined
                    }
                  />
                </div>
              </div>

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
                    Add Entry
                  </WatermelonButton>
                </div>
              </div>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  );
}
