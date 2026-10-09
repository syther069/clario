"use client";

/**
 * ReimbursementDialog — Treasury Settlement UX
 *
 * Implements the full treasury reimbursement flow:
 * 1. Fetches calldata from the prepare endpoint (pre-condition checks enforced server-side)
 * 2. Shows intent preview: token, recipient, amount, commitment, chain
 * 3. ERC-20 approve step (if allowance is insufficient) → wallet signs → reconcile
 * 4. Reimburse step → wallet signs → reconcile
 * 5. Shows submitted state with explorer link
 *
 * Design rules:
 * - No private fields (merchant, purpose, notes) ever shown in this component
 * - Status clearly communicates SUBMITTED vs CONFIRMED distinction
 * - Commitment hash shown as the onchain binding, not as private data
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import type {
  SettlementPrepareResponse,
  SettlementProof,
} from "@/lib/settlement/service";
import { getExplorerTxUrl, getSupportedChain } from "@/lib/import/chains";
import { MonadLogo, UsdcLogo } from "@/components/ui/crypto-icon";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Banknote,
  AlertTriangle,
  Copy,
  Check,
  X,
  Info,
} from "lucide-react";
import { ContextualIconSwap } from "@/components/ui/motion";

export type SettlementLifecycleStatus =
  | "idle"
  | "preparing"
  | "preview"
  | "awaiting_approve"
  | "approve_submitted"
  | "awaiting_reimburse"
  | "reimburse_submitted"
  | "reconciling"
  | "submitted"
  | "confirming"
  | "confirmed"
  | "failed";

export interface ReimbursementDialogProps {
  isOpen: boolean;
  workspaceId: string;
  expenseId: string;
  /** Human-readable display for the expense (safe public label) */
  expenseLabel?: string | undefined;
  userAddress: string;
  connectedChainId?: number | undefined;
  csrfToken?: string | undefined;
  onClose: () => void;
  onSettlementSubmitted: (txHash: string) => void;
}

