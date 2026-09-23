import type { AiExtractionResult } from "../ai/types";
import type { ExpenseDraftPayload } from "../expense/types";

export type WarningCode =
  | "INCOMPLETE_EVIDENCE"
  | "DUPLICATE_EVIDENCE"
  | "DUPLICATE_SOURCE_CLAIM"
  | "FAILED_SOURCE_TRANSACTION"
  | "DUPLICATE_ACTIVE_SETTLEMENT"
  | "STALE_ACTIVE_SETTLEMENT"
  | "SETTLEMENT_AMOUNT_MISMATCH"
  | "SETTLEMENT_RECIPIENT_MISMATCH"
  | "AI_FIELD_MISMATCH";

export type WarningDisposition =
  "acknowledged" | "confirmed_issue" | "dismissed_false_positive";

export interface WarningDispositionRecord {
  readonly disposition: WarningDisposition;
  readonly actorAddress: string;
  readonly occurredAt: string;
}

export interface ExpenseWarning {
  readonly warningId: string;
  readonly code: WarningCode;
  readonly category: "duplicate" | "mismatch" | "incomplete";
  readonly severity: "review" | "blocking";
  readonly title: string;
  readonly message: string;
  readonly deterministic: boolean;
  readonly affectedFields: readonly string[];
  readonly source: {
    readonly kind:
      "database" | "source_transaction" | "ai_analysis" | "settlement";
    readonly label: string;
    readonly referenceId: string | null;
    readonly observedAt: string | null;
    readonly confidence: number | null;
  };
  readonly disposition: WarningDispositionRecord | null;
  readonly history: readonly WarningDispositionRecord[];
}

export interface WarningEvaluationInput {
  readonly workspaceId: string;
  readonly expenseId: string;
  readonly currentVersion: number;
  readonly amountBaseUnits: string;
  readonly currency: string;
  readonly recipient: string;
  readonly payload: ExpenseDraftPayload;
  readonly evidenceCount: number;
  readonly evidenceSignalsAvailable: boolean;
  readonly reusedEvidenceCount: number;
  readonly sourceTransactions: readonly {
    readonly id: string;
    readonly status: string;
    readonly duplicateCount: number;
    readonly importedAt: string;
  }[];
  readonly settlements: readonly {
    readonly reimbursementId: string;
    readonly version: number;
    readonly amount: string;
    readonly recipient: string;
    readonly status: string;
    readonly createdAt: string;
  }[];
  readonly aiAnalysis: {
    readonly analysisId: string;
    readonly provider: string;
    readonly createdAt: string;
    readonly disposition: string;
    readonly result: AiExtractionResult;
    readonly corrections: Partial<Record<string, string | null>>;
  } | null;
}

export interface ExpenseWarningsResponse {
  readonly workspaceId: string;
  readonly expenseId: string;
  readonly version: number;
  readonly warnings: readonly ExpenseWarning[];
  readonly blockingCount: number;
  readonly reviewCount: number;
  readonly evaluatedAt: string;
  readonly authorityNotice: string;
}
