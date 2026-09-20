"use client";

import React, { useEffect, useRef } from "react";
import type { PreparedTransactionIntent } from "@/lib/workspace/types";

export type TransactionLifecycleStatus =
  | "preparing"
  | "awaiting_signature"
  | "submitted"
  | "confirming"
  | "confirmed"
  | "failed"
  | "rejected";

export interface IntentDialogProps {
  isOpen: boolean;
  intent: PreparedTransactionIntent | null;
  status: TransactionLifecycleStatus;
  txHash?: string | undefined;
  errorMessage?: string | undefined;
  connectedChainId: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function IntentDialog({
  isOpen,
  intent,
  status,
  txHash,
  errorMessage,
  connectedChainId,
  onConfirm,
  onCancel,
}: IntentDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        status !== "confirming" &&
        status !== "awaiting_signature"
      ) {
        onCancel();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, status, onCancel]);

  if (!isOpen || !intent) return null;

  const isNetworkMismatch = connectedChainId !== intent.chainId;
  const isPending =
    status === "awaiting_signature" ||
    status === "submitted" ||
    status === "confirming";

  return (
    <div className="dialog-backdrop" role="presentation">
      <div
        className="dialog-panel"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="intent-dialog-title"
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "var(--space-4)",
          }}
        >
          <div>
            <h2
              id="intent-dialog-title"
              style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}
            >
              Transaction Intent Review
            </h2>
            <p
              style={{
                margin: "var(--space-1) 0 0",
                fontSize: "0.875rem",
                color: "var(--text-secondary)",
              }}
            >
              {intent.description}
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={isPending}
            className="btn btn-ghost btn-sm"
            aria-label="Close dialog"
            style={{ fontSize: "1.25rem", padding: "0 var(--space-2)" }}
          >
            ✕
          </button>
        </div>

        {/* Network Mismatch Alert */}
        {isNetworkMismatch && (
          <div
            style={{
              padding: "var(--space-3)",
              backgroundColor: "var(--danger-soft)",
              border: "1px solid var(--danger)",
              borderRadius: "var(--radius-sm)",
              color: "var(--danger-strong)",
              fontSize: "0.8125rem",
              marginBottom: "var(--space-4)",
            }}
          >
            <strong>⚠️ Unsupported Network:</strong> Your wallet is connected to
            Chain ID {connectedChainId}, but this transaction targets Monad
            Chain ID {intent.chainId}. Please switch networks in your wallet
            before signing.
          </div>
        )}

        {/* Warnings */}
        {intent.warnings && intent.warnings.length > 0 && (
          <div
            style={{
              padding: "var(--space-3)",
              backgroundColor: "var(--warning-soft)",
              border: "1px solid var(--warning)",
              borderRadius: "var(--radius-sm)",
              color: "var(--warning-strong)",
              fontSize: "0.8125rem",
              marginBottom: "var(--space-4)",
            }}
          >
            {intent.warnings.map((w, i) => (
              <div key={i}>⚠️ {w}</div>
            ))}
          </div>
        )}

        {/* Technical Intent Ledger */}
        <div
          style={{
            backgroundColor: "var(--background-secondary)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-4)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
            fontSize: "0.8125rem",
            marginBottom: "var(--space-4)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-muted)" }}>Target Contract:</span>
            <span className="font-mono" title={intent.to}>
              {intent.to.slice(0, 10)}...{intent.to.slice(-8)}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-muted)" }}>Function:</span>
            <span style={{ fontWeight: 600 }}>{intent.functionName}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-muted)" }}>Target Chain:</span>
            <span>Monad (ID {intent.chainId})</span>
          </div>
          <div>
            <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>
              Calldata:
            </div>
            <div
              className="font-mono"
              style={{
                wordBreak: "break-all",
                backgroundColor: "var(--surface-card)",
                padding: "var(--space-2)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-subtle)",
                fontSize: "0.6875rem",
                maxHeight: "72px",
                overflowY: "auto",
              }}
            >
              {intent.data}
            </div>
          </div>
        </div>

        {/* Status Tracker */}
        <div
          style={{
            padding: "var(--space-3)",
            borderRadius: "var(--radius-sm)",
            backgroundColor:
              status === "confirmed"
                ? "var(--success-soft)"
                : status === "failed" || status === "rejected"
                  ? "var(--danger-soft)"
                  : "var(--background-secondary)",
            marginBottom: "var(--space-6)",
            fontSize: "0.8125rem",
          }}
        >
          <div
            style={{
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
            }}
          >
            <span>Status:</span>
            <span
              className={`badge ${
                status === "confirmed"
                  ? "badge-success"
                  : status === "failed" || status === "rejected"
                    ? "badge-danger"
                    : "badge-warning"
              }`}
            >
              {status.toUpperCase()}
            </span>
          </div>

          {status === "awaiting_signature" && (
            <p
              style={{
                margin: "var(--space-1) 0 0",
                color: "var(--text-secondary)",
              }}
            >
              Please review and sign the transaction prompt in your connected
              wallet.
            </p>
          )}

          {status === "confirming" && txHash && (
            <p
              style={{
                margin: "var(--space-1) 0 0",
                color: "var(--text-secondary)",
              }}
            >
              Submitted to Monad:{" "}
              <span className="font-mono">{txHash.slice(0, 10)}...</span>.
              Waiting for authoritative block confirmation...
            </p>
          )}

          {status === "confirmed" && (
            <p
              style={{
                margin: "var(--space-1) 0 0",
                color: "var(--success-strong)",
              }}
            >
              ✓ Confirmed on Monad. Role state is authoritatively active.
            </p>
          )}

          {errorMessage && (
            <p style={{ margin: "var(--space-1) 0 0", color: "var(--danger)" }}>
              Error: {errorMessage}
            </p>
          )}

          <p
            style={{
              margin: "var(--space-2) 0 0",
              fontSize: "0.75rem",
              color: "var(--text-muted)",
            }}
          >
            ℹ️ Roles are never displayed as active before authoritative
            confirmation on Monad.
          </p>
        </div>

        {/* Action Controls */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "var(--space-3)",
          }}
        >
          <button
            onClick={onCancel}
            disabled={isPending}
            className="btn btn-secondary"
          >
            {status === "confirmed" ? "Close" : "Cancel"}
          </button>
          {status !== "confirmed" && (
            <button
              onClick={onConfirm}
              disabled={isPending || isNetworkMismatch}
              className="btn btn-primary"
            >
              {isPending ? "Processing..." : "Sign & Submit"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
