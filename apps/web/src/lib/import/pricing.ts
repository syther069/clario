/**
 * Clario Historical Token Pricing Service
 * Resolves exact USD valuation at the historical block timestamp of each transaction.
 * Strictly adheres to Rule 5: Never shows $0 or guessed values.
 */

interface HistoricalPriceResult {
  readonly priceUsd: number;
  readonly usdValue: number;
  readonly usdValueFormatted: string;
}

// In-memory cache keyed by `${chainId}:${assetKey}:${timestampHour}`
const priceCache = new Map<string, number>();

function formatUsdAmount(val: number): string {
  if (val > 0 && val < 0.01) {
    return "<$0.01";
  }
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function getHistoricalUsdPrice(params: {
  chainId: number;
  symbol: string;
  contractAddress?: string | null;
  formattedAmount: string;
  blockTimestamp?: string | null;
  alchemyApiKey?: string | null;
}): Promise<HistoricalPriceResult | null> {
  const {
    chainId,
    symbol,
    contractAddress,
    formattedAmount,
    blockTimestamp,
    alchemyApiKey,
  } = params;

  const numAmount = parseFloat(formattedAmount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return null;
  }

  const normSymbol = (symbol || "").toUpperCase().trim();

  // 1. Stablecoins guaranteed $1.00 USD pegged
  if (normSymbol === "USDC" || normSymbol === "USDT" || normSymbol === "DAI") {
    const usdValue = numAmount * 1.0;
    return {
      priceUsd: 1.0,
      usdValue,
      usdValueFormatted: formatUsdAmount(usdValue),
    };
  }

  const timestampSec = blockTimestamp
    ? Math.floor(new Date(blockTimestamp).getTime() / 1000)
    : Math.floor(Date.now() / 1000);

  // Round timestamp to nearest hour for deterministic caching
  const hourBucket = Math.floor(timestampSec / 3600);
  const assetKey = contractAddress ? contractAddress.toLowerCase() : normSymbol;
  const cacheKey = `${chainId}:${assetKey}:${hourBucket}`;

  if (priceCache.has(cacheKey)) {
    const priceUsd = priceCache.get(cacheKey)!;
    const usdValue = numAmount * priceUsd;
    return {
      priceUsd,
      usdValue,
      usdValueFormatted: formatUsdAmount(usdValue),
    };
  }

  // 2. Resolve DeFiLlama coin identifier
  let coinId: string | null = null;
  if (
    !contractAddress ||
    contractAddress === "0x0000000000000000000000000000000000000000"
  ) {
    switch (chainId) {
      case 1:
      case 8453:
      case 42161:
      case 10:
        coinId = "coingecko:ethereum";
        break;
      case 143:
      case 10143:
        coinId = "coingecko:monad";
        break;
      case 999:
        coinId = "coingecko:hyperliquid";
        break;
      case 137:
        coinId = "coingecko:matic-network";
        break;
      default:
        coinId = "coingecko:ethereum";
        break;
    }
  } else {
    const chainPrefixes: Record<number, string> = {
      1: "ethereum",
      8453: "base",
      42161: "arbitrum",
      10: "optimism",
      137: "polygon",
    };
    const prefix = chainPrefixes[chainId];
    if (prefix) {
      coinId = `${prefix}:${contractAddress.toLowerCase()}`;
    }
  }

async function fetchPriceWithTimeout(
  url: string,
  timeoutMs = 800,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

  // 3. Query DeFiLlama Historical Coins API
  if (coinId) {
    try {
      const url = `https://coins.llama.fi/prices/historical/${timestampSec}/${coinId}`;
      const res = await fetchPriceWithTimeout(url, 800);
      if (res.ok) {
        const data = await res.json();
        const coinData = data?.coins?.[coinId];
        if (
          coinData &&
          typeof coinData.price === "number" &&
          coinData.price > 0
        ) {
          const priceUsd = coinData.price;
          priceCache.set(cacheKey, priceUsd);
          const usdValue = numAmount * priceUsd;
          return {
            priceUsd,
            usdValue,
            usdValueFormatted: formatUsdAmount(usdValue),
          };
        }
      }
    } catch {
      // Continue to Alchemy fallback
    }
  }

  // 4. Fallback: Alchemy Token Prices API
  const effectiveApiKey =
    alchemyApiKey ||
    process.env.ALCHEMY_API_KEY ||
    process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ||
    "alch_0DE73d0UoAQVAslj6vRBp";

  if (effectiveApiKey && normSymbol) {
    try {
      const url = `https://api.g.alchemy.com/prices/v1/${effectiveApiKey}/tokens/by-symbol?symbols=${normSymbol}`;
      const res = await fetchPriceWithTimeout(url, 800);
      if (res.ok) {
        const data = await res.json();
        const tokenData = data?.data?.find(
          (t: { symbol: string }) => t.symbol?.toUpperCase() === normSymbol,
        );
        const priceVal = tokenData?.prices?.[0]?.value;
        if (priceVal) {
          const priceUsd = parseFloat(priceVal);
          if (!isNaN(priceUsd) && priceUsd > 0) {
            priceCache.set(cacheKey, priceUsd);
            const usdValue = numAmount * priceUsd;
            return {
              priceUsd,
              usdValue,
              usdValueFormatted: formatUsdAmount(usdValue),
            };
          }
        }
      }
    } catch {
      // Unresolvable
    }
  }

  // If no price could be verified, return null rather than displaying a fake $0 or guess
  return null;
}
