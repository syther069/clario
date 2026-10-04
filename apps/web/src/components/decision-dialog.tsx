"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { PreparedDecision } from "@/lib/review/decision-service";
import type { DecisionType } from "@/lib/review/decision";
import { getExplorerTxUrl, getSupportedChain } from "@/lib/import/chains";
import { X, Copy, Check, CheckCircle2 } from "lucide-react";

export type DecisionLifecycleStatus =
  | "idle"
  | "input"
  | "preparing"
  | "preview"
  | "awaiting_signature"
  | "submitted"
  | "confirming"
  | "confirmed"
  | "failed";

export interface DecisionDialogProps {
  isOpen: boolean;
  workspaceId: string;
  expenseId: string;
  version: number;
  decision: DecisionType;
  userAddress: string;
  connectedChainId?: number;
  csrfToken?: string | undefined;
  onClose: () => void;
  onDecisionRecorded: (txHash: string) => void;
}

export function DecisionDialog({
  isOpen,
  workspaceId,
  expenseId,
  version,
  decision,
  userAddress,
  connectedChainId = 31337,
  csrfToken,
  onClose,
  onDecisionRecorded,
}: DecisionDialogProps) {
  const isReasonRequired =
    decision === "reject" || decision === "request_changes";
  const [status, setStatus] = useState<DecisionLifecycleStatus>(
    isReasonRequired ? "input" : "preparing",
  );
  const [reason, setReason] = useState("");
  const [prepared, setPrepared] = useState<PreparedDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    setStatus(isReasonRequired ? "input" : "preparing");
    setReason("");
    setPrepared(null);
    setError(null);
    setTxHash(null);
    onClose();
  }, [isReasonRequired, onClose]);

  const prepareAction = useCallback(
    async (humanReason: string) => {
      try {
        setStatus("preparing");
        setError(null);

        const res = await fetch(
          `/api/workspaces/${workspaceId}/expenses/${expenseId}/decision/prepare`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              version,
              decision,
              reason:
                humanReason.trim().length > 0 ? humanReason.trim() : undefined,
            }),
          },
        );

        const data = await res.json();
        if (res.ok && data.ok && data.prepared) {
          setPrepared(data.prepared);
          setStatus("preview");
        } else {
          setError(data.error?.message || "Failed to prepare decision intent.");
          setStatus("failed");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error.");
        setStatus("failed");
      }
    },
    [workspaceId, expenseId, version, decision],
  );

  // Initialize prepare on dialog open for approve
  useEffect(() => {
    if (!isOpen || isReasonRequired) return;

    let ignore = false;
    async function prepare() {
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/expenses/${expenseId}/decision/prepare`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              version,
              decision,
            }),
          },
        );

        const data = await res.json();
        if (ignore) return;

        if (res.ok && data.ok && data.prepared) {
          setPrepared(data.prepared);
          setStatus("preview");
        } else {
          setError(data.error?.message || "Failed to prepare decision intent.");
          setStatus("failed");
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Network error.");
          setStatus("failed");
        }
      }
    }

    void prepare();
    return () => {
      ignore = true;
    };
  }, [isOpen, isReasonRequired, workspaceId, expenseId, version, decision]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        status !== "awaiting_signature" &&
        status !== "confirming"
      ) {
        handleClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, status, handleClose]);

  const handleSubmit = async () => {
    if (!prepared) return;

    try {
      setStatus("awaiting_signature");
      setError(null);

      let hash: string;

      // Check for browser wallet
      if (
        typeof window !== "undefined" &&
        (
          window as unknown as {
            ethereum?: { request: (args: unknown) => Promise<unknown> };
          }
        ).ethereum
      ) {
        const ethereum = (
          window as unknown as {
            ethereum: { request: (args: unknown) => Promise<unknown> };
          }
        ).ethereum;

        // Switch to target chain if needed
        try {
          await ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${prepared.chainId.toString(16)}` }],
          });
        } catch {
          // Continue if already on chain or unrecognized
        }

        const accounts = (await ethereum.request({
          method: "eth_requestAccounts",
        })) as string[];

        const from = accounts[0];
        if (!from) throw new Error("No wallet account selected.");

        hash = (await ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from,
              to: prepared.registryAddress,
              data: prepared.calldata,
            },
          ],
        })) as string;
      } else {
        // Simulation / mock fallback
        await new Promise((resolve) => setTimeout(resolve, 800));
        hash =
          "0x" +
          Array.from({ length: 64 }, () =>
            Math.floor(Math.random() * 16).toString(16),
          ).join("");
      }

      setTxHash(hash);
      setStatus("submitted");
      setStatus("confirming");

      // Reconcile with API server
      const recRes = await fetch(
        `/api/workspaces/${workspaceId}/expenses/${expenseId}/decision/reconcile`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
          },
          body: JSON.stringify({
            version,
            decision,
            txHash: hash,
            reason: reason.trim().length > 0 ? reason.trim() : undefined,
          }),
        },
      );

      const recData = await recRes.json();
      if (!recRes.ok || !recData.ok) {
        throw new Error(
          recData.error?.message ||
            `Reconciliation failed (HTTP ${recRes.status}).`,
        );
      }

      setStatus("confirmed");
      onDecisionRecorded(hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed.");
      setStatus("failed");
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!isOpen) return null;

  const effectiveChainId = prepared?.chainId ?? connectedChainId;
  const chainInfo = getSupportedChain(effectiveChainId);
  const explorerUrl =
    txHash && prepared ? getExplorerTxUrl(prepared.chainId, txHash) : null;

  const isPending =
    status === "preparing" ||
    status === "awaiting_signature" ||
    status === "confirming";

  const decisionTitles: Record<DecisionType, string> = {
    approve: `Approve Version ${version}`,
    request_changes: `Request Changes for Version ${version}`,
    reject: `Reject Version ${version}`,
  };

  const decisionBadgeColors: Record<
    DecisionType,
    { bg: string; text: string; border: string }
  > = {
    approve: {
      bg: "var(--status-success-subtle)",
      text: "var(--status-success)",
      border: "var(--status-success)",
    },
    request_changes: {
      bg: "var(--status-warning-subtle)",
      text: "var(--status-warning)",
      border: "var(--status-warning)",
    },
    reject: {
      bg: "var(--status-danger-subtle)",
      text: "var(--status-danger)",
      border: "var(--status-danger)",
    },
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="decision-dialog-title"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "var(--space-4)",
      }}
    >
      <div
        ref={dialogRef}
        className="card"
        style={{
          width: "100%",
          maxWidth: "600px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid var(--border-subtle)",
          boxShadow:
            "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "var(--space-4) var(--space-6)",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
            }}
          >
            <span
              style={{
                padding: "2px 8px",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                backgroundColor: decisionBadgeColors[decision].bg,
                color: decisionBadgeColors[decision].text,
                border: `1px solid ${decisionBadgeColors[decision].border}`,
              }}
            >
              {decision.replace("_", " ")}
            </span>
            <h2
              id="decision-dialog-title"
              style={{ margin: 0, fontSize: "1.125rem" }}
            >
              {decisionTitles[decision]}
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isPending}
            className="btn btn-secondary"
            style={{
              height: "28px",
              padding: "0 8px",
              fontSize: "0.8125rem",
              opacity: isPending ? 0.5 : 1,
              display: "inline-flex",
              alignItems: "center",
            }}
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            padding: "var(--space-6)",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
          }}
        >
          {/* Step 1: Human Reason Input (if reject or request_changes) */}
          {status === "input" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
              }}
            >
              <label
                htmlFor="decision-reason-input"
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "var(--text-primary)",
                }}
              >
                Human Reason{" "}
                <span style={{ color: "var(--status-danger)" }}>*</span>
              </label>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.8125rem",
                  color: "var(--text-muted)",
                }}
              >
                {decision === "reject"
                  ? "Rejection strictly requires a non-empty human rationale. A cryptographic hash of this reason will be anchored immutably onchain."
                  : "Requesting changes requires specific instructions for the submitter so they can create a corrected successor version."}
              </p>
              <textarea
                id="decision-reason-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter detailed reason for this decision..."
                rows={4}
                style={{
                  width: "100%",
                  padding: "var(--space-3)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                  backgroundColor: "var(--bg-card)",
                  color: "var(--text-primary)",
                  fontSize: "0.875rem",
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "var(--space-3)",
                  marginTop: "var(--space-2)",
                }}
              >
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn btn-secondary"
                  style={{ height: "36px" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void prepareAction(reason)}
                  disabled={reason.trim().length === 0}
                  className="btn btn-primary"
                  style={{
                    height: "36px",
                    opacity: reason.trim().length === 0 ? 0.5 : 1,
                  }}
                >
                  Continue to Onchain Preview →
                </button>
              </div>
            </div>
          )}

          {/* Preparing indicator */}
          {status === "preparing" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "var(--space-8) 0",
                gap: "var(--space-3)",
              }}
            >
              <div className="spinner" />
              <div style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
                Preparing exact-version calldata and EIP-712 envelope...
              </div>
            </div>
          )}

          {/* Preview & Execution */}
          {(status === "preview" ||
            status === "awaiting_signature" ||
            status === "submitted" ||
            status === "confirming" ||
            status === "confirmed" ||
            status === "failed") &&
            prepared && (
              <>
                {/* Onchain Commitment Verification Banner */}
                <div
                  style={{
                    padding: "var(--space-3) var(--space-4)",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-2)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.8125rem",
                    }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>
                      Target Version:
                    </span>
                    <span className="font-mono font-medium">
                      v{prepared.version}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.8125rem",
                    }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>
                      Expense Commitment:
                    </span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-2)",
                      }}
                    >
                      <span
                        className="font-mono"
                        style={{ fontSize: "0.75rem" }}
                      >
                        {prepared.commitment.slice(0, 10)}...
                        {prepared.commitment.slice(-8)}
                      </span>
                      <button
                        onClick={() =>
                          copyToClipboard(prepared.commitment, "commitment")
                        }
                        className="btn btn-secondary"
                        style={{
                          height: "22px",
                          padding: "0 6px",
                          fontSize: "0.6875rem",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {copiedField === "commitment" ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />{" "}
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-gray-500" /> Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {prepared.reasonCommitment !==
                    "0x0000000000000000000000000000000000000000000000000000000000000000" && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.8125rem",
                      }}
                    >
                      <span style={{ color: "var(--text-muted)" }}>
                        Reason Commitment:
                      </span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-2)",
                        }}
                      >
                        <span
                          className="font-mono"
                          style={{ fontSize: "0.75rem" }}
                        >
                          {prepared.reasonCommitment.slice(0, 10)}...
                          {prepared.reasonCommitment.slice(-8)}
                        </span>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              prepared.reasonCommitment,
                              "reasonCommitment",
                            )
                          }
                          className="btn btn-secondary"
                          style={{
                            height: "22px",
                            padding: "0 6px",
                            fontSize: "0.6875rem",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          {copiedField === "reasonCommitment" ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />{" "}
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-gray-500" /> Copy
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.8125rem",
                    }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>
                      Registry Address:
                    </span>
                    <span className="font-mono" style={{ fontSize: "0.75rem" }}>
                      {prepared.registryAddress.slice(0, 8)}...
                      {prepared.registryAddress.slice(-6)}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.8125rem",
                    }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>
                      Reviewer Address:
                    </span>
                    <span className="font-mono" style={{ fontSize: "0.75rem" }}>
                      {userAddress.slice(0, 8)}...{userAddress.slice(-6)}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.8125rem",
                    }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>
                      Target Chain:
                    </span>
                    <span className="font-mono" style={{ fontSize: "0.75rem" }}>
                      {chainInfo?.name ?? `Chain ID ${effectiveChainId}`}
                    </span>
                  </div>
                </div>

                {/* Reason Text Summary */}
                {prepared.reasonText && (
                  <div
                    style={{
                      padding: "var(--space-3)",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid var(--border-subtle)",
                      fontSize: "0.8125rem",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 500,
                        marginBottom: "var(--space-1)",
                      }}
                    >
                      Reason:
                    </div>
                    <div
                      style={{
                        color: "var(--text-secondary)",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {prepared.reasonText}
                    </div>
                  </div>
                )}

                {/* Founder Invariant Warning */}
                <div
                  style={{
                    padding: "var(--space-3) var(--space-4)",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "rgba(59, 130, 246, 0.08)",
                    border: "1px solid rgba(59, 130, 246, 0.2)",
                    fontSize: "0.75rem",
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  <strong>Founder Invariant:</strong> Approval binds strictly to
                  the exact current commitment (v{prepared.version}) and an
                  authorized human reviewer. AI has no authority. Material edits
                  visibly create a successor version (V+1), invalidating prior
                  approvals.
                </div>

                {/* Status Messages & Spinners */}
                {status === "awaiting_signature" && (
                  <div
                    style={{
                      padding: "var(--space-3)",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "var(--status-warning-subtle)",
                      border: "1px solid var(--status-warning)",
                      color: "var(--status-warning)",
                      fontSize: "0.8125rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                    }}
                  >
                    <div className="spinner" />
                    <span>Confirm transaction in your connected wallet...</span>
                  </div>
                )}

                {status === "confirming" && (
                  <div
                    style={{
                      padding: "var(--space-3)",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "var(--status-info-subtle)",
                      border: "1px solid var(--status-info)",
                      color: "var(--status-info)",
                      fontSize: "0.8125rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                    }}
                  >
                    <div className="spinner" />
                    <span>
                      Transaction submitted. Confirming on Monad and updating
                      offchain state...
                    </span>
                  </div>
                )}

                {status === "confirmed" && (
                  <div
                    style={{
                      padding: "var(--space-4)",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "var(--status-success-subtle)",
                      border: "1px solid var(--status-success)",
                      color: "var(--status-success)",
                      fontSize: "0.875rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--space-2)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontWeight: 600,
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" /> Decision
                      recorded successfully onchain and verified!
                    </div>
                    {txHash && (
                      <div
                        style={{
                          fontSize: "0.75rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-2)",
                        }}
                      >
                        <span>Tx Hash:</span>
                        <span className="font-mono">
                          {txHash.slice(0, 16)}...
                        </span>
                        {explorerUrl && (
                          <a
                            href={explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: "var(--status-success)",
                              textDecoration: "underline",
                            }}
                          >
                            View on Explorer ↗
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {error && (
                  <div
                    style={{
                      padding: "var(--space-3)",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "var(--status-danger-subtle)",
                      border: "1px solid var(--status-danger)",
                      color: "var(--status-danger)",
                      fontSize: "0.8125rem",
                    }}
                  >
                    {error}
                  </div>
                )}
              </>
            )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: "var(--space-4) var(--space-6)",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "var(--space-3)",
            backgroundColor: "var(--bg-card)",
          }}
        >
          {status === "confirmed" ? (
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-primary"
              style={{ height: "38px", minWidth: "100px" }}
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleClose}
                disabled={isPending}
                className="btn btn-secondary"
                style={{ height: "38px" }}
              >
                Cancel
              </button>

              {status !== "input" && (
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={isPending || !prepared}
                  className="btn btn-primary"
                  style={{
                    height: "38px",
                    fontWeight: 600,
                    opacity: isPending || !prepared ? 0.5 : 1,
                    backgroundColor:
                      decision === "reject"
                        ? "var(--status-danger)"
                        : decision === "request_changes"
                          ? "var(--status-warning)"
                          : undefined,
                    color: decision === "request_changes" ? "#000" : undefined,
                  }}
                >
                  {isPending
                    ? "Recording..."
                    : decision === "approve"
                      ? "Confirm Approval"
                      : decision === "request_changes"
                        ? "Confirm Request Changes"
                        : "Confirm Rejection"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
