"use client";

import { useMemo, useState } from "react";
import type { AiAnalysisRecord, AiFieldName } from "@/lib/ai/types";
import { AI_FIELD_NAMES } from "@/lib/ai/types";
import type { EvidenceAttachmentSummary } from "@/lib/expense/types";

const LABELS: Record<AiFieldName, string> = {
  merchant: "Merchant",
  documentDate: "Document date",
  invoiceNumber: "Invoice number",
  currency: "Currency",
  subtotal: "Subtotal",
  tax: "Tax",
  total: "Total",
  category: "Category",
  project: "Project",
};

export function confidenceLabel(value: number): "Low" | "Moderate" | "High" {
  if (value < 0.6) return "Low";
  if (value < 0.85) return "Moderate";
  return "High";
}

export interface AppliedAiFields {
  merchant?: string;
  expenseDate?: string;
  invoiceNumber?: string;
  claimAmount?: string;
  category?: string;
  project?: string;
}

export function buildAppliedAiFields(
  analysis: AiAnalysisRecord,
  values: Partial<Record<AiFieldName, string>>,
  selectedFields: readonly AiFieldName[],
): {
  applied: AppliedAiFields;
  corrections: Partial<Record<AiFieldName, string | null>>;
  disposition: "accepted" | "modified";
} {
  const corrections: Partial<Record<AiFieldName, string | null>> = {};
  let modified =
    selectedFields.length !==
    AI_FIELD_NAMES.filter((name) => analysis.fields[name].value !== null)
      .length;
  for (const name of selectedFields) {
    if ((values[name] ?? null) !== analysis.fields[name].value) {
      corrections[name] = values[name] ?? null;
      modified = true;
    }
  }
  const applied: AppliedAiFields = {};
  const selectedValue = (name: AiFieldName) =>
    selectedFields.includes(name) ? values[name] : undefined;
  const merchant = selectedValue("merchant");
  const documentDate = selectedValue("documentDate");
  const invoiceNumber = selectedValue("invoiceNumber");
  const total = selectedValue("total");
  const category = selectedValue("category");
  const project = selectedValue("project");
  if (merchant !== undefined) applied.merchant = merchant;
  if (documentDate !== undefined) applied.expenseDate = documentDate;
  if (invoiceNumber !== undefined) applied.invoiceNumber = invoiceNumber;
  if (total !== undefined) applied.claimAmount = total;
  if (category !== undefined) applied.category = category;
  if (project !== undefined) applied.project = project;
  return {
    applied,
    corrections,
    disposition: modified ? "modified" : "accepted",
  };
}

interface Props {
  workspaceId: string;
  expenseId: string;
  evidence: readonly EvidenceAttachmentSummary[];
  csrfToken?: string | undefined;
  onApply: (fields: AppliedAiFields) => Promise<void> | void;
  onAnalysisChange?: (() => void) | undefined;
}

