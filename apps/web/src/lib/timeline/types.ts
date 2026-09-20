/**
 * Authoritative Activity Timeline & Proof Spine Types
 *
 * Reconstructs local, submitted, confirmed, replaced, failed, and indexed workflow events.
 * Adheres strictly to PRD 9.10, DESIGN.md Proof Spine rules, and RULES.md.
 */

export type TimelineEventType =
  | "draft_created"
  | "source_transaction_linked"
  | "evidence_attached"
  | "evidence_replaced"
  | "ai_extraction_completed"
  | "version_submitted"
  | "commitment_confirmed"
  | "review_started"
  | "changes_requested"
  | "decision_recorded"
  | "version_superseded"
  | "reimbursement_prepared"
  | "settlement_confirmed"
  | "transaction_reorged"
  | "transaction_failed";

export type TimelineEventSource =
  "application" | "onchain_indexer" | "onchain_rpc" | "hybrid";

export type ConfirmationState =
  | "local_draft"
  | "pending"
  | "confirming"
  | "confirmed"
  | "superseded"
  | "reorged"
  | "failed";

export type TimestampType = "application" | "block" | "indexer";

export interface TimestampDetail {
  /** Primary timestamp used for chronological sorting (ISO string) */
  readonly primary: string;
  /** Taxonomy of the primary timestamp */
  readonly primaryType: TimestampType;
  /** Application record creation/update time (ISO string or null) */
  readonly applicationTime: string | null;
  /** Finalized onchain block time (ISO string or null) */
  readonly blockTime: string | null;
  /** Indexer checkpoint ingestion time (ISO string or null) */
  readonly indexerTime: string | null;
}

export interface TimelineEvent {
  /** Unique, deterministic event identifier */
  readonly id: string;
  /** Event taxonomy */
  readonly type: TimelineEventType;
  /** Human-readable event headline */
  readonly title: string;
  /** Detailed description or explanation */
  readonly description: string;
  /** Actor address (0x...) or internal user identifier */
  readonly actor: string;
  /** Semantic role of the actor at event time (e.g. submitter, approver, treasury, system) */
  readonly actorRole?: string | undefined;
  /** Expense version associated with this event (1, 2, ... or null for unversioned draft) */
  readonly version: number | null;
  /** Whether this event belongs to the current active expense version */
  readonly isCurrentVersion: boolean;
  /** Whether this event is part of a superseded/historical branch that bent left */
  readonly isSupersededBranch: boolean;
  /** Branch identifier grouping historical version branches (e.g. "v1") */
  readonly branchId?: string | undefined;
  /** Data source providing this event */
  readonly source: TimelineEventSource;
  /** Exact lifecycle confirmation state */
  readonly confirmationState: ConfirmationState;
  /** Multi-dimensional timestamp taxonomy */
  readonly timestamp: TimestampDetail;
  /** Expense commitment hash (0x... 32 bytes) if applicable */
  readonly commitment?: string | null | undefined;
  /** Predecessor commitment hash for version lineage */
  readonly previousCommitment?: string | null | undefined;
  /** Onchain transaction hash (0x... 32 bytes) if applicable */
  readonly txHash?: string | null | undefined;
  /** Onchain block number if confirmed */
  readonly blockNumber?: number | null | undefined;
  /** Chain ID where transaction took place */
  readonly chainId?: number | null | undefined;
  /** Block explorer verification URL */
  readonly explorerUrl?: string | null | undefined;
  /** Additional structured metadata (reasons, amounts, file names, etc.) */
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface IndexerLagStatus {
  /** Whether the indexer is trailing known finalized onchain transactions */
  readonly isLagging: boolean;
  /** Highest block number seen across confirmed transactions */
  readonly latestKnownBlock: number;
  /** Highest block number indexed in the checkpoint */
  readonly indexedCheckpointBlock: number;
  /** Number of blocks the indexer is trailing */
  readonly lagBlocks: number;
  /** Explanation or status guidance for the user */
  readonly message: string;
}

export interface RpcConflictStatus {
  /** Whether an RPC reorg or unconfirmed conflict was detected */
  readonly hasConflict: boolean;
  /** Conflict classification */
  readonly conflictType?:
    "reorg_detected" | "hash_mismatch" | "unconfirmed_timeout" | undefined;
  /** Human-readable explanation and recovery instructions */
  readonly message?: string | undefined;
  /** Affected transaction hashes */
  readonly affectedTxHashes?: readonly string[] | undefined;
}

export interface ExpenseTimelineResponse {
  readonly expenseId: string;
  readonly workspaceId: string;
  readonly currentVersion: number;
  readonly currentStatus: string;
  readonly isSuperseded: boolean;
  readonly events: readonly TimelineEvent[];
  readonly indexerLag: IndexerLagStatus;
  readonly rpcConflict: RpcConflictStatus;
  readonly generatedAt: string;
}
