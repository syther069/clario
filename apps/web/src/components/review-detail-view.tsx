"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { ReviewDetail, ReviewEvidenceItem } from "@/lib/review/types";
import type { ExpenseTimelineResponse } from "@/lib/timeline/types";
import type { DecisionType } from "@/lib/review/decision";
import { DecisionDialog } from "./decision-dialog";
import { ProofSpineTimeline } from "./proof-spine-timeline";
import { ReimbursementDialog } from "./reimbursement-dialog";
import { ExpenseWarningPanel } from "./expense-warning-panel";
import { AlertTriangle, Eye, X, Copy, Check } from "lucide-react";
import { ContextualIconSwap } from "@/components/ui/motion";

export interface ReviewDetailViewProps {
  workspaceId: string;
  expenseId: string;
  userAddress: string;
  initialVersion?: number | undefined;
  csrfToken?: string | undefined;
  onBack: () => void;
}

export function ReviewDetailView({
  workspaceId,
  expenseId,
  userAddress,
  initialVersion,
  csrfToken,
  onBack,
}: ReviewDetailViewProps) {
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(
    initialVersion,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePreviewEvidence, setActivePreviewEvidence] =
    useState<ReviewEvidenceItem | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeDecision, setActiveDecision] = useState<DecisionType | null>(
    null,
  );
  const [isCreatingSuccessor, setIsCreatingSuccessor] = useState(false);
  const [successorError, setSuccessorError] = useState<string | null>(null);
  const [showFullTimeline, setShowFullTimeline] = useState(false);
  const [fullTimeline, setFullTimeline] =
    useState<ExpenseTimelineResponse | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [showReimbursementDialog, setShowReimbursementDialog] = useState(false);
  const [reimbursementTxHash, setReimbursementTxHash] = useState<string | null>(
    null,
  );

  const toggleFullTimeline = async () => {
    if (!showFullTimeline && !fullTimeline) {
      setLoadingTimeline(true);
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/expenses/${expenseId}/timeline`,
        );
        if (res.ok) {
          const data = (await res.json()) as ExpenseTimelineResponse;
          setFullTimeline(data);
        }
      } catch {
        // ignore
      } finally {
        setLoadingTimeline(false);
      }
    }
    setShowFullTimeline((prev) => !prev);
  };

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = selectedVersion
        ? `/api/workspaces/${workspaceId}/expenses/${expenseId}/review?version=${selectedVersion}`
        : `/api/workspaces/${workspaceId}/expenses/${expenseId}/review`;

      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error?.message ||
            `Failed to load review detail (HTTP ${res.status}).`,
        );
      }
      const data = (await res.json()) as { ok: boolean; review: ReviewDetail };
      setDetail(data.review);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, expenseId, selectedVersion]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const url = selectedVersion
          ? `/api/workspaces/${workspaceId}/expenses/${expenseId}/review?version=${selectedVersion}`
          : `/api/workspaces/${workspaceId}/expenses/${expenseId}/review`;

        const res = await fetch(url);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.error?.message ||
              `Failed to load review detail (HTTP ${res.status}).`,
          );
        }
        const data = (await res.json()) as {
          ok: boolean;
          review: ReviewDetail;
        };
        if (!ignore) {
          setDetail(data.review);
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
  }, [workspaceId, expenseId, selectedVersion]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCreateSuccessor = async () => {
    if (!detail) return;
    try {
      setIsCreatingSuccessor(true);
      setSuccessorError(null);

      const res = await fetch(
        `/api/workspaces/${workspaceId}/expenses/${expenseId}/successor`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
          },
          body: JSON.stringify({}),
        },
      );

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(
          data.error?.message || "Failed to create successor revision.",
        );
      }

      setSelectedVersion(data.draft.version);
      void fetchDetail();
    } catch (err) {
      setSuccessorError(
        err instanceof Error
          ? err.message
          : "Failed to create successor revision.",
      );
    } finally {
      setIsCreatingSuccessor(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        <button
          onClick={onBack}
          className="btn btn-secondary"
          style={{ width: "fit-content", height: "36px" }}
        >
          ← Back to Review Queue
        </button>
        <div
          className="card"
          style={{
            height: "400px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Loading expense review detail...
          </div>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        <button
          onClick={onBack}
          className="btn btn-secondary"
          style={{ width: "fit-content", height: "36px" }}
        >
          ← Back to Review Queue
        </button>
        <div
          className="card"
          style={{
            padding: "var(--space-6)",
            border: "1px solid var(--status-danger)",
          }}
        >
          <h3
            style={{
              color: "var(--status-danger)",
              margin: "0 0 var(--space-2)",
            }}
          >
            Review Load Error
          </h3>
          <p style={{ margin: "0 0 var(--space-4)", fontSize: "0.875rem" }}>
            {error || "Record not found."}
          </p>
          <button onClick={fetchDetail} className="btn btn-secondary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      {/* Top Nav & Breadcrumb */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <button
          onClick={onBack}
          className="btn btn-secondary"
          style={{ height: "36px", fontSize: "0.8125rem" }}
        >
          ← Back to Review Queue
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
          }}
        >
          <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
            Inspect Version:
          </span>
          {Array.from({ length: detail.currentVersion }, (_, i) => i + 1).map(
            (v) => {
              const isTarget = v === detail.version;
              return (
                <button
                  key={v}
                  onClick={() => setSelectedVersion(v)}
                  className={`btn ${isTarget ? "btn-primary" : "btn-secondary"}`}
                  style={{
                    height: "30px",
                    padding: "0 10px",
                    fontSize: "0.75rem",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  v{v} {v === detail.currentVersion ? "(Current)" : ""}
                </button>
              );
            },
          )}
        </div>
      </div>

      {/* Warnings Banner */}
      {detail.isSuperseded && (
        <div
          className="card"
          style={{
            padding: "var(--space-4) var(--space-6)",
            backgroundColor: "rgba(173, 38, 50, 0.08)",
            border: "1px solid var(--status-danger)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
          }}
        >
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <div
              style={{
                fontWeight: 600,
                color: "var(--status-danger)",
                fontSize: "0.875rem",
              }}
            >
              Stale / Superseded Version (v{detail.version})
            </div>
            <div
              style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}
            >
              This expense has evolved to version {detail.currentVersion}. Per
              Clario protocol rules, historical versions cannot be approved for
              settlement.
            </div>
          </div>
        </div>
      )}

      {detail.selfApprovalBlocked && (
        <div
          className="card"
          style={{
            padding: "var(--space-4) var(--space-6)",
            backgroundColor: "rgba(138, 81, 0, 0.08)",
            border: "1px solid var(--status-warning)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
          }}
        >
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <div
              style={{
                fontWeight: 600,
                color: "var(--status-warning)",
                fontSize: "0.875rem",
              }}
            >
              Self-Approval Prohibited
            </div>
            <div
              style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}
            >
              You submitted this expense. Under Clario founder invariants,
              submitters cannot approve their own expenses. Another authorized
              reviewer must decide.
            </div>
          </div>
        </div>
      )}

      {detail.isCurrentVersion && (
        <ExpenseWarningPanel
          workspaceId={workspaceId}
          expenseId={expenseId}
          csrfToken={csrfToken}
        />
      )}

      {/* Main 7 / 5 Evidence Ledger Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gap: "var(--space-6)",
        }}
      >
        {/* Left Column (7 cols): Canonical Terms, Evidence, Diff */}
        <div
          style={{
            gridColumn: "span 7",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-6)",
          }}
        >
          {/* Canonical Terms Card */}
          <div className="card" style={{ padding: "var(--space-6)" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "var(--space-4)",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--accent-primary)",
                  }}
                >
                  Canonical Expense Record · Version {detail.version}
                </span>
                <h2
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    margin: "var(--space-1) 0 0",
                    textWrap: "balance",
                  }}
                >
                  {detail.title}
                </h2>
              </div>

              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: "var(--radius-full)",
                  textTransform: "uppercase",
                  backgroundColor:
                    detail.status === "approved"
                      ? "rgba(8, 122, 85, 0.12)"
                      : detail.status === "rejected"
                        ? "rgba(173, 38, 50, 0.12)"
                        : "rgba(36, 87, 245, 0.12)",
                  color:
                    detail.status === "approved"
                      ? "var(--status-success)"
                      : detail.status === "rejected"
                        ? "var(--status-danger)"
                        : "var(--accent-primary)",
                }}
              >
                {detail.status.replace("_", " ")}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-4)",
                fontSize: "0.875rem",
              }}
            >
              <div>
                <div
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.75rem",
                    marginBottom: "2px",
                  }}
                >
                  Merchant
                </div>
                <div style={{ fontWeight: 600 }}>{detail.merchant}</div>
              </div>
              <div>
                <div
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.75rem",
                    marginBottom: "2px",
                  }}
                >
                  Expense Date
                </div>
                <div style={{ fontWeight: 600 }}>{detail.expenseDate}</div>
              </div>
              <div>
                <div
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.75rem",
                    marginBottom: "2px",
                  }}
                >
                  Category
                </div>
                <div style={{ textTransform: "capitalize", fontWeight: 600 }}>
                  {detail.category}
                </div>
              </div>
              <div>
                <div
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.75rem",
                    marginBottom: "2px",
                  }}
                >
                  Project Code
                </div>
                <div style={{ fontWeight: 600 }}>{detail.project || "—"}</div>
              </div>
              <div>
                <div
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.75rem",
                    marginBottom: "2px",
                  }}
                >
                  Claim Amount
                </div>
                <div
                  style={{
                    fontSize: "1.125rem",
                    fontWeight: 700,
                    color: "var(--accent-primary)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {detail.claimAmount}{" "}
                  {detail.canonicalRecord?.claimAsset ? "USDC" : ""}
                </div>
              </div>
              <div>
                <div
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.75rem",
                    marginBottom: "2px",
                  }}
                >
                  Payment Source
                </div>
                <div style={{ textTransform: "capitalize", fontWeight: 600 }}>
                  {detail.paymentSource.replace("_", " ")}
                </div>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <div
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.75rem",
                    marginBottom: "2px",
                  }}
                >
                  Reimbursement Payee
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.8125rem",
                  }}
                >
                  {detail.recipient}
                </div>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <div
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.75rem",
                    marginBottom: "2px",
                  }}
                >
                  Business Justification / Purpose
                </div>
                <div style={{ lineHeight: 1.5 }}>{detail.businessPurpose}</div>
              </div>
              {detail.canonicalRecord?.notes && (
                <div style={{ gridColumn: "span 2" }}>
                  <div
                    style={{
                      color: "var(--text-muted)",
                      fontSize: "0.75rem",
                      marginBottom: "2px",
                    }}
                  >
                    Internal Review Notes
                  </div>
                  <div
                    style={{
                      fontStyle: "italic",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {detail.canonicalRecord.notes}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Predecessor Material Diff Card (if version > 1) */}
          {detail.materialDiff && detail.materialDiff.hasChanges && (
            <div className="card" style={{ padding: "var(--space-6)" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "var(--space-3)",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: "1rem",
                    fontWeight: 600,
                    textWrap: "balance",
                  }}
                >
                  Predecessor Changes (v{detail.materialDiff.predecessorVersion}{" "}
                  → v{detail.version})
                </h3>
                {detail.materialDiff.hasMaterialChanges ? (
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "var(--radius-full)",
                      backgroundColor: "rgba(173, 38, 50, 0.12)",
                      color: "var(--status-danger)",
                    }}
                  >
                    Material Changes Detected
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: "var(--radius-full)",
                      backgroundColor: "var(--surface-tertiary)",
                      color: "var(--text-muted)",
                    }}
                  >
                    Non-Material Changes Only
                  </span>
                )}
              </div>

              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    fontSize: "0.8125rem",
                    borderCollapse: "collapse",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: "1px solid var(--border-subtle)",
                        textAlign: "left",
                        color: "var(--text-muted)",
                      }}
                    >
                      <th style={{ padding: "var(--space-2) 0" }}>Field</th>
                      <th style={{ padding: "var(--space-2)" }}>
                        Previous (v{detail.materialDiff.predecessorVersion})
                      </th>
                      <th style={{ padding: "var(--space-2)" }}>
                        Current (v{detail.version})
                      </th>
                      <th
                        style={{
                          padding: "var(--space-2) 0",
                          textAlign: "right",
                        }}
                      >
                        Impact
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.materialDiff.changes.map((ch) => (
                      <tr
                        key={ch.field}
                        style={{
                          borderBottom: "1px solid var(--border-subtle)",
                        }}
                      >
                        <td
                          style={{
                            padding: "var(--space-3) 0",
                            fontWeight: 600,
                          }}
                        >
                          {ch.displayName}
                        </td>
                        <td
                          style={{
                            padding: "var(--space-3)",
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-secondary)",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {String(ch.oldValue ?? "—")}
                        </td>
                        <td
                          style={{
                            padding: "var(--space-3)",
                            fontFamily: "var(--font-mono)",
                            fontWeight: 600,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {String(ch.newValue ?? "—")}
                        </td>
                        <td
                          style={{
                            padding: "var(--space-3) 0",
                            textAlign: "right",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.6875rem",
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: "4px",
                              backgroundColor: ch.isMaterial
                                ? "rgba(173, 38, 50, 0.12)"
                                : "var(--surface-tertiary)",
                              color: ch.isMaterial
                                ? "var(--status-danger)"
                                : "var(--text-muted)",
                            }}
                          >
                            {ch.isMaterial ? "MATERIAL" : "NON-MATERIAL"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Attached Evidence Manifest Card */}
          <div className="card" style={{ padding: "var(--space-6)" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "var(--space-3)",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "1rem",
                  fontWeight: 600,
                  textWrap: "balance",
                }}
              >
                Attached Private Evidence ({detail.evidence.length})
              </h3>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Envelope Encrypted (AES-256-GCM)
              </span>
            </div>

            {detail.evidence.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                No evidence documents attached to this version.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                }}
              >
                {detail.evidence.map((ev) => (
                  <div
                    key={ev.evidenceId}
                    style={{
                      padding: "var(--space-3) var(--space-4)",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "var(--surface-secondary)",
                      border: "1px solid var(--border-subtle)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "var(--space-4)",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                        {ev.originalFilename}
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-muted)",
                          marginTop: "2px",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {(ev.byteSize / 1024).toFixed(1)} KB • {ev.mimeType} •
                        SHA: {ev.sha256Hash.slice(0, 10)}...
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "var(--space-2)" }}>
                      {ev.previewAvailable && (
                        <button
                          onClick={() => setActivePreviewEvidence(ev)}
                          className="btn btn-secondary"
                          style={{
                            height: "30px",
                            fontSize: "0.75rem",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <Eye className="w-3.5 h-3.5" /> Preview
                        </button>
                      )}
                      <a
                        href={ev.downloadUrl}
                        download={ev.originalFilename}
                        className="btn btn-secondary"
                        style={{
                          height: "30px",
                          fontSize: "0.75rem",
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                        }}
                      >
                        ⬇️ Download
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Source Chain Provenance (if imported) */}
          {detail.hasSourceTransaction && detail.sourceTransaction && (
            <div className="card" style={{ padding: "var(--space-6)" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "var(--space-2)",
                }}
              >
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
                  Imported Source Chain Record
                </h3>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--accent-primary)",
                    fontWeight: 600,
                  }}
                >
                  Chain ID: {detail.sourceTransaction.chainId}
                </span>
              </div>
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--text-secondary)",
                  backgroundColor: "var(--surface-tertiary)",
                  padding: "var(--space-2) var(--space-3)",
                  borderRadius: "var(--radius-sm)",
                  margin: "0 0 var(--space-3)",
                  textWrap: "pretty",
                }}
              >
                <em>
                  Imported facts are provider/source-chain records, not
                  Monad-verified truth.
                </em>
              </p>
              <div
                style={{
                  fontSize: "0.8125rem",
                  fontFamily: "var(--font-mono)",
                }}
              >
                Tx Hash: {detail.sourceTransaction.txHash}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Commitment Stamp, Proof Spine, Review Actions */}
        <div
          style={{
            gridColumn: "span 5",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-6)",
          }}
        >
          {/* Commitment Stamp Card */}
          <div className="card" style={{ padding: "var(--space-6)" }}>
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--accent-primary)",
              }}
            >
              Commitment Stamp · Exact Monad State
            </span>

            <div style={{ marginTop: "var(--space-3)" }}>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  marginBottom: "4px",
                }}
              >
                Active Commitment (v{detail.version})
              </div>
              <div
                style={{
                  padding: "var(--space-3)",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--surface-tertiary)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.75rem",
                  wordBreak: "break-all",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "var(--space-2)",
                }}
              >
                <span>{detail.commitment}</span>
                <button
                  onClick={() =>
                    copyToClipboard(detail.commitment, "commitment")
                  }
                  className="btn btn-secondary relative flex items-center gap-1 after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2 after:content-[''] transition-colors duration-150 ease-out"
                  style={{
                    height: "26px",
                    fontSize: "0.6875rem",
                    padding: "0 8px",
                  }}
                  title="Copy commitment hash"
                  aria-label="Copy commitment hash"
                >
                  <ContextualIconSwap
                    isActive={copiedField === "commitment"}
                    initialIcon={<Copy className="h-3 w-3" />}
                    activeIcon={<Check className="h-3 w-3 text-emerald-600" />}
                  />
                  <span>{copiedField === "commitment" ? "Copied!" : "Copy"}</span>
                </button>
              </div>
            </div>

            {detail.predecessorCommitment && (
              <div style={{ marginTop: "var(--space-3)" }}>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                    marginBottom: "4px",
                  }}
                >
                  Predecessor Commitment
                </div>
                <div
                  style={{
                    padding: "var(--space-3)",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "var(--surface-tertiary)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.75rem",
                    wordBreak: "break-all",
                  }}
                >
                  {detail.predecessorCommitment}
                </div>
              </div>
            )}
          </div>

          {/* Proof Spine Card */}
          <div className="card" style={{ padding: "var(--space-6)" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "var(--space-4)",
                flexWrap: "wrap",
                gap: "var(--space-2)",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "1rem",
                  fontWeight: 600,
                  textWrap: "balance",
                }}
              >
                Proof Spine · Workflow Chain
              </h3>
              <button
                type="button"
                onClick={toggleFullTimeline}
                className="btn btn-secondary"
                style={{
                  fontSize: "0.75rem",
                  padding: "4px 10px",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                }}
              >
                {loadingTimeline
                  ? "Loading Timeline..."
                  : showFullTimeline
                    ? "Show Summary Rail"
                    : "Authoritative Timeline"}
              </button>
            </div>

            {showFullTimeline && fullTimeline ? (
              <ProofSpineTimeline
                timeline={fullTimeline}
                style={{
                  padding: 0,
                  border: "none",
                  backgroundColor: "transparent",
                }}
              />
            ) : (
              <div
                style={{ position: "relative", paddingLeft: "var(--space-6)" }}
              >
                {/* Vertical 1px line */}
                <div
                  style={{
                    position: "absolute",
                    left: "9px",
                    top: "10px",
                    bottom: "10px",
                    width: "2px",
                    backgroundColor: "var(--border-subtle)",
                  }}
                />

                {detail.proofSpine.map((step, idx) => (
                  <div
                    key={step.step}
                    style={{
                      position: "relative",
                      marginBottom:
                        idx === detail.proofSpine.length - 1
                          ? 0
                          : "var(--space-4)",
                    }}
                  >
                    {/* Node Circle */}
                    <div
                      style={{
                        position: "absolute",
                        left: "-21px",
                        top: "2px",
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        backgroundColor:
                          step.status === "completed"
                            ? "var(--accent-primary)"
                            : step.status === "active"
                              ? "var(--status-warning)"
                              : step.status === "failed"
                                ? "var(--status-danger)"
                                : "var(--surface-tertiary)",
                        border: "2px solid var(--surface-primary)",
                      }}
                    />

                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                        {step.title}
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-secondary)",
                          marginTop: "2px",
                          textWrap: "pretty",
                        }}
                      >
                        {step.description}
                      </div>
                      {step.timestamp && (
                        <div
                          style={{
                            fontSize: "0.6875rem",
                            color: "var(--text-muted)",
                            marginTop: "2px",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {new Date(step.timestamp).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Decision Actions Card */}
          <div className="card" style={{ padding: "var(--space-6)" }}>
            <h3
              style={{
                margin: "0 0 var(--space-3)",
                fontSize: "1rem",
                fontWeight: 600,
                textWrap: "balance",
              }}
            >
              Review Decision
            </h3>
            <p
              style={{
                fontSize: "0.8125rem",
                color: "var(--text-secondary)",
                margin: "0 0 var(--space-4)",
                textWrap: "pretty",
              }}
            >
              Human decisions bind to the exact commitment of version{" "}
              {detail.version} on Monad.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
              }}
            >
              <button
                disabled={!detail.canApprove}
                onClick={() => setActiveDecision("approve")}
                className="btn btn-primary"
                style={{
                  height: "44px",
                  fontWeight: 600,
                  opacity: detail.canApprove ? 1 : 0.5,
                  cursor: detail.canApprove ? "pointer" : "not-allowed",
                }}
                title={
                  detail.selfApprovalBlocked
                    ? "Self-approval is blocked for the submitter."
                    : detail.isSuperseded
                      ? "Cannot approve a superseded version."
                      : !detail.canApprove
                        ? "You do not have APPROVER_ROLE in this workspace."
                        : `Approve Version ${detail.version}`
                }
              >
                Approve Version {detail.version}
              </button>

              <button
                disabled={detail.isSuperseded || !detail.canApprove}
                onClick={() => setActiveDecision("request_changes")}
                className="btn btn-secondary"
                style={{ height: "38px" }}
              >
                Request Changes
              </button>

              <button
                disabled={detail.isSuperseded || !detail.canApprove}
                onClick={() => setActiveDecision("reject")}
                className="btn btn-secondary"
                style={{ height: "38px", color: "var(--status-danger)" }}
              >
                Reject Expense
              </button>
            </div>

            {/* Treasury Settlement Section */}
            {detail.latestDecision?.decisionType === "approve" &&
              detail.isCurrentVersion &&
              !detail.isSuperseded && (
                <div
                  style={{
                    marginTop: "var(--space-4)",
                    padding: "var(--space-4)",
                    backgroundColor: "rgba(16, 185, 129, 0.05)",
                    border: "1px solid var(--status-success)",
                    borderRadius: "var(--radius-md)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-3)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                    }}
                  >
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: "var(--status-success)",
                        display: "inline-block",
                      }}
                    />
                    <span
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "var(--status-success)",
                      }}
                    >
                      Approved — Ready for Settlement
                    </span>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                      lineHeight: 1.4,
                    }}
                  >
                    Version {detail.version} has valid human approval bound to
                    its commitment. Treasury can execute atomic reimbursement on
                    Monad.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowReimbursementDialog(true)}
                    className="btn btn-primary"
                    style={{
                      height: "40px",
                      fontWeight: 600,
                      backgroundColor: "var(--accent-primary)",
                      borderColor: "var(--accent-primary)",
                    }}
                  >
                    Execute Reimbursement →
                  </button>
                  {reimbursementTxHash && (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                        wordBreak: "break-all",
                      }}
                    >
                      Submitted Tx: {reimbursementTxHash}
                    </div>
                  )}
                </div>
              )}

            {/* Successor Lineage Section */}
            {(detail.latestDecision?.decisionType === "request_changes" ||
              detail.isSuperseded ||
              detail.isSelfExpense) && (
              <div
                style={{
                  marginTop: "var(--space-4)",
                  paddingTop: "var(--space-3)",
                  borderTop: "1px solid var(--border-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-2)",
                }}
              >
                <div style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
                  Revision Lineage
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                    lineHeight: 1.4,
                  }}
                >
                  Material edits create an immutable successor version (v
                  {detail.version + 1}) with independent evidence binding. Prior
                  approvals are invalidated.
                </p>
                <button
                  type="button"
                  onClick={() => void handleCreateSuccessor()}
                  disabled={isCreatingSuccessor || detail.status === "draft"}
                  className="btn btn-secondary"
                  style={{
                    height: "36px",
                    fontWeight: 500,
                    borderColor: "var(--status-warning)",
                    color: "var(--text-primary)",
                  }}
                >
                  {isCreatingSuccessor
                    ? "Creating Revision..."
                    : `Create Corrected Version v${detail.version + 1} →`}
                </button>
                {successorError && (
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--status-danger)",
                    }}
                  >
                    {successorError}
                  </div>
                )}
              </div>
            )}

            <div
              style={{
                marginTop: "var(--space-4)",
                paddingTop: "var(--space-3)",
                borderTop: "1px solid var(--border-subtle)",
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-1)",
              }}
            >
              <span>
                Reviewing as:{" "}
                <span className="font-mono">
                  {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
                </span>
              </span>
              <span>Human decisions anchor cryptographically on Monad.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Evidence Preview Modal */}
      {activePreviewEvidence && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-title"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "var(--space-6)",
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "800px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "var(--space-4) var(--space-6)",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 id="preview-title" style={{ margin: 0, fontSize: "1rem" }}>
                {activePreviewEvidence.originalFilename}
              </h3>
              <button
                onClick={() => setActivePreviewEvidence(null)}
                className="btn btn-secondary"
                style={{
                  height: "30px",
                  padding: "0 10px",
                  fontSize: "0.8125rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <X className="w-3.5 h-3.5" /> Close
              </button>
            </div>

            <div
              style={{
                padding: "var(--space-6)",
                overflowY: "auto",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "300px",
              }}
            >
              {activePreviewEvidence.mimeType.startsWith("image/") ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={activePreviewEvidence.downloadUrl}
                  alt={activePreviewEvidence.originalFilename}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "65vh",
                    objectFit: "contain",
                  }}
                />
              ) : activePreviewEvidence.mimeType === "application/pdf" ? (
                <iframe
                  src={activePreviewEvidence.downloadUrl}
                  title={activePreviewEvidence.originalFilename}
                  style={{ width: "100%", height: "65vh", border: "none" }}
                />
              ) : (
                <div style={{ color: "var(--text-muted)" }}>
                  Preview not supported for this file type.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Exact-Version Decision Recording Dialog */}
      {activeDecision && (
        <DecisionDialog
          isOpen={true}
          workspaceId={workspaceId}
          expenseId={expenseId}
          version={detail.version}
          decision={activeDecision}
          userAddress={userAddress}
          csrfToken={csrfToken}
          onClose={() => setActiveDecision(null)}
          onDecisionRecorded={() => {
            setActiveDecision(null);
            void fetchDetail();
          }}
        />
      )}

      {/* Treasury Reimbursement Dialog */}
      {showReimbursementDialog && detail && (
        <ReimbursementDialog
          isOpen={true}
          workspaceId={workspaceId}
          expenseId={expenseId}
          expenseLabel={`Expense v${detail.version}`}
          userAddress={userAddress}
          csrfToken={csrfToken}
          onClose={() => setShowReimbursementDialog(false)}
          onSettlementSubmitted={(txHash) => {
            setReimbursementTxHash(txHash);
            setShowReimbursementDialog(false);
            void fetchDetail();
          }}
        />
      )}
    </div>
  );
}