export function ReimbursementDialog({
  isOpen,
  workspaceId,
  expenseId,
  expenseLabel,
  userAddress,
  connectedChainId = 31337,
  csrfToken,
  onClose,
  onSettlementSubmitted,
}: ReimbursementDialogProps) {
  const [status, setStatus] = useState<SettlementLifecycleStatus>("idle");
  const [prepared, setPrepared] = useState<SettlementPrepareResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [approveTxHash, setApproveTxHash] = useState<string | null>(null);
  const [reimburseTxHash, setReimburseTxHash] = useState<string | null>(null);
  const [isSimulated, setIsSimulated] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [proof, setProof] = useState<SettlementProof | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    setStatus("idle");
    setPrepared(null);
    setError(null);
    setApproveTxHash(null);
    setReimburseTxHash(null);
    setIsSimulated(false);
    setProof(null);
    setIsConfirming(false);
    setConfirmMessage(null);
    onClose();
  }, [onClose]);

  // Prepare the settlement intent when the dialog opens
  useEffect(() => {
    if (!isOpen) return;

    let ignore = false;
    async function init() {
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/expenses/${expenseId}/settlement/prepare`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
            },
            body: JSON.stringify({}),
          },
        );

        const body = (await res.json()) as
          | { ok: true; prepared: SettlementPrepareResponse }
          | { error: { code: string; message: string } };

        if (ignore) return;

        if (!res.ok || !("ok" in body)) {
          const errMsg =
            "error" in body ? body.error.message : "Prepare request failed.";
          setError(errMsg);
          setStatus("failed");
          return;
        }

        setPrepared(body.prepared);
        setStatus("preview");
      } catch (e) {
        if (ignore) return;
        setError(
          e instanceof Error ? e.message : "Network error during prepare.",
        );
        setStatus("failed");
      }
    }

    void init();
    return () => {
      ignore = true;
    };
  }, [isOpen, workspaceId, expenseId, csrfToken]);

  // Key press handling
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, handleClose]);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // ignore
    }
  };

  // Sign or simulate transaction: in Web3 browser uses window.ethereum, otherwise simulated demo
  const sendTransaction = useCallback(
    async (
      to: string,
      calldata: string,
      onSuccess: (txHash: string) => void | Promise<void>,
    ) => {
      const ethereum =
        typeof window !== "undefined"
          ? (
              window as unknown as {
                ethereum?: {
                  request: (args: {
                    method: string;
                    params?: unknown[];
                  }) => Promise<unknown>;
                };
              }
            ).ethereum
          : undefined;

      if (ethereum) {
        if (prepared?.chainId) {
          try {
            await ethereum.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: `0x${prepared.chainId.toString(16)}` }],
            });
          } catch {
            // Proceed if switch fails or chain already matches
          }
        }
        const accounts = (await ethereum.request({
          method: "eth_requestAccounts",
        })) as string[];
        if (!accounts || accounts.length === 0) {
          throw new Error("No connected wallet accounts available.");
        }
        const txHash = (await ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              to,
              from: accounts[0],
              data: calldata,
            },
          ],
        })) as string;
        await onSuccess(txHash);
        return;
      }

      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "No Ethereum wallet detected (e.g. MetaMask). Please connect a Web3 wallet extension to broadcast transactions.",
        );
      }

      // In local non-production environments without a wallet, simulate execution with explicit labeling
      setIsSimulated(true);
      const mockTxHash =
        "0x" +
        Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16),
        ).join("");
      await onSuccess(mockTxHash);
    },
    [prepared],
  );

  const handleApprove = useCallback(async () => {
    if (!prepared?.approveCalldata) return;
    try {
      setStatus("awaiting_approve");
      await sendTransaction(
        prepared.tokenAddress,
        prepared.approveCalldata,
        (hash) => {
          setApproveTxHash(hash);
          setStatus("approve_submitted");
        },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve signature failed.");
      setStatus("failed");
    }
  }, [prepared, sendTransaction]);

  const handleReimburse = useCallback(async () => {
    if (!prepared) return;
    try {
      setStatus("awaiting_reimburse");
      await sendTransaction(
        prepared.registryAddress,
        prepared.calldata,
        async (txHash) => {
          setReimburseTxHash(txHash);
          setStatus("reconciling");

          // Reconcile with the server
          const res = await fetch(
            `/api/workspaces/${workspaceId}/expenses/${expenseId}/settlement/reconcile`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
              },
              body: JSON.stringify({
                version: prepared.version,
                commitment: prepared.commitment,
                transactionHash: txHash,
                idempotencyKey: prepared.idempotencyKey,
              }),
            },
          );

          if (res.ok) {
            setStatus("submitted");
            onSettlementSubmitted(txHash);
          } else {
            const body = (await res.json()) as {
              error?: { message: string };
            };
            setError(
              body.error?.message ??
                "Reconcile failed — transaction may have been submitted.",
            );
            setStatus("submitted"); // Still show submitted — TX was sent
          }
        },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reimburse signature failed.");
      setStatus("failed");
    }
  }, [
    prepared,
    workspaceId,
    expenseId,
    csrfToken,
    onSettlementSubmitted,
    sendTransaction,
  ]);

  const handleConfirm = useCallback(
    async (txHashOverride?: string) => {
      const hash = txHashOverride ?? reimburseTxHash;
      if (!hash) return;
      setIsConfirming(true);
      setConfirmMessage(null);
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/expenses/${expenseId}/settlement/confirm`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
            },
            body: JSON.stringify({
              transactionHash: hash,
            }),
          },
        );
        const data = (await res.json().catch(() => ({}))) as {
          result?: {
            confirmed: boolean;
            status: string;
            proof?: SettlementProof;
            reason?: string;
          };
          error?: { message: string };
        };
        if (res.ok && data.result) {
          if (data.result.confirmed) {
            setStatus("confirmed");
            setProof(data.result.proof ?? null);
          } else if (data.result.status === "failed") {
            setStatus("failed");
            setError(data.result.reason ?? "Transaction reverted onchain.");
          }
        } else {
          const msg =
            data.error?.message ??
            "Transaction receipt not yet indexed on node. Please re-check in a few seconds.";
          setConfirmMessage(msg);
        }
      } catch (e) {
        setConfirmMessage(
          e instanceof Error ? e.message : "Confirmation check failed.",
        );
      } finally {
        setIsConfirming(false);
      }
    },
    [reimburseTxHash, workspaceId, expenseId, csrfToken],
  );

  const handleRetry = useCallback(async () => {
    try {
      setStatus("preparing");
      setError(null);
      setConfirmMessage(null);
      setProof(null);
      setReimburseTxHash(null);
      setApproveTxHash(null);

      const res = await fetch(
        `/api/workspaces/${workspaceId}/expenses/${expenseId}/settlement/retry`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
          },
          body: JSON.stringify({}),
        },
      );

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        setError(
          body.error?.message ??
            "Failed to reset failed reimbursement for retry.",
        );
        setStatus("failed");
        return;
      }

      // Re-trigger prepare
      const prepRes = await fetch(
        `/api/workspaces/${workspaceId}/expenses/${expenseId}/settlement/prepare`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
          },
          body: JSON.stringify({}),
        },
      );
      const prepBody = (await prepRes.json().catch(() => ({}))) as {
        ok?: boolean;
        prepared?: SettlementPrepareResponse;
        error?: { message?: string };
      };
      if (prepRes.ok && prepBody.prepared) {
        setPrepared(prepBody.prepared);
        setStatus("preview");
      } else {
        setError(prepBody.error?.message ?? "Prepare failed during retry.");
        setStatus("failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry attempt failed.");
      setStatus("failed");
    }
  }, [workspaceId, expenseId, csrfToken]);

  if (!isOpen) return null;

  const supportedChain = getSupportedChain(
    prepared?.chainId ?? connectedChainId,
  );
  const txUrl =
    !isSimulated && reimburseTxHash && prepared?.chainId
      ? getExplorerTxUrl(prepared.chainId, reimburseTxHash)
      : null;

  const isWrongChain =
    prepared?.chainId && connectedChainId !== prepared.chainId;

  return (
    <div
      className="settlement-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settlement-dialog-title"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="settlement-dialog" ref={dialogRef}>
        {/* Header */}
        <div className="settlement-header">
          <div className="settlement-header-left">
            <span className="settlement-icon" aria-hidden="true">
              {status === "confirmed" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : status === "submitted" ? (
                <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
              ) : status === "failed" ? (
                <XCircle className="w-5 h-5 text-rose-600" />
              ) : (
                <Banknote className="w-5 h-5 text-[#836EF9]" />
              )}
            </span>
            <div>
              <h2 id="settlement-dialog-title" className="settlement-title">
                {status === "confirmed"
                  ? "Reimbursement Confirmed"
                  : status === "submitted"
                    ? "Reimbursement Submitted"
                    : status === "failed"
                      ? "Reimbursement Failed"
                      : "Initiate Reimbursement"}
              </h2>
              {expenseLabel && (
                <p className="settlement-subtitle">{expenseLabel}</p>
              )}
            </div>
          </div>
          <button
            className="settlement-close-btn"
            onClick={handleClose}
            aria-label="Close reimbursement dialog"
            id="settlement-close-button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="settlement-content">
          {/* Loading state */}
          {status === "preparing" && (
            <div className="settlement-loading" role="status">
              <div className="settlement-spinner" aria-hidden="true" />
              <span>Verifying approval and preparing calldata…</span>
            </div>
          )}

          {/* Preview / Action state */}
          {(status === "preview" ||
            status === "awaiting_approve" ||
            status === "approve_submitted" ||
            status === "awaiting_reimburse" ||
            status === "reconciling") &&
            prepared && (
              <>
                {/* Wrong chain warning */}
                {isWrongChain && (
                  <div
                    className="settlement-alert settlement-alert--warning"
                    role="alert"
                  >
                    <span className="settlement-alert-icon" aria-hidden="true">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    </span>
                    <div>
                      <strong>Wrong Network</strong>
                      <p>
                        Please switch to{" "}
                        {supportedChain?.name ?? `Chain ${prepared.chainId}`}{" "}
                        (ID: {prepared.chainId}) before signing.
                      </p>
                    </div>
                  </div>
                )}

                {/* Intent summary */}
                <div className="settlement-intent-card">
                  <h3 className="settlement-section-label">
                    Settlement Intent
                  </h3>
                  <div className="settlement-intent-grid">
                    <IntentRow
                      label="Amount"
                      value={`${prepared.amountDisplay} ${prepared.token.symbol}`}
                      valueClass="settlement-amount"
                    />
                    <IntentRow
                      label="Token Contract"
                      value={prepared.tokenAddress}
                      mono
                      onCopy={() =>
                        copyToClipboard(prepared.tokenAddress, "token")
                      }
                      copied={copiedField === "token"}
                    />
                    <IntentRow
                      label="Recipient"
                      value={prepared.recipient}
                      mono
                      onCopy={() =>
                        copyToClipboard(prepared.recipient, "recipient")
                      }
                      copied={copiedField === "recipient"}
                    />
                    <IntentRow
                      label="Registry Contract"
                      value={prepared.registryAddress}
                      mono
                      onCopy={() =>
                        copyToClipboard(prepared.registryAddress, "registry")
                      }
                      copied={copiedField === "registry"}
                    />
                    <IntentRow
                      label="Version"
                      value={String(prepared.version)}
                    />
                    <IntentRow
                      label="Commitment"
                      value={`${prepared.commitment.slice(0, 10)}…${prepared.commitment.slice(-6)}`}
                      mono
                      onCopy={() =>
                        copyToClipboard(prepared.commitment, "commitment")
                      }
                      copied={copiedField === "commitment"}
                    />
                    <IntentRow
                      label="Network"
                      value={`${supportedChain?.name ?? "Unknown"} (${prepared.chainId})`}
                    />
                    <IntentRow
                      label="Treasury Operator"
                      value={`${userAddress.slice(0, 6)}…${userAddress.slice(-4)}`}
                      mono
                      onCopy={() => copyToClipboard(userAddress, "operator")}
                      copied={copiedField === "operator"}
                    />
                  </div>
                </div>

                {/* Approve step */}
                {prepared.needsApproval && (
                  <div className="settlement-step">
                    <div className="settlement-step-number" aria-hidden="true">
                      1
                    </div>
                    <div className="settlement-step-body">
                      <strong
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <UsdcLogo className="h-4 w-4 inline" />
                        Approve USDC Spend
                      </strong>
                      <p>
                        The registry contract needs approval to transfer{" "}
                        {prepared.amountDisplay} {prepared.token.symbol} from
                        your treasury wallet.
                      </p>
                      {approveTxHash ? (
                        <div className="settlement-step-done">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 inline mr-1" />{" "}
                          Approval submitted:{" "}
                          <span className="settlement-mono">
                            {approveTxHash.slice(0, 10)}…
                          </span>
                        </div>
                      ) : (
                        <button
                          id="settlement-approve-btn"
                          className="settlement-btn settlement-btn--secondary"
                          onClick={handleApprove}
                          disabled={status !== "preview" || !!isWrongChain}
                        >
                          {status === "awaiting_approve" ? (
                            <>
                              <span
                                className="settlement-spinner settlement-spinner--sm"
                                aria-hidden="true"
                              />{" "}
                              Waiting for signature…
                            </>
                          ) : (
                            "Sign Approval"
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Reimburse step */}
                <div className="settlement-step">
                  <div className="settlement-step-number" aria-hidden="true">
                    {prepared.needsApproval ? "2" : "1"}
                  </div>
                  <div className="settlement-step-body">
                    <strong
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <UsdcLogo className="h-4 w-4 inline" />
                      Sign Reimbursement ({prepared.amountDisplay}{" "}
                      {prepared.token.symbol})
                    </strong>
                    <p>
                      Sends an onchain call to{" "}
                      <code className="settlement-mono">
                        ClarioSettlementRegistry.reimburse()
                      </code>
                      , binding the approved commitment to the payment on{" "}
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontWeight: "bold",
                        }}
                      >
                        <MonadLogo className="h-3.5 w-3.5 inline" />
                        Monad
                      </span>
                      .
                    </p>
                    <button
                      id="settlement-reimburse-btn"
                      className="settlement-btn settlement-btn--primary"
                      onClick={handleReimburse}
                      disabled={
                        (prepared.needsApproval && !approveTxHash) ||
                        status === "awaiting_approve" ||
                        status === "awaiting_reimburse" ||
                        status === "reconciling" ||
                        !!isWrongChain
                      }
                    >
                      {status === "awaiting_reimburse" ||
                      status === "reconciling" ? (
                        <>
                          <span
                            className="settlement-spinner settlement-spinner--sm"
                            aria-hidden="true"
                          />{" "}
                          {status === "reconciling"
                            ? "Recording…"
                            : "Waiting for signature…"}
                        </>
                      ) : (
                        "Sign Reimbursement"
                      )}
                    </button>
                  </div>
                </div>

                {/* Calldata disclosure */}
                <details className="settlement-calldata-details">
                  <summary className="settlement-calldata-summary">
                    View raw calldata
                  </summary>
                  <div className="settlement-calldata-body">
                    <div className="settlement-calldata-label">
                      reimburse() calldata
                    </div>
                    <pre className="settlement-calldata-pre">
                      {prepared.calldata}
                    </pre>
                    <button
                      className="settlement-copy-btn"
                      onClick={() =>
                        copyToClipboard(prepared.calldata, "calldata")
                      }
                      id="settlement-copy-calldata-btn"
                    >
                      {copiedField === "calldata" ? "Copied!" : "Copy calldata"}
                    </button>
                  </div>
                </details>
              </>
            )}

          {/* Submitted state */}
          {status === "submitted" && reimburseTxHash && (
            <div className="settlement-result">
              <div className="settlement-result-badge">
                <span className="settlement-result-icon" aria-hidden="true">
                  ⏳
                </span>
                <div>
                  <h3 className="settlement-result-heading">
                    Reimbursement Submitted to Monad
                  </h3>
                  <p className="settlement-result-sub">
                    Transaction broadcast to Monad. Receipt confirmation is
                    required before marking as finalized.
                  </p>
                </div>
              </div>

              <div className="settlement-result-detail">
                <div className="settlement-result-label">Transaction Hash</div>
                <div className="settlement-result-value-row">
                  <span className="settlement-mono settlement-result-hash">
                    {reimburseTxHash}
                  </span>
                  <button
                    className="settlement-copy-btn"
                    onClick={() => copyToClipboard(reimburseTxHash, "txhash")}
                  >
                    {copiedField === "txhash" ? "Copied!" : "Copy"}
                  </button>
                </div>
                {isSimulated ? (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#f59e0b",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      background: "rgba(245, 158, 11, 0.1)",
                      border: "1px solid rgba(245, 158, 11, 0.25)",
                    }}
                  >
                    Simulated Demonstration Data — Explorer link disabled for
                    simulation
                  </div>
                ) : (
                  txUrl && (
                    <a
                      href={txUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="settlement-explorer-link"
                      id="settlement-explorer-link"
                    >
                      View on Explorer →
                    </a>
                  )
                )}
              </div>

              <div
                className="settlement-status-note flex items-start gap-2"
                role="note"
              >
                <Info
                  className="w-4 h-4 shrink-0 text-slate-500 mt-0.5"
                  aria-hidden="true"
                />
                <div>
                  Status shows <strong>submitted</strong>, not confirmed.
                  Confirmation requires transaction receipt verification against
                  Monad settlement registry rules.
                </div>
              </div>

              <div
                style={{
                  marginTop: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <button
                  id="settlement-verify-btn"
                  className="settlement-btn settlement-btn--primary"
                  onClick={() => void handleConfirm()}
                  disabled={isConfirming}
                >
                  {isConfirming ? (
                    <>
                      <span
                        className="settlement-spinner settlement-spinner--sm"
                        aria-hidden="true"
                      />{" "}
                      Verifying onchain confirmation…
                    </>
                  ) : (
                    "Verify Onchain Confirmation →"
                  )}
                </button>
                {confirmMessage && (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--text-secondary)",
                      textAlign: "center",
                      padding: "4px",
                    }}
                  >
                    {confirmMessage}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Confirmed state */}
          {status === "confirmed" && (
            <div className="settlement-result" role="status">
              <div
                className="settlement-result-badge"
                style={{
                  backgroundColor: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                }}
              >
                <span className="settlement-result-icon" aria-hidden="true">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                </span>
                <div>
                  <h3
                    className="settlement-result-heading"
                    style={{ color: "var(--status-success)" }}
                  >
                    Settlement Confirmed & Finalized
                  </h3>
                  <p className="settlement-result-sub">
                    Reimbursement verified on Monad Settlement Registry and
                    ERC-20 event logs.
                  </p>
                </div>
              </div>

              <div className="settlement-result-detail">
                <div className="settlement-result-label">Transaction Hash</div>
                <div className="settlement-result-value-row">
                  <span className="settlement-mono settlement-result-hash">
                    {proof?.transactionHash ?? reimburseTxHash}
                  </span>
                  <button
                    className="settlement-copy-btn"
                    onClick={() =>
                      copyToClipboard(
                        proof?.transactionHash ?? reimburseTxHash ?? "",
                        "txhash",
                      )
                    }
                  >
                    {copiedField === "txhash" ? "Copied!" : "Copy"}
                  </button>
                </div>
                {proof?.explorerUrl ? (
                  <a
                    href={proof.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="settlement-explorer-link"
                    id="settlement-confirmed-explorer-link"
                  >
                    View Confirmed Proof on Explorer →
                  </a>
                ) : txUrl ? (
                  <a
                    href={txUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="settlement-explorer-link"
                    id="settlement-confirmed-explorer-link"
                  >
                    View Confirmed Proof on Explorer →
                  </a>
                ) : null}
              </div>

              {proof && (
                <div
                  className="settlement-intent-card"
                  style={{ marginTop: "12px" }}
                >
                  <h3 className="settlement-section-label">
                    Settlement Proof Details
                  </h3>
                  <div className="settlement-intent-grid">
                    <IntentRow
                      label="Block Number"
                      value={proof.blockNumber}
                      mono
                    />
                    <IntentRow
                      label="Payment Reference"
                      value={`${proof.paymentReference.slice(0, 10)}…${proof.paymentReference.slice(-6)}`}
                      mono
                      onCopy={() =>
                        copyToClipboard(proof.paymentReference, "payref")
                      }
                      copied={copiedField === "payref"}
                    />
                    <IntentRow
                      label="Amount Settled"
                      value={`${proof.amountDisplay} USDC`}
                      valueClass="settlement-amount"
                    />
                    <IntentRow
                      label="Recipient"
                      value={proof.recipientAddress}
                      mono
                      onCopy={() =>
                        copyToClipboard(proof.recipientAddress, "conf-recip")
                      }
                      copied={copiedField === "conf-recip"}
                    />
                    <IntentRow
                      label="Settled At"
                      value={new Date(proof.settledAt).toLocaleString()}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error state */}
          {error && (
            <div
              className="settlement-alert settlement-alert--error"
              role="alert"
            >
              <span className="settlement-alert-icon" aria-hidden="true">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              </span>
              <div>
                <strong>Error</strong>
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Retry button on failure */}
          {status === "failed" && (
            <div style={{ marginTop: "16px" }}>
              <button
                id="settlement-retry-btn"
                className="settlement-btn settlement-btn--primary"
                onClick={() => void handleRetry()}
                style={{ width: "100%" }}
              >
                Reset & Retry Reimbursement →
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="settlement-footer">
          {status === "submitted" || status === "confirmed" ? (
            <button
              id="settlement-done-btn"
              className="settlement-btn settlement-btn--primary"
              onClick={handleClose}
            >
              Done
            </button>
          ) : status !== "preparing" && status !== "idle" ? (
            <button
              className="settlement-btn settlement-btn--ghost"
              onClick={handleClose}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      <style>{settlementDialogStyles}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: intent row
// ---------------------------------------------------------------------------

function IntentRow({
  label,
  value,
  mono = false,
  valueClass,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueClass?: string;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="settlement-intent-row">
      <span className="settlement-intent-label">{label}</span>
      <span
        className={`settlement-intent-value ${mono ? "settlement-mono" : ""} ${valueClass ?? ""}`}
      >
        {value}
        {onCopy && (
          <button
            className="settlement-inline-copy"
            onClick={onCopy}
            aria-label={`Copy ${label}`}
          >
            <ContextualIconSwap
              isActive={Boolean(copied)}
              ActiveIcon={Check}
              InactiveIcon={Copy}
              className="w-3.5 h-3.5"
              activeClassName="text-emerald-600 inline"
              inactiveClassName="text-gray-500 inline"
            />
          </button>
        )}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scoped styles
// ---------------------------------------------------------------------------

const settlementDialogStyles = `
  .settlement-overlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: rgba(0,0,0,0.72);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    backdrop-filter: blur(4px);
    animation: settlementFadeIn 0.18s ease;
  }

  @keyframes settlementFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .settlement-dialog {
    background: #0f1117;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 16px;
    width: 100%;
    max-width: 580px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 24px 80px rgba(0,0,0,0.8);
    animation: settlementSlideIn 0.2s cubic-bezier(0.34,1.56,0.64,1);
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.12) transparent;
  }

  @keyframes settlementSlideIn {
    from { transform: translateY(24px) scale(0.96); opacity: 0; }
    to { transform: translateY(0) scale(1); opacity: 1; }
  }

  .settlement-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }

  .settlement-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .settlement-icon {
    font-size: 28px;
    line-height: 1;
  }

  .settlement-title {
    font-size: 17px;
    font-weight: 600;
    color: #f8fafc;
    margin: 0;
    letter-spacing: -0.02em;
  }

  .settlement-subtitle {
    font-size: 12px;
    color: rgba(255,255,255,0.45);
    margin: 2px 0 0;
    text-wrap: pretty;
  }

  .settlement-close-btn {
    position: relative;
    background: none;
    border: none;
    color: rgba(255,255,255,0.5);
    font-size: 22px;
    cursor: pointer;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    transition: background-color 0.15s ease, color 0.15s ease;
    flex-shrink: 0;
  }

  .settlement-close-btn::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 44px;
    height: 44px;
    transform: translate(-50%, -50%);
  }

  .settlement-close-btn:hover {
    background: rgba(255,255,255,0.08);
    color: #f8fafc;
  }

  .settlement-content {
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .settlement-loading {
    display: flex;
    align-items: center;
    gap: 10px;
    color: rgba(255,255,255,0.6);
    font-size: 14px;
    padding: 24px 0;
    justify-content: center;
  }

  .settlement-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255,255,255,0.15);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: settlementSpin 0.7s linear infinite;
    flex-shrink: 0;
  }

  .settlement-spinner--sm {
    width: 13px;
    height: 13px;
    border-width: 1.5px;
  }

  @keyframes settlementSpin {
    to { transform: rotate(360deg); }
  }

  .settlement-alert {
    display: flex;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 10px;
    font-size: 13px;
    line-height: 1.5;
  }

  .settlement-alert--warning {
    background: rgba(234,179,8,0.1);
    border: 1px solid rgba(234,179,8,0.25);
    color: #fde68a;
  }

  .settlement-alert--error {
    background: rgba(239,68,68,0.1);
    border: 1px solid rgba(239,68,68,0.25);
    color: #fca5a5;
  }

  .settlement-alert-icon {
    font-size: 16px;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .settlement-intent-card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    padding: 14px;
  }

  .settlement-section-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.4);
    margin: 0 0 10px;
  }

  .settlement-intent-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .settlement-intent-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
  }

  .settlement-intent-label {
    font-size: 11px;
    color: rgba(255,255,255,0.45);
    min-width: 110px;
    flex-shrink: 0;
  }

  .settlement-intent-value {
    font-size: 12.5px;
    color: #e2e8f0;
    word-break: break-all;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .settlement-amount {
    font-size: 18px;
    font-weight: 700;
    color: #a5f3fc;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }

  .settlement-mono {
    font-family: 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
    font-size: 11.5px;
    font-variant-numeric: tabular-nums;
  }

  .settlement-inline-copy {
    position: relative;
    background: none;
    border: none;
    cursor: pointer;
    color: rgba(255,255,255,0.35);
    font-size: 12px;
    padding: 0 2px;
    transition: color 0.15s ease-out;
    line-height: 1;
  }

  .settlement-inline-copy::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 44px;
    height: 44px;
    transform: translate(-50%, -50%);
  }

  .settlement-inline-copy:hover {
    color: rgba(255,255,255,0.7);
  }

  .settlement-step {
    display: flex;
    gap: 14px;
    padding: 14px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px;
  }

  .settlement-step-number {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(99,102,241,0.2);
    border: 1px solid rgba(99,102,241,0.4);
    color: #a5b4fc;
    font-size: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .settlement-step-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .settlement-step-body strong {
    font-size: 13px;
    color: #f1f5f9;
    font-weight: 600;
  }

  .settlement-step-body p {
    font-size: 12px;
    color: rgba(255,255,255,0.5);
    line-height: 1.5;
    margin: 0;
  }

  .settlement-step-done {
    font-size: 12px;
    color: #86efac;
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
  }

  .settlement-calldata-details {
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 8px;
    overflow: hidden;
  }

  .settlement-calldata-summary {
    font-size: 12px;
    color: rgba(255,255,255,0.4);
    padding: 10px 14px;
    cursor: pointer;
    user-select: none;
    transition: background 0.15s;
  }

  .settlement-calldata-summary:hover {
    background: rgba(255,255,255,0.04);
  }

  .settlement-calldata-body {
    padding: 12px 14px;
    border-top: 1px solid rgba(255,255,255,0.06);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .settlement-calldata-label {
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.3);
  }

  .settlement-calldata-pre {
    font-family: 'Fira Code', 'Cascadia Code', monospace;
    font-size: 10px;
    color: rgba(255,255,255,0.5);
    white-space: pre-wrap;
    word-break: break-all;
    background: rgba(0,0,0,0.3);
    border-radius: 6px;
    padding: 8px;
    max-height: 140px;
    overflow-y: auto;
    margin: 0;
  }

  .settlement-copy-btn {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px;
    color: rgba(255,255,255,0.5);
    font-size: 11px;
    padding: 4px 10px;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
    align-self: flex-start;
  }

  .settlement-copy-btn:hover {
    background: rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.8);
  }

  .settlement-result {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 4px 0;
  }

  .settlement-result-badge {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px;
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-radius: 12px;
  }

  .settlement-result-icon {
    font-size: 28px;
    line-height: 1;
    flex-shrink: 0;
  }

  .settlement-result-heading {
    font-size: 15px;
    font-weight: 600;
    color: #6ee7b7;
    margin: 0 0 4px;
  }

  .settlement-result-sub {
    font-size: 12px;
    color: rgba(255,255,255,0.5);
    margin: 0;
    line-height: 1.5;
  }

  .settlement-result-detail {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .settlement-result-label {
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.3);
  }

  .settlement-result-value-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .settlement-result-hash {
    font-size: 11px;
    color: rgba(255,255,255,0.6);
    word-break: break-all;
  }

  .settlement-explorer-link {
    font-size: 12px;
    color: #818cf8;
    text-decoration: none;
    transition: color 0.15s;
  }

  .settlement-explorer-link:hover {
    color: #a5b4fc;
  }

  .settlement-status-note {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 12px;
    color: rgba(255,255,255,0.45);
    line-height: 1.5;
  }

  .settlement-footer {
    padding: 16px 24px 20px;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }

  .settlement-btn {
    padding: 8px 18px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.15s ease, opacity 0.15s ease, transform 0.15s ease;
    display: flex;
    align-items: center;
    gap: 7px;
    border: none;
  }

  .settlement-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .settlement-btn--primary {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: #fff;
    box-shadow: 0 2px 12px rgba(99,102,241,0.4);
  }

  .settlement-btn--primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    box-shadow: 0 4px 20px rgba(99,102,241,0.5);
    transform: translateY(-1px);
  }

  .settlement-btn--secondary {
    background: rgba(255,255,255,0.08);
    color: #e2e8f0;
    border: 1px solid rgba(255,255,255,0.12);
  }

  .settlement-btn--secondary:hover:not(:disabled) {
    background: rgba(255,255,255,0.12);
  }

  .settlement-btn--ghost {
    background: transparent;
    color: rgba(255,255,255,0.5);
    border: 1px solid rgba(255,255,255,0.08);
  }

  .settlement-btn--ghost:hover:not(:disabled) {
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.8);
  }
`;
