"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ExpenseWarning,
  ExpenseWarningsResponse,
  WarningDisposition,
} from "@/lib/warnings/types";

interface Props {
  workspaceId: string;
  expenseId: string;
  csrfToken?: string | undefined;
  refreshKey?: number | undefined;
}

export function availableWarningDispositions(
  warning: Pick<ExpenseWarning, "severity">,
): readonly WarningDisposition[] {
  return warning.severity === "blocking"
    ? ["confirmed_issue", "acknowledged"]
    : ["confirmed_issue", "acknowledged", "dismissed_false_positive"];
}

export function ExpenseWarningPanel({
  workspaceId,
  expenseId,
  csrfToken,
  refreshKey = 0,
}: Props) {
  const [response, setResponse] = useState<ExpenseWarningsResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const loadWarnings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResponse(await fetchExpenseWarnings(workspaceId, expenseId));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Warnings could not be evaluated.",
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId, expenseId]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const next = await fetchExpenseWarnings(workspaceId, expenseId);
        if (!ignore) setResponse(next);
      } catch (cause) {
        if (!ignore) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Warnings could not be evaluated.",
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, [workspaceId, expenseId, refreshKey]);

  async function recordDisposition(
    warning: ExpenseWarning,
    disposition: WarningDisposition,
  ) {
    setUpdating(warning.warningId);
    setError(null);
    try {
      const result = await fetch(
        `/api/workspaces/${workspaceId}/expenses/${expenseId}/warnings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
          },
          body: JSON.stringify({ warningId: warning.warningId, disposition }),
        },
      );
      const body = (await result.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      if (!result.ok) {
        throw new Error(
          body.error?.message ?? "Could not record the warning disposition.",
        );
      }
      await loadWarnings();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not record the warning disposition.",
      );
    } finally {
      setUpdating(null);
    }
  }

  if (loading) {
    return (
      <section className="card" style={{ padding: 16 }} aria-busy="true">
        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
          Evaluating duplicate and mismatch rules…
        </span>
      </section>
    );
  }

  if (!response || response.warnings.length === 0) {
    return error ? (
      <p
        role="alert"
        style={{ color: "var(--status-danger)", fontSize: "0.75rem" }}
      >
        {error}
      </p>
    ) : null;
  }

  return (
    <section
      className="card"
      style={{ padding: 16 }}
      aria-labelledby="expense-warnings-title"
    >
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
      >
        <div>
          <h3
            id="expense-warnings-title"
            style={{ margin: 0, fontSize: "0.9rem" }}
          >
            Review signals
          </h3>
          <p
            style={{
              margin: "5px 0 0",
              color: "var(--text-muted)",
              fontSize: "0.72rem",
              lineHeight: 1.4,
            }}
          >
            {response.authorityNotice}
          </p>
        </div>
        <span className="mono-badge" style={{ whiteSpace: "nowrap" }}>
          {response.blockingCount} blocking · {response.reviewCount} review
        </span>
      </div>

      {error && (
        <p
          role="alert"
          style={{ color: "var(--status-danger)", fontSize: "0.75rem" }}
        >
          {error}
        </p>
      )}

      <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
        {response.warnings.map((warning) => {
          const isBlocking = warning.severity === "blocking";
          return (
            <article
              key={warning.warningId}
              style={{
                border: `1px solid ${isBlocking ? "var(--status-danger)" : "var(--status-warning)"}`,
                borderRadius: "var(--radius-sm, 4px)",
                padding: 12,
                background: isBlocking
                  ? "var(--danger-soft, rgba(179, 38, 50, 0.08))"
                  : "var(--warning-soft, rgba(154, 91, 0, 0.08))",
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <strong style={{ fontSize: "0.8rem" }}>{warning.title}</strong>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: "0.68rem",
                    fontFamily: "var(--font-mono)",
                    textTransform: "uppercase",
                  }}
                >
                  {warning.deterministic ? "Exact rule" : "AI-assisted"} ·{" "}
                  {warning.severity}
                </span>
              </div>
              <p
                style={{
                  margin: "6px 0",
                  fontSize: "0.75rem",
                  lineHeight: 1.45,
                }}
              >
                {warning.message}
              </p>
              <div
                style={{
                  color: "var(--text-muted)",
                  fontSize: "0.68rem",
                  lineHeight: 1.45,
                }}
              >
                Source: {warning.source.label}
                {warning.source.confidence !== null
                  ? ` · ${confidenceLabel(warning.source.confidence)} confidence`
                  : ""}
                <br />
                Affected: {warning.affectedFields.join(", ")}
              </div>
              {warning.disposition && (
                <p
                  role="status"
                  style={{ margin: "7px 0 0", fontSize: "0.7rem" }}
                >
                  Latest human disposition:{" "}
                  {warning.disposition.disposition.replaceAll("_", " ")} ·{" "}
                  {new Date(warning.disposition.occurredAt).toLocaleString()}
                </p>
              )}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 7,
                  marginTop: 9,
                }}
              >
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={updating === warning.warningId}
                  onClick={() =>
                    void recordDisposition(warning, "confirmed_issue")
                  }
                  style={{ fontSize: "0.7rem", padding: "6px 9px" }}
                >
                  Confirm issue
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={updating === warning.warningId}
                  onClick={() =>
                    void recordDisposition(warning, "acknowledged")
                  }
                  style={{ fontSize: "0.7rem", padding: "6px 9px" }}
                >
                  Acknowledge
                </button>
                {availableWarningDispositions(warning).includes(
                  "dismissed_false_positive",
                ) && (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={updating === warning.warningId}
                    onClick={() =>
                      void recordDisposition(
                        warning,
                        "dismissed_false_positive",
                      )
                    }
                    style={{ fontSize: "0.7rem", padding: "6px 9px" }}
                  >
                    Mark false positive
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function confidenceLabel(value: number): "Low" | "Moderate" | "High" {
  if (value < 0.6) return "Low";
  if (value < 0.85) return "Moderate";
  return "High";
}

async function fetchExpenseWarnings(
  workspaceId: string,
  expenseId: string,
): Promise<ExpenseWarningsResponse> {
  const result = await fetch(
    `/api/workspaces/${workspaceId}/expenses/${expenseId}/warnings`,
    { cache: "no-store" },
  );
  const body = (await result.json().catch(() => ({}))) as
    ({ ok: true } & ExpenseWarningsResponse) | { error?: { message?: string } };
  if (!result.ok || !("warnings" in body)) {
    throw new Error(
      "error" in body && body.error?.message
        ? body.error.message
        : "Warnings could not be evaluated.",
    );
  }
  return body;
}
