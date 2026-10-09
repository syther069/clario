"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ModeHeader } from "@/components/layout/mode-header";
import { ReceiptUploadModal } from "@/components/dashboard/receipt-upload-modal";
import { ReceiptBundleModal } from "@/components/dashboard/receipt-bundle-modal";
import {
  Receipt,
  UploadCloud,
  Search,
  ShieldCheck,
  FileText,
  Calendar,
  ExternalLink,
  Loader2,
  Eye,
} from "lucide-react";
import type {
  PlatformMode,
  Transaction,
  ReceiptBundle,
} from "@/lib/supabase/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useClarioAuth } from "@/lib/auth/use-clario-auth";
import {
  CLARIO_REGISTRY_ADDRESS,
  MONAD_TESTNET_CHAIN_ID,
  getMonadExplorerTxUrl,
} from "@/lib/blockchain/registry";
import { MonadLogo } from "@/components/ui/crypto-icon";
import { AnimatedBackground } from "@/components/ui/motion/animated-background";
import { Magnetic } from "@/components/ui/motion/magnetic";
import { WatermelonButton } from "@/components/ui/watermelon-button";
import { WatermelonAlert } from "@/components/ui/watermelon-alert";
import { TransactionShareModal } from "@/components/dashboard/transaction-share-modal";
import { getStoredReceiptBundles } from "@/lib/receipts/receipt-client-storage";
import { getStoredTransactions } from "@/lib/storage/transaction-storage";

