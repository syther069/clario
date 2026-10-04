/**
 * Monad Direct RPC and Block Explorer Fallback Adapter for Clario
 * Source: PRD §9.3; Architecture §4
 *
 * Provides a resilient multi-tier fallback for Monad Mainnet (143) and Testnet (10143):
 * 1. Explorer Fallback: Etherscan v2 API (api.etherscan.io/v2/api?chainid=143/10143) for historical transfers.
 * 2. Direct Monad RPC Log Scanner: Viem public client querying ERC-20 Transfer logs in bounded 100-block windows.
 * 3. Direct Monad RPC Single Tx Lookup: Reads transaction and receipt directly via Viem on Monad RPC.
 * 4. Exact historical USD valuation at block timestamp via pricing.ts.
 */

import {
  createPublicClient,
  http,
  parseAbiItem,
  type PublicClient,
} from "viem";
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

const ERC20_TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

interface EtherscanTokenTxItem {
  readonly blockNumber: string;
  readonly timeStamp: string;
  readonly hash: string;
  readonly from: string;
  readonly to: string;
  readonly value: string;
  readonly tokenName?: string;
  readonly tokenSymbol?: string;
  readonly tokenDecimal?: string;
  readonly contractAddress?: string;
}

interface EtherscanNormalTxItem {
  readonly blockNumber: string;
  readonly timeStamp: string;
  readonly hash: string;
  readonly from: string;
  readonly to: string;
  readonly value: string;
  readonly isError?: string;
  readonly txreceipt_status?: string;
}

interface EtherscanApiResponse<T> {
  readonly status: string;
  readonly message: string;
  readonly result?: T;
}

export class MonadFallbackImportAdapter implements TransactionImportAdapter {
  readonly providerName = "monad_fallback";
  private alchemyApiKey: string | null;
  private explorerApiKey: string | null;

  constructor(alchemyApiKey?: string, explorerApiKey?: string) {
    this.alchemyApiKey = alchemyApiKey ?? process.env.ALCHEMY_API_KEY ?? null;
    this.explorerApiKey =
      explorerApiKey ??
      process.env.ETHERSCAN_API_KEY ??
      process.env.MONAD_EXPLORER_API_KEY ??
      null;
  }

  getRpcUrl(chainId: number): string {
    if (chainId === 10143) {
      return "https://testnet-rpc.monad.xyz";
    }
    if (this.alchemyApiKey && this.alchemyApiKey.trim().length > 0) {
      return `https://monad-mainnet.g.alchemy.com/v2/${this.alchemyApiKey}`;
    }
    return "https://rpc.monad.xyz";
  }

  getViemClient(chainId: number): PublicClient {
    return createPublicClient({
      transport: http(this.getRpcUrl(chainId), {
        timeout: 8000,
        retryCount: 2,
      }),
    });
  }

