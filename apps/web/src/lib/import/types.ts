/**
 * Clario Attributable Transaction Import Types
 * Source: PRD §9.3; Architecture §4
 * Founder Invariant #12: Imported facts are provider/source-chain records, not Monad-verified truth.
 */

export const IMPORTED_FACTS_DISCLAIMER =
  "Imported facts are provider/source-chain records, not Monad-verified truth." as const;

export type TransactionExecutionStatus = "confirmed" | "failed" | "pending";

export interface TransactionProvenance {
  readonly provider: string;
  readonly fetchedAt: string; // ISO-8601 UTC
  readonly rawReference: string | null;
  readonly disclaimer: typeof IMPORTED_FACTS_DISCLAIMER;
}

export interface NormalizedTransaction {
  readonly sourceChainId: number;
  readonly sourceTransactionHash: `0x${string}`;
  readonly sender: `0x${string}`;
  readonly recipient: `0x${string}` | null;
  readonly assetAddress: `0x${string}` | null;
  readonly assetSymbol: string;
  readonly assetDecimals: number;
  readonly rawAmount: string; // Integer base units as string
  readonly formattedAmount: string; // Human decimal string e.g. "150.00"
  readonly usdValue?: number | null; // Real historical USD valuation at block timestamp
  readonly usdValueFormatted?: string | null; // E.g. "$150.00"
  readonly historicalTokenPrice?: number | null; // Historical token unit price in USD
  readonly blockNumber: number | null;
  readonly blockTimestamp: string | null; // ISO-8601 UTC
  readonly status: TransactionExecutionStatus;
  readonly claimSlot: number;
  readonly provenance: TransactionProvenance;
}

export interface TransactionImportCandidate extends NormalizedTransaction {
  readonly isClaimed: boolean;
  readonly claimedByExpenseId: string | null;
  readonly warning: string | null;
}

export interface PaginatedTransactions {
  readonly items: readonly TransactionImportCandidate[];
  readonly nextCursor: string | null;
  readonly provider: string;
  readonly disclaimer: typeof IMPORTED_FACTS_DISCLAIMER;
}

export interface TransactionFilter {
  readonly address: `0x${string}`;
  readonly chainId?: number | undefined;
  readonly limit?: number | undefined;
  readonly cursor?: string | undefined;
  readonly timeoutMs?: number | undefined;
}

/**
 * Formats a block timestamp in the user's local timezone
 * Format: "30 Sep 2026, 2:45 PM" (strictly fulfills Rule 6)
 */
export function formatTransactionDateTime(
  isoOrDateString?: string | null,
): string {
  if (!isoOrDateString) return "Pending timestamp";
  const date = new Date(isoOrDateString);
  if (isNaN(date.getTime())) return String(isoOrDateString);

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;

  return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
}

/**
 * Strict token priority rank (Rule 4: USDC, USDT, native tokens, then others)
 */
export function getTokenPriorityRank(symbol: string): number {
  const norm = (symbol || "").toUpperCase().trim();
  if (norm === "USDC") return 1;
  if (norm === "USDT") return 2;
  if (
    ["ETH", "WETH", "MON", "HYPE", "POL", "MATIC", "BTC", "WBTC"].includes(norm)
  ) {
    return 3;
  }
  return 4;
}

/**
 * Filters spam tokens, scam URLs, and zero-value airdrops (Rule 7)
 */
export function isSpamToken(transfer: {
  assetSymbol?: string | null;
  formattedAmount?: string | null;
  rawAmount?: string | null;
}): boolean {
  const symbol = (transfer.assetSymbol || "").trim();
  const amt = parseFloat(transfer.formattedAmount || "0");
  if (amt <= 0 || isNaN(amt)) return true;

  const spamPatterns = [
    /\.com/i,
    /\.org/i,
    /\.io/i,
    /\.xyz/i,
    /\.net/i,
    /\.cc/i,
    /\.app/i,
    /claim/i,
    /visit/i,
    /airdrop/i,
    /reward/i,
    /gift/i,
    /voucher/i,
    /free/i,
    /official/i,
  ];

  return spamPatterns.some((pattern) => pattern.test(symbol));
}
