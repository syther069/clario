"use client";

import React, { useEffect, useState } from "react";
import type { ExpenseSummary } from "@/lib/expense/types";
import { findTokenAsset, SUPPORTED_TOKENS } from "@/lib/expense/amount";

interface ExpenseListProps {
  workspaceId: string;
  userAddress: string;
  csrfToken?: string;
  onSelectExpense: (expenseId: string) => void;
}

export function ExpenseList({
  workspaceId,
  userAddress,
  csrfToken,
  onSelectExpense,
}: ExpenseListProps) {
  const [expenses, setExpenses] = useState<ExpenseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const url =
          filter === "all"
            ? `/api/workspaces/${workspaceId}/expenses`
            : `/api/workspaces/${workspaceId}/expenses?status=${filter}`;

        const res = await fetch(url);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || "Failed to load expenses.");
        }

        const data = (await res.json()) as { expenses: ExpenseSummary[] };
        if (!ignore) {
          setExpenses(data.expenses || []);
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error ? err.message : "Error loading expenses.",
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      ignore = true;
    };
  }, [workspaceId, filter]);

  const handleCreateDraft = async () => {
    try {
      setCreating(true);
      setError(null);
      const res = await fetch(`/api/workspaces/${workspaceId}/expenses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        },
        body: JSON.stringify({
          payload: {
            title: "New Expense Draft",
            recipient: userAddress,
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || "Failed to create draft.");
      }

      const data = (await res.json()) as { draft: { expenseId: string } };
      onSelectExpense(data.draft.expenseId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create draft.");
      setCreating(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: 600,
              color: "var(--foreground)",
              margin: 0,
            }}
          >
            Verifiable Expense Ledger
          </h2>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--muted)",
              margin: "4px 0 0 0",
            }}
          >
            Offchain private drafts, immutable commitments, and Monad settlement
            tracking.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            className="btn-primary"
            disabled={creating}
            onClick={() => void handleCreateDraft()}
            style={{ fontSize: "0.85rem", padding: "8px 16px" }}
          >
            {creating ? "Creating Draft..." : "+ New Expense Draft"}
          </button>
        </div>
      </div>

      {error && (
        <div className="callout-box warning" style={{ margin: 0 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "10px",
        }}
      >
        {["all", "draft", "submitted", "current", "superseded"].map(
          (status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              style={{
                padding: "4px 12px",
                borderRadius: "4px",
                border: "none",
                fontSize: "0.8rem",
                cursor: "pointer",
                background:
                  filter === status ? "var(--monad-purple)" : "transparent",
                color: filter === status ? "#fff" : "var(--muted)",
                fontWeight: filter === status ? 600 : 400,
              }}
            >
              {status.toUpperCase()}
            </button>
          ),
        )}
      </div>

      {/* Expenses Table */}
      {loading ? (
        <div
          style={{
            padding: "40px",
            color: "var(--muted)",
            textAlign: "center",
          }}
        >
          Loading workspace expenses...
        </div>
      ) : expenses.length === 0 ? (
        <div
          className="card"
          style={{
            padding: "48px 24px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div style={{ fontSize: "2rem" }}>📄</div>
          <h3
            style={{
              margin: 0,
              fontSize: "1.05rem",
              fontWeight: 600,
              color: "var(--foreground)",
            }}
          >
            No expenses found
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: "0.85rem",
              color: "var(--muted)",
              maxWidth: "420px",
            }}
          >
            Start by creating a private offchain expense draft with receipt or
            invoice evidence.
          </p>
          <button
            type="button"
            className="btn-primary"
            disabled={creating}
            onClick={() => void handleCreateDraft()}
            style={{
              marginTop: "8px",
              fontSize: "0.85rem",
              padding: "8px 16px",
            }}
          >
            + Create First Expense Draft
          </button>
        </div>
      ) : (
        <div
          className="card"
          style={{
            overflowX: "auto",
            padding: 0,
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.85rem",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--border)",
                  color: "var(--muted)",
                  textAlign: "left",
                }}
              >
                <th style={{ padding: "12px 16px" }}>Title & Merchant</th>
                <th style={{ padding: "12px 16px" }}>Category</th>
                <th style={{ padding: "12px 16px" }}>Date</th>
                <th style={{ padding: "12px 16px" }}>Evidence</th>
                <th style={{ padding: "12px 16px" }}>Amount</th>
                <th style={{ padding: "12px 16px" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp) => {
                const token =
                  findTokenAsset(exp.currency) || SUPPORTED_TOKENS[0]!;
                const formattedAmount = exp.claimAmount ? exp.claimAmount : "0";

                return (
                  <tr
                    key={exp.expenseId}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      cursor: "pointer",
                      transition: "background 0.15s ease",
                    }}
                    onClick={() => onSelectExpense(exp.expenseId)}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <div
                        style={{ fontWeight: 600, color: "var(--foreground)" }}
                      >
                        {exp.title}
                      </div>
                      <div
                        style={{ fontSize: "0.75rem", color: "var(--muted)" }}
                      >
                        {exp.merchant}
                      </div>
                    </td>

                    <td style={{ padding: "12px 16px" }}>
                      <span
                        className="mono-badge"
                        style={{ fontSize: "0.75rem" }}
                      >
                        {exp.category}
                      </span>
                    </td>

                    <td style={{ padding: "12px 16px", color: "var(--muted)" }}>
                      {exp.expenseDate}
                    </td>

                    <td style={{ padding: "12px 16px" }}>
                      {exp.evidenceCount > 0 ? (
                        <span
                          style={{
                            color: "var(--foreground)",
                            fontSize: "0.8rem",
                          }}
                        >
                          📎 {exp.evidenceCount} file
                          {exp.evidenceCount > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span
                          style={{ color: "var(--muted)", fontSize: "0.8rem" }}
                        >
                          None
                        </span>
                      )}
                    </td>

                    <td
                      style={{
                        padding: "12px 16px",
                        fontWeight: 600,
                        color: "var(--foreground)",
                      }}
                    >
                      <span className="font-mono">
                        {formattedAmount} {token.symbol}
                      </span>
                    </td>

                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          background:
                            exp.status === "draft"
                              ? "rgba(131, 110, 249, 0.15)"
                              : exp.status === "current"
                                ? "rgba(0, 229, 153, 0.15)"
                                : "rgba(255, 255, 255, 0.05)",
                          color:
                            exp.status === "draft"
                              ? "var(--monad-purple)"
                              : exp.status === "current"
                                ? "var(--success)"
                                : "var(--muted)",
                        }}
                      >
                        {exp.status.toUpperCase()}
                      </span>
                    </td>

                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectExpense(exp.expenseId);
                        }}
                      >
                        {exp.status === "draft" ? "Edit Draft" : "View"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
