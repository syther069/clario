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

import React, { useState, useEffect, useCallback } from "react";
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
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || "Failed to fetch transactions from Alchemy.");
        }

        const newItems: TransactionImportCandidate[] = data.items || [];
        if (isLoadMore) {
          setTransactions((prev) => [...prev, ...newItems]);
        } else {
          setTransactions(newItems);
        }
        setNextCursor(data.nextCursor || null);
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
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error?.message || "Transaction not found on this chain.",
        );
      }
      setLookupCandidate(data.transaction);
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
                Import Attributable Transaction
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg border-2 border-[#121212] p-1.5 hover:bg-slate-100 shadow-[2px_2px_0_0_#121212] transition-all active:translate-x-0.5 active:translate-y-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Disclaimer Banner */}
        <div className="px-5 py-2 bg-[#f3f0ff] border-b-2 border-[#121212] flex items-center justify-between gap-2 text-xs font-mono text-[#836EF9]">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-bold">ℹ</span>
            <span className="truncate">{IMPORTED_FACTS_DISCLAIMER}</span>
          </div>
          <span className="shrink-0 text-[10px] font-black uppercase bg-white px-2 py-0.5 rounded border border-[#836EF9]">
            MONAD &amp; MAINNETS
          </span>
        </div>

        {/* Tabs & Filters */}
        <div className="p-5 border-b-2 border-[#121212] bg-[#fbfbfb] flex flex-col gap-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("wallet")}
              className={`border-2 border-[#121212] font-black uppercase text-xs tracking-wider px-3.5 py-2 rounded-xl shadow-[2px_2px_0_0_#121212] transition-all ${
                activeTab === "wallet"
                  ? "bg-[#836EF9] text-white"
                  : "bg-white text-[#121212] hover:bg-slate-50"
              }`}
            >
              Browse Wallet Transactions
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("hash")}
              className={`border-2 border-[#121212] font-black uppercase text-xs tracking-wider px-3.5 py-2 rounded-xl shadow-[2px_2px_0_0_#121212] transition-all ${
                activeTab === "hash"
                  ? "bg-[#836EF9] text-white"
                  : "bg-white text-[#121212] hover:bg-slate-50"
              }`}
            >
              Direct Hash Lookup
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                {activeTab === "wallet" ? "Source Chain Filter" : "Source Chain"}
              </label>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-[#121212] bg-[#fbf9fe] shadow-[2px_2px_0_0_#121212]">
                  {activeTab === "wallet" && selectedChainId === 0 ? (
                    <Globe className="h-5 w-5 text-[#836EF9]" />
                  ) : (
                    <CryptoChainIcon
                      chain={activeTab === "wallet" ? selectedChainId : lookupChainId}
                      className="h-5 w-5"
                    />
                  )}
                </div>
                {activeTab === "wallet" ? (
                  <NeoSelect
                    value={String(selectedChainId)}
                    onChange={(val) => setSelectedChainId(Number(val))}
                    options={[
                      { value: "0", label: "✨ All Supported Chains (Auto-Discover)" },
                      ...SUPPORTED_IMPORT_CHAINS.map((c: SourceChainConfig) => ({
                        value: String(c.chainId),
                        label: `${c.name} (${c.shortName})`,
                      })),
                    ]}
                  />
                ) : (
                  <NeoSelect
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

            {activeTab === "wallet" && (
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Connected Wallet Address (Rule 1)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={queryAddress}
                    onChange={(e) => setQueryAddress(e.target.value)}
                    placeholder="Connect an EVM wallet to fetch"
                    readOnly={Boolean(userAddress)}
                    className="flex-1 border-2 border-[#121212] rounded-xl px-3 py-2 text-xs font-mono bg-white shadow-[2px_2px_0_0_#121212] focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                  />
                  <button
                    type="button"
                    onClick={() => fetchTransactions(false)}
                    disabled={loading || !isValidEvmAddress(queryAddress)}
                    title="Refresh transactions via Alchemy"
                    className="border-2 border-[#121212] bg-white hover:bg-slate-50 disabled:bg-slate-100 text-[#121212] font-black uppercase text-xs px-3 py-2 rounded-xl shadow-[2px_2px_0_0_#121212] flex items-center justify-center transition-all active:translate-x-0.5 active:translate-y-0.5"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                    />
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
                      Connect your EVM wallet to fetch blockchain transactions.
                    </p>
                    <p className="text-xs text-slate-500 max-w-sm">
                      An active external EVM wallet is required to index onchain
                      transactions via Alchemy.
                    </p>
                  </div>
                  {onConnectWallet && (
                    <button
                      type="button"
                      onClick={onConnectWallet}
                      className="mt-2 border-2 border-[#121212] bg-[#836EF9] hover:bg-[#725aeb] text-white font-black uppercase text-xs tracking-wider py-2.5 px-5 rounded-xl shadow-[2px_2px_0_0_#121212] flex items-center gap-2 transition-all active:translate-x-[1px] active:translate-y-[1px]"
                    >
                      <Wallet className="h-4 w-4" />
                      <span>CONNECT EVM WALLET</span>
                    </button>
                  )}
                </div>
              ) : error ? (
                /* State 2: Alchemy / API Error State */
                <div className="border-2 border-[#ef4444] bg-[#fef2f2] text-[#ef4444] p-4 rounded-xl flex flex-col gap-3 shadow-[2px_2px_0_0_#ef4444]">
                  <div className="flex items-center gap-2 font-mono text-xs font-bold">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Alchemy API Error: {error}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fetchTransactions(false)}
                      className="border-2 border-[#ef4444] bg-white hover:bg-[#fef2f2] text-[#ef4444] font-black uppercase text-xs px-3.5 py-1.5 rounded-lg shadow-[2px_2px_0_0_#ef4444] flex items-center gap-1.5 transition-all"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>Retry Alchemy Request</span>
                    </button>
                  </div>
                </div>
              ) : loading ? (
                /* State 3: Loading State */
                <div className="text-center py-12 text-slate-500 font-mono text-xs flex flex-col items-center gap-3">
                  <RefreshCw className="h-8 w-8 animate-spin text-[#836EF9]" />
                  <div className="flex items-center gap-2 mt-1">
                    <AlchemyLogo className="h-4 w-4" />
                    <span className="font-bold text-[#121212]">
                      Fetching verified transfers via Alchemy Asset Transfers API...
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Querying external, erc20, erc721, and internal transfers
                  </span>
                </div>
              ) : transactions.length === 0 ? (
                /* State 4: Honest Empty State with Discovery CTA */
                <div className="text-center py-10 border-2 border-dashed border-[#121212] rounded-xl bg-[#fafafa] p-6 flex flex-col items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div className="font-mono text-xs text-slate-600 max-w-md">
                    {selectedChainId === 0 ? (
                      <p>
                        No on-chain activity found for{" "}
                        <span className="font-bold text-[#121212]">
                          {queryAddress.slice(0, 6)}...{queryAddress.slice(-4)}
                        </span>{" "}
                        across any supported EVM chains.
                      </p>
                    ) : (
                      <p>
                        No attributable transactions found for this wallet on{" "}
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
                      className="mt-1 border-2 border-[#121212] bg-[#836EF9] hover:bg-[#725aeb] text-white font-black uppercase text-xs tracking-wider py-2 px-4 rounded-xl shadow-[2px_2px_0_0_#121212] flex items-center gap-2 transition-all active:translate-x-0.5 active:translate-y-0.5"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      <span>Scan All Supported Chains</span>
                    </button>
                  )}
                </div>
              ) : (
                /* State 5: Loaded Transaction Candidates */
                <>
                  <div className="flex items-center justify-between text-xs font-mono text-slate-500 px-1">
                    <span>
                      Found <strong className="text-[#121212]">{transactions.length}</strong> attributable transactions
                    </span>
                    <span className="text-[10px] uppercase font-bold text-[#836EF9] flex items-center gap-1">
                      <AlchemyLogo className="h-3 w-3" /> Live Ingestion
                    </span>
                  </div>

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
                        className={`border-2 border-[#121212] rounded-xl p-4 shadow-[3px_3px_0_0_#121212] flex flex-col gap-3 transition-all ${
                          tx.isClaimed
                            ? "bg-slate-50 opacity-75"
                            : "bg-white hover:bg-[#faf8fe]"
                        }`}
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          {/* Left: Direction + Token + Amounts */}
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] p-1 ${
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

                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-[#121212] bg-white shadow-[2px_2px_0_0_#121212] p-1.5">
                              <CryptoCoinIcon
                                symbol={tx.assetSymbol}
                                className="h-6 w-6"
                              />
                            </div>

                            <div>
                              <div className="flex items-baseline gap-2">
                                <span className="font-mono text-base font-black text-[#121212]">
                                  {tx.formattedAmount} {tx.assetSymbol}
                                </span>
                                {tx.usdValueFormatted && (
                                  <span className="font-mono text-xs font-bold text-[#16a34a] bg-[#dcfce7] px-1.5 py-0.5 rounded border border-[#16a34a]/30">
                                    {tx.usdValueFormatted} USD
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span
                                  className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded border border-[#121212] ${
                                    isSender
                                      ? "bg-[#fee2e2] text-[#dc2626]"
                                      : "bg-[#dcfce7] text-[#16a34a]"
                                  }`}
                                >
                                  {isSender ? "SENT" : "RECEIVED"}
                                </span>
                                <span
                                  className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded border border-[#121212] ${
                                    tx.status === "confirmed"
                                      ? "bg-[#dcfce7] text-[#16a34a]"
                                      : tx.status === "failed"
                                        ? "bg-[#fee2e2] text-[#dc2626]"
                                        : "bg-[#fef9c3] text-[#ca8a04]"
                                  }`}
                                >
                                  {tx.status}
                                </span>
                                <span className="text-[9px] font-mono uppercase bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-300 flex items-center gap-1">
                                  <CryptoChainIcon
                                    chain={tx.sourceChainId}
                                    className="h-3 w-3"
                                  />
                                  {SUPPORTED_IMPORT_CHAINS.find(
                                    (c) => c.chainId === tx.sourceChainId,
                                  )?.shortName || `Chain ${tx.sourceChainId}`}
                                </span>
                                <span className="text-[9px] font-mono text-[#0052FF] bg-[#f0f4ff] px-1.5 py-0.2 rounded border border-[#0052FF]/30 flex items-center gap-1">
                                  <AlchemyLogo className="h-2.5 w-2.5" />
                                  Alchemy
                                </span>
                                {tx.isClaimed && (
                                  <span className="text-[9px] font-black uppercase bg-[#fee2e2] text-[#dc2626] px-1.5 py-0.2 rounded border border-[#121212]">
                                    CLAIMED
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
                            className={`border-2 border-[#121212] font-black uppercase text-xs tracking-wider px-3.5 py-2 rounded-xl shadow-[2px_2px_0_0_#121212] flex items-center gap-1.5 transition-all ${
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
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Autofill →
                              </>
                            )}
                          </button>
                        </div>

                        {/* Detail row */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono text-slate-600 pt-2 border-t border-slate-100">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400">Tx:</span>
                            <span className="font-bold">
                              {tx.sourceTransactionHash.slice(0, 8)}...
                              {tx.sourceTransactionHash.slice(-6)}
                            </span>
                            {explorerUrl && (
                              <a
                                href={explorerUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#836EF9] hover:underline inline-flex items-center"
                                title="View on block explorer"
                              >
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>

                          <div className="truncate">
                            <span className="text-slate-400">
                              {isSender ? "To:" : "From:"}
                            </span>{" "}
                            <span className="font-bold">
                              {isSender
                                ? tx.recipient
                                  ? `${tx.recipient.slice(0, 6)}...${tx.recipient.slice(-4)}`
                                  : "Contract"
                                : `${tx.sender.slice(0, 6)}...${tx.sender.slice(-4)}`}
                            </span>
                          </div>

                          <div className="sm:text-right">
                            <span className="text-slate-400">Time:</span>{" "}
                            <span className="font-bold text-[#121212]">
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
                        className="border-2 border-[#121212] bg-white hover:bg-slate-50 text-[#121212] font-black uppercase text-xs tracking-wider px-5 py-2.5 rounded-xl shadow-[2px_2px_0_0_#121212] flex items-center gap-2 transition-all active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50"
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
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Enter Source Transaction Hash (0x...)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="0x..."
                    value={lookupHash}
                    onChange={(e) => setLookupHash(e.target.value)}
                    className="flex-1 border-2 border-[#121212] rounded-xl px-3 py-2.5 text-xs font-mono bg-white shadow-[2px_2px_0_0_#121212] focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                  />
                  <button
                    type="button"
                    onClick={handleLookup}
                    disabled={lookupLoading || !lookupHash.trim()}
                    className="border-2 border-[#121212] bg-[#836EF9] hover:bg-[#725aeb] disabled:bg-slate-200 text-white font-black uppercase text-xs px-4 py-2.5 rounded-xl shadow-[2px_2px_0_0_#121212] flex items-center gap-2 transition-all active:translate-x-0.5 active:translate-y-0.5"
                  >
                    {lookupLoading ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Search className="h-3.5 w-3.5" />
                    )}
                    <span>Lookup</span>
                  </button>
                </div>
              </div>

              {lookupError && (
                <div className="border-2 border-[#ef4444] bg-[#fef2f2] text-[#ef4444] p-3 rounded-xl text-xs font-mono font-bold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{lookupError}</span>
                </div>
              )}

              {lookupCandidate && (
                <div
                  className={`border-2 border-[#121212] rounded-xl p-4 shadow-[4px_4px_0_0_#121212] flex flex-col gap-3 ${
                    lookupCandidate.isClaimed ? "bg-slate-50" : "bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-[#121212] bg-[#fbf9fe] shadow-[2px_2px_0_0_#121212] p-1">
                        <CryptoCoinIcon
                          symbol={lookupCandidate.assetSymbol}
                          className="h-7 w-7"
                        />
                      </div>
                      <div>
                        <div className="font-mono text-lg font-black text-[#121212] flex items-center gap-2">
                          <span>
                            {lookupCandidate.formattedAmount}{" "}
                            {lookupCandidate.assetSymbol}
                          </span>
                          {lookupCandidate.usdValueFormatted && (
                            <span className="font-mono text-xs font-bold text-[#16a34a] bg-[#dcfce7] px-2 py-0.5 rounded border border-[#16a34a]/30">
                              {lookupCandidate.usdValueFormatted} USD
                            </span>
                          )}
                          <span className="text-[10px] font-mono uppercase bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-300 flex items-center gap-1">
                            <CryptoChainIcon
                              chain={lookupCandidate.sourceChainId}
                              className="h-3.5 w-3.5"
                            />
                            {SUPPORTED_IMPORT_CHAINS.find(
                              (c) =>
                                c.chainId === lookupCandidate.sourceChainId,
                            )?.shortName ||
                              `Chain ${lookupCandidate.sourceChainId}`}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-slate-500 mt-0.5">
                          Status:{" "}
                          <span
                            className={`font-black uppercase ${
                              lookupCandidate.status === "confirmed"
                                ? "text-[#16a34a]"
                                : "text-[#dc2626]"
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
                      className={`border-2 border-[#121212] font-black uppercase text-xs tracking-wider px-3.5 py-2 rounded-xl shadow-[2px_2px_0_0_#121212] flex items-center gap-1.5 transition-all ${
                        lookupCandidate.isClaimed ||
                        lookupCandidate.status === "failed"
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
                          : "bg-[#836EF9] hover:bg-[#725aeb] text-white active:translate-x-0.5 active:translate-y-0.5"
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Use Transaction Hash →
                    </button>
                  </div>

                  {lookupCandidate.warning && (
                    <div className="border border-[#ca8a04] bg-[#fefce8] text-[#854d0e] p-2 rounded-lg text-xs font-mono flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>{lookupCandidate.warning}</span>
                    </div>
                  )}

                  <div className="text-xs font-mono text-slate-600 space-y-1">
                    <div>
                      <span className="text-slate-400">Sender:</span>{" "}
                      <span>{lookupCandidate.sender}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Recipient:</span>{" "}
                      <span>{lookupCandidate.recipient || "None"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Exact Time:</span>{" "}
                      <span className="font-bold text-[#121212]">
                        {formatTransactionDateTime(
                          lookupCandidate.blockTimestamp,
                        )}
                      </span>
                    </div>
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
            className="border-2 border-[#121212] bg-white hover:bg-slate-100 text-[#121212] font-black uppercase text-xs tracking-wider px-4 py-2 rounded-xl shadow-[2px_2px_0_0_#121212] transition-all active:translate-x-0.5 active:translate-y-0.5"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
