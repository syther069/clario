"use client";

import React, { useState, useEffect, useCallback } from "react";
import type {
  TreasuryQueueItem,
  TreasuryQueueResponse,
} from "@/lib/settlement/service";
import { ReimbursementDialog } from "./reimbursement-dialog";
import { Landmark, CheckCircle2, AlertCircle, Clock } from "lucide-react";

export interface TreasuryQueueViewProps {
  workspaceId: string;
  userAddress: string;
  connectedChainId?: number | undefined;
  csrfToken?: string | undefined;
  onNavigateToExpense?: ((expenseId: string) => void) | undefined;
}

export function TreasuryQueueView({
  workspaceId,
  userAddress,
  connectedChainId = 31337,
  csrfToken,
  onNavigateToExpense,
}: TreasuryQueueViewProps) {
  const [items, setItems] = useState<readonly TreasuryQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeReimburseExpense, setActiveReimburseExpense] =
    useState<TreasuryQueueItem | null>(null);
  const [filterSettled, setFilterSettled] = useState<"pending" | "all">(
    "pending",
  );
  const [submittedTxHashes, setSubmittedTxHashes] = useState<
    Record<string, string>
  >({});

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/settlement/queue`,
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { code?: string; message?: string };
        };
        if (res.status === 403 || data.error?.code === "UNAUTHORIZED") {
          throw new Error(
            "Access restricted: Your address is not granted TREASURY_ROLE or OWNER_ROLE in this workspace.",
          );
        }
        throw new Error(
          data.error?.message ||
            `Failed to load treasury queue (HTTP ${res.status}).`,
        );
      }
      const data = (await res.json()) as TreasuryQueueResponse;
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/settlement/queue`,
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: { code?: string; message?: string };
          };
          if (res.status === 403 || data.error?.code === "UNAUTHORIZED") {
            throw new Error(
              "Access restricted: Your address is not granted TREASURY_ROLE or OWNER_ROLE in this workspace.",
            );
          }
          throw new Error(
            data.error?.message ||
              `Failed to load treasury queue (HTTP ${res.status}).`,
          );
        }
        const data = (await res.json()) as TreasuryQueueResponse;
        if (!ignore) {
          setItems(data.items || []);
          setTotal(data.total || 0);
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "An error occurred.");
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
  }, [workspaceId]);

  const filteredItems = items.filter((item) => {
    if (
      filterSettled === "pending" &&
      (item.isSettled || item.hasPendingReimbursement)
    ) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.expenseId.toLowerCase().includes(q) ||
      item.recipient.toLowerCase().includes(q) ||
      item.commitment.toLowerCase().includes(q) ||
      item.amountDisplay.includes(q)
    );
  });

  return (
    <div
      style={{ maxWidth: 1200, margin: "0 auto", padding: "var(--space-6)" }}
    >
      {/* Header Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "var(--space-6)",
          paddingBottom: "var(--space-4)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              marginBottom: "var(--space-1)",
            }}
          >
            <Landmark className="w-6 h-6 text-[#836EF9] shrink-0" />
            <h1
              style={{
                margin: 0,
                fontSize: "1.5rem",
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              Treasury Settlement Queue
            </h1>
            <span
              style={{
                fontSize: "0.75rem",
                padding: "2px 8px",
                borderRadius: "var(--radius-full)",
                backgroundColor: "rgba(29, 78, 216, 0.1)",
                color: "var(--accent-primary)",
                fontWeight: 600,
                border: "1px solid rgba(29, 78, 216, 0.2)",
              }}
            >
              TREASURY_ROLE
            </span>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "0.875rem",
              color: "var(--text-secondary)",
            }}
          >
            Execute atomic ERC-20 disbursements on Monad for approved current
            expense versions.
          </p>
        </div>

        <button
          onClick={() => void fetchQueue()}
          disabled={loading}
          className="btn btn-secondary"
          style={{ height: 36, fontSize: "0.8125rem" }}
        >
          {loading ? "Refreshing..." : "↻ Refresh Queue"}
        </button>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "var(--space-4)",
          marginBottom: "var(--space-6)",
        }}
      >
        <div className="card" style={{ padding: "var(--space-4)" }}>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            Pending Reimbursement
          </div>
          <div
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              marginTop: "var(--space-1)",
            }}
          >
            {
              items.filter((i) => !i.isSettled && !i.hasPendingReimbursement)
                .length
            }
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--status-warning)",
              marginTop: "var(--space-1)",
            }}
          >
            Awaiting treasury transaction
          </div>
        </div>

        <div className="card" style={{ padding: "var(--space-4)" }}>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            Total Approved
          </div>
          <div
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              marginTop: "var(--space-1)",
            }}
          >
            {total}
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--text-secondary)",
              marginTop: "var(--space-1)",
            }}
          >
            Current versions with human approval
          </div>
        </div>

        <div className="card" style={{ padding: "var(--space-4)" }}>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            Connected Operator
          </div>
          <div
            style={{
              fontSize: "0.9375rem",
              fontWeight: 600,
              color: "var(--text-primary)",
              fontFamily: "var(--font-mono)",
              marginTop: "var(--space-2)",
            }}
          >
            {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              marginTop: "var(--space-1)",
            }}
          >
            Monad settlement authority
          </div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--space-4)",
          marginBottom: "var(--space-4)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button
            onClick={() => setFilterSettled("pending")}
            className={`btn ${filterSettled === "pending" ? "btn-primary" : "btn-secondary"}`}
            style={{ height: 32, fontSize: "0.8125rem", padding: "0 12px" }}
          >
            Awaiting Settlement (
            {
              items.filter((i) => !i.isSettled && !i.hasPendingReimbursement)
                .length
            }
            )
          </button>
          <button
            onClick={() => setFilterSettled("all")}
            className={`btn ${filterSettled === "all" ? "btn-primary" : "btn-secondary"}`}
            style={{ height: 32, fontSize: "0.8125rem", padding: "0 12px" }}
          >
            All Approved ({total})
          </button>
        </div>

        <input
          type="search"
          placeholder="Filter by recipient, ID, or commitment..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            maxWidth: 320,
            width: "100%",
            height: 32,
            padding: "0 var(--space-3)",
            fontSize: "0.8125rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
            backgroundColor: "var(--bg-card)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      {/* Error Banner */}
      {error && (
        <div
          className="card"
          style={{
            padding: "var(--space-4)",
            marginBottom: "var(--space-6)",
            borderColor: "var(--status-danger)",
            backgroundColor: "rgba(239, 68, 68, 0.05)",
          }}
        >
          <div
            style={{
              fontWeight: 600,
              color: "var(--status-danger)",
              marginBottom: "var(--space-1)",
            }}
          >
            Queue Error
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "0.875rem",
              color: "var(--text-primary)",
            }}
          >
            {error}
          </p>
        </div>
      )}

      {/* Main Table / State */}
      {loading ? (
        <div
          className="card"
          style={{
            padding: "var(--space-12)",
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          <div style={{ fontSize: "1.25rem", marginBottom: "var(--space-2)" }}>
            Loading settlement queue...
          </div>
          <div style={{ fontSize: "0.875rem" }}>
            Verifying approval commitments against Monad registry rules...
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div
          className="card"
          style={{ padding: "var(--space-12)", textAlign: "center" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "var(--space-3)",
            }}
          >
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h2
            style={{
              fontSize: "1.125rem",
              fontWeight: 600,
              margin: "0 0 var(--space-1)",
            }}
          >
            {filterSettled === "pending"
              ? "No pending reimbursements"
              : "No matching approved expenses"}
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "0.875rem",
              color: "var(--text-secondary)",
              maxWidth: 440,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {filterSettled === "pending"
              ? "All approved expenses in this workspace have been reimbursed or are currently processing."
              : "No expenses found matching the current search criteria."}
          </p>
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "0.875rem",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--border-subtle)",
                  backgroundColor: "var(--bg-muted, rgba(0,0,0,0.02))",
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  letterSpacing: "0.05em",
                }}
              >
                <th style={{ padding: "12px 16px" }}>Expense / Version</th>
                <th style={{ padding: "12px 16px" }}>Amount</th>
                <th style={{ padding: "12px 16px" }}>Recipient</th>
                <th style={{ padding: "12px 16px" }}>Approved By</th>
                <th style={{ padding: "12px 16px" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const isSubmitting = !!submittedTxHashes[item.expenseId];
                return (
                  <tr
                    key={item.expenseId}
                    style={{
                      borderBottom: "1px solid var(--border-subtle)",
                      transition: "background-color 0.15s ease",
                    }}
                  >
                    <td style={{ padding: "14px 16px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-2)",
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 600,
                            color: "var(--text-primary)",
                          }}
                        >
                          {item.expenseId.slice(0, 8)}...
                          {item.expenseId.slice(-4)}
                        </span>
                        <span
                          style={{
                            fontSize: "0.6875rem",
                            padding: "1px 6px",
                            borderRadius: "var(--radius-sm)",
                            backgroundColor: "var(--bg-muted)",
                            color: "var(--text-muted)",
                            fontWeight: 600,
                          }}
                        >
                          v{item.currentVersion}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "0.6875rem",
                          color: "var(--text-muted)",
                          fontFamily: "var(--font-mono)",
                          marginTop: 2,
                        }}
                        title={`Onchain Commitment: ${item.commitment}`}
                      >
                        {item.commitment.slice(0, 10)}...
                        {item.commitment.slice(-8)}
                      </div>
                    </td>

                    <td style={{ padding: "14px 16px" }}>
                      <div
                        style={{
                          fontWeight: 700,
                          color: "var(--text-primary)",
                          fontSize: "0.9375rem",
                        }}
                      >
                        {item.amountDisplay} {item.currency}
                      </div>
                      <div
                        style={{
                          fontSize: "0.6875rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        Base: {item.amountBaseUnits}
                      </div>
                    </td>

                    <td style={{ padding: "14px 16px" }}>
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.8125rem",
                          color: "var(--text-primary)",
                        }}
                      >
                        {item.recipient.slice(0, 6)}...
                        {item.recipient.slice(-4)}
                      </div>
                      <div
                        style={{
                          fontSize: "0.6875rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        EVM Recipient
                      </div>
                    </td>

                    <td style={{ padding: "14px 16px" }}>
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.8125rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {item.reviewerAddress.slice(0, 6)}...
                        {item.reviewerAddress.slice(-4)}
                      </div>
                      <div
                        style={{
                          fontSize: "0.6875rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        {new Date(item.decisionRecordedAt).toLocaleDateString()}
                      </div>
                    </td>

                    <td style={{ padding: "14px 16px" }}>
                      {item.isSettled ? (
                        <span
                          style={{
                            fontSize: "0.75rem",
                            padding: "2px 8px",
                            borderRadius: "var(--radius-full)",
                            backgroundColor: "rgba(16, 185, 129, 0.1)",
                            color: "var(--status-success)",
                            fontWeight: 600,
                          }}
                        >
                          <CheckCircle2 className="w-3 h-3 inline mr-1" />{" "}
                          Settled
                        </span>
                      ) : item.isFailed ? (
                        <span
                          style={{
                            fontSize: "0.75rem",
                            padding: "2px 8px",
                            borderRadius: "var(--radius-full)",
                            backgroundColor: "rgba(239, 68, 68, 0.1)",
                            color: "var(--status-danger)",
                            fontWeight: 600,
                          }}
                        >
                          <AlertCircle className="w-3 h-3 inline mr-1" /> Failed
                          (Retryable)
                        </span>
                      ) : item.hasPendingReimbursement || isSubmitting ? (
                        <span
                          style={{
                            fontSize: "0.75rem",
                            padding: "2px 8px",
                            borderRadius: "var(--radius-full)",
                            backgroundColor: "rgba(245, 158, 11, 0.1)",
                            color: "var(--status-warning)",
                            fontWeight: 600,
                          }}
                        >
                          ⏳ Submitted (Pending)
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: "0.75rem",
                            padding: "2px 8px",
                            borderRadius: "var(--radius-full)",
                            backgroundColor: "rgba(29, 78, 216, 0.1)",
                            color: "var(--accent-primary)",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <Clock className="w-3 h-3 text-[#836EF9] shrink-0" />
                          <span>Ready for Payment</span>
                        </span>
                      )}
                    </td>

                    <td style={{ padding: "14px 16px", textAlign: "right" }}>
                      {item.isSettled ? (
                        <button
                          onClick={() => onNavigateToExpense?.(item.expenseId)}
                          className="btn btn-secondary"
                          style={{
                            height: 32,
                            fontSize: "0.75rem",
                            padding: "0 10px",
                          }}
                        >
                          View Details
                        </button>
                      ) : item.isFailed ? (
                        <button
                          onClick={() => setActiveReimburseExpense(item)}
                          className="btn btn-secondary"
                          style={{
                            height: 32,
                            fontSize: "0.75rem",
                            padding: "0 12px",
                            fontWeight: 600,
                            borderColor: "var(--status-danger)",
                            color: "var(--status-danger)",
                          }}
                        >
                          Retry Payment →
                        </button>
                      ) : (
                        <button
                          onClick={() => setActiveReimburseExpense(item)}
                          disabled={item.hasPendingReimbursement}
                          className="btn btn-primary"
                          style={{
                            height: 32,
                            fontSize: "0.75rem",
                            padding: "0 12px",
                            fontWeight: 600,
                          }}
                        >
                          Reimburse →
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Reimbursement Dialog */}
      {activeReimburseExpense && (
        <ReimbursementDialog
          isOpen={true}
          workspaceId={workspaceId}
          expenseId={activeReimburseExpense.expenseId}
          expenseLabel={`Expense v${activeReimburseExpense.currentVersion} (${activeReimburseExpense.amountDisplay} ${activeReimburseExpense.currency})`}
          userAddress={userAddress}
          connectedChainId={connectedChainId}
          csrfToken={csrfToken}
          onClose={() => setActiveReimburseExpense(null)}
          onSettlementSubmitted={(txHash) => {
            setSubmittedTxHashes((prev) => ({
              ...prev,
              [activeReimburseExpense.expenseId]: txHash,
            }));
            setActiveReimburseExpense(null);
            void fetchQueue();
          }}
        />
      )}
    </div>
  );
}
