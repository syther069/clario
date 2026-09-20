import type {
  Bytes32,
  CommitmentHash,
  EvmAddress,
  ExpenseId,
  ExpenseVersion,
  PaymentReference,
  PolicyCommitment,
  PolicyVersion,
  WorkspaceId,
} from "@clario/protocol";

export interface LogMetadata {
  readonly chainId: bigint;
  readonly contractAddress: EvmAddress;
  readonly blockNumber: bigint;
  readonly blockHash: Bytes32;
  readonly transactionHash: Bytes32;
  readonly logIndex: number;
}

export interface RawEventLog {
  readonly address: string;
  readonly topics: string[];
  readonly data: string;
  readonly blockNumber: string | number | bigint;
  readonly blockHash: string;
  readonly transactionHash: string;
  readonly logIndex: string | number;
  readonly removed?: boolean | undefined;
}

export interface IngestResult {
  readonly status: "indexed" | "already_processed" | "dead_lettered" | "failed";
  readonly eventId?: string | undefined;
  readonly eventName: string;
  readonly transactionHash: string;
  readonly logIndex: number;
  readonly error?: string | undefined;
}

export interface BatchIngestResult {
  readonly total: number;
  readonly indexed: number;
  readonly skipped: number;
  readonly deadLettered: number;
  readonly failed: number;
  readonly results: IngestResult[];
}

export interface CheckpointState {
  readonly chainId: bigint;
  readonly contractAddress: EvmAddress;
  readonly lastIndexedBlock: bigint;
  readonly lastIndexedBlockHash: Bytes32;
  readonly updatedAt: Date | string;
}

export interface DeadLetterItem {
  readonly deadLetterId: string;
  readonly chainId: bigint;
  readonly blockNumber: bigint;
  readonly blockHash: Bytes32;
  readonly transactionHash: Bytes32;
  readonly logIndex: number;
  readonly eventName: string;
  readonly contractAddress: EvmAddress;
  readonly payload: Record<string, unknown>;
  readonly errorMessage: string;
  readonly attempts: number;
  readonly createdAt: Date | string;
  readonly resolvedAt: Date | string | null;
}

export interface ReorgRollbackResult {
  readonly rolledBackFromBlock: bigint;
  readonly markedRemovedCount: number;
  readonly affectedWorkspaces: WorkspaceId[];
}

export interface RebuildProjectionsResult {
  readonly chainId: bigint;
  readonly fromBlock: bigint;
  readonly totalEventsReplayed: number;
  readonly projectionsRebuilt: {
    readonly workspaces: number;
    readonly roleGrants: number;
    readonly policyVersions: number;
    readonly expenses: number;
    readonly expenseVersions: number;
    readonly decisions: number;
    readonly settlements: number;
  };
  readonly durationMs: number;
}

export interface PublicWorkspaceProjection {
  readonly workspaceId: WorkspaceId;
  readonly ownerAddress: EvmAddress;
  readonly policyCommitment: PolicyCommitment;
  readonly currentPolicyVersion: PolicyVersion;
  readonly createdAtBlock: bigint;
  readonly createdAtTx: Bytes32;
  readonly updatedAt: Date | string;
}

export interface PublicRoleGrantProjection {
  readonly grantId: string;
  readonly workspaceId: WorkspaceId;
  readonly accountAddress: EvmAddress;
  readonly role: Bytes32;
  readonly scope: Bytes32;
  readonly active: boolean;
  readonly grantedAtBlock: bigint;
  readonly grantedAtTx: Bytes32;
  readonly revokedAtBlock: bigint | null;
  readonly revokedAtTx: Bytes32 | null;
}

export interface PublicPolicyVersionProjection {
  readonly workspaceId: WorkspaceId;
  readonly policyVersion: PolicyVersion;
  readonly policyCommitment: PolicyCommitment;
  readonly updatedAtBlock: bigint;
  readonly updatedAtTx: Bytes32;
  readonly indexedAt: Date | string;
}

export interface PublicExpenseProjection {
  readonly workspaceId: WorkspaceId;
  readonly expenseId: ExpenseId;
  readonly currentVersion: ExpenseVersion;
  readonly currentCommitment: CommitmentHash;
  readonly latestSubmitter: EvmAddress;
  readonly submittedAtBlock: bigint;
  readonly submittedAtTx: Bytes32;
  readonly updatedAt: Date | string;
}

export interface PublicExpenseVersionProjection {
  readonly workspaceId: WorkspaceId;
  readonly expenseId: ExpenseId;
  readonly version: ExpenseVersion;
  readonly commitment: CommitmentHash;
  readonly submitter: EvmAddress;
  readonly isSuperseded: boolean;
  readonly supersededByVersion: ExpenseVersion | null;
  readonly submittedAtBlock: bigint;
  readonly submittedAtTx: Bytes32;
  readonly indexedAt: Date | string;
}

export interface PublicDecisionProjection {
  readonly workspaceId: WorkspaceId;
  readonly expenseId: ExpenseId;
  readonly version: ExpenseVersion;
  readonly commitment: CommitmentHash;
  readonly reviewer: EvmAddress;
  readonly decision: "approve" | "reject" | "request_changes";
  readonly reasonCommitment: Bytes32 | null;
  readonly recordedAtBlock: bigint;
  readonly recordedAtTx: Bytes32;
  readonly indexedAt: Date | string;
}

export interface PublicSettlementProjection {
  readonly workspaceId: WorkspaceId;
  readonly expenseId: ExpenseId;
  readonly version: ExpenseVersion;
  readonly commitment: CommitmentHash;
  readonly token: EvmAddress;
  readonly recipient: EvmAddress;
  readonly amount: bigint;
  readonly paymentReference: PaymentReference;
  readonly settledAtBlock: bigint;
  readonly settledAtTx: Bytes32;
  readonly indexedAt: Date | string;
}

export interface IngestEventOptions {
  readonly retryAttempts?: number | undefined;
  readonly updateCheckpoint?: boolean | undefined;
}
