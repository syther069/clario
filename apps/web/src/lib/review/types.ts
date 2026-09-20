import type { CanonicalExpenseV1 } from "@clario/protocol";

export type ReviewStatus =
  "submitted" | "in_review" | "changes_requested" | "approved" | "rejected";

export interface ReviewQueueItem {
  readonly expenseId: string;
  readonly workspaceId: string;
  readonly version: number;
  readonly commitment: string;
  readonly predecessorCommitment: string | null;
  readonly status: string;
  readonly title: string;
  readonly businessPurpose: string;
  readonly category: string;
  readonly project: string | null;
  readonly merchant: string;
  readonly expenseDate: string;
  readonly claimAmount: string;
  readonly currency: string;
  readonly claimAsset: string;
  readonly recipient: string;
  readonly paymentSource: string;
  readonly submittedAt: string;
  readonly createdBy: string;
  readonly isSelfExpense: boolean;
  readonly canApprove: boolean;
  readonly evidenceCount: number;
  readonly hasSourceTransaction: boolean;
  readonly sourceTransaction: {
    readonly chainId: number;
    readonly txHash: string;
    readonly status: string;
  } | null;
  readonly latestDecision: {
    readonly decisionType: "approve" | "reject" | "request_changes";
    readonly reviewerAddress: string;
    readonly recordedAt: string;
    readonly reasonCommitment: string | null;
  } | null;
}

export interface ReviewQueueFilter {
  readonly status?:
    | "pending"
    | "all"
    | "approved"
    | "rejected"
    | "changes_requested"
    | undefined;
  readonly assignedTo?: "me" | "all" | undefined;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

export interface ReviewerAuthorityInfo {
  readonly address: string;
  readonly hasApproverRole: boolean;
  readonly isOwner: boolean;
  readonly isAdmin: boolean;
  readonly isAuditor: boolean;
  readonly policyVersion: number;
  readonly targetScope: string;
}

export interface ReviewQueueResponse {
  readonly items: readonly ReviewQueueItem[];
  readonly totalCount: number;
  readonly pendingCount: number;
  readonly reviewerRole: ReviewerAuthorityInfo;
}

export interface ReviewEvidenceItem {
  readonly evidenceId: string;
  readonly originalFilename: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly sha256Hash: string;
  readonly downloadUrl: string;
  readonly previewAvailable: boolean;
}

export interface MaterialFieldChange {
  readonly field: string;
  readonly displayName: string;
  readonly oldValue: unknown;
  readonly newValue: unknown;
  readonly isMaterial: boolean;
}

export interface MaterialDiff {
  readonly predecessorVersion: number | null;
  readonly hasChanges: boolean;
  readonly hasMaterialChanges: boolean;
  readonly changes: readonly MaterialFieldChange[];
}

export interface ProofSpineStep {
  readonly step: string;
  readonly title: string;
  readonly description: string;
  readonly timestamp: string | null;
  readonly status: "completed" | "active" | "pending" | "superseded" | "failed";
  readonly actor?: string | undefined;
  readonly txHash?: string | undefined;
  readonly commitment?: string | undefined;
  readonly explorerUrl?: string | undefined;
}

export interface ReviewDetail extends ReviewQueueItem {
  readonly canonicalRecord: CanonicalExpenseV1 | null;
  readonly evidence: readonly ReviewEvidenceItem[];
  readonly manifestHash: string | null;
  readonly isCurrentVersion: boolean;
  readonly currentVersion: number;
  readonly isSuperseded: boolean;
  readonly materialDiff: MaterialDiff | null;
  readonly selfApprovalBlocked: boolean;
  readonly proofSpine: readonly ProofSpineStep[];
}
