"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import type {
  Transaction,
  Subscription,
  Budget,
  FinancialGoal,
  ReceiptBundle,
  PersonalView,
  PlatformMode,
} from "@/lib/supabase/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { executeSaveTransaction } from "@/lib/blockchain/save-transaction";
import { useClarioAuth } from "@/lib/auth/use-clario-auth";
import { formatTransactionDateTime } from "@/lib/import/types";
import { TransactionShareModal } from "./transaction-share-modal";
import { ReceiptPreviewModal } from "./receipt-preview-modal";
import { ReceiptBundleModal } from "./receipt-bundle-modal";
import {
  CLARIO_REGISTRY_ADDRESS,
  MONAD_TESTNET_CHAIN_ID,
} from "@/lib/blockchain/registry";
import {
  getStoredReceiptBundles,
  saveStoredReceiptBundle,
  saveStoredReceiptBundles,
  mergeReceiptBundles,
} from "@/lib/receipts/receipt-client-storage";
import {
  upsertStoredTransaction,
  upsertStoredTransactions,
} from "@/lib/storage/transaction-storage";
import {
  getStoredBudgets,
  saveStoredBudgets,
  getStoredSubscriptions,
  saveStoredSubscriptions,
} from "@/lib/modes/mode-storage";

// Clean Architecture Domain & Application imports
import { formatCategoryName } from "@/domain/analytics/financial-metrics";
import { exportTransactionsToCsv } from "@/domain/transactions/transaction-csv-exporter";
import { usePersonalMetrics } from "@/application/dashboard/use-personal-metrics";
import { useExpenseFilters } from "@/application/dashboard/use-expense-filters";

// Presentation Components & Views
import { PersonalHeader } from "./personal/components/PersonalHeader";
import { SubLedgerSwitcher } from "./personal/components/SubLedgerSwitcher";
import { PersonalNavTabs } from "./personal/components/PersonalNavTabs";
import { PersonalOverviewView } from "./personal/views/PersonalOverviewView";
import { PersonalExpensesView } from "./personal/views/PersonalExpensesView";
import { PersonalIncomeView } from "./personal/views/PersonalIncomeView";
import { PersonalBudgetsView } from "./personal/views/PersonalBudgetsView";
import { PersonalRecurringView } from "./personal/views/PersonalRecurringView";
import { PersonalReceiptsView } from "./personal/views/PersonalReceiptsView";
import { WalletGuardModal } from "./personal/modals/WalletGuardModal";
import { CreateBudgetModal } from "./personal/modals/CreateBudgetModal";
import { AddSubscriptionModal } from "./personal/modals/AddSubscriptionModal";
import type { SubFrequency, DashboardTransaction } from "./personal/types";

export interface PersonalDashboardProps {
  currentMode?: PlatformMode | undefined;
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
  currentMode = "personal",
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
  const [, startTransition] = useTransition();

  if (activeView !== prevActiveView) {
    setPrevActiveView(activeView);
    if (activeView) setCurrentView(activeView);
  }

  const handleTabChange = (view: PersonalView) => {
    startTransition(() => {
      setCurrentView(view);
      onViewChange?.(view);
    });
  };

  const auth = useClarioAuth();
  const effectiveConnectedAddress =
    userAddress || auth.activeWalletAddress || undefined;
  const isWalletConnected = hasConnectedWallet ?? auth.hasAnyWallet;
  const handleConnectWallet = onConnectWallet || auth.connectEvmWallet;

