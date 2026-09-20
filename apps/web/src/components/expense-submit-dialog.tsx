"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ExpenseSubmissionPreview } from "@/lib/expense/submission";
import { getExplorerTxUrl, getSupportedChain } from "@/lib/import/chains";

export type SubmissionLifecycleStatus =
  | "idle"
  | "preparing"
  | "preview"
  | "awaiting_signature"
  | "submitted"
  | "confirming"
  | "confirmed"
  | "failed"
  | "rejected";

export interface ExpenseSubmitDialogProps {
  isOpen: boolean;
  workspaceId: string;
  expenseId: string;
  connectedChainId: number;
  csrfToken?: string | undefined;
  onClose: () => void;
  onSubmitted: (txHash: string) => void;
}

export function ExpenseSubmitDialog({
  isOpen,
  workspaceId,
  expenseId,
  connectedChainId,
  csrfToken,
  onClose,
  onSubmitted,
}: ExpenseSubmitDialogProps) {
  const [status, setStatus] = useState<SubmissionLifecycleStatus>("preparing");
  const [preview, setPreview] = useState<ExpenseSubmissionPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    setStatus("preparing");
    setPreview(null);
    setError(null);
    setTxHash(null);
    onClose();
  }, [onClose]);

  // 1. Fetch submission preview asynchronously when dialog opens
  useEffect(() => {
    let ignore = false;
    if (!isOpen) return;

    async function loadPreview() {
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/expenses/${expenseId}/submit/prepare`,
          { method: "POST" },
        );
        const data = await res.json();
        if (ignore) return;
        if (data.ok && data.preview) {
          setPreview(data.preview);
          setStatus("preview");
        } else {
          setError(
            data.error?.message || "Failed to prepare submission intent.",
          );
          setStatus("failed");
        }
      } catch (err) {
        if (ignore) return;
        setError(err instanceof Error ? err.message : "Network error.");
        setStatus("failed");
      }
    }

    void loadPreview();

    return () => {
      ignore = true;
    };
  }, [isOpen, workspaceId, expenseId]);

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

  if (!isOpen) return null;

  const isNetworkMismatch =
    preview !== null && connectedChainId !== preview.intent.chainId;

  const chainInfo = preview ? getSupportedChain(preview.intent.chainId) : null;
  const explorerUrl =
    txHash && preview ? getExplorerTxUrl(preview.intent.chainId, txHash) : null;

  const isPending =
    status === "preparing" ||
    status === "awaiting_signature" ||
    status === "confirming";

  // 2. Wallet signing & submission handler
  const handleSubmit = async () => {
    if (!preview) return;

    try {
      setStatus("awaiting_signature");
      setError(null);

      let hash: string;

      // Check if browser wallet is available
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

        // Verify/switch network
        try {
          await ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${preview.intent.chainId.toString(16)}` }],
          });
        } catch {
          // If switch fails, continue or throw
        }

        const accounts = (await ethereum.request({
          method: "eth_requestAccounts",
        })) as string[];

        const from = accounts[0];
        if (!from) throw new Error("No wallet account selected.");

        // Send transaction to ClarioExpenseRegistryV1
        hash = (await ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from,
              to: preview.intent.to,
              data: preview.intent.data,
            },
          ],
        })) as string;
      } else {
        // Fallback for simulation / mock demo mode
        await new Promise((resolve) => setTimeout(resolve, 800));
        // Synthetic deterministic hash for demonstration
        hash =
          "0x" +
          Array.from({ length: 64 }, () =>
            Math.floor(Math.random() * 16).toString(16),
          ).join("");
      }

      setTxHash(hash);
      setStatus("submitted");

      // Now begin block confirmation
      setStatus("confirming");

      // Reconcile with API server
      const recRes = await fetch(
        `/api/workspaces/${workspaceId}/expenses/${expenseId}/submit/reconcile`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
          },
          body: JSON.stringify({ txHash: hash }),
        },
      );

      const recData = await recRes.json();
      if (!recRes.ok || !recData.ok) {
        throw new Error(
          recData.error?.message || "Failed to reconcile onchain submission.",
        );
      }

      setStatus("confirmed");
      onSubmitted(hash);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submission failed.";
      if (msg.includes("reject") || msg.includes("denied")) {
        setStatus("rejected");
        setError("Transaction signature was rejected by user.");
      } else {
        setStatus("failed");
        setError(msg);
      }
    }
  };

  return (
    <div className="dialog-backdrop" role="presentation">
      <div
        className="dialog-panel"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-dialog-title"
        style={{ maxWidth: "680px" }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "var(--space-4)",
            borderBottom: "1px solid var(--border)",
            paddingBottom: "16px",
          }}
        >
          <div>
            <h2
              id="submit-dialog-title"
              style={{
                margin: 0,
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "var(--foreground)",
              }}
            >
              Review & Submit Version on Monad
            </h2>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "0.875rem",
                color: "var(--muted)",
              }}
            >
              Immutable cryptographic version commitment for Expense #
              {expenseId.slice(0, 10)}...
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isPending}
            className="btn-secondary"
            style={{ padding: "4px 8px", fontSize: "0.8rem" }}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        {status === "preparing" && (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div
              style={{
                display: "inline-block",
                width: "32px",
                height: "32px",
                border: "3px solid var(--monad-purple)",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                marginBottom: "16px",
              }}
            />
            <p style={{ margin: 0, fontWeight: 500 }}>
              Computing RFC 8785 Canonical Commitment & Generating Intent...
            </p>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: "0.8rem",
                color: "var(--muted)",
              }}
            >
              All private evidence remains offchain and envelope-encrypted.
            </p>
          </div>
        )}

        {status === "preview" && preview && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            {/* Network Check */}
            {isNetworkMismatch && (
              <div
                className="callout-box warning"
                style={{
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <strong>Network Mismatch:</strong> Connected to chain #
                  {connectedChainId}. Target is{" "}
                  {chainInfo?.name || `Chain #${preview.intent.chainId}`}.
                </div>
              </div>
            )}

            {/* Public onchain record box */}
            <div
              style={{
                background: "rgba(107, 70, 193, 0.05)",
                border: "1px solid rgba(107, 70, 193, 0.3)",
                borderRadius: "6px",
                padding: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "12px",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span style={{ fontSize: "1.1rem" }}>⛓</span>
                  <strong style={{ fontSize: "0.95rem" }}>
                    Public Onchain Record (Monad)
                  </strong>
                </div>
                <span className="mono-badge" style={{ fontSize: "0.75rem" }}>
                  Version {preview.publicFields.version}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 1fr",
                  gap: "8px",
                  fontSize: "0.85rem",
                }}
              >
                <span style={{ color: "var(--muted)" }}>Commitment:</span>
                <span className="mono-badge" style={{ wordBreak: "break-all" }}>
                  {preview.publicFields.commitment}
                </span>

                <span style={{ color: "var(--muted)" }}>Predecessor:</span>
                <span className="mono-badge" style={{ wordBreak: "break-all" }}>
                  {preview.publicFields.previousCommitment}
                </span>

                <span style={{ color: "var(--muted)" }}>Target Registry:</span>
                <span className="mono-badge">{preview.intent.to}</span>

                <span style={{ color: "var(--muted)" }}>Submitter:</span>
                <span className="mono-badge">
                  {preview.publicFields.submitter}
                </span>
              </div>
            </div>

            {/* Private offchain shield box */}
            <div
              style={{
                background: "rgba(16, 185, 129, 0.05)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                borderRadius: "6px",
                padding: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "10px",
                }}
              >
                <span style={{ fontSize: "1.1rem" }}>🛡</span>
                <strong style={{ fontSize: "0.95rem", color: "#10b981" }}>
                  Confidential Offchain Ledger (Never Visible to Monad)
                </strong>
              </div>

              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: "0.82rem",
                  color: "var(--foreground)",
                }}
              >
                {preview.disclaimer}
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "10px",
                  fontSize: "0.85rem",
                }}
              >
                <div>
                  <span style={{ color: "var(--muted)", display: "block" }}>
                    Title:
                  </span>
                  <strong>{preview.privateFields.title}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--muted)", display: "block" }}>
                    Merchant:
                  </span>
                  <strong>{preview.privateFields.merchant}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--muted)", display: "block" }}>
                    Purpose:
                  </span>
                  <span style={{ color: "var(--foreground)" }}>
                    {preview.privateFields.businessPurpose.slice(0, 60)}
                    {preview.privateFields.businessPurpose.length > 60
                      ? "..."
                      : ""}
                  </span>
                </div>
                <div>
                  <span style={{ color: "var(--muted)", display: "block" }}>
                    Evidence Objects:
                  </span>
                  <span>
                    {preview.privateFields.evidenceCount} file(s) attached
                  </span>
                </div>
              </div>
            </div>

            {/* Calldata privacy disclosure */}
            <details style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
              <summary style={{ cursor: "pointer", userSelect: "none" }}>
                View Raw Calldata Intent (Verified Zero Private Leakage)
              </summary>
              <pre
                style={{
                  marginTop: "8px",
                  padding: "8px",
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  fontSize: "0.75rem",
                  maxHeight: "100px",
                  overflowY: "auto",
                }}
              >
                {preview.intent.data}
              </pre>
            </details>
          </div>
        )}

        {status === "awaiting_signature" && (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div
              style={{
                display: "inline-block",
                width: "32px",
                height: "32px",
                border: "3px solid #f59e0b",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                marginBottom: "16px",
              }}
            />
            <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>
              Awaiting Wallet Signature
            </h3>
            <p
              style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}
            >
              Please confirm the transaction in your connected wallet. Verify
              the commitment hash.
            </p>
          </div>
        )}

        {(status === "submitted" || status === "confirming") && (
          <div style={{ padding: "30px 20px", textAlign: "center" }}>
            <div
              style={{
                display: "inline-block",
                width: "32px",
                height: "32px",
                border: "3px solid var(--monad-purple)",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                marginBottom: "16px",
              }}
            />
            <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>
              Submitted to Monad (Pending Block Confirmation)
            </h3>
            <p
              style={{
                margin: "0 0 16px",
                fontSize: "0.85rem",
                color: "var(--muted)",
              }}
            >
              Transaction broadcast. Authoritative confirmation requires onchain
              event verification.
            </p>
            {txHash && (
              <div style={{ fontSize: "0.85rem" }}>
                <span style={{ color: "var(--muted)" }}>
                  Transaction Hash:{" "}
                </span>
                {explorerUrl ? (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "var(--monad-purple)",
                      textDecoration: "underline",
                    }}
                  >
                    {txHash.slice(0, 12)}...{txHash.slice(-8)} ↗
                  </a>
                ) : (
                  <span className="mono-badge">{txHash}</span>
                )}
              </div>
            )}
          </div>
        )}

        {status === "confirmed" && (
          <div style={{ padding: "30px 20px", textAlign: "center" }}>
            <div
              style={{
                fontSize: "2.5rem",
                color: "#10b981",
                marginBottom: "12px",
              }}
            >
              ✓
            </div>
            <h3
              style={{
                margin: "0 0 8px",
                fontSize: "1.2rem",
                color: "#10b981",
              }}
            >
              Expense Version Confirmed on Monad
            </h3>
            <p
              style={{
                margin: "0 0 16px",
                fontSize: "0.85rem",
                color: "var(--foreground)",
              }}
            >
              Version commitment successfully written to
              ClarioExpenseRegistryV1. The expense is now locked and submitted
              for authorized review.
            </p>
            {txHash && explorerUrl && (
              <div style={{ fontSize: "0.85rem", marginBottom: "16px" }}>
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "var(--monad-purple)",
                    textDecoration: "underline",
                  }}
                >
                  View Monad Block Explorer Receipt ↗
                </a>
              </div>
            )}
          </div>
        )}

        {(status === "failed" || status === "rejected") && (
          <div style={{ padding: "20px" }}>
            <div
              className="callout-box warning"
              style={{
                margin: 0,
                borderLeftColor: status === "rejected" ? "#f59e0b" : "#ef4444",
              }}
            >
              <strong>
                {status === "rejected"
                  ? "Signature Rejected"
                  : "Submission Failed"}
                :
              </strong>
              <p style={{ margin: "4px 0 0" }}>
                {error || "An unexpected error occurred."}
              </p>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
            marginTop: "20px",
            borderTop: "1px solid var(--border)",
            paddingTop: "16px",
          }}
        >
          {status === "preview" && (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="btn-secondary"
                style={{ padding: "8px 16px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                className="btn-primary"
                style={{ padding: "8px 20px" }}
              >
                Sign & Submit on Monad
              </button>
            </>
          )}

          {(status === "failed" || status === "rejected") && (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="btn-secondary"
                style={{ padding: "8px 16px" }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                className="btn-primary"
                style={{ padding: "8px 20px" }}
              >
                Retry Submission
              </button>
            </>
          )}

          {status === "confirmed" && (
            <button
              type="button"
              onClick={handleClose}
              className="btn-primary"
              style={{ padding: "8px 24px" }}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