export function AiExtractionPanel({
  workspaceId,
  expenseId,
  evidence,
  csrfToken,
  onApply,
  onAnalysisChange,
}: Props) {
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AiAnalysisRecord | null>(null);
  const [values, setValues] = useState<Partial<Record<AiFieldName, string>>>(
    {},
  );
  const [selectedFields, setSelectedFields] = useState<AiFieldName[]>([]);

  const evidenceNames = useMemo(
    () =>
      new Map(
        evidence.map((item) => [
          item.evidenceId,
          item.originalFilename ?? `Evidence ${item.evidenceId.slice(0, 8)}`,
        ]),
      ),
    [evidence],
  );

  async function runExtraction() {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/expenses/${expenseId}/ai-extraction`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
          },
          body: JSON.stringify({ evidenceIds: selectedEvidence, consent }),
        },
      );
      const body = (await response.json().catch(() => ({}))) as {
        analysis?: AiAnalysisRecord;
        error?: { message?: string };
      };
      if (!response.ok || !body.analysis) {
        throw new Error(
          body.error?.message ??
            "AI extraction is unavailable. Continue with manual entry.",
        );
      }
      setAnalysis(body.analysis);
      onAnalysisChange?.();
      const initialValues: Partial<Record<AiFieldName, string>> = {};
      const initialSelection: AiFieldName[] = [];
      for (const name of AI_FIELD_NAMES) {
        const value = body.analysis.fields[name].value;
        if (value !== null) {
          initialValues[name] = value;
          initialSelection.push(name);
        }
      }
      setValues(initialValues);
      setSelectedFields(initialSelection);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "AI extraction is unavailable. Continue with manual entry.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function recordDisposition(
    disposition: "accepted" | "modified" | "rejected",
    corrections: Partial<Record<AiFieldName, string | null>> = {},
  ) {
    if (!analysis) return;
    const response = await fetch(
      `/api/workspaces/${workspaceId}/expenses/${expenseId}/ai-extraction/${analysis.analysisId}/disposition`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        },
        body: JSON.stringify({ disposition, corrections }),
      },
    );
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      throw new Error(
        body.error?.message ?? "Could not record your AI suggestion decision.",
      );
    }
  }

  async function applySuggestions() {
    if (!analysis) return;
    setLoading(true);
    setError(null);
    try {
      const decision = buildAppliedAiFields(analysis, values, selectedFields);
      await onApply(decision.applied);
      await recordDisposition(decision.disposition, decision.corrections);
      setAnalysis({ ...analysis, disposition: decision.disposition });
      onAnalysisChange?.();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not apply suggestions.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (evidence.length === 0) return null;

  return (
    <section
      className="card"
      style={{ padding: 16 }}
      aria-labelledby="ai-extraction-title"
    >
      <div
        style={{
          borderLeft: "2px solid var(--ai-suggested, #8b7cf6)",
          paddingLeft: 10,
        }}
      >
        <h4 id="ai-extraction-title" style={{ margin: 0, fontSize: "0.85rem" }}>
          Receipt analysis
        </h4>
        <p
          style={{
            margin: "5px 0 0",
            color: "var(--muted)",
            fontSize: "0.75rem",
            lineHeight: 1.4,
          }}
        >
          AI suggestions are untrusted until you confirm them. AI cannot submit,
          approve, or reimburse an expense.
        </p>
      </div>

      {!analysis && (
        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontSize: "0.75rem", marginBottom: 6 }}>
              Evidence sent for analysis
            </legend>
            {evidence.map((item) => (
              <label
                key={item.evidenceId}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  fontSize: "0.75rem",
                  marginTop: 6,
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedEvidence.includes(item.evidenceId)}
                  onChange={(event) =>
                    setSelectedEvidence((current) =>
                      event.target.checked
                        ? [...current, item.evidenceId]
                        : current.filter((id) => id !== item.evidenceId),
                    )
                  }
                />
                <span>{evidenceNames.get(item.evidenceId)}</span>
              </label>
            ))}
          </fieldset>
          <label
            style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
              fontSize: "0.72rem",
              color: "var(--muted)",
              lineHeight: 1.4,
            }}
          >
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            I explicitly consent to sending only the selected evidence to
            Clario&apos;s configured extraction provider.
          </label>
          <button
            type="button"
            className="btn-secondary"
            disabled={loading || !consent || selectedEvidence.length === 0}
            onClick={() => void runExtraction()}
          >
            {loading ? "Analyzing…" : "Analyze selected evidence"}
          </button>
        </div>
      )}

      {error && (
        <p
          role="alert"
          style={{
            color: "var(--error)",
            fontSize: "0.75rem",
            lineHeight: 1.4,
          }}
        >
          {error} Manual entry remains fully available.
        </p>
      )}

      {analysis && (
        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
            AI suggested · {confidenceLabel(analysis.overallConfidence)}{" "}
            confidence · {new Date(analysis.createdAt).toLocaleString()}
          </div>
          {AI_FIELD_NAMES.map((name) => {
            const suggestion = analysis.fields[name];
            if (suggestion.value === null) return null;
            return (
              <div
                key={name}
                style={{
                  padding: 9,
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: "0.72rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(name)}
                    onChange={(event) =>
                      setSelectedFields((current) =>
                        event.target.checked
                          ? [...current, name]
                          : current.filter((field) => field !== name),
                      )
                    }
                  />
                  <strong>{LABELS[name]}</strong>
                  <span style={{ marginLeft: "auto", color: "var(--muted)" }}>
                    {confidenceLabel(suggestion.confidence)}
                  </span>
                </label>
                <input
                  className="input-field"
                  aria-label={`${LABELS[name]} AI suggestion`}
                  value={values[name] ?? ""}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [name]: event.target.value,
                    }))
                  }
                  style={{ marginTop: 7, width: "100%" }}
                />
                <div
                  style={{
                    marginTop: 5,
                    color: "var(--muted)",
                    fontSize: "0.68rem",
                  }}
                >
                  Source:{" "}
                  {evidenceNames.get(suggestion.sourceEvidenceId) ??
                    "Selected evidence"}
                  {suggestion.uncertainty ? ` · ${suggestion.uncertainty}` : ""}
                </div>
              </div>
            );
          })}
          {analysis.warnings.length > 0 && (
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                color: "var(--warning)",
                fontSize: "0.72rem",
              }}
            >
              {analysis.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn-secondary"
              disabled={loading || selectedFields.length === 0}
              onClick={() => void applySuggestions()}
            >
              Apply selected
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={loading}
              onClick={() =>
                void recordDisposition("rejected")
                  .then(() =>
                    setAnalysis({ ...analysis, disposition: "rejected" }),
                  )
                  .then(() => onAnalysisChange?.())
                  .catch((cause: unknown) =>
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "Could not reject suggestions.",
                    ),
                  )
              }
            >
              Reject all
            </button>
          </div>
          {analysis.disposition !== "pending" && (
            <p role="status" style={{ margin: 0, fontSize: "0.72rem" }}>
              Human disposition recorded: {analysis.disposition}.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
