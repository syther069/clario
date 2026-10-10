"use client";

/**
 * Clario Attributable Transaction Import Dialog (Montally Neo-Brutalist)
 * Source: PRD §9.3; Architecture §4
 *
 * Implements strict rules:
 * 1. Only transactions from or to the connected wallet.
 * 2. Multi-chain and single-chain auto-discovery via Alchemy Asset Transfers API.
 * 3. Chain order: Monad, Ethereum, Base, Hyperliquid, then other EVM chains.
 * 4. Token order: USDC, USDT, native tokens, then others.
 * 5. Real USD value at the time of transaction (never $0 or guessed).
 * 6. Exact date and time from block timestamp in user's local timezone.
 * 7. Deduplication, decimal accuracy, failed txn protection, and spam rejection.
 * 8. Hackathon bounty attribution: "Fetched via Alchemy".
 * 9. Real vector logos for all tokens and chains.
 * 10. Distinct UI states: Loading, API Error, Disconnected, Invalid Address, Empty State, Pagination, and Loaded List.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  type TransactionImportCandidate,
  type NormalizedTransaction,
  IMPORTED_FACTS_DISCLAIMER,
  formatTransactionDateTime,
} from "../lib/import/types";
import {
  SUPPORTED_IMPORT_CHAINS,
  getExplorerTxUrl,
  type SourceChainConfig,
} from "../lib/import/chains";
import {
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  RefreshCw,
  X,
  AlertTriangle,
  Search,
  Wallet,
  Globe,
  Layers,
} from "lucide-react";
import {
  CryptoChainIcon,
  CryptoCoinIcon,
  AlchemyAttributionBadge,
  AlchemyLogo,
} from "@/components/ui/crypto-icon";
import { NeoSelect } from "./ui/neo-select";

function isValidEvmAddress(address?: string | null): boolean {
  if (!address) return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}

function formatCryptoAmount(amountStr: string): string {
  if (!amountStr) return "0";
  const num = Number.parseFloat(amountStr);
  if (Number.isNaN(num)) return amountStr;
  if (num === 0) return "0";
  if (num >= 1000) {
    return num.toLocaleString("en-US", { maximumFractionDigits: 4 });
  }
  if (num < 0.000001) {
    return "< 0.000001";
  }
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}

export interface TransactionImportDialogProps {
  isOpen: boolean;
  workspaceId: string;
  userAddress?: string | undefined;
  onClose: () => void;
  onSelectTransaction: (
    tx: NormalizedTransaction,
    paymentSource: "imported_transaction" | "transaction_hash",
  ) => void;
  onConnectWallet?: (() => void) | undefined;
}

export function TransactionImportDialog({
  isOpen,
  workspaceId,
  userAddress,
  onClose,
  onSelectTransaction,
  onConnectWallet,
}: TransactionImportDialogProps) {
  const [activeTab, setActiveTab] = useState<"wallet" | "hash">("wallet");
  // 0 = All Supported Chains (Auto-Discover), or specific chain ID
  const [selectedChainId, setSelectedChainId] = useState<number>(0);
  const [queryAddress, setQueryAddress] = useState<string>(userAddress || "");
  const [transactions, setTransactions] = useState<
    readonly TransactionImportCandidate[]
  >([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync with prop when wallet connects or changes
  const [prevUserAddress, setPrevUserAddress] = useState<string | undefined>(
    userAddress,
  );
  if (userAddress !== prevUserAddress) {
    setPrevUserAddress(userAddress);
    setQueryAddress(userAddress || "");
  }

  // Detect which EVM chain the wallet has used the most
  const chainCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const t of transactions) {
      counts[t.sourceChainId] = (counts[t.sourceChainId] || 0) + 1;
    }
    return counts;
  }, [transactions]);

  const mostActiveChainId = useMemo(() => {
    let topChain = 0;
    let maxCount = 0;
    for (const [chainIdStr, count] of Object.entries(chainCounts)) {
      if (count > maxCount) {
        maxCount = count;
        topChain = Number(chainIdStr);
      }
    }
    return topChain;
  }, [chainCounts]);

  // Hash lookup states
  const [lookupChainId, setLookupChainId] = useState<number>(10143);
  const [lookupHash, setLookupHash] = useState<string>("");
  const [lookupLoading, setLookupLoading] = useState<boolean>(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupCandidate, setLookupCandidate] =
    useState<TransactionImportCandidate | null>(null);

  const fetchTransactions = useCallback(
    async (isLoadMore = false) => {
      if (!isValidEvmAddress(queryAddress) || !workspaceId) {
        setTransactions([]);
        setNextCursor(null);
        return;
      }
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const url = new URL(
          `/api/workspaces/${workspaceId}/import/transactions`,
          window.location.origin,
        );
        url.searchParams.set("address", queryAddress.trim());
        if (selectedChainId > 0) {
          url.searchParams.set("chainId", selectedChainId.toString());
        }
        if (isLoadMore && nextCursor) {
          url.searchParams.set("cursor", nextCursor);
        }

        const res = await fetch(url.toString(), {
          headers: {
            "Content-Type": "application/json",
            "x-wallet-address": queryAddress.trim(),
          },
        });

        const contentType = res.headers.get("content-type") || "";
        let data: { items?: TransactionImportCandidate[]; nextCursor?: string | null; error?: { message?: string } } | null = null;

        if (contentType.includes("application/json")) {
          data = await res.json();
        } else {
          // If server returned non-JSON (e.g. HTML 404/500/504), extract status cleanly without crashing
          if (!res.ok) {
            const isTimeout = res.status === 504 || res.status === 408;
            throw new Error(
              isTimeout
                ? "The indexer request timed out while scanning multiple networks."
                : `Indexer service error (HTTP ${res.status}). RPC indexer temporarily unreachable.`,
            );
          }
          throw new Error("Unexpected response format from transaction service.");
        }

        if (!res.ok) {
          throw new Error(data?.error?.message || `Failed to fetch transactions (HTTP ${res.status}).`);
        }

        const newItems: TransactionImportCandidate[] = data?.items || [];
        if (isLoadMore) {
          setTransactions((prev) => [...prev, ...newItems]);
        } else {
          setTransactions(newItems);
        }
        setNextCursor(data?.nextCursor || null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error loading transactions from Alchemy API.",
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [queryAddress, selectedChainId, workspaceId, nextCursor],
  );

  useEffect(() => {
    if (!isOpen || activeTab !== "wallet") return;
    const timer = setTimeout(() => {
      if (isValidEvmAddress(queryAddress) && workspaceId) {
        void fetchTransactions(false);
      } else {
        setTransactions([]);
        setNextCursor(null);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [
    isOpen,
    activeTab,
    queryAddress,
    selectedChainId,
    workspaceId,
    fetchTransactions,
  ]);

  const handleLookup = async () => {
    if (!lookupHash || !workspaceId) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupCandidate(null);
    try {
      const url = new URL(
        `/api/workspaces/${workspaceId}/import/lookup`,
        window.location.origin,
      );
      url.searchParams.set("chainId", lookupChainId.toString());
      url.searchParams.set("hash", lookupHash.trim());

      const res = await fetch(url.toString(), {
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address":
            queryAddress || "0x0000000000000000000000000000000000000000",
        },
      });

      const contentType = res.headers.get("content-type") || "";
      let data: { transaction?: TransactionImportCandidate; error?: { message?: string } } | null = null;

      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status} (${res.statusText || "Lookup failed"}).`);
        }
        throw new Error("Unexpected response format from transaction lookup service.");
      }

      if (!res.ok) {
        throw new Error(
          data?.error?.message || "Transaction not found on this chain.",
        );
      }
      setLookupCandidate(data?.transaction || null);
    } catch (err) {
      setLookupError(
        err instanceof Error ? err.message : "Failed to lookup transaction.",
      );
    } finally {
      setLookupLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentChainObj = SUPPORTED_IMPORT_CHAINS.find(
    (c) => c.chainId === selectedChainId,
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="relative z-10 w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border-2 border-[#121212] bg-white text-[#121212] shadow-[8px_8px_0_0_#121212] overflow-hidden font-sans">
        {/* Header */}
        <div className="p-5 border-b-2 border-[#121212] flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f3f0ff] text-[#836EF9] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <AlchemyAttributionBadge />
              </div>
              <h3
                id="import-dialog-title"
                className="text-base font-black uppercase tracking-wider text-[#121212]"
              >
                Import Transactions
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="relative rounded-xl border-2 border-[#121212] p-2 hover:bg-slate-100 shadow-[2px_2px_0_0_#121212] transition-[transform,box-shadow,background-color] duration-150 ease-out active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="px-5 py-2.5 bg-[#f5f3ff] border-b-2 border-[#121212] flex items-center justify-between gap-3 text-xs font-mono text-slate-700">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#836EF9] text-white text-[10px] font-bold">
              i
            </span>
            <span
              className="truncate text-xs text-slate-600 font-medium"
              title={IMPORTED_FACTS_DISCLAIMER}
            >
              Transactions are indexed directly from external blockchain networks.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-mono font-bold uppercase text-[#15803d] bg-[#dcfce7] px-2 py-0.5 rounded-md border border-[#121212] shadow-[1px_1px_0_0_#121212]">
              Min $1.00 USD
            </span>
            <span className="text-[10px] font-mono font-bold uppercase text-slate-700 bg-white px-2 py-0.5 rounded-md border border-[#121212] shadow-[1px_1px_0_0_#121212]">
              Multi-Chain
            </span>
          </div>
        </div>

        {/* Tabs & Controls */}
        <div className="p-5 border-b-2 border-[#121212] bg-[#fbfbfb] flex flex-col gap-4 relative z-20">
          {/* Tab Selection */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("wallet")}
              className={`border-2 border-[#121212] font-mono font-black uppercase text-xs tracking-wider px-4 py-2 rounded-xl shadow-[2px_2px_0_0_#121212] transition-[transform,box-shadow,background-color,color] duration-150 ease-out active:translate-x-0.5 active:translate-y-0.5 cursor-pointer ${
                activeTab === "wallet"
                  ? "bg-[#836EF9] text-white"
                  : "bg-white text-[#121212] hover:bg-slate-50"
              }`}
            >
              Wallet Activity
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("hash")}
              className={`border-2 border-[#121212] font-mono font-black uppercase text-xs tracking-wider px-4 py-2 rounded-xl shadow-[2px_2px_0_0_#121212] transition-[transform,box-shadow,background-color,color] duration-150 ease-out active:translate-x-0.5 active:translate-y-0.5 cursor-pointer ${
                activeTab === "hash"
                  ? "bg-[#836EF9] text-white"
                  : "bg-white text-[#121212] hover:bg-slate-50"
              }`}
            >
              Search by Hash
            </button>
          </div>

          {/* Form Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Column 1: Network Selection */}
            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="text-[11px] font-mono font-black uppercase tracking-wider text-slate-500">
                Network
              </label>
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-[#121212] bg-[#fbf9fe] shadow-[2px_2px_0_0_#121212]">
                  {activeTab === "wallet" && selectedChainId === 0 ? (
                    <Globe className="h-5 w-5 text-[#836EF9]" />
                  ) : (
                    <CryptoChainIcon
                      chain={activeTab === "wallet" ? selectedChainId : lookupChainId}
                      className="h-5 w-5"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {activeTab === "wallet" ? (
                    <NeoSelect
                      fullWidth
                      className="w-full min-w-0"
                      buttonClassName="h-10 w-full rounded-xl"
                      value={String(selectedChainId)}
                      onChange={(val) => setSelectedChainId(Number(val))}
                      options={[
                        { value: "0", label: "✨ All Chains (Auto-Discover)" },
                        ...SUPPORTED_IMPORT_CHAINS.map((c: SourceChainConfig) => ({
                          value: String(c.chainId),
                          label: `${c.name} (${c.shortName})`,
                        })),
                      ]}
                    />
                  ) : (
                    <NeoSelect
                      fullWidth
                      className="w-full min-w-0"
                      buttonClassName="h-10 w-full rounded-xl"
                      value={String(lookupChainId)}
                      onChange={(val) => setLookupChainId(Number(val))}
                      options={SUPPORTED_IMPORT_CHAINS.map((c: SourceChainConfig) => ({
                        value: String(c.chainId),
                        label: `${c.name} (${c.shortName})`,
                      }))}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Column 2: Connected Wallet (Wallet Tab) OR Transaction Hash Input (Hash Tab) */}
            {activeTab === "wallet" ? (
              <div className="flex flex-col gap-1.5 min-w-0">
                <label className="text-[11px] font-mono font-black uppercase tracking-wider text-slate-500">
                  Connected Wallet
                </label>
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="text"
                    value={queryAddress}
                    onChange={(e) => setQueryAddress(e.target.value)}
                    placeholder="Connect a wallet or enter 0x..."
                    readOnly={Boolean(userAddress)}
                    className="flex-1 min-w-0 h-10 border-2 border-[#121212] rounded-xl px-3 text-xs font-mono bg-white shadow-[2px_2px_0_0_#121212] focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                  />
                  <button
                    type="button"
                    onClick={() => fetchTransactions(false)}
                    disabled={loading || !isValidEvmAddress(queryAddress)}
                    title="Refresh wallet transactions"
                    className="h-10 w-10 shrink-0 border-2 border-[#121212] bg-white hover:bg-slate-50 disabled:bg-slate-100 disabled:opacity-50 text-[#121212] rounded-xl shadow-[2px_2px_0_0_#121212] flex items-center justify-center transition-[transform,box-shadow,background-color] duration-150 ease-out active:translate-x-0.5 active:translate-y-0.5 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${loading ? "animate-spin text-[#836EF9]" : ""}`}
                    />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 min-w-0">
                <label className="text-[11px] font-mono font-black uppercase tracking-wider text-slate-500">
                  Transaction Hash
                </label>
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="text"
                    placeholder="0x..."
                    value={lookupHash}
                    onChange={(e) => setLookupHash(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleLookup();
                    }}
                    className="flex-1 min-w-0 h-10 border-2 border-[#121212] rounded-xl px-3 text-xs font-mono bg-white shadow-[2px_2px_0_0_#121212] focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                  />
                  <button
                    type="button"
                    onClick={handleLookup}
                    disabled={lookupLoading || !lookupHash.trim()}
                    className="h-10 px-4 shrink-0 border-2 border-[#121212] bg-[#836EF9] hover:bg-[#725aeb] disabled:bg-slate-200 disabled:opacity-50 text-white font-mono font-black uppercase text-xs rounded-xl shadow-[2px_2px_0_0_#121212] flex items-center gap-1.5 transition-[transform,box-shadow,background-color] duration-150 ease-out active:translate-x-0.5 active:translate-y-0.5 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {lookupLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    <span>Search</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3 bg-white">
          {activeTab === "wallet" ? (
            <>
              {/* State 1: Wallet Disconnected / Invalid Address */}
              {!isValidEvmAddress(queryAddress) ? (
                <div className="text-center py-12 border-2 border-dashed border-[#121212] rounded-xl bg-[#fbf9fe] p-6 flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f3f0ff] text-[#836EF9] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
                    <Wallet className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-mono text-sm font-bold uppercase text-[#121212] mb-1">
                      Connect your wallet to fetch transactions
                    </p>
                    <p className="text-xs text-slate-500 max-w-sm">
                      An active EVM wallet is required to index onchain transactions.
                    </p>
                  </div>
                  {onConnectWallet && (
                    <button
                      type="button"
                      onClick={onConnectWallet}
                      className="mt-2 border-2 border-[#121212] bg-[#836EF9] hover:bg-[#725aeb] text-white font-mono font-black uppercase text-xs tracking-wider py-2.5 px-5 rounded-xl shadow-[2px_2px_0_0_#121212] flex items-center gap-2 transition-[transform,box-shadow,background-color] duration-150 ease-out active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                    >
                      <Wallet className="h-4 w-4" />
                      <span>Connect Wallet</span>
                    </button>
                  )}
                </div>
              ) : error ? (
                /* State 2: Error State with Actions */
                <div className="border-2 border-[#ef4444] bg-[#fef2f2] text-[#121212] p-5 rounded-xl flex flex-col gap-3 shadow-[4px_4px_0_0_#ef4444]">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-5 w-5 text-[#ef4444] shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-mono text-xs font-black uppercase text-[#ef4444] tracking-wider">
                        Unable to fetch transactions
                      </p>
                      <p className="font-mono text-xs text-slate-700">
                        {error}
                      </p>
                      {selectedChainId === 0 && (
                        <p className="text-[11px] text-slate-500 font-mono mt-1">
                          Tip: Scanning all networks at once may time out. Try selecting a specific chain or use Search by Hash.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-[#ef4444]/20 flex-wrap">
                    <button
                      type="button"
                      onClick={() => fetchTransactions(false)}
                      className="border-2 border-[#121212] bg-[#ef4444] hover:bg-[#dc2626] text-white font-mono font-black uppercase text-xs px-3.5 py-2 rounded-xl shadow-[2px_2px_0_0_#121212] flex items-center gap-1.5 transition-[transform,box-shadow,background-color] duration-150 ease-out active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Retry</span>
                    </button>

                    {selectedChainId === 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setSelectedChainId(10143)}
                          className="border-2 border-[#121212] bg-white hover:bg-slate-50 text-[#121212] font-mono font-black uppercase text-xs px-3 py-2 rounded-xl shadow-[2px_2px_0_0_#121212] flex items-center gap-1.5 transition-[transform,box-shadow,background-color] duration-150 ease-out active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                        >
                          <CryptoChainIcon chain={10143} className="h-3.5 w-3.5" />
                          <span>Monad</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedChainId(8453)}
                          className="border-2 border-[#121212] bg-white hover:bg-slate-50 text-[#121212] font-mono font-black uppercase text-xs px-3 py-2 rounded-xl shadow-[2px_2px_0_0_#121212] flex items-center gap-1.5 transition-[transform,box-shadow,background-color] duration-150 ease-out active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                        >
                          <CryptoChainIcon chain={8453} className="h-3.5 w-3.5" />
                          <span>Base</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedChainId(11155111)}
                          className="border-2 border-[#121212] bg-white hover:bg-slate-50 text-[#121212] font-mono font-black uppercase text-xs px-3 py-2 rounded-xl shadow-[2px_2px_0_0_#121212] flex items-center gap-1.5 transition-[transform,box-shadow,background-color] duration-150 ease-out active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                        >
                          <CryptoChainIcon chain={11155111} className="h-3.5 w-3.5" />
                          <span>Sepolia</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedChainId(0)}
                        className="border-2 border-[#121212] bg-white hover:bg-slate-50 text-[#121212] font-mono font-black uppercase text-xs px-3 py-2 rounded-xl shadow-[2px_2px_0_0_#121212] flex items-center gap-1.5 transition-[transform,box-shadow,background-color] duration-150 ease-out active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                      >
                        <Globe className="h-3.5 w-3.5 text-[#836EF9]" />
                        <span>All Chains</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setActiveTab("hash")}
                      className="border-2 border-[#121212] bg-[#f3f0ff] hover:bg-[#e9e3ff] text-[#836EF9] font-mono font-black uppercase text-xs px-3 py-2 rounded-xl shadow-[2px_2px_0_0_#121212] flex items-center gap-1.5 transition-[transform,box-shadow,background-color] duration-150 ease-out active:translate-x-0.5 active:translate-y-0.5 sm:ml-auto cursor-pointer"
                    >
                      <Search className="h-3.5 w-3.5" />
                      <span>Search by Hash →</span>
                    </button>
                  </div>
                </div>
              ) : loading ? (
                /* State 3: Multi-Chain Progress State */
                <div className="py-8 px-5 border-2 border-[#121212] rounded-2xl bg-[#faf9fe] shadow-[4px_4px_0_0_#121212] flex flex-col items-center gap-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] text-[#836EF9]">
                    <RefreshCw className="h-6 w-6 animate-spin text-[#836EF9]" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-mono text-sm font-black uppercase text-[#121212] tracking-wider">
                      Scanning EVM Networks...
                    </p>
                    <p className="text-xs font-mono text-slate-600">
                      Finding wallet activity and calculating values (≥ $1.00 USD)
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-md pt-1">
                    {SUPPORTED_IMPORT_CHAINS.map((chain) => (
                      <span
                        key={chain.chainId}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-[#121212] bg-white text-[10px] font-mono font-bold text-slate-700 shadow-[1px_1px_0_0_#121212] animate-pulse"
                      >
                        <CryptoChainIcon chain={chain.chainId} className="h-3 w-3" />
                        {chain.shortName}
                      </span>
                    ))}
                  </div>
                </div>
              ) : transactions.length === 0 ? (
                /* State 4: Empty State */
                <div className="text-center py-10 border-2 border-dashed border-[#121212] rounded-xl bg-[#fafafa] p-6 flex flex-col items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div className="font-mono text-xs text-slate-600 max-w-md">
                    {selectedChainId === 0 ? (
                      <p>
                        No transactions found for{" "}
                        <span className="font-bold text-[#121212]">
                          {queryAddress.slice(0, 6)}...{queryAddress.slice(-4)}
                        </span>{" "}
                        across supported networks.
                      </p>
                    ) : (
                      <p>
                        No transactions found on{" "}
                        <span className="font-bold text-[#121212]">
                          {currentChainObj?.name || `Chain ID ${selectedChainId}`}
                        </span>
                        .
                      </p>
                    )}
                  </div>
                  {selectedChainId !== 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedChainId(0)}
                      className="mt-1 border-2 border-[#121212] bg-[#836EF9] hover:bg-[#725aeb] text-white font-mono font-black uppercase text-xs tracking-wider py-2 px-4 rounded-xl shadow-[2px_2px_0_0_#121212] flex items-center gap-2 transition-[transform,box-shadow,background-color] duration-150 ease-out active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      <span>Scan All Chains</span>
                    </button>
                  )}
                </div>
              ) : (
                /* State 5: Loaded Transaction Candidates */
                <>
                  {/* Primary Activity Banner */}
                  {selectedChainId === 0 && mostActiveChainId > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-xl border-2 border-[#121212] bg-[#f8f6ff] text-xs font-mono shadow-[2px_2px_0_0_#121212] flex-wrap gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#836EF9] text-white font-black text-[10px]">
                          ★
                        </span>
                        <span className="text-slate-700 truncate">
                          Most active on{" "}
                          <strong className="text-[#121212] font-black">
                            {SUPPORTED_IMPORT_CHAINS.find((c) => c.chainId === mostActiveChainId)?.name || `Chain ${mostActiveChainId}`}
                          </strong>{" "}
                          ({chainCounts[mostActiveChainId]} transactions).
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedChainId(mostActiveChainId)}
                        className="text-[10px] font-mono font-black uppercase px-2.5 py-1 rounded-lg border-2 border-[#121212] bg-white hover:bg-slate-50 text-[#836EF9] shadow-[1px_1px_0_0_#121212] transition cursor-pointer active:translate-x-0.5 active:translate-y-0.5 shrink-0"
                      >
                        Filter to {SUPPORTED_IMPORT_CHAINS.find((c) => c.chainId === mostActiveChainId)?.shortName || "Chain"}
                      </button>
                    </div>
                  )}

                  {/* Summary Bar */}
                  <div className="flex items-center justify-between text-xs font-mono text-slate-500 px-1">
                    <span>
                      Found <strong className="text-[#121212]">{transactions.length}</strong> transactions (≥ $1.00 USD)
                    </span>
                    <span className="text-[10px] font-mono uppercase font-bold text-[#836EF9] flex items-center gap-1">
                      <AlchemyLogo className="h-3 w-3" /> Live Ingestion
                    </span>
                  </div>

                  {/* Transaction Cards */}
                  {transactions.map((tx) => {
                    const explorerUrl = getExplorerTxUrl(
                      tx.sourceChainId,
                      tx.sourceTransactionHash,
                    );
                    const isSender =
                      queryAddress.toLowerCase() === tx.sender.toLowerCase();

                    return (
                      <div
                        key={`${tx.sourceChainId}-${tx.sourceTransactionHash}-${tx.claimSlot}`}
                        className={`border-2 border-[#121212] rounded-xl p-4 shadow-[3px_3px_0_0_#121212] flex flex-col gap-3 transition-[background-color,border-color,box-shadow] duration-150 ease-out ${
                          tx.isClaimed
                            ? "bg-slate-50 opacity-75"
                            : "bg-white hover:bg-[#faf8fe]"
                        }`}
                      >
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          {/* Left: Direction + Token + Amounts */}
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Direction Pill */}
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] ${
                                isSender
                                  ? "bg-[#fee2e2] text-[#dc2626]"
                                  : "bg-[#dcfce7] text-[#16a34a]"
                              }`}
                              title={
                                isSender ? "Outgoing / Sent" : "Incoming / Received"
                              }
                            >
                              {isSender ? (
                                <ArrowUpRight className="h-5 w-5" />
                              ) : (
                                <ArrowDownLeft className="h-5 w-5" />
                              )}
                            </div>

                            {/* Coin Icon */}
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-[#121212] bg-white shadow-[2px_2px_0_0_#121212] p-1.5">
                              <CryptoCoinIcon
                                symbol={tx.assetSymbol}
                                className="h-6 w-6"
                              />
                            </div>

                            {/* Amount & Badges */}
                            <div className="min-w-0">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span
                                  className="font-mono tabular-nums text-base font-black text-[#121212]"
                                  title={`${tx.formattedAmount} ${tx.assetSymbol}`}
                                >
                                  {formatCryptoAmount(tx.formattedAmount)} {tx.assetSymbol}
                                </span>
                                {tx.usdValueFormatted && (
                                  <span className="font-mono tabular-nums text-xs font-bold text-[#15803d] bg-[#dcfce7] px-1.5 py-0.5 rounded-md border border-[#121212]">
                                    {tx.usdValueFormatted} USD
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span
                                  className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md border border-[#121212] ${
                                    isSender
                                      ? "bg-[#fee2e2] text-[#dc2626]"
                                      : "bg-[#dcfce7] text-[#16a34a]"
                                  }`}
                                >
                                  {isSender ? "Sent" : "Received"}
                                </span>
                                <span
                                  className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md border border-[#121212] ${
                                    tx.status === "confirmed"
                                      ? "bg-[#dcfce7] text-[#16a34a]"
                                      : tx.status === "failed"
                                        ? "bg-[#fee2e2] text-[#dc2626]"
                                        : "bg-[#fef9c3] text-[#ca8a04]"
                                  }`}
                                >
                                  {tx.status}
                                </span>
                                <span className="text-[10px] font-mono font-bold uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-[#121212] flex items-center gap-1">
                                  <CryptoChainIcon
                                    chain={tx.sourceChainId}
                                    className="h-3 w-3"
                                  />
                                  {SUPPORTED_IMPORT_CHAINS.find(
                                    (c) => c.chainId === tx.sourceChainId,
                                  )?.shortName || `Chain ${tx.sourceChainId}`}
                                </span>
                                <span className="text-[10px] font-mono font-bold text-[#0052FF] bg-[#f0f4ff] px-2 py-0.5 rounded-md border border-[#121212] flex items-center gap-1">
                                  <AlchemyLogo className="h-2.5 w-2.5" />
                                  Alchemy
                                </span>
                                {tx.isClaimed && (
                                  <span className="text-[10px] font-mono font-black uppercase bg-[#fee2e2] text-[#dc2626] px-2 py-0.5 rounded-md border border-[#121212]">
                                    Claimed
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Autofill button */}
                          <button
                            type="button"
                            disabled={tx.isClaimed || tx.status === "failed"}
                            onClick={() => {
                              onSelectTransaction(tx, "imported_transaction");
                              onClose();
                            }}
                            className={`h-10 px-4 border-2 border-[#121212] font-mono font-black uppercase text-xs tracking-wider rounded-xl shadow-[2px_2px_0_0_#121212] flex items-center gap-1.5 transition-[transform,box-shadow,background-color] duration-150 ease-out cursor-pointer ${
                              tx.isClaimed || tx.status === "failed"
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
                                : "bg-[#836EF9] hover:bg-[#725aeb] text-white active:translate-x-0.5 active:translate-y-0.5"
                            }`}
                          >
                            {tx.isClaimed ? (
                              "Claimed"
                            ) : tx.status === "failed" ? (
                              "Failed"
                            ) : (
                              <>
                                <CheckCircle2 className="h-4 w-4" />
                                <span>Autofill →</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Detail row */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono text-slate-600 pt-2.5 border-t border-slate-200">
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="text-slate-400">Tx:</span>
                            <span className="font-bold text-[#121212]">
                              {tx.sourceTransactionHash.slice(0, 8)}...
                              {tx.sourceTransactionHash.slice(-6)}
                            </span>
                            {explorerUrl && (
                              <a
                                href={explorerUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#836EF9] hover:underline inline-flex items-center ml-0.5"
                                title="View on block explorer"
                              >
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>

                          <div className="truncate min-w-0">
                            <span className="text-slate-400">
                              {isSender ? "To:" : "From:"}
                            </span>{" "}
                            <span className="font-bold text-[#121212]">
                              {isSender
                                ? tx.recipient
                                  ? `${tx.recipient.slice(0, 6)}...${tx.recipient.slice(-4)}`
                                  : "Contract"
                                : `${tx.sender.slice(0, 6)}...${tx.sender.slice(-4)}`}
                            </span>
                          </div>

                          <div className="sm:text-right min-w-0">
                            <span className="text-slate-400">Time:</span>{" "}
                            <span className="font-bold tabular-nums text-[#121212]">
                              {formatTransactionDateTime(tx.blockTimestamp)}
                            </span>
                          </div>
                        </div>

                        {tx.warning && (
                          <div className="border border-[#ca8a04] bg-[#fefce8] text-[#854d0e] p-2 rounded-lg text-xs font-mono flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span>{tx.warning}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Pagination / Load More */}
                  {nextCursor && (
                    <div className="flex justify-center pt-2">
                      <button
                        type="button"
                        onClick={() => fetchTransactions(true)}
                        disabled={loadingMore}
                        className="border-2 border-[#121212] bg-white hover:bg-slate-50 text-[#121212] font-mono font-black uppercase text-xs tracking-wider px-5 py-2.5 rounded-xl shadow-[2px_2px_0_0_#121212] flex items-center gap-2 transition-[transform,box-shadow,background-color] duration-150 ease-out active:translate-x-0.5 active:translate-y-0.5 cursor-pointer disabled:opacity-50"
                      >
                        {loadingMore ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Layers className="h-3.5 w-3.5" />
                        )}
                        <span>Load More Transactions</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            /* Direct Hash Lookup Tab */
            <div className="flex flex-col gap-4">
              {lookupError && (
                <div className="border-2 border-[#ef4444] bg-[#fef2f2] text-[#ef4444] p-3.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 shadow-[2px_2px_0_0_#ef4444]">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{lookupError}</span>
                </div>
              )}

              {lookupCandidate ? (
                <div
                  className={`border-2 border-[#121212] rounded-xl p-4 shadow-[4px_4px_0_0_#121212] flex flex-col gap-3 ${
                    lookupCandidate.isClaimed ? "bg-slate-50" : "bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-[#121212] bg-[#fbf9fe] shadow-[2px_2px_0_0_#121212] p-1.5">
                        <CryptoCoinIcon
                          symbol={lookupCandidate.assetSymbol}
                          className="h-6 w-6"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="font-mono tabular-nums text-base font-black text-[#121212] flex items-center gap-2 flex-wrap">
                          <span title={`${lookupCandidate.formattedAmount} ${lookupCandidate.assetSymbol}`}>
                            {formatCryptoAmount(lookupCandidate.formattedAmount)}{" "}
                            {lookupCandidate.assetSymbol}
                          </span>
                          {lookupCandidate.usdValueFormatted && (
                            <span className="font-mono tabular-nums text-xs font-bold text-[#15803d] bg-[#dcfce7] px-2 py-0.5 rounded-md border border-[#121212]">
                              {lookupCandidate.usdValueFormatted} USD
                            </span>
                          )}
                          <span className="text-[10px] font-mono font-bold uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-[#121212] flex items-center gap-1">
                            <CryptoChainIcon
                              chain={lookupCandidate.sourceChainId}
                              className="h-3 w-3"
                            />
                            {SUPPORTED_IMPORT_CHAINS.find(
                              (c) => c.chainId === lookupCandidate.sourceChainId,
                            )?.shortName || `Chain ${lookupCandidate.sourceChainId}`}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-slate-500 mt-1 flex items-center gap-2">
                          <span>Status:</span>
                          <span
                            className={`font-black uppercase text-[10px] px-2 py-0.5 rounded-md border border-[#121212] ${
                              lookupCandidate.status === "confirmed"
                                ? "bg-[#dcfce7] text-[#16a34a]"
                                : "bg-[#fee2e2] text-[#dc2626]"
                            }`}
                          >
                            {lookupCandidate.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={
                        lookupCandidate.isClaimed ||
                        lookupCandidate.status === "failed"
                      }
                      onClick={() => {
                        onSelectTransaction(
                          lookupCandidate,
                          "transaction_hash",
                        );
                        onClose();
                      }}
                      className={`h-10 px-4 border-2 border-[#121212] font-mono font-black uppercase text-xs tracking-wider rounded-xl shadow-[2px_2px_0_0_#121212] flex items-center gap-1.5 transition-[transform,box-shadow,background-color] duration-150 ease-out cursor-pointer ${
                        lookupCandidate.isClaimed ||
                        lookupCandidate.status === "failed"
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
                          : "bg-[#836EF9] hover:bg-[#725aeb] text-white active:translate-x-0.5 active:translate-y-0.5"
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Autofill →</span>
                    </button>
                  </div>

                  {lookupCandidate.warning && (
                    <div className="border border-[#ca8a04] bg-[#fefce8] text-[#854d0e] p-2 rounded-lg text-xs font-mono flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>{lookupCandidate.warning}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono text-slate-600 pt-2.5 border-t border-slate-200">
                    <div className="truncate min-w-0">
                      <span className="text-slate-400">From:</span>{" "}
                      <span className="font-bold text-[#121212]">
                        {lookupCandidate.sender.slice(0, 6)}...{lookupCandidate.sender.slice(-4)}
                      </span>
                    </div>
                    <div className="truncate min-w-0">
                      <span className="text-slate-400">To:</span>{" "}
                      <span className="font-bold text-[#121212]">
                        {lookupCandidate.recipient
                          ? `${lookupCandidate.recipient.slice(0, 6)}...${lookupCandidate.recipient.slice(-4)}`
                          : "Contract"}
                      </span>
                    </div>
                    <div className="sm:text-right min-w-0">
                      <span className="text-slate-400">Time:</span>{" "}
                      <span className="font-bold tabular-nums text-[#121212]">
                        {formatTransactionDateTime(lookupCandidate.blockTimestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : !lookupLoading && (
                <div className="text-center py-12 border-2 border-dashed border-[#121212] rounded-xl bg-[#fafafa] p-6 flex flex-col items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#836EF9] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
                    <Search className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-mono text-sm font-bold uppercase text-[#121212] mb-1">
                      Search by Transaction Hash
                    </p>
                    <p className="text-xs font-mono text-slate-500 max-w-sm">
                      Enter any transaction hash above to look up its details and import.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t-2 border-[#121212] bg-[#fbfbfb] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlchemyLogo className="h-4 w-4" />
            <span className="text-[11px] font-mono font-bold text-slate-600">
              Powered by Alchemy Asset Transfers &amp; Price APIs
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border-2 border-[#121212] bg-white hover:bg-slate-100 text-[#121212] font-mono font-black uppercase text-xs tracking-wider px-4 py-2 rounded-xl shadow-[2px_2px_0_0_#121212] transition-[transform,box-shadow,background-color] duration-150 ease-out active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
