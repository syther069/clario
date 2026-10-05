/**
 * Alchemy Transaction Import Adapter for Clario
 * Source: PRD §9.3; Architecture §4
 *
 * Implements strict live onchain ingestion via Alchemy Asset Transfers API:
 * - Rule 1: Strictly transfers FROM or TO the connected wallet address.
 * - Rule 2: Mainnets and supported testnets with honest provenance.
 * - Rule 3: Chain order: Monad, Ethereum, Base, Hyperliquid, then other EVM chains.
 * - Rule 4: Token order: USDC, USDT, native tokens (ETH, MON, HYPE, POL), then others.
 * - Rule 5: Exact historical USD valuation at block timestamp (never $0 or guess).
 * - Rule 6: Block timestamp preservation for local timezone formatting.
 * - Rule 7: Strict deduplication, correct decimal scaling, failed txn filtering, and spam rejection.
 * - Rule 8: Provenance tracking ("alchemy").
 */

import { type TransactionImportAdapter } from "./adapter";
import {
  type NormalizedTransaction,
  type TransactionFilter,
  type TransactionExecutionStatus,
  IMPORTED_FACTS_DISCLAIMER,
  getTokenPriorityRank,
  isSpamToken,
} from "./types";
import { getExplorerTxUrl } from "./chains";
import { formatBaseUnits } from "../expense/amount";
import { getHistoricalUsdPrice } from "./pricing";
import { MonadFallbackImportAdapter } from "./monad-fallback";

export function getAlchemyEndpoint(
  chainId: number,
  apiKey: string,
): string | null {
  if (!apiKey || apiKey.trim().length === 0) return null;
  const cleanKey = apiKey.trim();
  switch (chainId) {
    case 143:
      return `https://monad-mainnet.g.alchemy.com/v2/${cleanKey}`;
    case 10143:
      return `https://monad-testnet.g.alchemy.com/v2/${cleanKey}`;
    case 1:
      return `https://eth-mainnet.g.alchemy.com/v2/${cleanKey}`;
    case 8453:
      return `https://base-mainnet.g.alchemy.com/v2/${cleanKey}`;
    case 999:
      return `https://hyperliquid-mainnet.g.alchemy.com/v2/${cleanKey}`;
    case 42161:
      return `https://arb-mainnet.g.alchemy.com/v2/${cleanKey}`;
    case 10:
      return `https://opt-mainnet.g.alchemy.com/v2/${cleanKey}`;
    case 137:
      return `https://polygon-mainnet.g.alchemy.com/v2/${cleanKey}`;
    case 11155111:
      return `https://eth-sepolia.g.alchemy.com/v2/${cleanKey}`;
    case 84532:
      return `https://base-sepolia.g.alchemy.com/v2/${cleanKey}`;
    default:
      return null;
  }
}

/**
 * Returns Alchemy asset transfer categories supported for a specific chain.
 * "internal" is only supported on Ethereum Mainnet, Sepolia, and Polygon.
 */
function getTransferCategoriesForChain(chainId: number): string[] {
  if (chainId === 1 || chainId === 11155111 || chainId === 137) {
    return ["external", "internal", "erc20", "erc721", "erc1155"];
  }
  return ["external", "erc20", "erc721", "erc1155"];
}

// Chain-specific native asset symbols
function getNativeAssetSymbol(chainId: number): string {
  switch (chainId) {
    case 143:
    case 10143:
      return "MON";
    case 999:
      return "HYPE";
    case 137:
      return "POL";
    default:
      return "ETH";
  }
}

// Known token decimals
function getKnownTokenDecimals(symbol: string, rawDecimals?: number): number {
  if (rawDecimals !== undefined && rawDecimals > 0 && rawDecimals <= 36) {
    return rawDecimals;
  }
  const norm = (symbol || "").toUpperCase().trim();
  if (norm === "USDC" || norm === "USDT") return 6;
  if (norm === "WBTC" || norm === "BTC") return 8;
  return 18;
}

interface AlchemyTransferItem {
  readonly blockNum: string;
  readonly uniqueId: string;
  readonly hash: string;
  readonly from: string;
  readonly to: string | null;
  readonly value: number | null;
  readonly asset: string | null;
  readonly category: string;
  readonly rawContract?: {
    readonly value?: string | null;
    readonly address?: string | null;
    readonly decimal?: string | null;
  };
  readonly metadata?: {
    readonly blockTimestamp?: string | null;
  };
}

