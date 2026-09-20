"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { ReviewQueueItem, ReviewQueueResponse } from "@/lib/review/types";
import { ReviewDetailView } from "./review-detail-view";

export interface ReviewQueueViewProps {
  workspaceId: string;
  userAddress: string;
  initialSelectedExpenseId?: string | null | undefined;
  csrfToken?: string | undefined;
}

export function ReviewQueueView({
  workspaceId,
  userAddress,
  initialSelectedExpenseId = null,
  csrfToken,
}: ReviewQueueViewProps) {
  const [items, setItems] = useState<readonly ReviewQueueItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [reviewerRole, setReviewerRole] = useState<
    ReviewQueueResponse["reviewerRole"] | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "pending" | "all" | "approved" | "rejected" | "changes_requested"
  >("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(
    initialSelectedExpenseId,
  );

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/reviews?status=${statusFilter}`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 403 || data.error?.code === "UNAUTHORIZED") {
          throw new Error(
            "Access restricted: Your address is not granted an authorized reviewer, owner, or auditor role in this workspace.",
          );
        }
        throw new Error(
          data.error?.message ||
            `Failed to load review queue (HTTP ${res.status}).`,
        );
      }
      const data = (await res.json()) as ReviewQueueResponse;
      setItems(data.items || []);
      setTotalCount(data.totalCount || 0);
      setPendingCount(data.pendingCount || 0);
      setReviewerRole(data.reviewerRole || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, statusFilter]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/reviews?status=${statusFilter}`,
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (res.status === 403 || data.error?.code === "UNAUTHORIZED") {
            throw new Error(
              "Access restricted: Your address is not granted an authorized reviewer, owner, or auditor role in this workspace.",
            );
          }
          throw new Error(
            data.error?.message ||
              `Failed to load review queue (HTTP ${res.status}).`,
          );
        }
        const data = (await res.json()) as ReviewQueueResponse;
        if (!ignore) {
          setItems(data.items || []);
          setTotalCount(data.totalCount || 0);
          setPendingCount(data.pendingCount || 0);
          setReviewerRole(data.reviewerRole || null);
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
  }, [workspaceId, statusFilter]);

  if (selectedExpenseId) {
    return (
      <ReviewDetailView
        workspaceId={workspaceId}
        expenseId={selectedExpenseId}
        userAddress={userAddress}
        csrfToken={csrfToken}
        onBack={() => {
          setSelectedExpenseId(null);
          fetchQueue();
        }}
      />
    );
  }

  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.merchant.toLowerCase().includes(q) ||
      item.businessPurpose.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.createdBy.toLowerCase().includes(q)
    );
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      {/* Header Banner */}
      <div
        className="card"
        style={{
          padding: "var(--space-6)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-4)",
          background:
            "linear-gradient(180deg, var(--surface-primary) 0%, var(--surface-secondary) 100%)",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
            }}
          >
            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              Authorized Review Queue
            </h1>
            <span
              style={{
                backgroundColor:
                  pendingCount > 0
                    ? "rgba(36, 87, 245, 0.12)"
                    : "var(--surface-tertiary)",
                color:
                  pendingCount > 0
                    ? "var(--accent-primary)"
                    : "var(--text-muted)",
                padding: "2px 10px",
                borderRadius: "var(--radius-full)",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}
            >
              {pendingCount} Pending Decision{pendingCount === 1 ? "" : "s"}
            </span>
          </div>
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--text-secondary)",
              margin: "var(--space-1) 0 0",
            }}
          >
            Review private expense records, inspect evidence integrity, and
            commit exact-version decisions on Monad.
          </p>
        </div>

        {/* Reviewer Authority Pill */}
        {reviewerRole && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              padding: "var(--space-2) var(--space-4)",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--surface-tertiary)",
              border: "1px solid var(--border-subtle)",
              fontSize: "0.8125rem",
            }}
          >
            <span style={{ color: "var(--status-success)" }}>●</span>
            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
              {reviewerRole.isOwner
                ? "Workspace Owner"
                : reviewerRole.hasApproverRole
                  ? "Authorized Approver"
                  : reviewerRole.isAdmin
                    ? "Administrator"
                    : "Auditor"}
            </span>
            <span style={{ color: "var(--text-muted)" }}>•</span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--text-secondary)",
                fontSize: "0.75rem",
              }}
            >
              {reviewerRole.address.slice(0, 6)}...
              {reviewerRole.address.slice(-4)}
            </span>
          </div>
        )}
      </div>

      {/* Filter Tabs & Search */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-4)",
        }}
      >
        <div
          style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}
        >
          {[
            { id: "pending", label: `Pending (${pendingCount})` },
            { id: "approved", label: "Approved" },
            { id: "changes_requested", label: "Changes Requested" },
            { id: "rejected", label: "Rejected" },
            { id: "all", label: `All (${totalCount})` },
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as typeof statusFilter)}
                className={`btn ${isActive ? "btn-primary" : "btn-secondary"}`}
                style={{
                  fontSize: "0.8125rem",
                  padding: "var(--space-2) var(--space-4)",
                  height: "36px",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div style={{ minWidth: "260px" }}>
          <input
            type="text"
            placeholder="Search merchant, title, purpose..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input"
            style={{ width: "100%", height: "36px", fontSize: "0.8125rem" }}
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div
          className="card"
          style={{
            padding: "var(--space-6)",
            backgroundColor: "rgba(173, 38, 50, 0.08)",
            border: "1px solid var(--status-danger)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "var(--space-3)",
            }}
          >
            <span style={{ fontSize: "1.25rem" }}>⚠️</span>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: "1rem",
                  color: "var(--status-danger)",
                }}
              >
                Review Queue Error
              </h3>
              <p
                style={{
                  margin: "var(--space-1) 0 var(--space-4)",
                  fontSize: "0.875rem",
                }}
              >
                {error}
              </p>
              <button
                onClick={fetchQueue}
                className="btn btn-secondary"
                style={{ height: "32px", fontSize: "0.75rem" }}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !error && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
          }}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="card"
              style={{
                height: "80px",
                backgroundColor: "var(--surface-secondary)",
                opacity: 0.6,
                display: "flex",
                alignItems: "center",
                padding: "var(--space-4)",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  width: "240px",
                  height: "16px",
                  backgroundColor: "var(--surface-tertiary)",
                  borderRadius: "4px",
                }}
              />
              <div
                style={{
                  width: "120px",
                  height: "16px",
                  backgroundColor: "var(--surface-tertiary)",
                  borderRadius: "4px",
                }}
              />
              <div
                style={{
                  width: "90px",
                  height: "32px",
                  backgroundColor: "var(--surface-tertiary)",
                  borderRadius: "4px",
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredItems.length === 0 && (
        <div
          className="card"
          style={{
            padding: "var(--space-12)",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--space-3)",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              backgroundColor: "var(--surface-tertiary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.5rem",
            }}
          >
            ⚖️
          </div>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>
            {statusFilter === "pending"
              ? "All Clear — No Pending Reviews"
              : "No Expenses Found"}
          </h2>
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--text-secondary)",
              maxWidth: "420px",
              margin: 0,
            }}
          >
            {statusFilter === "pending"
              ? "There are no expenses currently awaiting your review in this workspace."
              : "No expenses matched the selected filter or search query."}
          </p>
        </div>
      )}

      {/* Review Queue Items */}
      {!loading && !error && filteredItems.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
          }}
        >
          {filteredItems.map((item) => {
            const isSelf = item.isSelfExpense;
            return (
              <div
                key={`${item.expenseId}-v${item.version}`}
                className="card"
                style={{
                  padding: "var(--space-4) var(--space-6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--space-4)",
                  transition: "border-color 150ms ease",
                }}
              >
                {/* Left: Metadata & Status */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-3)",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontFamily: "var(--font-mono)",
                        backgroundColor: "var(--surface-tertiary)",
                        padding: "2px 8px",
                        borderRadius: "var(--radius-sm)",
                        fontWeight: 600,
                      }}
                    >
                      v{item.version}
                    </span>

                    <h3
                      style={{
                        margin: 0,
                        fontSize: "1rem",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.title}
                    </h3>

                    {/* Status Pill */}
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: "var(--radius-full)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        backgroundColor:
                          item.status === "approved"
                            ? "rgba(8, 122, 85, 0.12)"
                            : item.status === "rejected"
                              ? "rgba(173, 38, 50, 0.12)"
                              : item.status === "changes_requested"
                                ? "rgba(138, 81, 0, 0.12)"
                                : "rgba(36, 87, 245, 0.12)",
                        color:
                          item.status === "approved"
                            ? "var(--status-success)"
                            : item.status === "rejected"
                              ? "var(--status-danger)"
                              : item.status === "changes_requested"
                                ? "var(--status-warning)"
                                : "var(--accent-primary)",
                      }}
                    >
                      {item.status.replace("_", " ")}
                    </span>

                    {/* Self-Expense Pill */}
                    {isSelf && (
                      <span
                        title="You submitted this expense. Under founder invariants, submitters cannot approve their own expenses."
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: "var(--radius-full)",
                          backgroundColor: "rgba(138, 81, 0, 0.12)",
                          color: "var(--status-warning)",
                        }}
                      >
                        Self-Submitted (No Self-Approval)
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-4)",
                      marginTop: "var(--space-2)",
                      fontSize: "0.8125rem",
                      color: "var(--text-secondary)",
                      flexWrap: "wrap",
                    }}
                  >
                    <span>{item.merchant}</span>
                    <span>•</span>
                    <span style={{ textTransform: "capitalize" }}>
                      {item.category}
                    </span>
                    <span>•</span>
                    <span>
                      {item.evidenceCount} attachment
                      {item.evidenceCount === 1 ? "" : "s"}
                    </span>
                    <span>•</span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.75rem",
                      }}
                    >
                      Commitment: {item.commitment.slice(0, 8)}...
                      {item.commitment.slice(-6)}
                    </span>
                    {item.hasSourceTransaction && (
                      <>
                        <span>•</span>
                        <span style={{ color: "var(--accent-primary)" }}>
                          🔗 Imported Source Tx
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right: Amount & CTA */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-6)",
                  }}
                >
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: "1.125rem",
                        fontWeight: 700,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {item.claimAmount}
                    </div>
                    <div
                      style={{
                        fontSize: "0.6875rem",
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {item.claimAsset.slice(0, 6)}...
                      {item.claimAsset.slice(-4)}
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedExpenseId(item.expenseId)}
                    className="btn btn-primary"
                    style={{
                      height: "38px",
                      fontSize: "0.8125rem",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Review v{item.version} →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
