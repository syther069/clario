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