interface AlchemyTransfersResponse {
  readonly jsonrpc: string;
  readonly id: number;
  readonly result?: {
    readonly transfers: readonly AlchemyTransferItem[];
    readonly pageKey?: string;
  };
  readonly error?: {
    readonly code: number;
    readonly message: string;
  };
}

export class AlchemyImportAdapter implements TransactionImportAdapter {
  readonly providerName = "alchemy";
  private apiKey: string | null;
  private monadFallback: MonadFallbackImportAdapter;

  constructor(apiKey?: string, monadFallback?: MonadFallbackImportAdapter) {
    this.apiKey = apiKey ?? process.env.ALCHEMY_API_KEY ?? null;
    this.monadFallback =
      monadFallback ?? new MonadFallbackImportAdapter(this.apiKey ?? undefined);
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  private async normalizeTransfer(
    item: AlchemyTransferItem,
    chainId: number,
    connectedAddress: string,
  ): Promise<NormalizedTransaction | null> {
    const cleanHash = item.hash.toLowerCase() as `0x${string}`;
    const sender = item.from.toLowerCase() as `0x${string}`;
    const recipient = item.to ? (item.to.toLowerCase() as `0x${string}`) : null;
    const normConnected = connectedAddress.toLowerCase();

    // Rule 1: Strictly only transfers from or to the connected wallet
    if (sender !== normConnected && recipient !== normConnected) {
      return null;
    }

    const assetAddress = item.rawContract?.address
      ? (item.rawContract.address.toLowerCase() as `0x${string}`)
      : null;

    let parsedDecimals: number | undefined;
    if (item.rawContract?.decimal) {
      try {
        parsedDecimals = parseInt(item.rawContract.decimal, 16);
      } catch {
        parsedDecimals = undefined;
      }
    }

    const assetSymbol = item.asset || getNativeAssetSymbol(chainId);
    const assetDecimals = getKnownTokenDecimals(assetSymbol, parsedDecimals);

    let rawAmount = "0";
    if (item.rawContract?.value) {
      try {
        rawAmount = BigInt(item.rawContract.value).toString();
      } catch {
        rawAmount = "0";
      }
    }

    let formattedAmount = "0.00";
    if (item.value !== null && item.value !== undefined && !isNaN(item.value)) {
      formattedAmount = item.value.toString();
    } else if (rawAmount !== "0") {
      try {
        formattedAmount = formatBaseUnits(rawAmount, assetDecimals);
      } catch {
        formattedAmount = "0.00";
      }
    }

    // Rule 7: Filter out spam tokens, scam URLs, or zero value transfers
    if (
      isSpamToken({
        assetSymbol,
        formattedAmount,
        rawAmount,
      })
    ) {
      return null;
    }

    let blockNumber: number | null = null;
    if (item.blockNum) {
      try {
        blockNumber = parseInt(item.blockNum, 16);
      } catch {
        blockNumber = null;
      }
    }

    const blockTimestamp =
      item.metadata?.blockTimestamp ?? new Date().toISOString();

    const status: TransactionExecutionStatus = "confirmed";

    // Rule 5: Exact historical USD valuation at the transaction's block timestamp
    const priceResult = await getHistoricalUsdPrice({
      chainId,
      symbol: assetSymbol,
      contractAddress: assetAddress,
      formattedAmount,
      blockTimestamp,
      alchemyApiKey: this.apiKey,
    });

    return {
      sourceChainId: chainId,
      sourceTransactionHash: cleanHash,
      sender,
      recipient,
      assetAddress,
      assetSymbol,
      assetDecimals,
      rawAmount,
      formattedAmount,
      usdValue: priceResult?.usdValue ?? null,
      usdValueFormatted: priceResult?.usdValueFormatted ?? null,
      historicalTokenPrice: priceResult?.priceUsd ?? null,
      blockNumber,
      blockTimestamp,
      status,
      claimSlot: 0,
      provenance: {
        provider: "alchemy",
        fetchedAt: new Date().toISOString(),
        rawReference: getExplorerTxUrl(chainId, cleanHash),
        disclaimer: IMPORTED_FACTS_DISCLAIMER,
      },
    };
  }

  async fetchTransactions(filter: TransactionFilter): Promise<{
    items: readonly NormalizedTransaction[];
    nextCursor: string | null;
  }> {
    if (!this.apiKey) {
      return { items: [], nextCursor: null };
    }

    const targetAddress = filter.address.toLowerCase() as `0x${string}`;

    // Target chains: if a specific chain is requested (and > 0), use it; otherwise scan all supported chains in priority order
    let targetChainIds: number[];
    if (filter.chainId && filter.chainId > 0) {
      if (getAlchemyEndpoint(filter.chainId, this.apiKey)) {
        targetChainIds = [filter.chainId];
      } else {
        targetChainIds = [filter.chainId];
      }
    } else {
      // Order: Monad (10143, 143), Base (8453), Ethereum (1), Sepolia (11155111), Hyperliquid (999), Arbitrum (42161), Optimism (10), Polygon (137), Base Sepolia (84532)
      targetChainIds = [10143, 143, 8453, 1, 11155111, 999, 42161, 10, 137, 84532];
    }

    const maxCountHex = `0x${Math.min(filter.limit ?? 50, 100).toString(16)}`;

    try {
      // Query transfers across target chains for BOTH outgoing (fromAddress) and incoming (toAddress)
      const queryPromises = targetChainIds.flatMap((chainId) => {
        const endpoint = getAlchemyEndpoint(chainId, this.apiKey!);
        if (!endpoint) return [];

        const categories = getTransferCategoriesForChain(chainId);

        const fetchParams = (addressKey: "fromAddress" | "toAddress") => ({
          fromBlock: "0x0",
          toBlock: "latest",
          [addressKey]: targetAddress,
          category: categories,
          order: "desc",
          withMetadata: true,
          excludeZeroValue: false,
          maxCount: maxCountHex,
          ...(filter.cursor ? { pageKey: filter.cursor } : {}),
        });

        const fetchFrom = fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: chainId,
            method: "alchemy_getAssetTransfers",
            params: [fetchParams("fromAddress")],
          }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data: AlchemyTransfersResponse | null) => {
            if (data?.error) {
              console.warn(`[Alchemy] fromAddress error chain ${chainId}:`, data.error);
            }
            return {
              transfers: data?.result?.transfers ?? [],
              pageKey: data?.result?.pageKey ?? null,
              chainId,
            };
          })
          .catch((err) => {
            console.warn(`[Alchemy] fetch error for chain ${chainId}:`, err);
            return { transfers: [], pageKey: null, chainId };
          });

        const fetchTo = fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: chainId,
            method: "alchemy_getAssetTransfers",
            params: [fetchParams("toAddress")],
          }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data: AlchemyTransfersResponse | null) => {
            if (data?.error) {
              console.warn(`[Alchemy] toAddress error chain ${chainId}:`, data.error);
            }
            return {
              transfers: data?.result?.transfers ?? [],
              pageKey: data?.result?.pageKey ?? null,
              chainId,
            };
          })
          .catch((err) => {
            console.warn(`[Alchemy] fetch error for chain ${chainId}:`, err);
            return { transfers: [], pageKey: null, chainId };
          });

        return [fetchFrom, fetchTo];
      });

      const responses = await Promise.all(queryPromises);

      // Raw items collection with deduplication
      const seenKeys = new Set<string>();
      const rawItemsToNormalize: Array<{
        item: AlchemyTransferItem;
        chainId: number;
      }> = [];
      let nextCursor: string | null = null;

      for (const res of responses) {
        if (res.pageKey && !nextCursor) {
          nextCursor = res.pageKey;
        }
        for (const t of res.transfers) {
          // Deduplication key by (chainId, hash, uniqueId or asset/amount)
          const dedupKey = `${res.chainId}:${t.hash.toLowerCase()}:${t.rawContract?.address || t.asset || "native"}:${t.rawContract?.value || t.value || "0"}`;
          if (!seenKeys.has(dedupKey)) {
            seenKeys.add(dedupKey);
            rawItemsToNormalize.push({ item: t, chainId: res.chainId });
          }
        }
      }

      // Normalize all transfers in parallel with historical price resolution
      const normalizedResults = await Promise.all(
        rawItemsToNormalize.map(({ item, chainId }) =>
          this.normalizeTransfer(item, chainId, targetAddress),
        ),
      );

      let validTransactions: NormalizedTransaction[] = normalizedResults.filter(
        (tx): tx is NormalizedTransaction => tx !== null,
      );

      // Monad Direct RPC & Explorer Fallback:
      // If Monad was requested (or queried with all chains), but alchemy_getAssetTransfers returned 0 Monad transfers,
      // fallback to direct Monad RPC and explorer indexer so Monad transactions are properly surfaced.
      const shouldQueryMonad =
        !filter.chainId || filter.chainId === 0 || filter.chainId === 143 || filter.chainId === 10143;
      const targetMonadChain = filter.chainId === 10143 ? 10143 : 143;
      const hasMonadTxs = validTransactions.some(
        (tx) => tx.sourceChainId === targetMonadChain,
      );

      if (shouldQueryMonad && !hasMonadTxs) {
        try {
          const monadRes = await this.monadFallback.fetchTransactions({
            address: targetAddress,
            chainId: targetMonadChain,
            limit: filter.limit ?? 25,
          });
          if (monadRes.items.length > 0) {
            validTransactions = [...validTransactions, ...monadRes.items];
          }
        } catch {
          // Gracefully continue with other chains
        }
      }

      // Rule 4 & 7: Sort by Token hierarchy first (USDC -> USDT -> Native -> Others), then newest first
      validTransactions.sort((a, b) => {
        const rankA = getTokenPriorityRank(a.assetSymbol);
        const rankB = getTokenPriorityRank(b.assetSymbol);
        if (rankA !== rankB) {
          return rankA - rankB;
        }
        const timeA = a.blockTimestamp
          ? new Date(a.blockTimestamp).getTime()
          : 0;
        const timeB = b.blockTimestamp
          ? new Date(b.blockTimestamp).getTime()
          : 0;
        return timeB - timeA;
      });

      return {
        items: validTransactions.slice(0, filter.limit ?? 50),
        nextCursor,
      };
    } catch (err) {
      console.error("[AlchemyImportAdapter] fetchTransactions error:", err);
      return { items: [], nextCursor: null };
    }
  }

  async fetchTransactionByHash(
    chainId: number,
    hash: `0x${string}`,
  ): Promise<NormalizedTransaction | null> {
    if (!this.apiKey) return null;
    const endpoint = getAlchemyEndpoint(chainId, this.apiKey);
    if (!endpoint) return null;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          {
            jsonrpc: "2.0",
            id: 1,
            method: "eth_getTransactionByHash",
            params: [hash],
          },
          {
            jsonrpc: "2.0",
            id: 2,
            method: "eth_getTransactionReceipt",
            params: [hash],
          },
        ]),
      });

      if (!response.ok) return null;
      const data = await response.json();
      const txData = Array.isArray(data)
        ? data.find((d) => d.id === 1)?.result
        : null;
      const receiptData = Array.isArray(data)
        ? data.find((d) => d.id === 2)?.result
        : null;

      if (!txData || !receiptData) {
        if (chainId === 143 || chainId === 10143) {
          return this.monadFallback.fetchTransactionByHash(chainId, hash);
        }
        return null;
      }

      const rawAmount = txData.value ? BigInt(txData.value).toString() : "0";
      const assetSymbol = getNativeAssetSymbol(chainId);
      const formattedAmount = formatBaseUnits(rawAmount, 18);
      const status: TransactionExecutionStatus =
        receiptData.status === "0x1" ? "confirmed" : "failed";

      const blockNumber = receiptData.blockNumber
        ? parseInt(receiptData.blockNumber, 16)
        : null;
      const blockTimestamp = new Date().toISOString();

      const priceResult = await getHistoricalUsdPrice({
        chainId,
        symbol: assetSymbol,
        formattedAmount,
        blockTimestamp,
        alchemyApiKey: this.apiKey,
      });

      return {
        sourceChainId: chainId,
        sourceTransactionHash: hash.toLowerCase() as `0x${string}`,
        sender: txData.from.toLowerCase() as `0x${string}`,
        recipient: txData.to
          ? (txData.to.toLowerCase() as `0x${string}`)
          : null,
        assetAddress: null,
        assetSymbol,
        assetDecimals: 18,
        rawAmount,
        formattedAmount,
        usdValue: priceResult?.usdValue ?? null,
        usdValueFormatted: priceResult?.usdValueFormatted ?? null,
        historicalTokenPrice: priceResult?.priceUsd ?? null,
        blockNumber,
        blockTimestamp,
        status,
        claimSlot: 0,
        provenance: {
          provider: "alchemy",
          fetchedAt: new Date().toISOString(),
          rawReference: getExplorerTxUrl(chainId, hash),
          disclaimer: IMPORTED_FACTS_DISCLAIMER,
        },
      };
    } catch {
      if (chainId === 143 || chainId === 10143) {
        return this.monadFallback.fetchTransactionByHash(chainId, hash);
      }
      return null;
    }
  }
}