  // Selected state for modals & receipts
  const [selectedProofTx, setSelectedProofTx] = useState<Transaction | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<ReceiptBundle | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [activeLedgerTab, setActiveLedgerTab] = useState<"transactions" | "receipts">("transactions");
  const [isLoadingReceipts, setIsLoadingReceipts] = useState<boolean>(false);
  const [receiptSearchQuery, setReceiptSearchQuery] = useState<string>("");
  const [receiptBundles, setReceiptBundles] = useState<Record<string, ReceiptBundle>>(() => {
    return getStoredReceiptBundles(effectiveConnectedAddress || userId);
  });
  const [savingTxId, setSavingTxId] = useState<string | null>(null);
  const [savingProgressLabel, setSavingProgressLabel] = useState<string>("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isNoWalletPopupOpen, setIsNoWalletPopupOpen] = useState(false);

  // Sub-ledger state (All vs Personal Finance vs On-Chain)
  const [subLedger, setSubLedger] = useState<"all" | "fiat" | "onchain">(
    currentMode === "crypto" ? "onchain" : "all",
  );

  const [fiatCurrency, setFiatCurrency] = useState<{ code: string; symbol: string }>({
    code: "USD",
    symbol: currencySymbol || "$",
  });

  // Helper to distinguish On-Chain vs Fiat
  const isTxOnChain = (t: Transaction): boolean => {
    const pm = (t.payment_method || "").toLowerCase();
    const isExplicitFiat =
      pm.includes("cash") ||
      pm.includes("upi") ||
      pm.includes("credit card") ||
      pm.includes("debit card") ||
      pm.includes("bank transfer") ||
      pm.includes("card");

    if (isExplicitFiat) return false;

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

  const activeTransactions = useMemo(() => {
    return subLedger === "all"
      ? transactions
      : subLedger === "fiat"
        ? fiatTransactions
        : onChainTransactions;
  }, [subLedger, transactions, fiatTransactions, onChainTransactions]);

  const activeCurrencySymbol = subLedger === "onchain" ? "$" : fiatCurrency.symbol;

  // Persistent local budgets & subscriptions
  const [localBudgets, setLocalBudgets] = useState<Budget[]>(() => {
    const stored = getStoredBudgets(userId);
    return stored.length > 0 ? stored : budgets;
  });

  useEffect(() => {
    if (budgets && budgets.length > 0) setLocalBudgets(budgets);
  }, [budgets]);

  const [localSubscriptions, setLocalSubscriptions] = useState<Subscription[]>(() => {
    const stored = getStoredSubscriptions(userId);
    return stored.length > 0 ? stored : subscriptions;
  });

  useEffect(() => {
    if (subscriptions && subscriptions.length > 0) setLocalSubscriptions(subscriptions);
  }, [subscriptions]);

  // Cash flow period
  const [cashFlowPeriod, setCashFlowPeriod] = useState<"7D" | "30D" | "3M" | "6M" | "1Y">("30D");

  // Clean Architecture Domain & Application Metrics hook
  const metrics = usePersonalMetrics({
    activeTransactions,
    localBudgets,
    localSubscriptions,
    cashFlowPeriod,
  });

  // Clean Architecture Filters application hook
  const expenseFilters = useExpenseFilters({ transactions: activeTransactions });

  const displayedTransactions = activeTransactions;

  const latestTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      const timeA = new Date(a.date || a.timestamp || a.created_at || 0).getTime();
      const timeB = new Date(b.date || b.timestamp || b.created_at || 0).getTime();
      return timeB - timeA;
    });
  }, [transactions]);

  // Income analysis
  const incomeTransactions = useMemo(() => {
    return activeTransactions.filter((t) => t.type === "income");
  }, [activeTransactions]);

  const largestIncomeTx = useMemo(() => {
    if (incomeTransactions.length === 0) return null;
    return [...incomeTransactions].sort(
      (a, b) => Number(b.amount || 0) - Number(a.amount || 0),
    )[0] || null;
  }, [incomeTransactions]);

  const averageMonthlyIncome = useMemo(() => {
    if (incomeTransactions.length === 0) return 0;
    const uniqueMonths = new Set(
      incomeTransactions.map((t) => {
        const d = new Date(t.date || t.timestamp || t.created_at);
        return `${d.getFullYear()}-${d.getMonth()}`;
      }),
    ).size;
    return metrics.totalIncome / Math.max(1, uniqueMonths);
  }, [incomeTransactions, metrics.totalIncome]);

  const incomeSourcesBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of incomeTransactions) {
      const src = formatCategoryName(tx.category, tx.category_id);
      map[src] = (map[src] || 0) + Number(tx.amount || 0);
    }
    const total = metrics.totalIncome > 0 ? metrics.totalIncome : 1;
    return Object.entries(map)
      .map(([name, amount]) => ({
        name,
        amount,
        pct: Math.round((amount / total) * 100),
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [incomeTransactions, metrics.totalIncome]);

  // Modals for adding budget & subscription
  const [isAddBudgetOpen, setIsAddBudgetOpen] = useState(false);
  const [budgetCategoryInput, setBudgetCategoryInput] = useState("food_dining");
  const [budgetLimitInput, setBudgetLimitInput] = useState("");

  const [isAddSubOpen, setIsAddSubOpen] = useState(false);
  const [subNameInput, setSubNameInput] = useState("");
  const [subAmountInput, setSubAmountInput] = useState("");
  const [subFrequencyInput, setSubFrequencyInput] = useState<SubFrequency>("monthly");
  const [subNextBillingInput, setSubNextBillingInput] = useState("");

  // Multi-select & Batch Actions
  const isAllSelected =
    displayedTransactions.length > 0 &&
    displayedTransactions.every((t) => selectedTxIds.has(t.id));

  const selectedTransactions = useMemo(
    () => transactions.filter((t) => selectedTxIds.has(t.id)),
    [transactions, selectedTxIds],
  );

  const selectedTransactionsTotal = useMemo(
    () => selectedTransactions.reduce((sum, t) => sum + Number(t.amount || 0), 0),
    [selectedTransactions],
  );

  const handleToggleSelect = (txId: string) => {
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(txId)) next.delete(txId);
      else next.add(txId);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (isAllSelected) setSelectedTxIds(new Set());
    else setSelectedTxIds(new Set(displayedTransactions.map((t) => t.id)));
  };

  const handleCreateReceiptForSelected = () => {
    if (selectedTxIds.size === 0) return;
    if (selectedTransactions.length === 1 && selectedTransactions[0]) {
      setSelectedProofTx(selectedTransactions[0]);
    } else {
      setIsPreviewOpen(true);
    }
  };

  const handleBatchSaveOnChain = async () => {
    if (selectedTxIds.size === 0) return;
    if (
      !isWalletConnected ||
      !effectiveConnectedAddress ||
      !/^0x[a-fA-F0-9]{40}$/.test(effectiveConnectedAddress)
    ) {
      setIsNoWalletPopupOpen(true);
      return;
    }
    if (selectedTransactions.length === 1 && selectedTransactions[0]) {
      await handleSaveReceipt(selectedTransactions[0]);
    } else {
      setIsPreviewOpen(true);
    }
  };

  // Load bundles from remote API
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

  // Load verified receipts for authenticated account
  useEffect(() => {
    let ignore = false;
    async function loadVerifiedReceipts() {
      const walletOrUser = effectiveConnectedAddress || userId;
      const initialStored = getStoredReceiptBundles(walletOrUser);
      if (Object.keys(initialStored).length > 0 && !ignore) {
        setReceiptBundles((prev) => mergeReceiptBundles(prev, initialStored));
      }

      if (!auth.isReady) {
        setIsLoadingReceipts(true);
        return;
      }

      if (
        !effectiveConnectedAddress ||
        !/^0x[a-fA-F0-9]{40}$/.test(effectiveConnectedAddress)
      ) {
        setIsLoadingReceipts(false);
        return;
      }

      setIsLoadingReceipts(true);
      try {
        const normAddr = effectiveConnectedAddress.toLowerCase();
        const localBundles = getStoredReceiptBundles(normAddr);
        if (Object.keys(localBundles).length > 0 && !ignore) {
          setReceiptBundles((prev) => mergeReceiptBundles(prev, localBundles));
        }

        const queryParams = new URLSearchParams();
        queryParams.set("userAddress", normAddr);
        queryParams.set("verifiedOnly", "true");

        const res = await fetch(`/api/receipts/bundle?${queryParams.toString()}`);
        const data = await res.json();
        if (!ignore && data.success && Array.isArray(data.bundles)) {
          const map: Record<string, ReceiptBundle> = {};
          for (const b of data.bundles as ReceiptBundle[]) {
            map[b.id] = b;
          }
          setReceiptBundles((prev) => {
            const merged = mergeReceiptBundles(prev, map);
            saveStoredReceiptBundles(merged, normAddr);
            return merged;
          });
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
  }, [auth.isReady, effectiveConnectedAddress, userId]);

  // Compute verified receipts list
  const verifiedReceipts = useMemo(() => {
    const verifiedBundles = Object.values(receiptBundles).filter((b) => {
      return (
        (b.verification_status === "verified" || b.blockchain_status === "confirmed") &&
        Boolean(b.blockchain_tx_hash) &&
        b.blockchain_status !== "failed"
      );
    });

    const standaloneConfirmedTxs = transactions.filter(
      (t) =>
        (t.blockchain_status === "confirmed" ||
          t.verification_state === "verified" ||
          t.verification_status === "verified") &&
        Boolean(t.blockchain_tx_hash || t.monad_tx_hash) &&
        t.blockchain_status !== "failed" &&
        (!t.receipt_bundle_id || !receiptBundles[t.receipt_bundle_id]),
    );

    const synthesizedBundles: ReceiptBundle[] = standaloneConfirmedTxs.map((t) => {
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
    });

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
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
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
      return name.includes(q) || num.includes(q) || tx.includes(q) || wallet.includes(q);
    });
  }, [verifiedReceipts, receiptSearchQuery]);

  const handleReceiptBundleCreated = (bundle: ReceiptBundle) => {
    const walletOrUser = effectiveConnectedAddress || userId;
    saveStoredReceiptBundle(bundle, walletOrUser);
    setReceiptBundles((prev) => ({ ...prev, [bundle.id]: bundle }));
    setSelectedTxIds(new Set());
    setActiveLedgerTab("receipts");

    const updatedTxs: Transaction[] = [];

    if (
      Array.isArray(bundle.receipt_data?.transactions) &&
      bundle.receipt_data.transactions.length > 0
    ) {
      for (const t of bundle.receipt_data.transactions) {
        if (!t || !t.id) continue;
        const existing = transactions.find((ex) => ex.id === t.id);
        const fullTx: Transaction = {
          ...(existing || {}),
          id: t.id,
          user_id:
            existing?.user_id ||
            bundle.user_id ||
            bundle.wallet_address ||
            walletOrUser ||
            "user_default",
          type:
            (t.type as "expense" | "income" | "transfer") ||
            existing?.type ||
            "expense",
          amount: Number(t.amount) || existing?.amount || 0,
          currency: t.currency || existing?.currency || bundle.currency || "USD",
          merchant: t.merchant || existing?.merchant || bundle.name || "Expense",
          description: t.merchant || existing?.description || bundle.name || "Expense",
          category: t.category || existing?.category || "other",
          category_id: t.category || existing?.category_id || "other",
          date:
            t.date ||
            existing?.date ||
            bundle.created_at?.slice(0, 10) ||
            new Date().toISOString().slice(0, 10),
          timestamp:
            t.date || existing?.timestamp || bundle.created_at || new Date().toISOString(),
          payment_method: existing?.payment_method || "Onchain (Monad)",
          receipt_bundle_id: bundle.id,
          verification_state: "verified",
          verification_status: "verified",
          blockchain_status: "confirmed",
          blockchain_tx_hash: bundle.blockchain_tx_hash || null,
          monad_tx_hash: bundle.blockchain_tx_hash || null,
          blockchain_data_hash: bundle.receipt_hash,
          monad_block: bundle.monad_block || null,
          status: "cleared",
          source: "onchain_monad",
          version: 1,
          created_at: existing?.created_at || bundle.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        updatedTxs.push(fullTx);
        onUpdateTransaction?.(fullTx);
      }
    } else if (Array.isArray(bundle.transaction_ids)) {
      for (const txId of bundle.transaction_ids) {
        const existing = transactions.find((t) => t.id === txId);
        if (existing) {
          const updated: Transaction = {
            ...existing,
            receipt_bundle_id: bundle.id,
            verification_state: "verified",
            verification_status: "verified",
            blockchain_status: "confirmed",
            blockchain_tx_hash: bundle.blockchain_tx_hash || null,
            monad_tx_hash: bundle.blockchain_tx_hash || null,
            blockchain_data_hash: bundle.receipt_hash,
            monad_block: bundle.monad_block || null,
            updated_at: new Date().toISOString(),
          };
          updatedTxs.push(updated);
          onUpdateTransaction?.(updated);
        }
      }
    }

    if (updatedTxs.length > 0) {
      upsertStoredTransactions(updatedTxs, walletOrUser);
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
      const res = await fetch(`/api/receipts/bundle?receiptId=${bundleId}${addrQuery}`);
      const data = await res.json();
      if (data.success && data.bundle) {
        setReceiptBundles((prev) => ({ ...prev, [bundleId]: data.bundle }));
        setSelectedBundle(data.bundle);
        return;
      }
    } catch (e) {
      console.warn("Notice: bundle fetch fallback:", e);
    }

    const bundleTxs = transactions.filter((t) => t.receipt_bundle_id === bundleId);
    if (bundleTxs.length > 0) {
      const firstTx = bundleTxs[0]!;
      const totalAmt = bundleTxs.reduce((s, t) => s + Number(t.amount), 0);
      const fallbackName = `Receipt Bundle #${bundleId.startsWith("CR-") ? bundleId : bundleId.slice(0, 8).toUpperCase()}`;
      const fallbackBundle: ReceiptBundle = {
        id: bundleId,
        user_id: firstTx.user_id || userId,
        name: fallbackName,
        receipt_name: fallbackName,
        receipt_number: bundleId.startsWith("CR-") ? bundleId : `CR-${bundleId.slice(0, 8).toUpperCase()}`,
        file_hash: firstTx.blockchain_data_hash || firstTx.commitment_hash || "0x",
        receipt_hash: firstTx.blockchain_data_hash || firstTx.commitment_hash || "0x",
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
            category: typeof t.category === "string" ? t.category : t.category_id || "other",
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
        (w) => w.address.toLowerCase() === effectiveConnectedAddress.toLowerCase(),
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
          receipt_hash: result.dataHash || result.transaction.blockchain_data_hash || "0x",
          file_hash: result.dataHash || result.transaction.blockchain_data_hash || "0x",
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
          blockchain_tx_hash: result.txHash || result.transaction.blockchain_tx_hash || null,
          blockchain_contract_address: CLARIO_REGISTRY_ADDRESS,
          blockchain_chain_id: MONAD_TESTNET_CHAIN_ID,
          monad_block: result.transaction.monad_block || null,
          verification_status: "verified",
          created_at: result.transaction.created_at,
          updated_at: new Date().toISOString(),
        };

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
            errData.error || `Failed to persist saved receipt (HTTP ${saveRes.status})`,
          );
        }

        const saveData = await saveRes.json();
        if (!saveData.success) {
          throw new Error(saveData.error || "Failed to persist saved receipt in database");
        }

        const persistedBundle = saveData.bundle || singleBundle;
        saveStoredReceiptBundle(persistedBundle, normWallet);
        setReceiptBundles((prev) => ({
          ...prev,
          [persistedBundle.id]: persistedBundle,
        }));

        const updatedTxWithBundle: Transaction = {
          ...result.transaction,
          receipt_bundle_id: persistedBundle.id,
        };

        upsertStoredTransaction(updatedTxWithBundle, normWallet);
        onUpdateTransaction?.(updatedTxWithBundle);
        setSelectedProofTx(updatedTxWithBundle);
      } else if (result.error) {
        setSaveError(result.error);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save receipt on Monad";
      setSaveError(msg);
    } finally {
      setSavingTxId(null);
      setSavingProgressLabel("");
    }
  }

  // Budget & Subscription mutations
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
    setLocalBudgets((prev) => {
      const updated = [...prev, newBudget];
      saveStoredBudgets(updated, userId);
      return updated;
    });
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
    setLocalBudgets((prev) => {
      const updated = prev.filter((b) => b.id !== budgetId);
      saveStoredBudgets(updated, userId);
      return updated;
    });
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
      next_billing_date: subNextBillingInput || new Date().toISOString().split("T")[0]!,
      status: "active",
      created_at: new Date().toISOString(),
    };
    setLocalSubscriptions((prev) => {
      const updated = [...prev, newSub];
      saveStoredSubscriptions(updated, userId);
      return updated;
    });
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
    setLocalSubscriptions((prev) => {
      const updated = prev.map((s) => {
        if (s.id !== subId) return s;
        const nextStatus: Subscription["status"] =
          s.status === "active" ? "paused" : "active";
        return { ...s, status: nextStatus };
      });
      saveStoredSubscriptions(updated, userId);
      return updated;
    });
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
    setLocalSubscriptions((prev) => {
      const updated = prev.filter((s) => s.id !== subId);
      saveStoredSubscriptions(updated, userId);
      return updated;
    });
    try {
      const supabase = getSupabaseClient();
      await supabase.from("subscriptions").delete().eq("id", subId);
    } catch (err) {
      console.warn("Failed to delete subscription:", err);
    }
  }

  const hasData = displayedTransactions.length > 0;
  const totalExpensesCount = activeTransactions.filter((t) => t.type === "expense" || !t.type).length;
  const totalIncomeCount = activeTransactions.filter((t) => t.type === "income").length;

  return (
    <div className="space-y-8">
      {/* 1. Contextual Header & Quick Actions */}
      <PersonalHeader
        subLedger={subLedger}
        onAddTransaction={onAddTransaction}
        onUploadReceipt={onUploadReceipt}
      />

      {/* 2. Sub-Ledger Switcher: All Activity vs Personal Finance (Fiat) vs On-Chain (Web3) */}
      <SubLedgerSwitcher
        subLedger={subLedger}
        onSubLedgerChange={setSubLedger}
        fiatCurrency={fiatCurrency}
        onCurrencyChange={setFiatCurrency}
      />

      {/* 3. Neo-Brutalist View Navigation Tabs */}
      <PersonalNavTabs
        subLedger={subLedger}
        currentView={currentView}
        onViewSelect={handleTabChange}
        counts={{
          expenses: totalExpensesCount,
          income: totalIncomeCount,
          budgets: localBudgets.length,
          recurring: localSubscriptions.length,
          receipts: verifiedReceipts.length,
          onchain: onChainTransactions.length,
        }}
      />

      {/* VIEW 1: OVERVIEW TAB */}
      {currentView === "overview" && (
        <PersonalOverviewView
          subLedger={subLedger}
          netCashFlow={metrics.netCashFlow}
          activeCurrencySymbol={activeCurrencySymbol}
          currencySymbol={currencySymbol}
          currencyCode={fiatCurrency.code}
          userId={userId}
          monthlyIncome={metrics.monthlyIncome}
          monthlySpending={metrics.monthlySpending}
          availableBudget={metrics.availableBudget}
          totalBudgetLimit={metrics.totalBudgetLimit}
          upcomingBillsTotal={metrics.upcomingBillsTotal}
          activeSubscriptionsCount={localSubscriptions.filter((s) => s.status === "active").length}
          savingsRate={metrics.savingsRate}
          onAddExpense={onUpdateTransaction}
          chartData={metrics.chartData}
          cashFlowPeriod={cashFlowPeriod}
          onPeriodChange={setCashFlowPeriod}
          hasData={hasData}
          localSubscriptions={localSubscriptions}
          onOpenAddSubscription={() => setIsAddSubOpen(true)}
          spendingCategories={metrics.spendingCategoriesWithData}
          budgetStatuses={metrics.budgetStatusList}
          onOpenCreateBudget={() => setIsAddBudgetOpen(true)}
          latestTransactions={latestTransactions}
          onNavigateToExpenses={() => handleTabChange("expenses")}
          onSelectProofTx={setSelectedProofTx}
          onSaveReceipt={handleSaveReceipt}
          savingTxId={savingTxId}
          savingProgressLabel={savingProgressLabel}
        />
      )}

      {/* VIEW 2: EXPENSES TAB */}
      {currentView === "expenses" && (
        <PersonalExpensesView
          subLedger={subLedger}
          currencySymbol={activeCurrencySymbol}
          totalExpenses={metrics.totalExpenses}
          filteredExpenses={expenseFilters.filteredExpenses}
          activeTransactionsCount={activeTransactions.length}
          totalExpensesCount={totalExpensesCount}
          selectedTxIds={selectedTxIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          isAllSelected={isAllSelected}
          onCreateReceiptForSelected={handleCreateReceiptForSelected}
          onBatchSaveOnChain={handleBatchSaveOnChain}
          onExportExpensesCSV={() => exportTransactionsToCsv(expenseFilters.filteredExpenses)}
          onUploadReceipt={onUploadReceipt}
          onAddTransaction={onAddTransaction}
          onSelectProofTx={setSelectedProofTx}
          expenseSearch={expenseFilters.expenseSearch}
          onSearchChange={expenseFilters.setExpenseSearch}
          expenseCategoryFilter={expenseFilters.expenseCategoryFilter}
          onCategoryFilterChange={expenseFilters.setExpenseCategoryFilter}
          expenseDateFilter={expenseFilters.expenseDateFilter}
          onDateFilterChange={expenseFilters.setExpenseDateFilter}
          expenseAmountFilter={expenseFilters.expenseAmountFilter}
          onAmountFilterChange={expenseFilters.setExpenseAmountFilter}
          expensePaymentFilter={expenseFilters.expensePaymentFilter}
          onPaymentFilterChange={expenseFilters.setExpensePaymentFilter}
          expenseReceiptFilter={expenseFilters.expenseReceiptFilter}
          onReceiptFilterChange={expenseFilters.setExpenseReceiptFilter}
          expenseVerificationFilter={expenseFilters.expenseVerificationFilter}
          onVerificationFilterChange={expenseFilters.setExpenseVerificationFilter}
          onResetFilters={expenseFilters.resetFilters}
        />
      )}

      {/* VIEW 3: INCOME TAB */}
      {currentView === "income" && (
        <PersonalIncomeView
          currencySymbol={activeCurrencySymbol}
          totalIncome={metrics.totalIncome}
          averageMonthlyIncome={averageMonthlyIncome}
          largestIncomeTx={largestIncomeTx}
          monthlyIncome={metrics.monthlyIncome}
          incomeSourcesBreakdown={incomeSourcesBreakdown}
          incomeTransactions={incomeTransactions}
          onAddTransaction={onAddTransaction}
          onSelectProofTx={setSelectedProofTx}
          onSaveReceipt={handleSaveReceipt}
          savingTxId={savingTxId}
        />
      )}

      {/* VIEW 4: BUDGETS TAB */}
      {currentView === "budgets" && (
        <PersonalBudgetsView
          currencySymbol={activeCurrencySymbol}
          totalBudgetLimit={metrics.totalBudgetLimit}
          monthlySpending={metrics.monthlySpending}
          availableBudget={metrics.availableBudget}
          budgetsCount={localBudgets.length}
          budgetStatusList={metrics.budgetStatusList}
          onOpenCreateBudget={() => setIsAddBudgetOpen(true)}
          onDeleteBudget={handleDeleteBudget}
        />
      )}

      {/* VIEW 5: RECURRING BILLS TAB */}
      {currentView === "recurring" && (
        <PersonalRecurringView
          currencySymbol={activeCurrencySymbol}
          monthlyRecurringSpend={metrics.monthlyRecurringSpend}
          yearlyProjectedRecurring={metrics.yearlyProjectedRecurring}
          localSubscriptions={localSubscriptions}
          onOpenAddSubscription={() => setIsAddSubOpen(true)}
          onToggleSubscriptionStatus={handleToggleSubscriptionStatus}
          onDeleteSubscription={handleDeleteSubscription}
        />
      )}

      {/* VIEW 6: UNIVERSAL LEDGER & SAVED RECEIPTS */}
      <PersonalReceiptsView
        currentView={currentView}
        activeLedgerTab={activeLedgerTab}
        setActiveLedgerTab={setActiveLedgerTab}
        transactions={activeTransactions}
        verifiedReceipts={verifiedReceipts}
        filteredVerifiedReceipts={filteredVerifiedReceipts}
        displayedTransactions={displayedTransactions}
        hasData={hasData}
        saveError={saveError}
        setSaveError={setSaveError}
        selectedTxIds={selectedTxIds}
        setSelectedTxIds={setSelectedTxIds}
        selectedTransactionsTotal={selectedTransactionsTotal}
        isAllSelected={isAllSelected}
        handleSelectAll={handleSelectAll}
        handleToggleSelect={handleToggleSelect}
        handleCreateReceiptForSelected={handleCreateReceiptForSelected}
        handleBatchSaveOnChain={handleBatchSaveOnChain}
        currencySymbol={activeCurrencySymbol}
        formatTransactionDateTime={formatTransactionDateTime}
        formatCategoryName={formatCategoryName}
        receiptBundles={receiptBundles}
        savingTxId={savingTxId}
        savingProgressLabel={savingProgressLabel}
        handleSaveReceipt={handleSaveReceipt}
        setSelectedProofTx={setSelectedProofTx}
        handleViewBundle={handleViewBundle}
        onUploadReceipt={onUploadReceipt}
        onAddTransaction={onAddTransaction}
        subLedger={subLedger}
        isLoadingReceipts={isLoadingReceipts}
        receiptSearchQuery={receiptSearchQuery}
        setReceiptSearchQuery={setReceiptSearchQuery}
        effectiveConnectedAddress={effectiveConnectedAddress || null}
      />

      {/* MODALS */}
      <WalletGuardModal
        isOpen={isNoWalletPopupOpen}
        onClose={() => setIsNoWalletPopupOpen(false)}
        onConnectWallet={() => {
          setIsNoWalletPopupOpen(false);
          handleConnectWallet();
        }}
      />

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
        currencySymbol={activeCurrencySymbol}
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

      <CreateBudgetModal
        isOpen={isAddBudgetOpen}
        onClose={() => setIsAddBudgetOpen(false)}
        onSubmit={handleCreateBudget}
        budgetCategoryInput={budgetCategoryInput}
        setBudgetCategoryInput={setBudgetCategoryInput}
        budgetLimitInput={budgetLimitInput}
        setBudgetLimitInput={setBudgetLimitInput}
        currencySymbol={activeCurrencySymbol}
      />

      <AddSubscriptionModal
        isOpen={isAddSubOpen}
        onClose={() => setIsAddSubOpen(false)}
        onSubmit={handleCreateSubscription}
        subNameInput={subNameInput}
        setSubNameInput={setSubNameInput}
        subAmountInput={subAmountInput}
        setSubAmountInput={setSubAmountInput}
        subFrequencyInput={subFrequencyInput}
        setSubFrequencyInput={setSubFrequencyInput}
        subNextBillingInput={subNextBillingInput}
        setSubNextBillingInput={setSubNextBillingInput}
        currencySymbol={activeCurrencySymbol}
      />
    </div>
  );
}