  /**
   * Tier 1: Etherscan v2 Multichain API query for Monad (Chain ID 143 / 10143)
   */
  private async fetchFromExplorer(
    targetAddress: `0x${string}`,
    chainId: number,
    limit: number,
  ): Promise<NormalizedTransaction[]> {
    const apiKeyParam = this.explorerApiKey
      ? `&apikey=${encodeURIComponent(this.explorerApiKey)}`
      : "";

    // 1. Fetch ERC-20 token transfers
    const tokenTxUrl =
      chainId === 10143 && !this.explorerApiKey
        ? `https://testnet.monadexplorer.com/api?module=account&action=tokentx&address=${targetAddress}&page=1&offset=${limit}&sort=desc`
        : `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=tokentx&address=${targetAddress}&startblock=0&endblock=99999999&page=1&offset=${limit}&sort=desc${apiKeyParam}`;
    // 2. Fetch normal native MON transactions
    const normalTxUrl =
      chainId === 10143 && !this.explorerApiKey
        ? `https://testnet.monadexplorer.com/api?module=account&action=txlist&address=${targetAddress}&page=1&offset=${limit}&sort=desc`
        : `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=txlist&address=${targetAddress}&startblock=0&endblock=99999999&page=1&offset=${limit}&sort=desc${apiKeyParam}`;

    const [tokenRes, normalRes] = await Promise.all([
      fetch(tokenTxUrl, {
        headers: { Accept: "application/json", "User-Agent": "Clario/1.0" },
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(normalTxUrl, {
        headers: { Accept: "application/json", "User-Agent": "Clario/1.0" },
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);

    const results: NormalizedTransaction[] = [];
    const seenHashes = new Set<string>();

    // Process ERC-20 Token Transfers
    const tokenData = tokenRes as EtherscanApiResponse<
      EtherscanTokenTxItem[]
    > | null;
    if (tokenData?.status === "1" && Array.isArray(tokenData.result)) {
      for (const item of tokenData.result) {
        const cleanHash = item.hash.toLowerCase() as `0x${string}`;
        const sender = item.from.toLowerCase() as `0x${string}`;
        const recipient = item.to.toLowerCase() as `0x${string}`;

        if (sender !== targetAddress && recipient !== targetAddress) {
          continue;
        }

        const assetSymbol = (item.tokenSymbol || "TOKEN").toUpperCase().trim();
        const assetDecimals = parseInt(item.tokenDecimal || "18", 10);
        const rawAmount = item.value || "0";
        const formattedAmount = formatBaseUnits(rawAmount, assetDecimals);

        if (isSpamToken({ assetSymbol, formattedAmount, rawAmount })) {
          continue;
        }

        const blockTimestamp = item.timeStamp
          ? new Date(parseInt(item.timeStamp, 10) * 1000).toISOString()
          : new Date().toISOString();

        const priceResult = await getHistoricalUsdPrice({
          chainId,
          symbol: assetSymbol,
          contractAddress: item.contractAddress ?? null,
          formattedAmount,
          blockTimestamp,
          alchemyApiKey: this.alchemyApiKey,
        });

        seenHashes.add(cleanHash);
        results.push({
          sourceChainId: chainId,
          sourceTransactionHash: cleanHash,
          sender,
          recipient,
          assetAddress: item.contractAddress
            ? (item.contractAddress.toLowerCase() as `0x${string}`)
            : null,
          assetSymbol,
          assetDecimals,
          rawAmount,
          formattedAmount,
          usdValue: priceResult?.usdValue ?? null,
          usdValueFormatted: priceResult?.usdValueFormatted ?? null,
          historicalTokenPrice: priceResult?.priceUsd ?? null,
          blockNumber: item.blockNumber ? parseInt(item.blockNumber, 10) : null,
          blockTimestamp,
          status: "confirmed",
          claimSlot: 0,
          provenance: {
            provider: "monad_explorer",
            fetchedAt: new Date().toISOString(),
            rawReference: getExplorerTxUrl(chainId, cleanHash),
            disclaimer: IMPORTED_FACTS_DISCLAIMER,
          },
        });
      }
    }

    // Process Native MON Transactions
    const normalData = normalRes as EtherscanApiResponse<
      EtherscanNormalTxItem[]
    > | null;
    if (normalData?.status === "1" && Array.isArray(normalData.result)) {
      for (const item of normalData.result) {
        const cleanHash = item.hash.toLowerCase() as `0x${string}`;
        if (seenHashes.has(cleanHash)) continue;

        const sender = item.from.toLowerCase() as `0x${string}`;
        const recipient = item.to
          ? (item.to.toLowerCase() as `0x${string}`)
          : null;

        if (sender !== targetAddress && recipient !== targetAddress) {
          continue;
        }

        const rawAmount = item.value || "0";
        if (rawAmount === "0") continue; // Skip zero-value contract interactions

        const formattedAmount = formatBaseUnits(rawAmount, 18);
        const blockTimestamp = item.timeStamp
          ? new Date(parseInt(item.timeStamp, 10) * 1000).toISOString()
          : new Date().toISOString();

        const isFailed = item.isError === "1" || item.txreceipt_status === "0";
        const status: TransactionExecutionStatus = isFailed
          ? "failed"
          : "confirmed";

        const priceResult = await getHistoricalUsdPrice({
          chainId,
          symbol: "MON",
          formattedAmount,
          blockTimestamp,
          alchemyApiKey: this.alchemyApiKey,
        });

        seenHashes.add(cleanHash);
        results.push({
          sourceChainId: chainId,
          sourceTransactionHash: cleanHash,
          sender,
          recipient,
          assetAddress: null,
          assetSymbol: "MON",
          assetDecimals: 18,
          rawAmount,
          formattedAmount,
          usdValue: priceResult?.usdValue ?? null,
          usdValueFormatted: priceResult?.usdValueFormatted ?? null,
          historicalTokenPrice: priceResult?.priceUsd ?? null,
          blockNumber: item.blockNumber ? parseInt(item.blockNumber, 10) : null,
          blockTimestamp,
          status,
          claimSlot: 0,
          provenance: {
            provider: "monad_explorer",
            fetchedAt: new Date().toISOString(),
            rawReference: getExplorerTxUrl(chainId, cleanHash),
            disclaimer: IMPORTED_FACTS_DISCLAIMER,
          },
        });
      }
    }

    return results;
  }

  /**
   * Tier 2: Direct Monad RPC Log Scanner (Querying Viem for ERC-20 Transfer events)
   * Note: Monad RPC enforces a maximum 100-block range for eth_getLogs.
   */
  private async fetchFromRpcLogs(
    targetAddress: `0x${string}`,
    chainId: number,
    limit: number,
  ): Promise<NormalizedTransaction[]> {
    const client = this.getViemClient(chainId);

    try {
      const latestBlock = await client.getBlockNumber();
      // Scan up to the last 500 blocks in 5 chunks of 100
      const chunkRanges: Array<{ from: bigint; to: bigint }> = [];
      const numChunks = 5;
      for (let i = 0; i < numChunks; i++) {
        const to = latestBlock - BigInt(i * 100);
        if (to < 0n) break;
        const from = to >= 99n ? to - 99n : 0n;
        chunkRanges.push({ from, to });
      }

      // Query incoming and outgoing transfer logs in parallel across chunks
      const logPromises = chunkRanges.flatMap((range) => [
        client
          .getLogs({
            fromBlock: range.from,
            toBlock: range.to,
            event: ERC20_TRANSFER_EVENT,
            args: { to: targetAddress },
          })
          .catch(() => []),
        client
          .getLogs({
            fromBlock: range.from,
            toBlock: range.to,
            event: ERC20_TRANSFER_EVENT,
            args: { from: targetAddress },
          })
          .catch(() => []),
      ]);

      const logBatches = await Promise.all(logPromises);
      const allLogs = logBatches.flat();

      if (allLogs.length === 0) {
        return [];
      }

      // Deduplicate logs by transactionHash
      const seenTxHashes = new Set<string>();
      const uniqueLogs = allLogs.filter((l) => {
        if (!l.transactionHash) return false;
        const lower = l.transactionHash.toLowerCase();
        if (seenTxHashes.has(lower)) return false;
        seenTxHashes.add(lower);
        return true;
      });

      const transactions: NormalizedTransaction[] = [];

      for (const log of uniqueLogs.slice(0, limit)) {
        if (!log.transactionHash || !log.args) continue;

        const sender = (log.args.from as string).toLowerCase() as `0x${string}`;
        const recipient = (
          log.args.to as string
        ).toLowerCase() as `0x${string}`;
        const rawAmount = log.args.value?.toString() ?? "0";
        const assetAddress = log.address.toLowerCase() as `0x${string}`;

        // Monad Testnet USDC check or default
        let assetSymbol = "USDC";
        let assetDecimals = 6;
        if (
          assetAddress ===
          "0x754704bc059f8c67012fed69bc8a327a5aafb603".toLowerCase()
        ) {
          assetSymbol = "USDC";
          assetDecimals = 6;
        }

        const formattedAmount = formatBaseUnits(rawAmount, assetDecimals);

        if (isSpamToken({ assetSymbol, formattedAmount, rawAmount })) {
          continue;
        }

        // Get block timestamp
        let blockTimestamp = new Date().toISOString();
        if (log.blockNumber) {
          try {
            const blk = await client.getBlock({
              blockNumber: log.blockNumber,
            });
            blockTimestamp = new Date(
              Number(blk.timestamp) * 1000,
            ).toISOString();
          } catch {
            blockTimestamp = new Date().toISOString();
          }
        }

        const cleanHash = log.transactionHash.toLowerCase() as `0x${string}`;
        const priceResult = await getHistoricalUsdPrice({
          chainId,
          symbol: assetSymbol,
          contractAddress: assetAddress,
          formattedAmount,
          blockTimestamp,
          alchemyApiKey: this.alchemyApiKey,
        });

        transactions.push({
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
          blockNumber: log.blockNumber ? Number(log.blockNumber) : null,
          blockTimestamp,
          status: "confirmed",
          claimSlot: 0,
          provenance: {
            provider: "monad_rpc",
            fetchedAt: new Date().toISOString(),
            rawReference: getExplorerTxUrl(chainId, cleanHash),
            disclaimer: IMPORTED_FACTS_DISCLAIMER,
          },
        });
      }

      return transactions;
    } catch {
      return [];
    }
  }

  async fetchTransactions(filter: TransactionFilter): Promise<{
    items: readonly NormalizedTransaction[];
    nextCursor: string | null;
  }> {
    const chainId = filter.chainId ?? 143;
    // Only handles Monad Mainnet (143) and Monad Testnet (10143)
    if (chainId !== 143 && chainId !== 10143) {
      return { items: [], nextCursor: null };
    }

    const targetAddress = filter.address.toLowerCase() as `0x${string}`;
    const limit = Math.min(filter.limit ?? 25, 50);

    // 1. Try Explorer fallback first
    let transactions = await this.fetchFromExplorer(
      targetAddress,
      chainId,
      limit,
    );

    // 2. If explorer returns no transactions, fall back to direct Monad RPC log scanner
    if (transactions.length === 0) {
      transactions = await this.fetchFromRpcLogs(targetAddress, chainId, limit);
    }

    // Sort by Token Hierarchy (USDC > USDT > MON > others), then newest first
    transactions.sort((a, b) => {
      const rankA = getTokenPriorityRank(a.assetSymbol);
      const rankB = getTokenPriorityRank(b.assetSymbol);
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      const timeA = a.blockTimestamp ? new Date(a.blockTimestamp).getTime() : 0;
      const timeB = b.blockTimestamp ? new Date(b.blockTimestamp).getTime() : 0;
      return timeB - timeA;
    });

    return {
      items: transactions.slice(0, limit),
      nextCursor: null,
    };
  }

  async fetchTransactionByHash(
    chainId: number,
    hash: `0x${string}`,
  ): Promise<NormalizedTransaction | null> {
    if (chainId !== 143 && chainId !== 10143) {
      return null;
    }

    const client = this.getViemClient(chainId);
    const cleanHash = hash.toLowerCase() as `0x${string}`;

    try {
      const [tx, receipt] = await Promise.all([
        client.getTransaction({ hash: cleanHash }).catch(() => null),
        client.getTransactionReceipt({ hash: cleanHash }).catch(() => null),
      ]);

      if (!tx || !receipt) {
        return null;
      }

      let blockTimestamp = new Date().toISOString();
      if (receipt.blockNumber) {
        try {
          const blk = await client.getBlock({
            blockNumber: receipt.blockNumber,
          });
          blockTimestamp = new Date(Number(blk.timestamp) * 1000).toISOString();
        } catch {
          blockTimestamp = new Date().toISOString();
        }
      }

      const status: TransactionExecutionStatus =
        receipt.status === "success" ? "confirmed" : "failed";

      let assetAddress: `0x${string}` | null = null;
      let assetSymbol = "MON";
      let assetDecimals = 18;
      let rawAmount = tx.value ? tx.value.toString() : "0";
      let recipient: `0x${string}` | null = tx.to
        ? (tx.to.toLowerCase() as `0x${string}`)
        : null;

      // Scan for ERC-20 Transfer logs
      for (const log of receipt.logs) {
        if (
          log.topics[0]?.toLowerCase() ===
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
        ) {
          try {
            assetAddress = log.address.toLowerCase() as `0x${string}`;
            if (log.topics[2]) {
              recipient = (
                "0x" + log.topics[2].slice(26)
              ).toLowerCase() as `0x${string}`;
            }
            if (log.data && log.data !== "0x") {
              rawAmount = BigInt(log.data).toString();
            }
            assetSymbol = "USDC";
            assetDecimals = 6;
            break;
          } catch {
            // Not standard ERC20 log
          }
        }
      }

      const formattedAmount = formatBaseUnits(rawAmount, assetDecimals);

      const priceResult = await getHistoricalUsdPrice({
        chainId,
        symbol: assetSymbol,
        contractAddress: assetAddress,
        formattedAmount,
        blockTimestamp,
        alchemyApiKey: this.alchemyApiKey,
      });

      return {
        sourceChainId: chainId,
        sourceTransactionHash: cleanHash,
        sender: tx.from.toLowerCase() as `0x${string}`,
        recipient,
        assetAddress,
        assetSymbol,
        assetDecimals,
        rawAmount,
        formattedAmount,
        usdValue: priceResult?.usdValue ?? null,
        usdValueFormatted: priceResult?.usdValueFormatted ?? null,
        historicalTokenPrice: priceResult?.priceUsd ?? null,
        blockNumber: receipt.blockNumber ? Number(receipt.blockNumber) : null,
        blockTimestamp,
        status,
        claimSlot: 0,
        provenance: {
          provider: "monad_rpc",
          fetchedAt: new Date().toISOString(),
          rawReference: getExplorerTxUrl(chainId, cleanHash),
          disclaimer: IMPORTED_FACTS_DISCLAIMER,
        },
      };
    } catch {
      return null;
    }
  }
}