export default function ReceiptsPage() {
  const router = useRouter();
  const { user, connectedEvmAddress } = useClarioAuth();
  const userId = user?.id || "demo_user";
  const [activeMode, setActiveMode] = useState<PlatformMode>("personal");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [receiptBundles, setReceiptBundles] = useState<ReceiptBundle[]>([]);
  const [selectedBundle, setSelectedBundle] = useState<ReceiptBundle | null>(
    null,
  );
  const [selectedShareTx, setSelectedShareTx] = useState<Transaction | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load strictly verified receipts from the API and Supabase
  useEffect(() => {
    let ignore = false;
    async function loadVerifiedReceipts() {
      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (userId) queryParams.set("userId", userId);
        if (connectedEvmAddress)
          queryParams.set("userAddress", connectedEvmAddress);
        queryParams.set("verifiedOnly", "true");

        const effectiveUser = connectedEvmAddress || userId;
        const supabaseClient = getSupabaseClient(effectiveUser);
        let txQuery = supabaseClient
          .from("transactions")
          .select("*")
          .or("verification_status.eq.verified,blockchain_status.eq.confirmed");

        if (effectiveUser) {
          const userFilters = [`user_id.eq.${effectiveUser}`];
          if (userId && userId !== effectiveUser) {
            userFilters.push(`user_id.eq.${userId}`);
          }
          if (connectedEvmAddress && connectedEvmAddress !== effectiveUser) {
            userFilters.push(`user_id.eq.${connectedEvmAddress}`);
          }
          txQuery = txQuery.or(userFilters.join(","));
        }

        const [apiRes, supabaseRes] = await Promise.all([
          fetch(`/api/receipts/bundle?${queryParams.toString()}`),
          txQuery,
        ]);

        const apiData = await apiRes.json();
        const loadedBundles: ReceiptBundle[] = [];
        const seenBundleIds = new Set<string>();

        // 1. Incorporate local stored verified bundles
        const localStoredBundles = getStoredReceiptBundles(effectiveUser);
        for (const b of Object.values(localStoredBundles)) {
          if (
            (b.verification_status === "verified" ||
              b.blockchain_status === "confirmed") &&
            Boolean(b.blockchain_tx_hash) &&
            b.blockchain_status !== "failed"
          ) {
            seenBundleIds.add(b.id);
            loadedBundles.push(b);
          }
        }

        if (apiData.success && Array.isArray(apiData.bundles)) {
          // Strictly filter confirmed on-chain receipts
          for (const b of apiData.bundles as ReceiptBundle[]) {
            if (
              (b.verification_status === "verified" ||
                b.blockchain_status === "confirmed") &&
              Boolean(b.blockchain_tx_hash) &&
              b.blockchain_status !== "failed" &&
              !seenBundleIds.has(b.id)
            ) {
              seenBundleIds.add(b.id);
              loadedBundles.push(b);
            }
          }
        }

        // Also check standalone confirmed transactions from Supabase and local storage
        const localStoredTxs = getStoredTransactions(effectiveUser);
        const combinedCandidateTxs: Transaction[] = [
          ...localStoredTxs,
          ...(Array.isArray(supabaseRes.data) ? (supabaseRes.data as Transaction[]) : []),
        ];

        const standaloneConfirmed = combinedCandidateTxs.filter(
          (t) =>
            (t.blockchain_status === "confirmed" ||
              t.verification_status === "verified" ||
              t.verification_state === "verified") &&
            Boolean(t.blockchain_tx_hash || t.monad_tx_hash) &&
            t.blockchain_status !== "failed",
        );

          const seenHashes = new Set(
            loadedBundles
              .map((b) => b.blockchain_tx_hash?.toLowerCase())
              .filter(Boolean),
          );

          for (const t of standaloneConfirmed) {
            const txHash = t.blockchain_tx_hash || t.monad_tx_hash || "0x";
            if (!seenHashes.has(txHash.toLowerCase())) {
              const receiptId = `receipt_${t.id.replace(/-/g, "")}`;
              loadedBundles.push({
                id: receiptId,
                user_id: t.user_id || userId,
                wallet_address: connectedEvmAddress || null,
                name: t.merchant,
                receipt_name: t.merchant,
                receipt_number: `CR-${t.id.slice(0, 8).toUpperCase()}`,
                receipt_hash:
                  t.blockchain_data_hash || t.commitment_hash || "0x",
                file_hash: t.blockchain_data_hash || t.commitment_hash || "0x",
                transaction_count: 1,
                total_amount: Number(t.amount || 0),
                currency: t.currency || "USD",
                transaction_ids: [t.id],
                receipt_data: {
                  receiptId,
                  receiptNumber: `CR-${t.id.slice(0, 8).toUpperCase()}`,
                  receiptName: t.merchant,
                  createdAt: t.created_at,
                  owner: t.user_id || userId,
                  transactionCount: 1,
                  totalAmount: Number(t.amount || 0),
                  currency: t.currency || "USD",
                  transactionIds: [t.id],
                  transactions: [
                    {
                      id: t.id,
                      amount: Number(t.amount || 0),
                      currency: t.currency || "USD",
                      merchant: t.merchant,
                      category:
                        t.category_id ||
                        (typeof t.category === "string"
                          ? t.category
                          : t.category?.name) ||
                        "General",
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
              });
              seenHashes.add(txHash.toLowerCase());
            }
          }

        if (!ignore) {
          setReceiptBundles(
            loadedBundles.sort(
              (a, b) =>
                new Date(b.created_at || 0).getTime() -
                new Date(a.created_at || 0).getTime(),
            ),
          );
        }
      } catch (err) {
        console.warn("Failed to load verified receipts:", err);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadVerifiedReceipts();
    return () => {
      ignore = true;
    };
  }, [userId, connectedEvmAddress]);

  // Deep-link check for shared individual transaction receipt (?txId=...)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const txId = params.get("txId");
    if (txId) {
      const supabaseClient = getSupabaseClient(connectedEvmAddress || userId);
      supabaseClient
        .from("transactions")
        .select("*")
        .eq("id", txId)
        .single()
        .then(({ data }) => {
          if (data) setSelectedShareTx(data as Transaction);
        });
    }
  }, [connectedEvmAddress, userId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return receiptBundles;
    const q = search.toLowerCase().trim();
    return receiptBundles.filter((r) => {
      const name = (r.name || r.receipt_name || "").toLowerCase();
      const num = (r.receipt_number || "").toLowerCase();
      const hash = (r.receipt_hash || r.file_hash || "").toLowerCase();
      const txHash = (r.blockchain_tx_hash || "").toLowerCase();
      return (
        name.includes(q) ||
        num.includes(q) ||
        hash.includes(q) ||
        txHash.includes(q)
      );
    });
  }, [receiptBundles, search]);

  return (
    <div className="min-h-screen bg-grid text-[#121212] flex flex-col font-sans">
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Page-Level Header: Mode Selector */}
        <ModeHeader
          currentMode={activeMode}
          onModeChange={(m) => {
            setActiveMode(m);
            router.push(`/?mode=${m}`);
          }}
        />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase text-slate-500 bg-white px-2 py-0.5 rounded border border-[#121212]">
                [EVIDENCE VAULT — MONAD TESTNET]
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-[#121212] flex items-center gap-2.5">
              <Receipt className="h-7 w-7 text-[#836EF9]" />
              Verified Receipts Vault
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Only transactions and receipt bundles saved and confirmed on Monad
              Testnet are displayed.
            </p>
          </div>

          <Magnetic range={60} intensity={0.35}>
            <WatermelonButton
              onClick={() => setUploadOpen(true)}
              variant="primary"
              textMorph
              leftIcon={<UploadCloud className="h-4 w-4" />}
              className="self-start sm:self-auto"
            >
              Scan & Upload Receipt
            </WatermelonButton>
          </Magnetic>
        </div>

        {/* Primary Mode Navigation Bar */}
        <nav
          aria-label="Receipts Primary Navigation"
          className="p-1.5 bg-white border-2 border-[#121212] shadow-[3px_3px_0_0_#121212] rounded-xl flex items-center gap-1.5 overflow-x-auto"
        >
          <AnimatedBackground
            defaultValue="receipts"
            className="rounded-lg bg-[#836EF9] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]"
            transition={{
              type: "spring",
              bounce: 0.15,
              duration: 0.4,
            }}
          >
            {[
              {
                id: "overview",
                label: "Overview",
                href: "/?mode=personal&view=overview",
              },
              {
                id: "expenses",
                label: "Expenses",
                href: "/?mode=personal&view=expenses",
              },
              {
                id: "income",
                label: "Income",
                href: "/?mode=personal&view=income",
              },
              { id: "budgets", label: "Budgets", href: "/budgets" },
              { id: "recurring", label: "Recurring", href: "/subscriptions" },
              { id: "receipts", label: "Saved Receipts", href: "/receipts" },
            ].map((tab) => {
              const isActive = tab.id === "receipts";
              return (
                <Link
                  key={tab.id}
                  data-id={tab.id}
                  href={tab.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-black uppercase tracking-wider transition-all shrink-0 ${
                    isActive
                      ? "text-white"
                      : "text-[#121212] hover:bg-[#f3f4f6]/50"
                  }`}
                >
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </AnimatedBackground>
        </nav>

        {/* Filter bar */}
        <div className="neo-card flex items-center gap-3 p-3 bg-white">
          <Search className="h-4 w-4 text-slate-400 ml-1" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by receipt name, bundle number, or Monad tx hash..."
            className="flex-1 bg-transparent text-xs font-semibold text-[#121212] placeholder-slate-400 focus:outline-none"
          />
          <span className="neo-badge neo-badge-purple mr-1 flex items-center gap-1 font-mono">
            <MonadLogo className="h-3 w-3" />
            <span>{filtered.length} On-Chain</span>
          </span>
        </div>

        {/* Content Area */}
        {isLoading && receiptBundles.length === 0 ? (
          <div className="py-14 flex flex-col items-center justify-center text-center p-6 bg-white rounded-2xl border-2 border-[#121212]">
            <Loader2 className="h-8 w-8 text-[#836EF9] animate-spin mb-3" />
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#121212]">
              Syncing verified receipts from Monad Testnet (Chain ID:{" "}
              {MONAD_TESTNET_CHAIN_ID})...
            </p>
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((r) => {
              const rName =
                r.name ||
                r.receipt_name ||
                r.receipt_data?.receiptName ||
                "Receipt Bundle";
              const rNum =
                r.receipt_number || `CR-${r.id.slice(0, 8).toUpperCase()}`;
              const txHash = r.blockchain_tx_hash || "";
              const explorerUrl = txHash ? getMonadExplorerTxUrl(txHash) : null;

              return (
                <div
                  key={r.id}
                  className="neo-card p-5 space-y-4 hover:translate-x-[1px] hover:translate-y-[1px] transition shadow-[3px_3px_0_0_#121212] flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                          {rNum}
                        </span>
                        <h3 className="text-sm font-black uppercase tracking-wider text-[#121212] mt-0.5">
                          {rName}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1 text-xs font-mono text-slate-500">
                          <Calendar className="h-3.5 w-3.5 text-[#836EF9]" />
                          <span>
                            {r.created_at
                              ? new Date(r.created_at).toLocaleDateString()
                              : "Confirmed"}
                          </span>
                        </div>
                      </div>
                      <span className="text-lg font-black font-mono text-[#15803d]">
                        ${Number(r.total_amount).toFixed(2)}
                      </span>
                    </div>

                    <div className="rounded-lg bg-[#f8f9fa] p-3 border-2 border-[#121212] space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-600 uppercase text-[10px]">
                          Monad Testnet
                        </span>
                        <span className="neo-badge neo-badge-purple flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          Confirmed
                        </span>
                      </div>
                      <p className="font-mono text-[10px] text-slate-600 truncate font-semibold">
                        Tx: {txHash || "0x..."}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t-2 border-[#121212] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBundle(r);
                        setIsPreviewOpen(true);
                      }}
                      className="neo-btn neo-btn-secondary text-[11px] !py-1 !px-2.5 flex items-center gap-1 font-mono"
                    >
                      <Eye className="h-3 w-3" />
                      <span>Inspect</span>
                    </button>

                    {explorerUrl && (
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-mono font-bold text-[#836EF9] hover:underline flex items-center gap-1"
                      >
                        <span>Monad Explorer</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#121212] bg-[#f8f9fa] p-12 text-center space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#836EF9] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-wider text-[#121212]">
              No Verified On-Chain Receipts Yet
            </h3>
            <p className="text-xs text-slate-600 max-w-sm">
              Only receipts and transactions anchored and confirmed on Monad
              Testnet are displayed in this vault.
            </p>
            <div className="mt-2">
              <Magnetic range={60} intensity={0.35}>
                <WatermelonButton
                  onClick={() => setUploadOpen(true)}
                  variant="primary"
                  textMorph
                  leftIcon={<UploadCloud className="h-4 w-4" />}
                >
                  Scan & Anchor Receipt
                </WatermelonButton>
              </Magnetic>
            </div>
          </div>
        )}
      </main>

      {/* OCR Upload Modal */}
      <ReceiptUploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onTransactionCreated={() => {
          // Refresh list on receipt creation
          window.location.reload();
        }}
      />

      {/* Receipt Inspect Modal */}
      {selectedBundle && (
        <ReceiptBundleModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          bundle={selectedBundle}
        />
      )}

      {/* Shareable Receipt Modal for single deep-linked transactions */}
      <TransactionShareModal
        isOpen={!!selectedShareTx}
        onClose={() => setSelectedShareTx(null)}
        transaction={selectedShareTx}
      />
    </div>
  );
}
