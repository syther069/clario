import { describe, expect, it } from "vitest";
import {
  AI_EXTRACTION_SCHEMA_VERSION,
  AI_FIELD_NAMES,
  type AiExtractionResult,
} from "../ai/types";
import type { ExpenseDraftPayload } from "../expense/types";
import { evaluateExpenseWarnings } from "./rules";
import type { WarningEvaluationInput } from "./types";

const payload: ExpenseDraftPayload = {
  title: "Fixture expense",
  businessPurpose: "Fixture purpose",
  category: "other",
  project: "Project A",
  merchant: "Example Cafe",
  expenseDate: "2026-09-22",
  claimAmount: "42.00",
  claimAsset: "0x0000000000000000000000000000000000000001",
  recipient: "0x0000000000000000000000000000000000000002",
  paymentSource: "manual",
  invoiceNumber: "INV-1",
};

function aiResult(
  overrides: Partial<
    Record<string, { value: string | null; confidence: number }>
  > = {},
): AiExtractionResult {
  return {
    schemaVersion: AI_EXTRACTION_SCHEMA_VERSION,
    fields: Object.fromEntries(
      AI_FIELD_NAMES.map((name) => {
        const defaults: Record<string, string | null> = {
          merchant: payload.merchant,
          documentDate: payload.expenseDate,
          invoiceNumber: payload.invoiceNumber ?? null,
          currency: "USDC",
          subtotal: null,
          tax: null,
          total: payload.claimAmount,
          category: payload.category,
          project: payload.project,
        };
        return [
          name,
          {
            value: overrides[name]?.value ?? defaults[name] ?? null,
            confidence: overrides[name]?.confidence ?? 0.9,
            sourceEvidenceId: "evidence-1",
            uncertainty: null,
          },
        ];
      }),
    ) as AiExtractionResult["fields"],
    overallConfidence: 0.9,
    warnings: [],
  };
}

function input(
  overrides: Partial<WarningEvaluationInput> = {},
): WarningEvaluationInput {
  return {
    workspaceId: "workspace-1",
    expenseId: "expense-1",
    currentVersion: 1,
    amountBaseUnits: "42000000",
    currency: "USDC",
    recipient: payload.recipient,
    payload,
    evidenceCount: 1,
    evidenceSignalsAvailable: true,
    reusedEvidenceCount: 0,
    sourceTransactions: [],
    settlements: [],
    aiAnalysis: null,
    ...overrides,
  };
}

describe("evaluateExpenseWarnings", () => {
  it("returns no warning for a clean fixture", () => {
    expect(evaluateExpenseWarnings(input())).toEqual([]);
  });

  it("detects exact evidence reuse without exposing another expense identifier", () => {
    const [warning] = evaluateExpenseWarnings(
      input({ reusedEvidenceCount: 2 }),
    );
    expect(warning).toMatchObject({
      code: "DUPLICATE_EVIDENCE",
      deterministic: true,
      severity: "review",
      affectedFields: ["evidence"],
    });
    expect(JSON.stringify(warning)).not.toContain("expense-2");
  });

  it("places deterministic source conflicts before model-derived warnings", () => {
    const warnings = evaluateExpenseWarnings(
      input({
        sourceTransactions: [
          {
            id: "source-1",
            status: "confirmed",
            duplicateCount: 2,
            importedAt: "2026-09-22T00:00:00.000Z",
          },
        ],
        aiAnalysis: {
          analysisId: "analysis-1",
          provider: "fixture",
          createdAt: "2026-09-22T00:00:00.000Z",
          disposition: "pending",
          result: aiResult({ total: { value: "99.00", confidence: 0.9 } }),
          corrections: {},
        },
      }),
    );
    expect(warnings.map((warning) => warning.code)).toEqual([
      "DUPLICATE_SOURCE_CLAIM",
      "AI_FIELD_MISMATCH",
    ]);
    expect(warnings[0]?.severity).toBe("blocking");
    expect(warnings[1]?.severity).toBe("review");
  });

  it.each([
    [
      "amount",
      { amount: "41000000", recipient: payload.recipient },
      "SETTLEMENT_AMOUNT_MISMATCH",
    ],
    [
      "recipient",
      {
        amount: "42000000",
        recipient: "0x0000000000000000000000000000000000000003",
      },
      "SETTLEMENT_RECIPIENT_MISMATCH",
    ],
  ])(
    "blocks an exact settlement %s mismatch",
    (_name, settlement, expectedCode) => {
      const warnings = evaluateExpenseWarnings(
        input({
          settlements: [
            {
              reimbursementId: "reimbursement-1",
              version: 1,
              status: "submitted",
              createdAt: "2026-09-22T00:00:00.000Z",
              ...settlement,
            },
          ],
        }),
      );
      expect(
        warnings.some(
          (warning) =>
            warning.code === expectedCode && warning.severity === "blocking",
        ),
      ).toBe(true);
    },
  );

  it("blocks stale and duplicate active settlement records", () => {
    const settlement = {
      amount: "42000000",
      recipient: payload.recipient,
      status: "confirming",
      createdAt: "2026-09-22T00:00:00.000Z",
    };
    const warnings = evaluateExpenseWarnings(
      input({
        settlements: [
          { reimbursementId: "old", version: 0, ...settlement },
          { reimbursementId: "one", version: 1, ...settlement },
          { reimbursementId: "two", version: 1, ...settlement },
        ],
      }),
    );
    expect(warnings.map((warning) => warning.code)).toEqual([
      "DUPLICATE_ACTIVE_SETTLEMENT",
      "STALE_ACTIVE_SETTLEMENT",
    ]);
  });

  it("ignores rejected, low-confidence, and evidence-inaccessible AI signals", () => {
    const analysis = {
      analysisId: "analysis-1",
      provider: "fixture",
      createdAt: "2026-09-22T00:00:00.000Z",
      disposition: "pending",
      result: aiResult({ total: { value: "99.00", confidence: 0.3 } }),
      corrections: {},
    };
    expect(evaluateExpenseWarnings(input({ aiAnalysis: analysis }))).toEqual(
      [],
    );
    expect(
      evaluateExpenseWarnings(
        input({
          aiAnalysis: {
            ...analysis,
            disposition: "rejected",
            result: aiResult({ total: { value: "99.00", confidence: 0.9 } }),
          },
        }),
      ),
    ).toEqual([]);
    expect(
      evaluateExpenseWarnings(
        input({
          evidenceSignalsAvailable: false,
          aiAnalysis: {
            ...analysis,
            result: aiResult({ total: { value: "99.00", confidence: 0.9 } }),
          },
        }),
      ),
    ).toEqual([]);
  });

  it("uses corrected AI values and stable identifiers", () => {
    const evaluated = input({
      aiAnalysis: {
        analysisId: "analysis-1",
        provider: "fixture",
        createdAt: "2026-09-22T00:00:00.000Z",
        disposition: "modified",
        result: aiResult({ total: { value: "99.00", confidence: 0.9 } }),
        corrections: { total: "42.0" },
      },
    });
    expect(evaluateExpenseWarnings(evaluated)).toEqual([]);
    const missing = input({ evidenceCount: 0 });
    expect(evaluateExpenseWarnings(missing)[0]?.warningId).toBe(
      evaluateExpenseWarnings(missing)[0]?.warningId,
    );
  });
});
