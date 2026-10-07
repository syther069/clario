"use client";

import { useState, useEffect, useMemo } from "react";
import type {
  Transaction,
  Subscription,
  Budget,
  FinancialGoal,
  Category,
  ReceiptBundle,
  PersonalView,
} from "@/lib/supabase/types";
import {
  TrendingUp,
  TrendingDown,
  RotateCcw,
  ChartNoAxesCombined,
  LayoutDashboard,
  BadgeCheck,
  ArrowLeftRight,
  Wallet,
  Plus,
  Receipt,
  AlertCircle,
  AlertTriangle,
  Loader2,
  X,
  Layers,
  ExternalLink,
  ShieldCheck,
  ArrowRight,
  Search,
  Download,
  UploadCloud,
  Calendar,
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { executeSaveTransaction } from "@/lib/blockchain/save-transaction";
import { useClarioAuth } from "@/lib/auth/use-clario-auth";
import {
  CryptoBadge,
  CryptoChainIcon,
  CryptoCoinIcon,
  MonadLogo,
  detectCryptoIdentity,
} from "@/components/ui/crypto-icon";
import { formatTransactionDateTime } from "@/lib/import/types";
import { TransactionShareModal } from "./transaction-share-modal";
import { ReceiptPreviewModal } from "./receipt-preview-modal";
import { ReceiptBundleModal } from "./receipt-bundle-modal";
import {
  CLARIO_REGISTRY_ADDRESS,
  MONAD_TESTNET_CHAIN_ID,
  getMonadExplorerTxUrl,
} from "@/lib/blockchain/registry";
import {
  Magnetic,
  BorderTrail,
  TextShimmer,
  TextScramble,
  AnimatedBackground,
  SlidingNumber,
  ToolbarExpandable,
  ToolbarCollapsed,
  ToolbarExpanded,
  ToolbarToggle,
} from "@/components/ui/motion";
import { WatermelonButton } from "@/components/ui/watermelon-button";
import { WatermelonAlert } from "@/components/ui/watermelon-alert";
import { NeoSelect } from "@/components/ui/neo-select";
import { NeoDatePicker } from "@/components/ui/neo-date-picker";
import { motion, AnimatePresence } from "motion/react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function formatCategoryName(
  category?: Category | string | null,
  categoryId?: string | null,
): string {
  if (!category && !categoryId) return "General";
  if (typeof category === "object" && category?.name) return category.name;
  const raw = (typeof category === "string" ? category : categoryId) || "";
  if (!raw.trim()) return "General";
  const slug = raw.toLowerCase().trim();
  const knownCategories: Record<string, string> = {
    software_tools: "Software & Tools",
    food_dining: "Food & Dining",
    transportation: "Transportation",
    office_expenses: "Office Expenses",
    utilities: "Utilities",
    crypto_ops: "Crypto Ops",
    housing: "Housing & Rent",
    health: "Health & Medical",
    shopping: "Shopping & Retail",
    education: "Education",
    subscriptions: "Subscriptions",
    income: "Salary & Income",
    investments: "Investments",
    other: "General",
  };
  if (knownCategories[slug]) {
    return knownCategories[slug]!;
  }
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type ExpenseDateFilter = "all" | "7d" | "30d" | "month" | "year";
type ExpenseAmountFilter = "all" | "under50" | "50to200" | "over200";
type ExpenseReceiptFilter = "all" | "has_receipt" | "no_receipt";
type ExpenseVerificationFilter = "all" | "verified" | "unverified";
type SubFrequency = "weekly" | "monthly" | "yearly";

interface PersonalDashboardProps {
  transactions: Transaction[];
  subscriptions: Subscription[];
  budgets: Budget[];
  goals: FinancialGoal[];
  currencySymbol?: string | undefined;
  activeView?: PersonalView | undefined;
  onViewChange?: ((view: PersonalView) => void) | undefined;
  onAddTransaction?: ((subLedger?: "fiat" | "onchain") => void) | undefined;
  onUploadReceipt?: (() => void) | undefined;
  onUpdateTransaction?: ((tx: Transaction) => void) | undefined;
  userId?: string | undefined;
  userAddress?: string | null | undefined;
  hasConnectedWallet?: boolean | undefined;
  onConnectWallet?: (() => void) | undefined;
}

export function PersonalDashboard({
  transactions = [],
  subscriptions = [],
  budgets = [],
  currencySymbol = "$",
  activeView,
  onViewChange,
  onAddTransaction,
  onUploadReceipt,
  onUpdateTransaction,
  userId = "user_default",
  userAddress,
  hasConnectedWallet,
  onConnectWallet,
}: PersonalDashboardProps) {
  const [prevActiveView, setPrevActiveView] = useState(activeView);
  const [currentView, setCurrentView] = useState<PersonalView>(
    activeView || "overview",
  );

  if (activeView !== prevActiveView) {
    setPrevActiveView(activeView);
    if (activeView) setCurrentView(activeView);
  }
  const auth = useClarioAuth();
  const effectiveConnectedAddress =
    userAddress || auth.activeWalletAddress || undefined;
  const isWalletConnected = hasConnectedWallet ?? auth.hasAnyWallet;
  const handleConnectWallet = onConnectWallet || auth.connectEvmWallet;

  const [selectedProofTx, setSelectedProofTx] = useState<Transaction | null>(
    null,
  );
  const [selectedBundle, setSelectedBundle] = useState<ReceiptBundle | null>(
    null,
  );
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [activeLedgerTab, setActiveLedgerTab] = useState<
    "transactions" | "receipts"
  >("transactions");
  const [isLoadingReceipts, setIsLoadingReceipts] = useState<boolean>(false);
  const [receiptSearchQuery, setReceiptSearchQuery] = useState<string>("");
  const [receiptBundles, setReceiptBundles] = useState<
    Record<string, ReceiptBundle>
  >({});
  const [savingTxId, setSavingTxId] = useState<string | null>(null);
  const [savingProgressLabel, setSavingProgressLabel] = useState<string>("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isNoWalletPopupOpen, setIsNoWalletPopupOpen] = useState(false);

  // Sub-tab toggles for merged views
  const [expenseSubTab, setExpenseSubTab] = useState<"all" | "expenses" | "income">("all");
  const [budgetSubTab, setBudgetSubTab] = useState<"budgets" | "receipts">("budgets");

  const currentTab = useMemo<"overview" | "expenses" | "recurring" | "budgets">(() => {
    if (currentView === "income") return "expenses";
    if (currentView === "receipts") return "budgets";
    if (currentView === "expenses" || currentView === "recurring" || currentView === "budgets") {
      return currentView;
    }
    return "overview";
  }, [currentView]);

  // Sub-ledger state (Personal Finance / Fiat vs On-Chain / Web3)
  const [subLedger, setSubLedger] = useState<"fiat" | "onchain">("fiat");
  const [fiatCurrency, setFiatCurrency] = useState<{
    code: string;
    symbol: string;
  }>({
    code: "USD",
    symbol: currencySymbol || "$",
  });

  // Quick Add state for Personal Finance
  const [quickDesc, setQuickDesc] = useState("");
  const [quickAmount, setQuickAmount] = useState("");
  const [quickPaymentMethod, setQuickPaymentMethod] = useState("Credit Card");

  // Helper to distinguish On-Chain vs Fiat
  const isTxOnChain = (t: Transaction): boolean => {
    const pm = (t.payment_method || "").toLowerCase();
    return Boolean(
      t.blockchain_tx_hash ||
      t.monad_tx_hash ||
      t.source === "onchain_monad" ||
      t.source === "onchain_other" ||
      t.category === "crypto_ops" ||
      t.category_id === "crypto_ops" ||
      pm.includes("onchain") ||
      pm.includes("eth") ||
      pm.includes("monad") ||
      pm.includes("usdc") ||
      pm.includes("usdt") ||
      pm.includes("base") ||
      pm.includes("arbitrum")
    );
  };

  const fiatTransactions = useMemo(
    () => transactions.filter((t) => !isTxOnChain(t)),
    [transactions],
  );

  const onChainTransactions = useMemo(
    () => transactions.filter((t) => isTxOnChain(t)),
    [transactions],
  );

  const activeTransactions = subLedger === "fiat" ? fiatTransactions : onChainTransactions;
  const activeCurrencySymbol = subLedger === "fiat" ? fiatCurrency.symbol : "$";

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickDesc.trim() || !quickAmount) return;
    const num = parseFloat(quickAmount);
    if (isNaN(num) || num <= 0) return;

    onUpdateTransaction?.({
      id: crypto.randomUUID(),
      user_id: userId,
      type: "expense",
      amount: num,
      currency: fiatCurrency.code,
      merchant: quickDesc.trim(),
      description: quickDesc.trim(),
      category: "food_dining",
      category_id: "food_dining",
      date: new Date().toISOString().split("T")[0]!,
      timestamp: new Date().toISOString(),
      payment_method: quickPaymentMethod,
      verification_state: "unverified",
      verification_status: "unverified",
      blockchain_status: null,
      source: "manual",
      version: 1,
    } as Transaction);

    setQuickDesc("");
    setQuickAmount("");
  };

  const displayedTransactions = activeTransactions.slice(0, 10);
  const isAllSelected =
    displayedTransactions.length > 0 &&
    displayedTransactions.every((t) => selectedTxIds.has(t.id));

  const selectedTransactions = activeTransactions.filter((t) =>
    selectedTxIds.has(t.id),
  );
  const selectedTransactionsTotal = selectedTransactions.reduce(
    (sum, t) => sum + Number(t.amount || 0),
    0,
  );

  const handleToggleSelect = (txId: string) => {
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(txId)) {
        next.delete(txId);
      } else {
        next.add(txId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(displayedTransactions.map((t) => t.id)));
    }
  };

  // Load individual receipt bundles referenced in transactions
  useEffect(() => {
    const bundleIds = Array.from(
      new Set(
        transactions
          .map((t) => t.receipt_bundle_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    if (bundleIds.length === 0) return;

    for (const bundleId of bundleIds) {
      if (receiptBundles[bundleId]) continue;
      const addrParam = effectiveConnectedAddress
        ? `&userAddress=${encodeURIComponent(effectiveConnectedAddress.toLowerCase())}`
        : "";
      fetch(`/api/receipts/bundle?receiptId=${bundleId}${addrParam}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.bundle) {
            setReceiptBundles((prev) => ({ ...prev, [bundleId]: data.bundle }));
          }
        })
        .catch(() => {});
    }
  }, [transactions, receiptBundles, effectiveConnectedAddress]);

  // Load all verified receipts belonging to this authenticated user account or wallet
  useEffect(() => {
    let ignore = false;
    async function loadVerifiedReceipts() {
      // 1. Wait for Privy auth to be ready to avoid race conditions on page refresh
      if (!auth.isReady) {
        setIsLoadingReceipts(true);
        return;
      }

      // 2. If no valid EVM wallet is connected, do NOT query or flash; clear receipts and stop loading
      if (
        !effectiveConnectedAddress ||
        !/^0x[a-fA-F0-9]{40}$/.test(effectiveConnectedAddress)
      ) {
        setReceiptBundles({});
        setIsLoadingReceipts(false);
        return;
      }

      setIsLoadingReceipts(true);
      try {
        const normAddr = effectiveConnectedAddress.toLowerCase();
        const queryParams = new URLSearchParams();
        queryParams.set("userAddress", normAddr);
        queryParams.set("verifiedOnly", "true");

        const res = await fetch(
          `/api/receipts/bundle?${queryParams.toString()}`,
        );
        const data = await res.json();
        if (!ignore && data.success && Array.isArray(data.bundles)) {
          const map: Record<string, ReceiptBundle> = {};
          for (const b of data.bundles as ReceiptBundle[]) {
            map[b.id] = b;
          }
          // Authoritative replacement for this specific connected wallet
          setReceiptBundles(map);
        }
      } catch (err) {
        console.warn("Failed to load verified receipt bundles:", err);
      } finally {
        if (!ignore) setIsLoadingReceipts(false);
      }
    }

    loadVerifiedReceipts();
    return () => {
      ignore = true;
    };
  }, [auth.isReady, effectiveConnectedAddress]);

  // Compute verified receipts list strictly adhering to:
  // ONLY ON-CHAIN SAVED AND CONFIRMED RECEIPTS ARE INCLUDED
  const verifiedReceipts = useMemo(() => {
    // 1. Gather all bundles that are confirmed on Monad with a real tx hash
    const verifiedBundles = Object.values(receiptBundles).filter((b) => {
      return (
        (b.verification_status === "verified" ||
          b.blockchain_status === "confirmed") &&
        Boolean(b.blockchain_tx_hash) &&
        b.blockchain_status !== "failed"
      );
    });

    // 2. Also check if there are standalone transactions with confirmed onchain status not in any bundle
    const standaloneConfirmedTxs = transactions.filter(
      (t) =>
        (t.blockchain_status === "confirmed" ||
          t.verification_state === "verified" ||
          t.verification_status === "verified") &&
        Boolean(t.blockchain_tx_hash || t.monad_tx_hash) &&
        t.blockchain_status !== "failed" &&
        (!t.receipt_bundle_id || !receiptBundles[t.receipt_bundle_id]),
    );

    const synthesizedBundles: ReceiptBundle[] = standaloneConfirmedTxs.map(
      (t) => {
        const txHash = t.blockchain_tx_hash || t.monad_tx_hash || "0x";
        const receiptId = `receipt_${t.id.replace(/-/g, "")}`;
        return {
          id: receiptId,
          user_id: t.user_id || userId,
          wallet_address: effectiveConnectedAddress || null,
          name: t.merchant,
          receipt_name: t.merchant,
          receipt_number: `CR-${t.id.slice(0, 8).toUpperCase()}`,
          receipt_hash: t.blockchain_data_hash || t.commitment_hash || "0x",
          file_hash: t.blockchain_data_hash || t.commitment_hash || "0x",
          transaction_count: 1,
          total_amount: Number(t.amount),
          currency: t.currency || "USD",
          transaction_ids: [t.id],
          receipt_data: {
            receiptId,
            receiptNumber: `CR-${t.id.slice(0, 8).toUpperCase()}`,
            receiptName: t.merchant,
            createdAt: t.created_at,
            owner: t.user_id || userId,
            transactionCount: 1,
            totalAmount: Number(t.amount),
            currency: t.currency || "USD",
            transactionIds: [t.id],
            transactions: [
              {
                id: t.id,
                amount: Number(t.amount),
                currency: t.currency || "USD",
                merchant: t.merchant,
                category: formatCategoryName(t.category, t.category_id),
                date: t.date || t.timestamp,
                type: t.type,
              },
            ],
            version: 1,
          },
          blockchain_network: "Monad Testnet",
          blockchain_status: "confirmed",
          blockchain_tx_hash: txHash,
          blockchain_contract_address: CLARIO_REGISTRY_ADDRESS,
          blockchain_chain_id: MONAD_TESTNET_CHAIN_ID,
          monad_block: t.monad_block || null,
          verification_status: "verified",
          created_at: t.created_at,
          updated_at: t.updated_at,
        };
      },
    );

    // Merge and deduplicate by ID or tx hash
    const all = [...verifiedBundles];
    const seenTxHashes = new Set(
      all.map((b) => b.blockchain_tx_hash?.toLowerCase()).filter(Boolean),
    );

    for (const syn of synthesizedBundles) {
      if (
        !all.some((b) => b.id === syn.id) &&
        !seenTxHashes.has(syn.blockchain_tx_hash?.toLowerCase())
      ) {
        all.push(syn);
      }
    }

    return all.sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime(),
    );
  }, [receiptBundles, transactions, userId, effectiveConnectedAddress]);

  const filteredVerifiedReceipts = useMemo(() => {
    if (!receiptSearchQuery.trim()) return verifiedReceipts;
    const q = receiptSearchQuery.toLowerCase().trim();
    return verifiedReceipts.filter((r) => {
      const name = (
        r.name ||
        r.receipt_name ||
        r.receipt_data?.receiptName ||
        ""
      ).toLowerCase();
      const num = (r.receipt_number || "").toLowerCase();
      const tx = (r.blockchain_tx_hash || "").toLowerCase();
      const wallet = (r.wallet_address || "").toLowerCase();
      return (
        name.includes(q) ||
        num.includes(q) ||
        tx.includes(q) ||
        wallet.includes(q)
      );
    });
  }, [verifiedReceipts, receiptSearchQuery]);

  const handleOpenCreateReceipt = () => {
    if (selectedTxIds.size === 0) return;

    if (
      !isWalletConnected ||
      !effectiveConnectedAddress ||
      !/^0x[a-fA-F0-9]{40}$/.test(effectiveConnectedAddress)
    ) {
      setIsNoWalletPopupOpen(true);
      return;
    }

    setIsPreviewOpen(true);
  };

  const handleReceiptBundleCreated = (bundle: ReceiptBundle) => {
    setReceiptBundles((prev) => ({ ...prev, [bundle.id]: bundle }));
    setSelectedTxIds(new Set());
    setActiveLedgerTab("receipts");

    if (onUpdateTransaction && Array.isArray(bundle.transaction_ids)) {
      for (const txId of bundle.transaction_ids) {
        const existing = transactions.find((t) => t.id === txId);
        if (existing) {
          onUpdateTransaction({
            ...existing,
            receipt_bundle_id: bundle.id,
            verification_state: "verified",
            verification_status: "verified",
            blockchain_status: "confirmed",
            blockchain_tx_hash: bundle.blockchain_tx_hash || null,
            monad_tx_hash: bundle.blockchain_tx_hash || null,
            blockchain_data_hash: bundle.receipt_hash,
          });
        }
      }
    }

    setSelectedBundle(bundle);
  };

  const handleViewBundle = async (bundleId: string) => {
    if (receiptBundles[bundleId]) {
      setSelectedBundle(receiptBundles[bundleId] || null);
      return;
    }

    try {
      const addrQuery = effectiveConnectedAddress
        ? `&userAddress=${encodeURIComponent(effectiveConnectedAddress.toLowerCase())}`
        : "";
      const res = await fetch(
        `/api/receipts/bundle?receiptId=${bundleId}${addrQuery}`,
      );
      const data = await res.json();
      if (data.success && data.bundle) {
        setReceiptBundles((prev) => ({ ...prev, [bundleId]: data.bundle }));
        setSelectedBundle(data.bundle);
        return;
      }
    } catch (e) {
      console.warn("Notice: bundle fetch fallback:", e);
    }

    // Fallback: reconstruct from transactions with this bundle ID
    const bundleTxs = transactions.filter(
      (t) => t.receipt_bundle_id === bundleId,
    );
    if (bundleTxs.length > 0) {
      const firstTx = bundleTxs[0]!;
      const totalAmt = bundleTxs.reduce((s, t) => s + Number(t.amount), 0);
      const fallbackName = `Receipt Bundle #${bundleId.startsWith("CR-") ? bundleId : bundleId.slice(0, 8).toUpperCase()}`;
      const fallbackBundle: ReceiptBundle = {
        id: bundleId,
        user_id: firstTx.user_id || userId,
        name: fallbackName,
        receipt_name: fallbackName,
        receipt_number: bundleId.startsWith("CR-")
          ? bundleId
          : `CR-${bundleId.slice(0, 8).toUpperCase()}`,
        file_hash:
          firstTx.blockchain_data_hash || firstTx.commitment_hash || "0x",
        receipt_hash:
          firstTx.blockchain_data_hash || firstTx.commitment_hash || "0x",
        transaction_count: bundleTxs.length,
        total_amount: totalAmt,
        currency: firstTx.currency || "USD",
        transaction_ids: bundleTxs.map((t) => t.id),
        receipt_data: {
          receiptId: bundleId,
          receiptNumber: bundleId,
          receiptName: fallbackName,
          createdAt: firstTx.created_at,
          owner: firstTx.user_id,
          transactionCount: bundleTxs.length,
          totalAmount: totalAmt,
          currency: firstTx.currency || "USD",
          transactionIds: bundleTxs.map((t) => t.id),
          transactions: bundleTxs.map((t) => ({
            id: t.id,
            amount: Number(t.amount),
            currency: t.currency || "USD",
            merchant: t.merchant,
            category:
              typeof t.category === "string"
                ? t.category
                : t.category_id || "other",
            date: t.date || t.timestamp,
            type: t.type,
          })),
          version: 1,
        },
        blockchain_status: "confirmed",
        blockchain_tx_hash: firstTx.blockchain_tx_hash || firstTx.monad_tx_hash,
        verification_status: "verified",
        created_at: firstTx.created_at,
        updated_at: firstTx.updated_at,
      };
      setSelectedBundle(fallbackBundle);
    }
  };

  async function handleSaveReceipt(tx: Transaction) {
    if (savingTxId) return;

    if (
      !isWalletConnected ||
      !effectiveConnectedAddress ||
      !/^0x[a-fA-F0-9]{40}$/.test(effectiveConnectedAddress)
    ) {
      setIsNoWalletPopupOpen(true);
      return;
    }

    setSaveError(null);
    setSavingTxId(tx.id);
    setSavingProgressLabel("Validating...");

    const activeWallet =
      auth.activeWallet ||
      auth.externalEvmWallet ||
      auth.embeddedWallet ||
      auth.wallets.find(
        (w) =>
          w.address.toLowerCase() === effectiveConnectedAddress.toLowerCase(),
      );

    try {
      const result = await executeSaveTransaction({
        transactionData: {
          ...tx,
          amount: Number(tx.amount),
          merchant: tx.merchant,
          type: tx.type as "expense" | "income" | "transfer",
        },
        userId: tx.user_id || userId,
        userAddress: effectiveConnectedAddress,
        connectedWallet: activeWallet,
        onStepChange: (_step, label) => {
          setSavingProgressLabel(label);
        },
      });

      if (result.isBlockchainVerified) {
        setSavingProgressLabel("Persisting saved receipt...");
        const normWallet = effectiveConnectedAddress.toLowerCase();
        const singleReceiptId = `receipt_${result.transaction.id.replace(/-/g, "")}`;
        const singleBundle: ReceiptBundle = {
          id: singleReceiptId,
          user_id: normWallet,
          wallet_address: normWallet,
          name: result.transaction.merchant,
          receipt_name: result.transaction.merchant,
          receipt_number: `CR-${new Date().getFullYear()}-${result.transaction.id.slice(0, 4).toUpperCase()}`,
          receipt_hash:
            result.dataHash || result.transaction.blockchain_data_hash || "0x",
          file_hash:
            result.dataHash || result.transaction.blockchain_data_hash || "0x",
          transaction_count: 1,
          total_amount: Number(result.transaction.amount),
          currency: result.transaction.currency || "USD",
          transaction_ids: [result.transaction.id],
          receipt_data: {
            receiptId: singleReceiptId,
            receiptNumber: `CR-${result.transaction.id.slice(0, 4).toUpperCase()}`,
            receiptName: result.transaction.merchant,
            createdAt: result.transaction.created_at,
            owner: normWallet,
            transactionCount: 1,
            totalAmount: Number(result.transaction.amount),
            currency: result.transaction.currency || "USD",
            transactionIds: [result.transaction.id],
            transactions: [
              {
                id: result.transaction.id,
                amount: Number(result.transaction.amount),
                currency: result.transaction.currency || "USD",
                merchant: result.transaction.merchant,
                category: formatCategoryName(
                  result.transaction.category,
                  result.transaction.category_id,
                ),
                date: result.transaction.date || result.transaction.timestamp,
                type: result.transaction.type,
              },
            ],
            version: 1,
          },
          blockchain_network: "Monad Testnet",
          blockchain_status: "confirmed",
          blockchain_tx_hash:
            result.txHash || result.transaction.blockchain_tx_hash || null,
          blockchain_contract_address: CLARIO_REGISTRY_ADDRESS,
          blockchain_chain_id: MONAD_TESTNET_CHAIN_ID,
          monad_block: result.transaction.monad_block || null,
          verification_status: "verified",
          created_at: result.transaction.created_at,
          updated_at: new Date().toISOString(),
        };

        // 1. Persist bundle in server/db first (Authoritative database save)
        const saveRes = await fetch("/api/receipts/bundle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bundle: singleBundle,
            txHash: result.txHash || singleBundle.blockchain_tx_hash,
            blockNumber: result.transaction.monad_block,
            userAddress: normWallet,
            chain: "Monad Testnet",
          }),
        });

        if (!saveRes.ok) {
          const errData = await saveRes.json().catch(() => ({}));
          throw new Error(
            errData.error ||
              `Failed to persist saved receipt (HTTP ${saveRes.status})`,
          );
        }

        const saveData = await saveRes.json();
        if (!saveData.success) {
          throw new Error(
            saveData.error || "Failed to persist saved receipt in database",
          );
        }

        const persistedBundle = saveData.bundle || singleBundle;

        // 2. Only update UI state after successful database persistence
        setReceiptBundles((prev) => ({
          ...prev,
          [persistedBundle.id]: persistedBundle,
        }));

        const updatedTxWithBundle: Transaction = {
          ...result.transaction,
          receipt_bundle_id: persistedBundle.id,
        };

        onUpdateTransaction?.(updatedTxWithBundle);
        setSelectedProofTx(updatedTxWithBundle);
      } else if (result.error) {
        setSaveError(result.error);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to save receipt on Monad";
      setSaveError(msg);
    } finally {
      setSavingTxId(null);
      setSavingProgressLabel("");
    }
  }

  // Local state for interactive Budgets & Subscriptions
  const [prevBudgets, setPrevBudgets] = useState<Budget[]>(budgets);
  const [localBudgets, setLocalBudgets] = useState<Budget[]>(budgets);
  if (budgets !== prevBudgets) {
    setPrevBudgets(budgets);
    if (budgets && budgets.length > 0) setLocalBudgets(budgets);
  }

  const [prevSubscriptions, setPrevSubscriptions] =
    useState<Subscription[]>(subscriptions);
  const [localSubscriptions, setLocalSubscriptions] =
    useState<Subscription[]>(subscriptions);
  if (subscriptions !== prevSubscriptions) {
    setPrevSubscriptions(subscriptions);
    if (subscriptions && subscriptions.length > 0)
      setLocalSubscriptions(subscriptions);
  }

  // Cash flow time period selector: 7D, 30D, 3M, 6M, 1Y
  const [cashFlowPeriod, setCashFlowPeriod] = useState<
    "7D" | "30D" | "3M" | "6M" | "1Y"
  >("30D");

  // Expenses filters & search
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("all");
  const [expenseDateFilter, setExpenseDateFilter] =
    useState<ExpenseDateFilter>("all");
  const [expenseAmountFilter, setExpenseAmountFilter] =
    useState<ExpenseAmountFilter>("all");
  const [expensePaymentFilter, setExpensePaymentFilter] = useState("all");
  const [expenseReceiptFilter, setExpenseReceiptFilter] =
    useState<ExpenseReceiptFilter>("all");
  const [expenseVerificationFilter, setExpenseVerificationFilter] =
    useState<ExpenseVerificationFilter>("all");

  // Income search & filter
  const [incomeSearch, setIncomeSearch] = useState("");

  // Modals for adding budget & subscription
  const [isAddBudgetOpen, setIsAddBudgetOpen] = useState(false);
  const [budgetCategoryInput, setBudgetCategoryInput] = useState("food_dining");
  const [budgetLimitInput, setBudgetLimitInput] = useState("");

  const [isAddSubOpen, setIsAddSubOpen] = useState(false);
  const [subNameInput, setSubNameInput] = useState("");
  const [subAmountInput, setSubAmountInput] = useState("");
  const [subFrequencyInput, setSubFrequencyInput] =
    useState<SubFrequency>("monthly");
  const [subNextBillingInput, setSubNextBillingInput] = useState("");

  // Real metrics from scoped transactions
  const totalIncome = useMemo(() => {
    return activeTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [activeTransactions]);

  const totalExpenses = useMemo(() => {
    return activeTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [activeTransactions]);

  const netCashFlow = totalIncome - totalExpenses;

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const monthlyIncome = useMemo(() => {
    return activeTransactions
      .filter((t) => {
        if (t.type !== "income") return false;
        const d = new Date(t.date || t.timestamp || t.created_at);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [activeTransactions, currentMonth, currentYear]);

  const monthlySpending = useMemo(() => {
    return activeTransactions
      .filter((t) => {
        if (t.type !== "expense") return false;
        const d = new Date(t.date || t.timestamp || t.created_at);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [activeTransactions, currentMonth, currentYear]);

  const totalBudgetLimit = useMemo(() => {
    return localBudgets.reduce(
      (sum, b) => sum + Number(b.amount_limit || 0),
      0,
    );
  }, [localBudgets]);

  const availableBudget = Math.max(0, totalBudgetLimit - monthlySpending);

  const monthlySubscriptionsCost = useMemo(() => {
    return localSubscriptions
      .filter((s) => s.status === "active")
      .reduce((sum, s) => {
        const amt = Number(s.amount || 0);
        if (s.frequency === "yearly") return sum + amt / 12;
        if (s.frequency === "weekly") return sum + amt * 4.33;
        return sum + amt;
      }, 0);
  }, [localSubscriptions]);

  const upcomingBillsTotal = monthlySubscriptionsCost;
  const monthlyRecurringSpend = monthlySubscriptionsCost;
  const yearlyProjectedRecurring = monthlySubscriptionsCost * 12;

  const savingsRate =
    monthlyIncome > 0
      ? Math.max(
          0,
          Math.round(((monthlyIncome - monthlySpending) / monthlyIncome) * 100),
        )
      : totalIncome > totalExpenses && totalIncome > 0
        ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100)
        : 0;

  const categoryTotals = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const tx of activeTransactions) {
      if (tx.type === "expense") {
        const cat = String(tx.category || tx.category_id || "other");
        acc[cat] = (acc[cat] || 0) + Number(tx.amount || 0);
      }
    }
    return acc;
  }, [activeTransactions]);

  const spendingCategoriesWithData = useMemo(() => {
    const list: { slug: string; name: string; amount: number; pct: number }[] =
      [];
    const totalExp = totalExpenses > 0 ? totalExpenses : 1;
    for (const [slug, amount] of Object.entries(categoryTotals)) {
      if (amount > 0) {
        list.push({
          slug,
          name: formatCategoryName(slug, slug),
          amount,
          pct: Math.round((amount / totalExp) * 100),
        });
      }
    }
    return list.sort((a, b) => b.amount - a.amount);
  }, [categoryTotals, totalExpenses]);

  const budgetStatusList = useMemo(() => {
    return localBudgets.map((b) => {
      const catKey = String(
        b.category_id || b.category || "other",
      ).toLowerCase();
      const spent = transactions
        .filter((t) => {
          if (t.type !== "expense") return false;
          const txCat = String(
            t.category_id || t.category || "other",
          ).toLowerCase();
          return (
            txCat === catKey || txCat.includes(catKey) || catKey.includes(txCat)
          );
        })
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      const limit = Number(b.amount_limit || 1);
      const remaining = Math.max(0, limit - spent);
      const pct = Math.min(100, Math.round((spent / limit) * 100));
      const isOver = spent > limit;

      return {
        id: b.id,
        category: formatCategoryName(b.category, b.category_id),
        limit,
        spent,
        remaining,
        pct,
        isOver,
      };
    });
  }, [localBudgets, transactions]);

  // Cash flow chart dynamically driven by time period selector
  const chartData = useMemo(() => {
    const now = new Date();
    const startDate = new Date();
    let numBuckets = 7;
    let formatLabel = (d: Date) =>
      d.toLocaleDateString("en-US", { weekday: "short" });

    if (cashFlowPeriod === "7D") {
      startDate.setDate(now.getDate() - 7);
      numBuckets = 7;
      formatLabel = (d: Date) =>
        d.toLocaleDateString("en-US", { weekday: "short" });
    } else if (cashFlowPeriod === "30D") {
      startDate.setDate(now.getDate() - 30);
      numBuckets = 6;
      formatLabel = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    } else if (cashFlowPeriod === "3M") {
      startDate.setMonth(now.getMonth() - 3);
      numBuckets = 6;
      formatLabel = (d: Date) =>
        d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } else if (cashFlowPeriod === "6M") {
      startDate.setMonth(now.getMonth() - 6);
      numBuckets = 6;
      formatLabel = (d: Date) =>
        d.toLocaleDateString("en-US", { month: "short" });
    } else if (cashFlowPeriod === "1Y") {
      startDate.setFullYear(now.getFullYear() - 1);
      numBuckets = 12;
      formatLabel = (d: Date) =>
        d.toLocaleDateString("en-US", { month: "short" });
    }

    const startTime = startDate.getTime();
    const totalTime = Math.max(1, now.getTime() - startTime);
    const step = totalTime / numBuckets;

    const buckets = Array.from({ length: numBuckets }, (_, i) => {
      const bucketStart = startTime + i * step;
      const bucketEnd = startTime + (i + 1) * step;
      const date = new Date(bucketStart);
      return {
        name: formatLabel(date),
        start: bucketStart,
        end: bucketEnd,
        income: 0,
        expenses: 0,
      };
    });

    for (const tx of activeTransactions) {
      const txTime = new Date(
        tx.date || tx.timestamp || tx.created_at,
      ).getTime();
      if (txTime >= startTime && txTime <= now.getTime()) {
        const bucket =
          buckets.find((b) => txTime >= b.start && txTime <= b.end) ||
          buckets[buckets.length - 1];
        if (bucket) {
          if (tx.type === "income") bucket.income += Number(tx.amount || 0);
          if (tx.type === "expense") bucket.expenses += Number(tx.amount || 0);
        }
      }
    }

    const hasAny = buckets.some((b) => b.income > 0 || b.expenses > 0);
    if (!hasAny && activeTransactions.length > 0) {
      return [
        {
          name: "Period Start",
          income: totalIncome * 0.4,
          expenses: totalExpenses * 0.3,
        },
        {
          name: "Mid Period",
          income: totalIncome * 0.3,
          expenses: totalExpenses * 0.4,
        },
        {
          name: "Current",
          income: totalIncome * 0.3,
          expenses: totalExpenses * 0.3,
        },
      ];
    }

    return buckets.map((b) => ({
      name: b.name,
      income: Number(b.income.toFixed(2)),
      expenses: Number(b.expenses.toFixed(2)),
    }));
  }, [activeTransactions, cashFlowPeriod, totalIncome, totalExpenses]);

  // Filtered expenses for Expenses view
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    return activeTransactions.filter((t) => {
      if (t.type !== "expense") return false;

      // Search filter
      if (expenseSearch.trim()) {
        const q = expenseSearch.toLowerCase();
        const m = (t.merchant || "").toLowerCase();
        const d = (t.description || "").toLowerCase();
        const n = (t.notes || "").toLowerCase();
        if (!m.includes(q) && !d.includes(q) && !n.includes(q)) return false;
      }

      // Category filter
      if (expenseCategoryFilter !== "all") {
        const cat = String(t.category_id || t.category || "").toLowerCase();
        if (!cat.includes(expenseCategoryFilter.toLowerCase())) return false;
      }

      // Date filter
      if (expenseDateFilter !== "all") {
        const txDate = new Date(t.date || t.timestamp || t.created_at);
        const diffDays =
          (now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24);
        if (expenseDateFilter === "7d" && diffDays > 7) return false;
        if (expenseDateFilter === "30d" && diffDays > 30) return false;
        if (
          expenseDateFilter === "month" &&
          (txDate.getMonth() !== now.getMonth() ||
            txDate.getFullYear() !== now.getFullYear())
        )
          return false;
        if (
          expenseDateFilter === "year" &&
          txDate.getFullYear() !== now.getFullYear()
        )
          return false;
      }

      // Amount filter
      const amt = Number(t.amount || 0);
      if (expenseAmountFilter === "under50" && amt >= 50) return false;
      if (expenseAmountFilter === "50to200" && (amt < 50 || amt > 200))
        return false;
      if (expenseAmountFilter === "over200" && amt <= 200) return false;

      // Payment method
      if (expensePaymentFilter !== "all") {
        const pm = (t.payment_method || "card").toLowerCase();
        if (!pm.includes(expensePaymentFilter.toLowerCase())) return false;
      }

      // Receipt status
      if (
        expenseReceiptFilter === "has_receipt" &&
        !t.receipt_id &&
        !t.receipt_bundle_id &&
        !t.proof_hash
      )
        return false;
      if (
        expenseReceiptFilter === "no_receipt" &&
        (t.receipt_id || t.receipt_bundle_id || t.proof_hash)
      )
        return false;

      // Verification status
      if (
        expenseVerificationFilter === "verified" &&
        !t.monad_tx_hash &&
        t.verification_status !== "verified" &&
        t.blockchain_status !== "confirmed"
      )
        return false;
      if (
        expenseVerificationFilter === "unverified" &&
        (t.monad_tx_hash ||
          t.verification_status === "verified" ||
          t.blockchain_status === "confirmed")
      )
        return false;

      return true;
    });
  }, [
    activeTransactions,
    expenseSearch,
    expenseCategoryFilter,
    expenseDateFilter,
    expenseAmountFilter,
    expensePaymentFilter,
    expenseReceiptFilter,
    expenseVerificationFilter,
  ]);

  function handleExportExpensesCSV() {
    const headers = [
      "Date",
      "Merchant",
      "Category",
      "Payment Method",
      "Amount",
      "Currency",
      "Monad Verification",
      "Transaction Hash",
    ];
    const rows = filteredExpenses.map((t) => [
      t.date || t.timestamp?.split("T")[0] || "",
      `"${(t.merchant || "").replace(/"/g, '""')}"`,
      `"${formatCategoryName(t.category, t.category_id)}"`,
      `"${t.payment_method || "Card"}"`,
      t.amount,
      t.currency || "USD",
      t.monad_tx_hash ? "Verified" : "Unanchored",
      t.monad_tx_hash || t.blockchain_tx_hash || "",
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `clario_expenses_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Income analysis
  const incomeTransactions = useMemo(() => {
    return activeTransactions.filter((t) => t.type === "income");
  }, [activeTransactions]);

  const filteredIncome = useMemo(() => {
    if (!incomeSearch.trim()) return incomeTransactions;
    const q = incomeSearch.toLowerCase();
    return incomeTransactions.filter(
      (t) =>
        (t.merchant || "").toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q) ||
        (t.notes || "").toLowerCase().includes(q),
    );
  }, [incomeTransactions, incomeSearch]);

  const largestIncomeTx = useMemo(() => {
    if (incomeTransactions.length === 0) return null;
    return [...incomeTransactions].sort(
      (a, b) => Number(b.amount || 0) - Number(a.amount || 0),
    )[0];
  }, [incomeTransactions]);

  const averageMonthlyIncome = useMemo(() => {
    if (incomeTransactions.length === 0) return 0;
    const uniqueMonths = new Set(
      incomeTransactions.map((t) => {
        const d = new Date(t.date || t.timestamp || t.created_at);
        return `${d.getFullYear()}-${d.getMonth()}`;
      }),
    ).size;
    return totalIncome / Math.max(1, uniqueMonths);
  }, [incomeTransactions, totalIncome]);

  const incomeSourcesBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of incomeTransactions) {
      const src = formatCategoryName(tx.category, tx.category_id);
      map[src] = (map[src] || 0) + Number(tx.amount || 0);
    }
    const total = totalIncome > 0 ? totalIncome : 1;
    return Object.entries(map)
      .map(([name, amt]) => ({
        name,
        amount: amt,
        pct: Math.round((amt / total) * 100),
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [incomeTransactions, totalIncome]);

  // Modal actions
  async function handleCreateBudget(e: React.FormEvent) {
    e.preventDefault();
    if (!budgetLimitInput || isNaN(Number(budgetLimitInput))) return;
    const newBudget: Budget = {
      id: crypto.randomUUID(),
      user_id: userId,
      category_id: budgetCategoryInput,
      amount_limit: Number(budgetLimitInput),
      period: "monthly",
      created_at: new Date().toISOString(),
    };
    setLocalBudgets((prev) => [...prev, newBudget]);
    setIsAddBudgetOpen(false);
    setBudgetLimitInput("");

    try {
      const supabase = getSupabaseClient();
      await supabase.from("budgets").insert(newBudget);
    } catch (err) {
      console.warn("Failed to persist budget:", err);
    }
  }

  async function handleDeleteBudget(budgetId: string) {
    setLocalBudgets((prev) => prev.filter((b) => b.id !== budgetId));
    try {
      const supabase = getSupabaseClient();
      await supabase.from("budgets").delete().eq("id", budgetId);
    } catch (err) {
      console.warn("Failed to delete budget:", err);
    }
  }

  async function handleCreateSubscription(e: React.FormEvent) {
    e.preventDefault();
    if (!subNameInput || !subAmountInput) return;
    const newSub: Subscription = {
      id: crypto.randomUUID(),
      user_id: userId,
      name: subNameInput,
      amount: Number(subAmountInput),
      currency: currencySymbol === "₹" ? "INR" : "USD",
      frequency: subFrequencyInput,
      next_billing_date:
        subNextBillingInput || new Date().toISOString().split("T")[0],
      status: "active",
      created_at: new Date().toISOString(),
    };
    setLocalSubscriptions((prev) => [...prev, newSub]);
    setIsAddSubOpen(false);
    setSubNameInput("");
    setSubAmountInput("");
    setSubNextBillingInput("");

    try {
      const supabase = getSupabaseClient();
      await supabase.from("subscriptions").insert(newSub);
    } catch (err) {
      console.warn("Failed to persist subscription:", err);
    }
  }

  async function handleToggleSubscriptionStatus(subId: string) {
    setLocalSubscriptions((prev) =>
      prev.map((s) => {
        if (s.id !== subId) return s;
        const nextStatus = s.status === "active" ? "paused" : "active";
        return { ...s, status: nextStatus };
      }),
    );
    const sub = localSubscriptions.find((s) => s.id === subId);
    if (sub) {
      try {
        const supabase = getSupabaseClient();
        await supabase
          .from("subscriptions")
          .update({ status: sub.status === "active" ? "paused" : "active" })
          .eq("id", subId);
      } catch (err) {
        console.warn("Failed to update subscription:", err);
      }
    }
  }

  async function handleDeleteSubscription(subId: string) {
    setLocalSubscriptions((prev) => prev.filter((s) => s.id !== subId));
    try {
      const supabase = getSupabaseClient();
      await supabase.from("subscriptions").delete().eq("id", subId);
    } catch (err) {
      console.warn("Failed to delete subscription:", err);
    }
  }

  const hasData = transactions.length > 0;

  return (
    <div className="space-y-8">
      {/* 1. Contextual Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            {subLedger === "fiat" ? (
              <>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-700 bg-white px-2 py-0.5 rounded border border-[#121212] shadow-[1px_1px_0_0_#121212] flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Personal Finance Ledger
                </span>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-[#121212]">
                  100% Private & Off-Chain
                </span>
              </>
            ) : (
              <>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600 bg-white px-2 py-0.5 rounded border border-[#121212] shadow-[1px_1px_0_0_#121212] flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#836EF9] animate-pulse" />
                  Universal Ledger & Proof Spines
                </span>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#836EF9] bg-[#f3f0ff] px-2 py-0.5 rounded border border-[#121212] flex items-center gap-1">
                  <MonadLogo className="h-3 w-3" />
                  Monad Testnet
                </span>
              </>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#121212]">
            {subLedger === "fiat"
              ? "Personal finance"
              : "On-chain activity"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            {subLedger === "fiat"
              ? "Daily spending, cards, recurring bills, and budgets."
              : "Multi-chain transaction indexing and Monad notarizations."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {subLedger === "fiat" ? (
            <>
              <Magnetic range={60} intensity={0.35}>
                <WatermelonButton
                  onClick={onUploadReceipt}
                  variant="secondary"
                  icon={<Receipt className="h-4 w-4 text-[#836EF9]" />}
                  morphText="Scan Receipt"
                />
              </Magnetic>

              <Magnetic range={70} intensity={0.4}>
                <WatermelonButton
                  onClick={() => onAddTransaction?.("fiat")}
                  variant="primary"
                  icon={<Plus className="h-4 w-4" />}
                  morphText="Add Expense"
                />
              </Magnetic>
            </>
          ) : (
            <>
              <Magnetic range={60} intensity={0.35}>
                <WatermelonButton
                  onClick={() => onAddTransaction?.("onchain")}
                  variant="secondary"
                  icon={<MonadLogo className="h-4 w-4" />}
                  morphText="Sync via Alchemy"
                />
              </Magnetic>

              <Magnetic range={70} intensity={0.4}>
                <WatermelonButton
                  onClick={() => onAddTransaction?.("onchain")}
                  variant="primary"
                  icon={<Plus className="h-4 w-4" />}
                  morphText="Add Transaction"
                />
              </Magnetic>
            </>
          )}
        </div>
      </div>

      {/* 2. Two-Tier Sub-Ledger Switcher: Personal Finance (Fiat) vs On-Chain (Web3) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white border border-[#121212]/15 shadow-sm rounded-xl">
        <div className="flex items-center gap-2 p-1 bg-[#f3f4f6] border border-[#121212]/15 rounded-lg">
          <motion.button
            type="button"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setSubLedger("fiat");
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              subLedger === "fiat"
                ? "bg-[#836EF9] text-white border border-[#121212] shadow-[2px_2px_0_0_#121212]"
                : "bg-white text-slate-700 border border-transparent hover:border-[#121212]/20"
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>Personal finance</span>
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setSubLedger("onchain");
              if (
                currentView !== "overview" &&
                currentView !== "expenses" &&
                currentView !== "receipts"
              ) {
                setCurrentView("overview");
                if (onViewChange) onViewChange("overview");
              }
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              subLedger === "onchain"
                ? "bg-[#836EF9] text-white border border-[#121212] shadow-[2px_2px_0_0_#121212]"
                : "bg-white text-slate-700 border border-transparent hover:border-[#121212]/20"
            }`}
          >
            <MonadLogo className="h-3.5 w-3.5" />
            <span>On-chain</span>
          </motion.button>
        </div>

        {/* Dynamic Controls */}
        <div className="flex items-center gap-2.5">
          {subLedger === "fiat" ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">
                Currency:
              </span>
              <div className="flex items-center gap-1.5">
                {[
                  { code: "USD", symbol: "$" },
                  { code: "INR", symbol: "₹" },
                  { code: "EUR", symbol: "€" },
                  { code: "GBP", symbol: "£" },
                ].map((cur) => (
                  <motion.button
                    key={cur.code}
                    type="button"
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setFiatCurrency(cur)}
                    className={`px-2 py-0.5 rounded text-xs font-mono font-bold border transition-all cursor-pointer ${
                      fiatCurrency.code === cur.code
                        ? "bg-[#836EF9] text-white border-[#121212] shadow-[1px_1px_0_0_#121212]"
                        : "bg-white text-slate-700 border-[#121212]/20 hover:bg-[#f3f4f6]"
                    }`}
                  >
                    {cur.code} ({cur.symbol})
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#836EF9] bg-[#f3f0ff] px-2.5 py-1 rounded border border-[#836EF9]/30 flex items-center gap-1.5">
                <MonadLogo className="h-3.5 w-3.5" />
                <span>Monad Testnet</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Primary Mode Navigation Bar: Fixed 4 Tabs */}
      <div className="w-full bg-white border-2 border-[#121212] shadow-[3px_3px_0_0_#121212] rounded-xl p-1.5">
        <nav
          aria-label="Personal Navigation"
          className="grid grid-cols-4 w-full gap-1.5"
        >
          <AnimatedBackground
            defaultValue={currentTab}
            className="bg-[#836EF9] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] rounded-lg"
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 30,
            }}
          >
            {[
              { id: "overview", label: "Overview", icon: LayoutDashboard },
              { id: "expenses", label: "Expenses", icon: TrendingDown },
              { id: "recurring", label: "Recurring & bills", icon: RotateCcw },
              { id: "budgets", label: "Budgets & receipts", icon: ChartNoAxesCombined },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  data-id={tab.id}
                  type="button"
                  onClick={() => {
                    setCurrentView(tab.id as PersonalView);
                    if (onViewChange) onViewChange(tab.id as PersonalView);
                  }}
                  className={`group inline-flex items-center justify-center gap-2 py-2 px-2 rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer text-center ${
                    isActive ? "text-white" : "text-[#121212] hover:bg-[#f3f4f6]"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      isActive ? "text-white" : "text-[#836EF9] group-hover:text-[#7257f8]"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </AnimatedBackground>
        </nav>
      </div>

      {/* ========================================================================= */}
      {/* 1. OVERVIEW VIEW: Exactly 4 Stat Cards */}
      {/* ========================================================================= */}
      {currentTab === "overview" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Spent this month */}
            <div className="border border-[#121212]/15 shadow-sm rounded-xl p-5 bg-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Spent this month
                </span>
                <div className="p-1 rounded-md bg-rose-50 text-rose-600 border border-[#121212]/10">
                  <TrendingDown className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="text-2xl font-bold font-mono text-[#121212] mt-2">
                {activeCurrencySymbol}
                {monthlySpending.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Current month expenses
              </p>
            </div>

            {/* 2. Monthly income */}
            <div className="border border-[#121212]/15 shadow-sm rounded-xl p-5 bg-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Monthly income
                </span>
                <div className="p-1 rounded-md bg-emerald-50 text-emerald-600 border border-[#121212]/10">
                  <TrendingUp className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="text-2xl font-bold font-mono text-[#15803d] mt-2">
                +{activeCurrencySymbol}
                {monthlyIncome.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Current month inflow
              </p>
            </div>

            {/* 3. Net cash flow */}
            <div className="border border-[#121212]/15 shadow-sm rounded-xl p-5 bg-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Net cash flow
                </span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                    netCashFlow >= 0
                      ? "bg-[#dcfce7] text-[#15803d] border-emerald-300"
                      : "bg-[#fee2e2] text-[#b91c1c] border-rose-300"
                  }`}
                >
                  {netCashFlow >= 0 ? "Surplus" : "Deficit"}
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-[#121212] mt-2">
                {netCashFlow >= 0 ? "+" : "-"}
                {activeCurrencySymbol}
                {Math.abs(netCashFlow).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {netCashFlow >= 0 ? "Net positive balance" : "Net negative outflow"}
              </p>
            </div>

            {/* 4. Budget remaining */}
            <div className="border border-[#121212]/15 shadow-sm rounded-xl p-5 bg-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Budget remaining
                </span>
                <div className="p-1 rounded-md bg-[#f3f0ff] text-[#836EF9] border border-[#121212]/10">
                  <ChartNoAxesCombined className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="text-2xl font-bold font-mono text-[#836EF9] mt-2">
                {activeCurrencySymbol}
                {Math.max(0, availableBudget).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {totalBudgetLimit > 0
                  ? `${((monthlySpending / totalBudgetLimit) * 100).toFixed(0)}% of limit used`
                  : "No limit set"}
              </p>
            </div>
          </div>

          {/* Quick Log Personal Expense Bar (Personal Finance Exclusive) */}
          {subLedger === "fiat" && (
            <div className="neo-card p-5 bg-[#fbf9fe] border-2 border-[#121212] shadow-[4px_4px_0_0_#121212]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-[#836EF9] text-white flex items-center justify-center border border-[#121212] shadow-[1px_1px_0_0_#121212]">
                    <Plus className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#121212]">
                    Quick Add Personal Expense
                  </h3>
                  <span className="text-[10px] font-mono font-bold uppercase text-slate-500 bg-white px-2 py-0.5 rounded border border-[#121212]">
                    Zero Friction
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { label: "Cash", icon: Banknote },
                    { label: "UPI", icon: Smartphone },
                    { label: "Credit Card", icon: CreditCard },
                    { label: "Bank Transfer", icon: Building2 },
                  ].map((m) => (
                    <motion.button
                      key={m.label}
                      type="button"
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setQuickPaymentMethod(m.label)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-black uppercase rounded-lg border-2 border-[#121212] transition-all cursor-pointer ${
                        quickPaymentMethod === m.label
                          ? "bg-[#836EF9] text-white shadow-[2px_2px_0_0_#121212]"
                          : "bg-white text-slate-700 shadow-[1.5px_1.5px_0_0_#121212] hover:bg-[#f3f4f6]"
                      }`}
                    >
                      <m.icon className="h-3 w-3" />
                      <span>{m.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              <form
                onSubmit={handleQuickAddSubmit}
                className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center"
              >
                <input
                  type="text"
                  placeholder="Merchant / Purpose (e.g. Starbucks, Groceries, Metro, Gym)"
                  value={quickDesc}
                  onChange={(e) => setQuickDesc(e.target.value)}
                  className="flex-1 neo-input text-xs !py-2"
                  required
                />
                <div className="relative w-full sm:w-44">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-mono font-bold text-slate-500 pointer-events-none">
                    {fiatCurrency.symbol}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={quickAmount}
                    onChange={(e) => setQuickAmount(e.target.value)}
                    className="w-full neo-input !pl-8 text-xs font-mono font-bold !py-2"
                    required
                  />
                </div>
                <WatermelonButton
                  type="submit"
                  variant="primary"
                  size="sm"
                  textMorph
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                  className="!py-2 !px-5 whitespace-nowrap shadow-[3px_3px_0_0_#121212]"
                >
                  Add Expense
                </WatermelonButton>
              </form>
            </div>
          )}

          {/* Cash Flow Dynamics + Subscriptions Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart Column */}
            <div className="lg:col-span-2 neo-card p-6 flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-black uppercase tracking-wider text-[#121212]">
                    Income vs Expenses
                  </h2>
                  <p className="text-xs text-slate-500">
                    Real-time net cash flow across time intervals
                  </p>
                </div>

                {/* Useful Time Period Selector: 7D, 30D, 3M, 6M, 1Y */}
                <div className="flex items-center gap-1 bg-[#f3f4f6] p-1 rounded-lg border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
                  <AnimatedBackground
                    defaultValue={cashFlowPeriod}
                    className="bg-[#836EF9] border border-[#121212] shadow-[1px_1px_0_0_#121212] rounded"
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }}
                  >
                    {(["7D", "30D", "3M", "6M", "1Y"] as const).map(
                      (period) => (
                        <button
                          key={period}
                          data-id={period}
                          type="button"
                          onClick={() => setCashFlowPeriod(period)}
                          className={`px-2.5 py-1 text-[11px] font-mono font-black uppercase rounded transition-colors ${
                            cashFlowPeriod === period
                              ? "text-white"
                              : "text-slate-600 hover:text-[#121212]"
                          }`}
                        >
                          {period}
                        </button>
                      ),
                    )}
                  </AnimatedBackground>
                </div>
              </div>

              <div className="h-64 w-full">
                {hasData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient
                          id="incomeGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#22c55e"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="#22c55e"
                            stopOpacity={0}
                          />
                        </linearGradient>
                        <linearGradient
                          id="expenseGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#ef4444"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="#ef4444"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 2" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="name"
                        stroke="#6b7280"
                        fontSize={11}
                        fontWeight={600}
                      />
                      <YAxis stroke="#6b7280" fontSize={11} fontWeight={600} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          borderColor: "#121212",
                          borderWidth: "2px",
                          borderRadius: "8px",
                          boxShadow: "2px 2px 0 0 #121212",
                          fontSize: "12px",
                          fontWeight: "bold",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="income"
                        stroke="#15803d"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#incomeGrad)"
                        name="Income"
                      />
                      <Area
                        type="monotone"
                        dataKey="expenses"
                        stroke="#b91c1c"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#expenseGrad)"
                        name="Expenses"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-[#121212] rounded-xl p-6 text-center bg-[#f8f9fa]">
                    <AlertCircle className="h-8 w-8 text-slate-400 mb-2" />
                    <p className="text-xs font-black uppercase tracking-wider text-[#121212]">
                      No transaction activity recorded yet
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
                      Add your first income or expense transaction to unlock
                      real-time cash flow analytics.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Subscriptions Panel */}
            <div className="neo-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-black uppercase tracking-wider text-[#121212]">
                    Upcoming Bills
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddSubOpen(true)}
                  className="px-2 py-1 text-[10px] font-black uppercase tracking-wider bg-white hover:bg-[#f3f0ff] text-[#836EF9] border border-[#121212] rounded shadow-[1px_1px_0_0_#121212] flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add</span>
                </button>
              </div>

              {localSubscriptions.length > 0 ? (
                <div className="space-y-3">
                  {localSubscriptions.slice(0, 4).map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-white border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f3f0ff] text-[#836EF9] font-black text-xs border border-[#121212]">
                          {sub.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-wide text-[#121212]">
                            {sub.name}
                          </p>
                          <p className="text-[10px] font-mono text-slate-500">
                            Renews {sub.next_billing_date}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black font-mono text-[#121212]">
                          {currencySymbol}
                          {Number(sub.amount).toFixed(2)}
                        </p>
                        <p className="text-[9px] font-black text-slate-500 uppercase">
                          {sub.frequency}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 flex flex-col items-center justify-center border-2 border-dashed border-[#121212] rounded-xl text-center p-4 bg-[#f8f9fa]">
                  <RotateCcw
                    className="h-6 w-6 text-slate-400 mb-2"
                    aria-hidden="true"
                  />
                  <p className="text-xs font-black uppercase tracking-wider text-[#121212]">
                    No recurring bills
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsAddSubOpen(true)}
                    className="mt-2 px-3 py-1 text-xs font-black uppercase bg-[#836EF9] text-white border border-[#121212] rounded shadow-[2px_2px_0_0_#121212]"
                  >
                    + Add Bill
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Spending Breakdown & Budget Status (Categories with actual data only) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Spending Breakdown */}
            <div className="neo-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-black uppercase tracking-wider text-[#121212]">
                    Spending by Category
                  </h2>
                  <p className="text-xs text-slate-500">
                    Live distribution based on verified ledger records
                  </p>
                </div>
                <span className="neo-badge neo-badge-purple">
                  {spendingCategoriesWithData.length} Categories
                </span>
              </div>

              {spendingCategoriesWithData.length > 0 ? (
                <div className="space-y-3">
                  {spendingCategoriesWithData.slice(0, 6).map((cat) => (
                    <div key={cat.slug} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-[#121212]">
                        <span className="uppercase tracking-wide">
                          {cat.name}
                        </span>
                        <span className="font-mono">
                          {currencySymbol}
                          {cat.amount.toFixed(2)} ({cat.pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2.5 rounded-full border border-[#121212] bg-[#f3f4f6] overflow-hidden">
                        <div
                          className="h-full bg-[#836EF9] transition-all"
                          style={{
                            width: `${Math.min(100, Math.max(5, cat.pct))}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs font-bold text-slate-400 border-2 border-dashed border-[#121212] rounded-xl p-4 bg-[#f8f9fa]">
                  No category spending recorded yet.
                </div>
              )}
            </div>

            {/* Budget Status */}
            <div className="neo-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-black uppercase tracking-wider text-[#121212]">
                    Category Budgets
                  </h2>
                  <p className="text-xs text-slate-500">
                    Monthly spending limits and utilization
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddBudgetOpen(true)}
                  className="px-2 py-1 text-[10px] font-black uppercase tracking-wider bg-white hover:bg-[#f3f0ff] text-[#836EF9] border border-[#121212] rounded shadow-[1px_1px_0_0_#121212] flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  <span>Set Budget</span>
                </button>
              </div>

              {budgetStatusList.length > 0 ? (
                <div className="space-y-4">
                  {budgetStatusList.slice(0, 4).map((b) => (
                    <div
                      key={b.id}
                      className="p-3 rounded-lg border-2 border-[#121212] bg-white shadow-[2px_2px_0_0_#121212]"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase tracking-wider text-[#121212]">
                            {b.category}
                          </span>
                          {b.isOver && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#fee2e2] text-[#b91c1c] border border-[#b91c1c]">
                              OVER BUDGET
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-600">
                          {currencySymbol}
                          {b.spent.toFixed(2)} / {currencySymbol}
                          {b.limit.toFixed(0)}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full border border-[#121212] bg-[#f3f4f6] overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            b.isOver
                              ? "bg-[#b91c1c]"
                              : b.pct > 75
                                ? "bg-[#f59e0b]"
                                : "bg-[#836EF9]"
                          }`}
                          style={{ width: `${Math.min(100, b.pct)}%` }}
                        />
                      </div>
                      <div className="mt-1 flex justify-between text-[10px] font-semibold text-slate-500">
                        <span>{b.pct}% used</span>
                        <span>
                          Remaining: {currencySymbol}
                          {b.remaining.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs font-bold text-slate-400 border-2 border-dashed border-[#121212] rounded-xl p-4 bg-[#f8f9fa]">
                  No active category budgets. Set your first budget limit!
                </div>
              )}
            </div>
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
                onClick={() => {
                  setCurrentView("expenses");
                  if (onViewChange) onViewChange("expenses");
                }}
                className="neo-btn neo-btn-secondary text-[11px] font-black uppercase"
              >
                <span>View All In Ledger</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {activeTransactions.length > 0 ? (
              <div className="divide-y-2 divide-[#121212] border-2 border-[#121212] rounded-lg overflow-hidden bg-white shadow-[2px_2px_0_0_#121212]">
                {activeTransactions.slice(0, 5).map((tx) => {
                  const isExpense = tx.type === "expense";
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
                            className={`text-sm font-black font-mono tracking-tight ${
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
                          <div className="flex items-center justify-end gap-1 mt-0.5">
                            {tx.verification_state === "verified" || tx.verification_state === "anchored_onchain" ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-mono font-black uppercase text-[#15803d] bg-[#dcfce7] px-1.5 py-0.2 rounded border border-[#121212]">
                                <ShieldCheck className="h-2.5 w-2.5 text-[#15803d]" />
                                Monad Verified
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono uppercase text-slate-500 bg-[#f3f4f6] px-1.5 py-0.2 rounded border border-[#121212]">
                                Private Off-Chain
                              </span>
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
                No transactions recorded yet. Add your first transaction or scan
                a receipt!
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* 2. EXPENSES & INCOME VIEW */}
      {/* ========================================================================= */}
      {currentTab === "expenses" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center gap-1.5 p-1 bg-white border border-[#121212]/15 rounded-lg shadow-sm w-fit">
            <button
              type="button"
              onClick={() => setExpenseSubTab("all")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                expenseSubTab === "all"
                  ? "bg-[#836EF9] text-white border border-[#121212] shadow-[1px_1px_0_0_#121212]"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              All transactions
            </button>
            <button
              type="button"
              onClick={() => setExpenseSubTab("expenses")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                expenseSubTab === "expenses"
                  ? "bg-[#836EF9] text-white border border-[#121212] shadow-[1px_1px_0_0_#121212]"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              Expenses
            </button>
            <button
              type="button"
              onClick={() => setExpenseSubTab("income")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                expenseSubTab === "income"
                  ? "bg-[#836EF9] text-white border border-[#121212] shadow-[1px_1px_0_0_#121212]"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              Income
            </button>
          </div>

          {expenseSubTab !== "income" ? (
            <div className="space-y-6">
          {/* Header & Primary Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-black uppercase tracking-wider text-[#121212]">
                Personal Expenses
              </h2>
              <p className="text-xs text-slate-500">
                Filter by category, date, amount, merchant, and Monad
                verification.
              </p>
            </div>

            {/* Actions: Add Expense, Import, Create Receipt, Export */}
            <div className="flex flex-wrap items-center gap-2.5">
              {selectedTxIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(true)}
                  className="neo-btn bg-[#836EF9] text-white hover:bg-[#7257f8]"
                >
                  <Receipt className="h-4 w-4" />
                  <span>Create Receipt ({selectedTxIds.size})</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleExportExpensesCSV}
                className="neo-btn neo-btn-secondary"
                title="Download CSV"
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button>

              {onUploadReceipt && (
                <button
                  type="button"
                  onClick={onUploadReceipt}
                  className="neo-btn neo-btn-secondary"
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
                  onClick={() => onAddTransaction(subLedger)}
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
                Of {activeTransactions.filter((t) => t.type === "expense").length}{" "}
                total expenses
              </p>
            </div>
            <div className="neo-card p-5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                Average Expense
              </span>
              <div className="text-2xl font-black font-mono text-[#836EF9] mt-1">
                {currencySymbol}
                {(
                  totalExpenses /
                  Math.max(
                    1,
                    transactions.filter((t) => t.type === "expense").length,
                  )
                ).toFixed(2)}
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
                  onChange={(e) => setExpenseSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border-2 border-[#121212] rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                />
              </div>

              {/* Category Filter */}
              <NeoSelect
                value={expenseCategoryFilter}
                onChange={setExpenseCategoryFilter}
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
                onChange={(val) => setExpenseDateFilter(val as ExpenseDateFilter)}
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
                onChange={(val) => setExpenseAmountFilter(val as ExpenseAmountFilter)}
                options={[
                  { value: "all", label: "Any Amount" },
                  { value: "under50", label: `Under ${currencySymbol}50` },
                  { value: "50to200", label: `${currencySymbol}50 - ${currencySymbol}200` },
                  { value: "over200", label: `Over ${currencySymbol}200` },
                ]}
              />
            </div>

            {/* Sub-filters row: ToolbarExpandable genuinely reduces UI complexity */}
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
                    onChange={setExpensePaymentFilter}
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
                    onChange={(val) => setExpenseReceiptFilter(val as ExpenseReceiptFilter)}
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
                    onChange={(val) => setExpenseVerificationFilter(val as ExpenseVerificationFilter)}
                    options={[
                      { value: "all", label: "All Monad States" },
                      { value: "verified", label: "Monad Verified (On-Chain)" },
                      { value: "unverified", label: "Unanchored (Off-Chain)" },
                    ]}
                  />

                  <ToolbarToggle className="px-2 py-1 rounded bg-[#836EF9] text-white hover:bg-[#7257f8] border border-[#121212]">
                    Done ✕
                  </ToolbarToggle>
                </ToolbarExpanded>
              </ToolbarExpandable>

              {(expenseSearch ||
                expenseCategoryFilter !== "all" ||
                expenseDateFilter !== "all" ||
                expenseAmountFilter !== "all" ||
                expensePaymentFilter !== "all" ||
                expenseReceiptFilter !== "all" ||
                expenseVerificationFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setExpenseSearch("");
                    setExpenseCategoryFilter("all");
                    setExpenseDateFilter("all");
                    setExpenseAmountFilter("all");
                    setExpensePaymentFilter("all");
                    setExpenseReceiptFilter("all");
                    setExpenseVerificationFilter("all");
                  }}
                  className="text-[10px] font-bold uppercase text-[#836EF9] hover:underline"
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
                        checked={
                          filteredExpenses.length > 0 &&
                          filteredExpenses.every((t) => selectedTxIds.has(t.id))
                        }
                        onChange={() => {
                          const allFilteredSelected = filteredExpenses.every(
                            (t) => selectedTxIds.has(t.id),
                          );
                          if (allFilteredSelected) {
                            setSelectedTxIds(new Set());
                          } else {
                            setSelectedTxIds(
                              new Set(filteredExpenses.map((t) => t.id)),
                            );
                          }
                        }}
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
                      <td
                        colSpan={8}
                        className="py-12 text-center text-slate-500"
                      >
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
                              onChange={() => handleToggleSelect(tx.id)}
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
                          <td className="py-3 px-4 font-mono font-black text-[#b91c1c] text-right">
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
                              onClick={() => setSelectedProofTx(tx)}
                              className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider border border-[#121212] rounded bg-white hover:bg-[#f3f0ff] shadow-[1px_1px_0_0_#121212] transition"
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
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-black uppercase tracking-wider text-[#121212]">
                Personal Income & Earnings
              </h2>
              <p className="text-xs text-slate-500">
                Track salary, freelance contracts, investment dividends, and
                incoming deposits.
              </p>
            </div>
            {onAddTransaction && (
              <WatermelonButton
                type="button"
                variant="primary"
                size="sm"
                textMorph
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => onAddTransaction("fiat")}
              >
                Log Income
              </WatermelonButton>
            )}
          </div>

          {/* 4 KPIs: Total Income, Average Monthly Income, Largest Income Source, Income This Month */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="neo-card p-5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                Total Income
              </span>
              <div className="text-2xl font-black font-mono text-[#15803d] mt-1">
                +{currencySymbol}
                {totalIncome.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                All-time recorded deposits
              </p>
            </div>

            <div className="neo-card p-5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                Average Monthly
              </span>
              <div className="text-2xl font-black font-mono text-[#836EF9] mt-1">
                {currencySymbol}
                {averageMonthlyIncome.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Based on active history
              </p>
            </div>

            <div className="neo-card p-5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                Largest Source
              </span>
              <div className="text-2xl font-black font-mono text-[#121212] mt-1 truncate">
                {largestIncomeTx
                  ? `+${currencySymbol}${Number(largestIncomeTx.amount).toFixed(2)}`
                  : "None"}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 truncate">
                {largestIncomeTx?.merchant || "No inflows recorded"}
              </p>
            </div>

            <div className="neo-card p-5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                Income This Month
              </span>
              <div className="text-2xl font-black font-mono text-[#15803d] mt-1">
                +{currencySymbol}
                {monthlyIncome.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Calendar month to date
              </p>
            </div>
          </div>

          {/* Income Sources Distribution */}
          <div className="neo-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-black uppercase tracking-wider text-[#121212]">
                  Income by Stream
                </h3>
              </div>
              <span className="neo-badge neo-badge-purple">
                {incomeSourcesBreakdown.length} Sources
              </span>
            </div>

            {incomeSourcesBreakdown.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {incomeSourcesBreakdown.map((src) => (
                  <div
                    key={src.name}
                    className="p-3 rounded-lg border-2 border-[#121212] bg-white shadow-[2px_2px_0_0_#121212]"
                  >
                    <div className="flex justify-between text-xs font-bold text-[#121212] mb-1.5">
                      <span className="uppercase tracking-wide">
                        {src.name}
                      </span>
                      <span className="font-mono text-[#15803d]">
                        +{currencySymbol}
                        {src.amount.toFixed(2)} ({src.pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full border border-[#121212] bg-[#f3f4f6] overflow-hidden">
                      <div
                        className="h-full bg-[#15803d] transition-all"
                        style={{
                          width: `${Math.min(100, Math.max(5, src.pct))}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400 font-bold">
                No income stream breakdown available.
              </div>
            )}
          </div>

          {/* Searchable Income Table */}
          <div className="neo-card overflow-hidden">
            <div className="p-4 border-b-2 border-[#121212] bg-[#f9fafb] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#121212]">
                Recorded Income History
              </h3>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by source or notes..."
                  value={incomeSearch}
                  onChange={(e) => setIncomeSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-[#121212] rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#836EF9]"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b-2 border-[#121212] bg-[#f9fafb]">
                    <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                      Date
                    </th>
                    <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                      Source / Payer
                    </th>
                    <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                      Stream Category
                    </th>
                    <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600 text-right">
                      Amount
                    </th>
                    <th className="py-3 px-4 font-black uppercase tracking-wider text-slate-600">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y border-b border-[#121212]">
                  {filteredIncome.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-slate-500 font-semibold"
                      >
                        No income transactions logged yet.
                      </td>
                    </tr>
                  ) : (
                    filteredIncome.map((tx) => (
                      <tr
                        key={tx.id}
                        className="hover:bg-[#f3f0ff]/30 transition"
                      >
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {tx.date || tx.timestamp?.split("T")[0]}
                        </td>
                        <td className="py-3 px-4 font-bold text-[#121212]">
                          {tx.merchant}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-[#dcfce7] text-[#15803d] border border-[#121212]">
                            {formatCategoryName(tx.category, tx.category_id)}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-black text-[#15803d] text-right">
                          +{currencySymbol}
                          {Number(tx.amount).toFixed(2)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[#15803d]">
                            <BadgeCheck
                              className="w-3 h-3 shrink-0"
                              aria-hidden="true"
                            />
                            <span>Cleared</span>
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
)}

      {/* ========================================================================= */}
      {/* 4. BUDGETS & RECEIPTS VIEW */}
      {/* ========================================================================= */}
      {currentTab === "budgets" && (
        <div className="flex items-center gap-1.5 p-1 bg-white border border-[#121212]/15 rounded-lg shadow-sm w-fit mb-6">
          <button
            type="button"
            onClick={() => setBudgetSubTab("budgets")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              budgetSubTab === "budgets"
                ? "bg-[#836EF9] text-white border border-[#121212] shadow-[1px_1px_0_0_#121212]"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Budgets
          </button>
          <button
            type="button"
            onClick={() => {
              setBudgetSubTab("receipts");
              setActiveLedgerTab("receipts");
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              budgetSubTab === "receipts"
                ? "bg-[#836EF9] text-white border border-[#121212] shadow-[1px_1px_0_0_#121212]"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Saved receipts ({verifiedReceipts.length})
          </button>
        </div>
      )}

      {currentTab === "budgets" && budgetSubTab === "budgets" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-black uppercase tracking-wider text-[#121212]">
                Personal Budgets & Spending Limits
              </h2>
              <p className="text-xs text-slate-500">
                Set category thresholds to prevent lifestyle creep and track
                remaining capacity.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddBudgetOpen(true)}
              className="neo-btn neo-btn-primary"
            >
              <Plus className="h-4 w-4" />
              <span>Create Category Budget</span>
            </button>
          </div>

          {/* Monthly Budget Summary Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="neo-card p-4">
              <span className="text-[10px] font-black uppercase text-slate-500">
                Total Monthly Limit
              </span>
              <div className="text-2xl font-black font-mono text-[#121212] mt-1">
                {currencySymbol}
                {totalBudgetLimit.toFixed(2)}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Across {localBudgets.length} budgets
              </p>
            </div>

            <div className="neo-card p-4">
              <span className="text-[10px] font-black uppercase text-slate-500">
                Current Spent
              </span>
              <div className="text-2xl font-black font-mono text-[#b91c1c] mt-1">
                {currencySymbol}
                {monthlySpending.toFixed(2)}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Spent this month
              </p>
            </div>

            <div className="neo-card p-4">
              <span className="text-[10px] font-black uppercase text-slate-500">
                Remaining Buffer
              </span>
              <div className="text-2xl font-black font-mono text-[#836EF9] mt-1">
                {currencySymbol}
                {availableBudget.toFixed(2)}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Left before limit
              </p>
            </div>

            <div className="neo-card p-4">
              <span className="text-[10px] font-black uppercase text-slate-500">
                Overall Utilization
              </span>
              <div className="text-2xl font-black font-mono text-[#121212] mt-1">
                {totalBudgetLimit > 0
                  ? Math.round((monthlySpending / totalBudgetLimit) * 100)
                  : 0}
                %
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Of monthly allowance
              </p>
            </div>
          </div>

          {/* Category Budgets Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {budgetStatusList.length === 0 ? (
              <div className="col-span-full rounded-xl border-2 border-dashed border-[#121212] p-12 text-center bg-white">
                <Layers className="h-10 w-10 text-slate-400 mx-auto mb-2" />
                <h3 className="text-sm font-black uppercase tracking-wider text-[#121212]">
                  No Budgets Configured
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Create category-specific limits to stay in control of outlays.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddBudgetOpen(true)}
                  className="mt-4 neo-btn neo-btn-primary mx-auto"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create First Budget</span>
                </button>
              </div>
            ) : (
              budgetStatusList.map((b) => (
                <div key={b.id} className="neo-card p-5 relative">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-[#121212]">
                        {b.category}
                      </h3>
                      {b.isOver ? (
                        <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-[#fee2e2] text-[#b91c1c] border border-[#b91c1c]">
                          <AlertTriangle className="h-3 w-3" />
                          OVER BUDGET BY {currencySymbol}
                          {(b.spent - b.limit).toFixed(2)}
                        </span>
                      ) : b.pct > 80 ? (
                        <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-[#fef3c7] text-[#d97706] border border-[#d97706]">
                          NEAR LIMIT ({b.pct}%)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-[#ecfdf5] text-[#059669] border border-[#059669]">
                          ON TRACK ({b.pct}%)
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteBudget(b.id)}
                      className="p-1 text-slate-400 hover:text-[#b91c1c] transition"
                      title="Delete budget"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex justify-between text-xs font-mono font-bold text-slate-600 mt-3 mb-1.5">
                    <span>
                      Spent: {currencySymbol}
                      {b.spent.toFixed(2)}
                    </span>
                    <span>
                      Limit: {currencySymbol}
                      {b.limit.toFixed(2)}
                    </span>
                  </div>

                  <div className="w-full h-3 rounded-full border border-[#121212] bg-[#f3f4f6] overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        b.isOver
                          ? "bg-[#b91c1c]"
                          : b.pct > 75
                            ? "bg-[#f59e0b]"
                            : "bg-[#836EF9]"
                      }`}
                      style={{ width: `${Math.min(100, b.pct)}%` }}
                    />
                  </div>

                  <div className="mt-2 flex justify-between text-[11px] font-semibold text-slate-500">
                    <span>{b.pct}% used</span>
                    <span>
                      {b.isOver
                        ? `Exceeded: -${currencySymbol}${(b.spent - b.limit).toFixed(2)}`
                        : `Remaining: ${currencySymbol}${b.remaining.toFixed(2)}`}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. RECURRING DEDICATED VIEW */}
      {/* ========================================================================= */}
      {currentTab === "recurring" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-black uppercase tracking-wider text-[#121212]">
                Active Subscriptions & Recurring Bills
              </h2>
              <p className="text-xs text-slate-500">
                Track renewal dates, frequencies, and projected annualized cash
                burn.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsAddSubOpen(true)}
                className="neo-btn neo-btn-primary"
              >
                <Plus className="h-4 w-4" />
                <span>Add Subscription</span>
              </button>
            </div>
          </div>

          {/* Burn Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="neo-card p-5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                Monthly Burn
              </span>
              <div className="text-2xl font-black font-mono text-[#836EF9] mt-1">
                {currencySymbol}
                {monthlyRecurringSpend.toFixed(2)}/mo
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Current monthly recurring commitment
              </p>
            </div>

            <div className="neo-card p-5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                Yearly Projected Burn
              </span>
              <div className="text-2xl font-black font-mono text-[#121212] mt-1">
                {currencySymbol}
                {yearlyProjectedRecurring.toFixed(2)}/yr
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Annualized subscription cost
              </p>
            </div>

            <div className="neo-card p-5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                Active Services
              </span>
              <div className="text-2xl font-black font-mono text-[#15803d] mt-1">
                {localSubscriptions.filter((s) => s.status === "active").length}{" "}
                Active
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Of {localSubscriptions.length} total tracked
              </p>
            </div>
          </div>

          {/* Subscriptions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {localSubscriptions.length === 0 ? (
              <div className="col-span-full rounded-xl border-2 border-dashed border-[#121212] p-12 text-center bg-white">
                <RotateCcw
                  className="h-10 w-10 text-slate-400 mx-auto mb-2"
                  aria-hidden="true"
                />
                <h3 className="text-sm font-black uppercase tracking-wider text-[#121212]">
                  No Subscriptions Tracked
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Add subscriptions and recurring bills to forecast cash flow
                  accurately.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddSubOpen(true)}
                  className="mt-4 neo-btn neo-btn-primary mx-auto"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add First Subscription</span>
                </button>
              </div>
            ) : (
              localSubscriptions.map((sub) => {
                const isPaused = sub.status === "paused";
                return (
                  <div
                    key={sub.id}
                    className="neo-card p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f3f0ff] text-[#836EF9] font-black text-sm border-2 border-[#121212]">
                            {sub.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="text-sm font-black uppercase tracking-wider text-[#121212]">
                              {sub.name}
                            </h3>
                            <span className="text-[10px] font-black uppercase text-slate-500">
                              Billed {sub.frequency}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border border-[#121212] ${
                            isPaused
                              ? "bg-slate-100 text-slate-600"
                              : "bg-[#dcfce7] text-[#15803d]"
                          }`}
                        >
                          {sub.status}
                        </span>
                      </div>

                      <div className="text-2xl font-black font-mono text-[#121212] mt-4">
                        {currencySymbol}
                        {Number(sub.amount).toFixed(2)}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#121212] space-y-2">
                      {sub.next_billing_date && (
                        <div className="flex justify-between text-xs text-slate-600">
                          <span>Next renewal:</span>
                          <span className="font-mono font-bold text-[#121212]">
                            {sub.next_billing_date}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => handleToggleSubscriptionStatus(sub.id)}
                          className="text-[11px] font-bold text-[#836EF9] hover:underline"
                        >
                          {isPaused ? "Resume" : "Pause"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSubscription(sub.id)}
                          className="text-[11px] font-bold text-slate-400 hover:text-[#b91c1c] transition"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 4. Universal Ledger with Dual Tabs: Transactions & Saved Receipts (Montally Neo-Brutalist Style) */}
      {currentTab === "budgets" && budgetSubTab === "receipts" && (
        <div className="neo-card overflow-hidden">
          {/* Ledger Header with Montally Neo-Brutalist Tabs */}
          <div className="p-5 border-b-2 border-[#121212] bg-[#f9fafb] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="neo-badge neo-badge-purple">
                  • MONAD TESTNET
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
                  {/* Contextual Action Bar when >= 1 transactions selected */}
                  {selectedTxIds.size > 0 && (
                    <div className="mx-5 my-3 p-3 bg-[#fbf9fe] border-2 border-[#121212] rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-[3px_3px_0_0_#121212] animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#836EF9] text-white text-xs font-mono font-black border border-[#121212] shadow-[1px_1px_0_0_#121212]">
                          {selectedTxIds.size}
                        </span>
                        <span className="text-xs font-mono font-black uppercase text-[#121212]">
                          {selectedTxIds.size} selected
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-400">
                          •
                        </span>
                        <span className="text-xs font-mono font-black text-[#121212]">
                          Total {currencySymbol}
                          {selectedTransactionsTotal.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedTxIds(new Set())}
                          className="neo-btn neo-btn-secondary !py-1 !px-3 text-xs font-mono font-bold uppercase"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={handleOpenCreateReceipt}
                          className="neo-btn neo-btn-primary !py-1.5 !px-3.5 text-xs font-mono font-black uppercase flex items-center gap-1.5 shadow-[2px_2px_0_0_#121212]"
                        >
                          <Receipt className="h-3.5 w-3.5" />
                          <span>Create Receipt</span>
                        </button>
                      </div>
                    </div>
                  )}

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
                                    const b =
                                      receiptBundles[t.receipt_bundle_id];
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
                                          {bundleName ||
                                            "Monad Bundle Verified"}
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
                              className={`text-sm font-black font-mono ${
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
                              <button
                                type="button"
                                onClick={() => setSelectedProofTx(t)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-black uppercase rounded-lg border-2 border-[#121212] bg-[#f3f0ff] text-[#836EF9] shadow-[2px_2px_0_0_#121212] hover:bg-[#e7e1fe] transition active:translate-x-[1px] active:translate-y-[1px]"
                                title="Click to view Monad on-chain proof receipt"
                              >
                                <MonadLogo className="h-3 w-3" />
                                <span>View Proof</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSaveReceipt(t)}
                                disabled={savingTxId === t.id}
                                className="neo-btn neo-btn-primary !py-1 !px-2.5 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-[2px_2px_0_0_#121212] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50 ml-auto"
                                title="Create transaction on Monad Testnet and permanently save receipt"
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
                                    <span>Save receipt</span>
                                  </>
                                )}
                              </button>
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
                    an expense manually to start tracking with cryptographic
                    proof.
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
                  /* Empty state when user has 0 total transactions */
                  <div className="py-14 flex flex-col items-center justify-center text-center p-6 bg-[#f8f9fa]">
                    <div className="h-14 w-14 rounded-2xl bg-white flex items-center justify-center mb-3 text-[#836EF9] border-2 border-[#121212] shadow-[3px_3px_0_0_#121212]">
                      <Receipt className="h-7 w-7" />
                    </div>
                    <p className="text-sm font-black uppercase tracking-wider text-[#121212]">
                      NO SAVED RECEIPTS
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      Receipts you save and verify on Monad will appear here.
                    </p>
                    <div className="mt-5 flex flex-wrap justify-center gap-3">
                      <WatermelonButton
                        type="button"
                        variant="primary"
                        size="sm"
                        textMorph
                        leftIcon={<Plus className="h-3.5 w-3.5" />}
                        onClick={() => onAddTransaction?.("fiat")}
                      >
                        LOG EXPENSE
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
                          SCAN RECEIPT WITH AI
                        </WatermelonButton>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Empty state when local transactions exist but none are saved on-chain yet */
                  <div className="py-14 flex flex-col items-center justify-center text-center p-6 bg-[#f8f9fa]">
                    <div className="h-14 w-14 rounded-2xl bg-white flex items-center justify-center mb-3 text-[#836EF9] border-2 border-[#121212] shadow-[3px_3px_0_0_#121212]">
                      <ShieldCheck className="h-7 w-7" />
                    </div>
                    <p className="text-sm font-black uppercase tracking-wider text-[#121212]">
                      NO VERIFIED RECEIPTS YET
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-md">
                      You have {transactions.length} local transaction
                      {transactions.length === 1 ? "" : "s"}, but none have been
                      saved as receipts yet.
                    </p>
                    <div className="mt-5 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setActiveLedgerTab("transactions")}
                        className="neo-btn neo-btn-primary flex items-center gap-1.5 shadow-[2px_2px_0_0_#121212]"
                      >
                        <span>VIEW TRANSACTIONS</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              ) : (
                /* Verified Receipts Table & List */
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
      )}

      {/* Wallet Guard Popup */}
      <AnimatePresence>
        {isNoWalletPopupOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsNoWalletPopupOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="relative z-10 w-full max-w-sm rounded-2xl border-2 border-[#121212] bg-white p-6 shadow-[6px_6px_0_0_#121212] text-[#121212]"
            >
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
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-sm font-bold text-[#121212]">
                  To save this receipt on Monad, connect a wallet to your Clario
                  account.
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Your Clario account remains the permanent owner of all your data
                  and receipts. Connecting an EVM wallet allows you to anchor the
                  cryptographic receipt commitment directly to Monad Testnet.
                </p>
              </div>

              <div className="mt-6 space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsNoWalletPopupOpen(false);
                    handleConnectWallet();
                  }}
                  className="w-full border-2 border-[#121212] bg-[#836EF9] hover:bg-[#725aeb] text-white font-black uppercase text-xs tracking-wider py-3 px-4 rounded-xl shadow-[3px_3px_0_0_#121212] flex items-center justify-center gap-2 transition-all active:translate-x-[1px] active:translate-y-[1px]"
                >
                  <Wallet className="h-4 w-4" />
                  <span>CONNECT WALLET</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsNoWalletPopupOpen(false)}
                  className="w-full border-2 border-[#121212] bg-white hover:bg-[#f9fafb] text-[#121212] font-black uppercase text-xs tracking-wider py-2.5 px-4 rounded-xl shadow-[3px_3px_0_0_#121212] flex items-center justify-center transition-all active:translate-x-[1px] active:translate-y-[1px]"
                >
                  <span>CANCEL</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <TransactionShareModal
        isOpen={!!selectedProofTx}
        onClose={() => setSelectedProofTx(null)}
        transaction={selectedProofTx}
      />

      <ReceiptPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        transactions={selectedTransactions}
        userId={userId}
        userAddress={effectiveConnectedAddress}
        connectedWallet={
          auth.activeWallet ||
          auth.externalEvmWallet ||
          auth.embeddedWallet ||
          auth.wallets.find(
            (w) =>
              w.address.toLowerCase() ===
              (effectiveConnectedAddress || "").toLowerCase(),
          )
        }
        onReceiptCreated={handleReceiptBundleCreated}
        currencySymbol={currencySymbol}
        existingBundles={Object.values(receiptBundles)}
      />

      <ReceiptBundleModal
        isOpen={!!selectedBundle}
        onClose={() => setSelectedBundle(null)}
        bundle={selectedBundle}
        transactions={transactions}
        userAddress={effectiveConnectedAddress}
        onBundleUpdated={(updatedBundle) => {
          setReceiptBundles((prev) => ({
            ...prev,
            [updatedBundle.id]: updatedBundle,
          }));
          setSelectedBundle(updatedBundle);
        }}
      />

      {/* Add Category Budget Modal */}
      <AnimatePresence>
        {isAddBudgetOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsAddBudgetOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="relative z-10 w-full max-w-md bg-white border-2 border-[#121212] rounded-2xl shadow-[6px_6px_0_0_#121212] overflow-hidden"
            >
              <div className="p-4 border-b-2 border-[#121212] bg-[#f9fafb] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-[#121212]">
                    Create Category Budget
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddBudgetOpen(false)}
                  className="p-1 rounded text-slate-400 hover:text-[#121212] transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateBudget} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#121212] mb-1">
                    Budget Category
                  </label>
                  <NeoSelect
                    fullWidth
                    value={budgetCategoryInput}
                    onChange={setBudgetCategoryInput}
                    options={[
                      { value: "food_dining", label: "Food & Dining" },
                      { value: "software_tools", label: "Software & Tools" },
                      { value: "transportation", label: "Transportation" },
                      { value: "utilities", label: "Bills & Utilities" },
                      { value: "housing", label: "Housing & Rent" },
                      { value: "health", label: "Health & Medical" },
                      { value: "shopping", label: "Shopping & Retail" },
                      { value: "education", label: "Education" },
                      { value: "other", label: "General / Other" },
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#121212] mb-1">
                    Monthly Limit ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 500"
                    value={budgetLimitInput}
                    onChange={(e) => setBudgetLimitInput(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-[#121212] rounded-lg text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAddBudgetOpen(false)}
                    className="px-4 py-2 border-2 border-[#121212] rounded-lg text-xs font-black uppercase bg-white hover:bg-[#f3f4f6] transition"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="neo-btn neo-btn-primary">
                    <Plus className="h-4 w-4" />
                    <span>Save Budget</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Subscription / Recurring Bill Modal */}
      <AnimatePresence>
        {isAddSubOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsAddSubOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="relative z-10 w-full max-w-md bg-white border-2 border-[#121212] rounded-2xl shadow-[6px_6px_0_0_#121212] overflow-hidden"
            >
              <div className="p-4 border-b-2 border-[#121212] bg-[#f9fafb] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-[#121212]">
                    Add Subscription / Bill
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddSubOpen(false)}
                  className="p-1 rounded text-slate-400 hover:text-[#121212] transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSubscription} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#121212] mb-1">
                    Service / Provider Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GitHub Copilot, Electricity"
                    value={subNameInput}
                    onChange={(e) => setSubNameInput(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-[#121212] rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-[#121212] mb-1">
                      Amount ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="20.00"
                      value={subAmountInput}
                      onChange={(e) => setSubAmountInput(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-[#121212] rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-[#121212] mb-1">
                      Frequency
                    </label>
                    <NeoSelect
                      fullWidth
                      value={subFrequencyInput}
                      onChange={(val) => setSubFrequencyInput(val as SubFrequency)}
                      options={[
                        { value: "monthly", label: "Monthly" },
                        { value: "yearly", label: "Yearly" },
                        { value: "weekly", label: "Weekly" },
                      ]}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#121212] mb-1">
                    Next Billing Date
                  </label>
                  <NeoDatePicker
                    fullWidth
                    value={subNextBillingInput}
                    onChange={setSubNextBillingInput}
                    placeholder="Select Date"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAddSubOpen(false)}
                    className="px-4 py-2 border-2 border-[#121212] rounded-lg text-xs font-black uppercase bg-white hover:bg-[#f3f4f6] transition"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="neo-btn neo-btn-primary">
                    <Plus className="h-4 w-4" />
                    <span>Save Subscription</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
