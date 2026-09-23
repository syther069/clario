import { createHash } from "node:crypto";
import type {
  ExpenseWarning,
  WarningCode,
  WarningEvaluationInput,
} from "./types";

const ACTIVE_SETTLEMENT_STATES = new Set([
  "preparing",
  "awaiting_signature",
  "submitted",
  "confirming",
  "confirmed",
]);

function warningId(
  input: WarningEvaluationInput,
  code: WarningCode,
  sourceKey: string,
): string {
  return `warn_${createHash("sha256")
    .update(
      [
        "clario-warning-v1",
        input.workspaceId,
        input.expenseId,
        String(input.currentVersion),
        code,
        sourceKey,
      ].join("\u001f"),
    )
    .digest("hex")}`;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function normalizeDecimal(value: string | null | undefined): string | null {
  if (!value || !/^(0|[1-9]\d*)(\.\d+)?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const normalizedFraction = fraction.replace(/0+$/, "");
  return normalizedFraction
    ? `${BigInt(whole!).toString()}.${normalizedFraction}`
    : BigInt(whole!).toString();
}

function baseWarning(
  input: WarningEvaluationInput,
  code: WarningCode,
  sourceKey: string,
  warning: Omit<ExpenseWarning, "warningId" | "disposition" | "history">,
): ExpenseWarning {
  return {
    warningId: warningId(input, code, sourceKey),
    disposition: null,
    history: [],
    ...warning,
    code,
  };
}

export function evaluateExpenseWarnings(
  input: WarningEvaluationInput,
): ExpenseWarning[] {
  const warnings: ExpenseWarning[] = [];

  // Exact, local rules are evaluated before any model-derived comparison.
  if (input.evidenceSignalsAvailable && input.evidenceCount === 0) {
    warnings.push(
      baseWarning(input, "INCOMPLETE_EVIDENCE", "evidence:none", {
        code: "INCOMPLETE_EVIDENCE",
        category: "incomplete",
        severity: "review",
        title: "No supporting evidence attached",
        message:
          "This expense has no receipt or invoice attached. Confirm whether workspace policy permits evidence-free submission.",
        deterministic: true,
        affectedFields: ["evidence"],
        source: {
          kind: "database",
          label: "Current evidence manifest",
          referenceId: null,
          observedAt: null,
          confidence: null,
        },
      }),
    );
  }

  if (input.evidenceSignalsAvailable && input.reusedEvidenceCount > 0) {
    warnings.push(
      baseWarning(input, "DUPLICATE_EVIDENCE", "evidence:reused", {
        code: "DUPLICATE_EVIDENCE",
        category: "duplicate",
        severity: "review",
        title: "Evidence is reused by another expense",
        message:
          "An identical evidence file is attached to another expense in this workspace. Verify that both claims are intentional.",
        deterministic: true,
        affectedFields: ["evidence"],
        source: {
          kind: "database",
          label: "Exact evidence digest match",
          referenceId: null,
          observedAt: null,
          confidence: null,
        },
      }),
    );
  }

  for (const source of input.sourceTransactions) {
    if (source.duplicateCount > 1) {
      warnings.push(
        baseWarning(input, "DUPLICATE_SOURCE_CLAIM", `source:${source.id}`, {
          code: "DUPLICATE_SOURCE_CLAIM",
          category: "duplicate",
          severity: "blocking",
          title: "Source transaction is claimed more than once",
          message:
            "The same source-chain transaction and claim slot appear on multiple expenses. The normal claim and settlement path must remain blocked.",
          deterministic: true,
          affectedFields: ["sourceTransactionHash", "sourceChainId"],
          source: {
            kind: "source_transaction",
            label: "Exact workspace, chain, transaction, and claim-slot match",
            referenceId: source.id,
            observedAt: source.importedAt,
            confidence: null,
          },
        }),
      );
    }
    if (source.status === "failed") {
      warnings.push(
        baseWarning(input, "FAILED_SOURCE_TRANSACTION", `source:${source.id}`, {
          code: "FAILED_SOURCE_TRANSACTION",
          category: "mismatch",
          severity: "blocking",
          title: "Source transaction failed",
          message:
            "The attributed source transaction is marked failed and cannot support the normal reimbursement path.",
          deterministic: true,
          affectedFields: ["paymentSource", "sourceTransactionHash"],
          source: {
            kind: "source_transaction",
            label: "Persisted source transaction status",
            referenceId: source.id,
            observedAt: source.importedAt,
            confidence: null,
          },
        }),
      );
    }
  }

  const activeSettlements = input.settlements.filter((settlement) =>
    ACTIVE_SETTLEMENT_STATES.has(settlement.status),
  );
  const currentActive = activeSettlements.filter(
    (settlement) => settlement.version === input.currentVersion,
  );
  if (currentActive.length > 1) {
    warnings.push(
      baseWarning(
        input,
        "DUPLICATE_ACTIVE_SETTLEMENT",
        "settlement:duplicate",
        {
          code: "DUPLICATE_ACTIVE_SETTLEMENT",
          category: "duplicate",
          severity: "blocking",
          title: "Multiple active reimbursements detected",
          message:
            "More than one active reimbursement exists for the current expense version. Stop settlement and reconcile authoritative chain state.",
          deterministic: true,
          affectedFields: ["settlement"],
          source: {
            kind: "settlement",
            label: "Active reimbursement records",
            referenceId: null,
            observedAt: null,
            confidence: null,
          },
        },
      ),
    );
  }

  for (const settlement of activeSettlements) {
    if (settlement.version !== input.currentVersion) {
      warnings.push(
        baseWarning(
          input,
          "STALE_ACTIVE_SETTLEMENT",
          `settlement:${settlement.reimbursementId}`,
          {
            code: "STALE_ACTIVE_SETTLEMENT",
            category: "mismatch",
            severity: "blocking",
            title: "Settlement targets a stale expense version",
            message:
              "An active reimbursement references a non-current version. The current-version settlement path remains blocked until reconciliation.",
            deterministic: true,
            affectedFields: ["version", "settlement"],
            source: {
              kind: "settlement",
              label: "Persisted reimbursement version",
              referenceId: settlement.reimbursementId,
              observedAt: settlement.createdAt,
              confidence: null,
            },
          },
        ),
      );
      continue;
    }
    if (BigInt(settlement.amount) !== BigInt(input.amountBaseUnits)) {
      warnings.push(
        baseWarning(
          input,
          "SETTLEMENT_AMOUNT_MISMATCH",
          `settlement:${settlement.reimbursementId}`,
          {
            code: "SETTLEMENT_AMOUNT_MISMATCH",
            category: "mismatch",
            severity: "blocking",
            title: "Settlement amount does not match the approved version",
            message:
              "The persisted reimbursement amount differs from the current expense version. Settlement must remain blocked and reconciled.",
            deterministic: true,
            affectedFields: ["claimAmount", "settlementAmount"],
            source: {
              kind: "settlement",
              label: "Exact base-unit comparison",
              referenceId: settlement.reimbursementId,
              observedAt: settlement.createdAt,
              confidence: null,
            },
          },
        ),
      );
    }
    if (settlement.recipient.toLowerCase() !== input.recipient.toLowerCase()) {
      warnings.push(
        baseWarning(
          input,
          "SETTLEMENT_RECIPIENT_MISMATCH",
          `settlement:${settlement.reimbursementId}`,
          {
            code: "SETTLEMENT_RECIPIENT_MISMATCH",
            category: "mismatch",
            severity: "blocking",
            title: "Settlement recipient does not match the approved version",
            message:
              "The persisted reimbursement recipient differs from the current expense version. Settlement must remain blocked and reconciled.",
            deterministic: true,
            affectedFields: ["recipient", "settlementRecipient"],
            source: {
              kind: "settlement",
              label: "Exact normalized address comparison",
              referenceId: settlement.reimbursementId,
              observedAt: settlement.createdAt,
              confidence: null,
            },
          },
        ),
      );
    }
  }

  const ai = input.aiAnalysis;
  if (input.evidenceSignalsAvailable && ai && ai.disposition !== "rejected") {
    const comparisons: Array<{
      field:
        "merchant" | "documentDate" | "invoiceNumber" | "currency" | "total";
      recordValue: string | null | undefined;
      normalized: (value: string | null | undefined) => string | null;
    }> = [
      {
        field: "merchant",
        recordValue: input.payload.merchant,
        normalized: normalizeText,
      },
      {
        field: "documentDate",
        recordValue: input.payload.expenseDate,
        normalized: normalizeText,
      },
      {
        field: "invoiceNumber",
        recordValue: input.payload.invoiceNumber,
        normalized: normalizeText,
      },
      {
        field: "currency",
        recordValue: input.currency,
        normalized: normalizeText,
      },
      {
        field: "total",
        recordValue: input.payload.claimAmount,
        normalized: normalizeDecimal,
      },
    ];
    for (const comparison of comparisons) {
      const suggestion = ai.result.fields[comparison.field];
      const suggestedValue =
        ai.corrections[comparison.field] ?? suggestion.value;
      if (
        suggestion.confidence < 0.6 ||
        suggestedValue === null ||
        comparison.normalized(suggestedValue) ===
          comparison.normalized(comparison.recordValue)
      ) {
        continue;
      }
      const displayField =
        comparison.field === "documentDate"
          ? "document date"
          : comparison.field === "invoiceNumber"
            ? "invoice number"
            : comparison.field;
      warnings.push(
        baseWarning(
          input,
          "AI_FIELD_MISMATCH",
          `ai:${ai.analysisId}:${comparison.field}`,
          {
            code: "AI_FIELD_MISMATCH",
            category: "mismatch",
            severity: "review",
            title: `Receipt analysis differs on ${displayField}`,
            message: `The latest receipt analysis conflicts with the current ${displayField}. Compare the field with its source evidence before continuing.`,
            deterministic: false,
            affectedFields: [
              comparison.field === "total" ? "claimAmount" : comparison.field,
            ],
            source: {
              kind: "ai_analysis",
              label: `${ai.provider} receipt extraction`,
              referenceId: ai.analysisId,
              observedAt: ai.createdAt,
              confidence: suggestion.confidence,
            },
          },
        ),
      );
    }
  }

  return warnings;
}
