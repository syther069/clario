"use client";

import React, { useEffect, useState } from "react";
import type { ExpenseSummary } from "@/lib/expense/types";
import { findTokenAsset, SUPPORTED_TOKENS } from "@/lib/expense/amount";
import {
  Badge,
  Button,
  EmptyState,
  StatusSentence,
} from "@/components/ui/primitives";

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
      setLoading(true);
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
    <section className="expense-list" aria-labelledby="expense-list-title">
      <header className="expense-list-header">
        <div>
          <h2 id="expense-list-title" className="expense-list-title">
            Verifiable Expense Ledger
          </h2>
          <p className="expense-list-description">
            Private drafts, immutable commitments, and reimbursement status.
          </p>
        </div>
        <Button
          className="expense-create-button"
          variant="primary"
          disabled={creating}
          isLoading={creating}
          loadingLabel="Creating draft"
          onClick={() => void handleCreateDraft()}
        >
          New expense draft
        </Button>
      </header>

      {error ? (
        <StatusSentence
          className="expense-list-error"
          role="alert"
          tone="danger"
        >
          {error}
        </StatusSentence>
      ) : null}

      <div
        className="expense-filter-list"
        role="group"
        aria-label="Filter expenses by status"
      >
        {["all", "draft", "submitted", "current", "superseded"].map(
          (status) => (
            <Button
              key={status}
              className={
                filter === status
                  ? "filter-button is-selected"
                  : "filter-button"
              }
              variant="ghost"
              aria-pressed={filter === status}
              onClick={() => setFilter(status)}
            >
              {status === "all" ? "All expenses" : status}
            </Button>
          ),
        )}
      </div>

      {loading ? (
        <div
          className="expense-list-loading"
          role="status"
          aria-live="polite"
          aria-label="Loading workspace expenses"
          aria-busy="true"
        >
          <span
            className="skeleton expense-skeleton-title"
            aria-hidden="true"
          />
          <span className="skeleton expense-skeleton-row" aria-hidden="true" />
          <span className="skeleton expense-skeleton-row" aria-hidden="true" />
          <span className="skeleton expense-skeleton-row" aria-hidden="true" />
        </div>
      ) : expenses.length === 0 ? (
        <EmptyState
          className="expense-empty-state"
          title="No expenses found"
          action={
            <Button
              className="expense-empty-action"
              variant="primary"
              disabled={creating}
              isLoading={creating}
              loadingLabel="Creating draft"
              onClick={() => void handleCreateDraft()}
            >
              Create an expense draft
            </Button>
          }
        >
          Create a private offchain draft to start tracking an expense and its
          supporting evidence.
        </EmptyState>
      ) : (
        <div className="table-container expense-table-container">
          <table className="ledger-table expense-table">
            <caption className="sr-only">Expenses in this workspace</caption>
            <thead>
              <tr>
                <th scope="col">Expense</th>
                <th scope="col">Category</th>
                <th scope="col">Date</th>
                <th scope="col">Evidence</th>
                <th scope="col" className="expense-amount-heading">
                  Amount
                </th>
                <th scope="col">Status</th>
                <th scope="col" className="expense-action-heading">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => {
                const token =
                  findTokenAsset(expense.currency) || SUPPORTED_TOKENS[0]!;
                const amount = expense.claimAmount || "0";
                const statusTone =
                  expense.status === "current"
                    ? "success"
                    : expense.status === "submitted"
                      ? "info"
                      : expense.status === "draft"
                        ? "neutral"
                        : "warning";

                return (
                  <tr key={expense.expenseId}>
                    <td data-label="Expense">
                      <div className="expense-row-copy">
                        <div className="expense-row-title">{expense.title}</div>
                        <div className="expense-row-merchant">
                          {expense.merchant}
                        </div>
                      </div>
                    </td>
                    <td data-label="Category">
                      <span className="mono-badge expense-category">
                        {expense.category || "Uncategorized"}
                      </span>
                    </td>
                    <td data-label="Date" className="expense-date">
                      <time dateTime={expense.expenseDate}>
                        {expense.expenseDate}
                      </time>
                    </td>
                    <td data-label="Evidence">
                      {expense.evidenceCount > 0
                        ? `${expense.evidenceCount} ${expense.evidenceCount === 1 ? "file" : "files"}`
                        : "No evidence"}
                    </td>
                    <td data-label="Amount" className="expense-amount">
                      <span className="font-mono tabular-nums">
                        {amount} {token.symbol}
                      </span>
                    </td>
                    <td data-label="Status">
                      <Badge tone={statusTone}>{expense.status}</Badge>
                    </td>
                    <td data-label="Action" className="expense-action">
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => onSelectExpense(expense.expenseId)}
                      >
                        {expense.status === "draft"
                          ? "Edit draft"
                          : "View expense"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
