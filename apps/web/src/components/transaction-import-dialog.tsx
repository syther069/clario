"use client";

/**
 * Clario Attributable Transaction Import Dialog
 * Source: PRD §9.3; Architecture §4
 * Founder Invariant #12: Imported facts are provider/source-chain records, not Monad-verified truth.
 */

import React, { useState, useEffect } from "react";
import {
  type TransactionImportCandidate,
  type NormalizedTransaction,
  IMPORTED_FACTS_DISCLAIMER,
} from "../lib/import/types";
import {
  SUPPORTED_SOURCE_CHAINS,
  getExplorerTxUrl,
  type SourceChainConfig,
} from "../lib/import/chains";

export interface TransactionImportDialogProps {
  isOpen: boolean;
  workspaceId: string;
  userAddress: string;
  onClose: () => void;
  onSelectTransaction: (
    tx: NormalizedTransaction,
    paymentSource: "imported_transaction" | "transaction_hash",
  ) => void;
}

export function TransactionImportDialog({
  isOpen,
  workspaceId,
  userAddress,
  onClose,
  onSelectTransaction,
}: TransactionImportDialogProps) {
  const [activeTab, setActiveTab] = useState<"wallet" | "hash">("wallet");
  const [selectedChainId, setSelectedChainId] = useState<number>(10143); // Default to Monad Testnet
  const [queryAddress, setQueryAddress] = useState<string>(userAddress);
  const [transactions, setTransactions] = useState<
    readonly TransactionImportCandidate[]
  >([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Hash lookup states
  const [lookupHash, setLookupHash] = useState<string>("");
  const [lookupLoading, setLookupLoading] = useState<boolean>(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupCandidate, setLookupCandidate] =
    useState<TransactionImportCandidate | null>(null);

  const handleRefresh = async () => {
    if (!queryAddress || !workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const url = new URL(
        `/api/workspaces/${workspaceId}/import/transactions`,
        window.location.origin,
      );
      url.searchParams.set("address", queryAddress);
      if (selectedChainId) {
        url.searchParams.set("chainId", selectedChainId.toString());
      }

      const res = await fetch(url.toString(), {
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to fetch transactions.");
      }
      setTransactions(data.items || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error loading transactions.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    if (!isOpen || activeTab !== "wallet" || !queryAddress || !workspaceId) {
      return;
    }

    async function load() {
      try {
        const url = new URL(
          `/api/workspaces/${workspaceId}/import/transactions`,
          window.location.origin,
        );
        url.searchParams.set("address", queryAddress);
        if (selectedChainId) {
          url.searchParams.set("chainId", selectedChainId.toString());
        }

        const res = await fetch(url.toString(), {
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            data.error?.message || "Failed to fetch transactions.",
          );
        }
        if (!ignore) {
          setTransactions(data.items || []);
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error ? err.message : "Error loading transactions.",
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [isOpen, activeTab, queryAddress, selectedChainId, workspaceId]);

  const handleLookup = async () => {
    if (!lookupHash || !workspaceId) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupCandidate(null);
    try {
      const url = new URL(
        `/api/workspaces/${workspaceId}/import/lookup`,
        window.location.origin,
      );
      url.searchParams.set("chainId", selectedChainId.toString());
      url.searchParams.set("hash", lookupHash.trim());

      const res = await fetch(url.toString(), {
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Transaction not found.");
      }
      setLookupCandidate(data.transaction);
    } catch (err) {
      setLookupError(
        err instanceof Error ? err.message : "Failed to lookup transaction.",
      );
    } finally {
      setLookupLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-dialog-title"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "16px",
      }}
    >
      <div
        style={{
          backgroundColor: "var(--card-bg, #0d0e15)",
          border: "1px solid var(--border, #242738)",
          borderRadius: "12px",
          width: "100%",
          maxWidth: "760px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 24px 48px rgba(0,0,0,0.8)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border, #242738)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h3
              id="import-dialog-title"
              style={{
                margin: 0,
                fontSize: "1.15rem",
                fontWeight: 600,
                color: "var(--foreground, #fff)",
              }}
            >
              Import Attributable Transaction
            </h3>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "0.8rem",
                color: "var(--muted, #8b92a8)",
              }}
            >
              Select an onchain payment from Monad, Ethereum, or Base to attach
              as verifiable source provenance.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--muted, #8b92a8)",
              fontSize: "1.25rem",
              cursor: "pointer",
              padding: "4px 8px",
            }}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Disclaimer Banner */}
        <div
          style={{
            padding: "10px 24px",
            backgroundColor: "rgba(102, 77, 255, 0.08)",
            borderBottom: "1px solid rgba(102, 77, 255, 0.2)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "0.78rem",
            color: "#a49fff",
          }}
        >
          <span aria-hidden="true">ℹ️</span>
          <span>{IMPORTED_FACTS_DISCLAIMER}</span>
        </div>

        {/* Tabs & Controls */}
        <div
          style={{
            padding: "16px 24px 12px",
            borderBottom: "1px solid var(--border, #242738)",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={() => setActiveTab("wallet")}
              className={
                activeTab === "wallet" ? "btn-primary" : "btn-secondary"
              }
              style={{ fontSize: "0.85rem", padding: "6px 14px" }}
            >
              Browse Wallet Transactions
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("hash")}
              className={activeTab === "hash" ? "btn-primary" : "btn-secondary"}
              style={{ fontSize: "0.85rem", padding: "6px 14px" }}
            >
              Direct Hash Lookup
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  color: "var(--muted, #8b92a8)",
                  marginBottom: "4px",
                }}
              >
                Source Chain
              </label>
              <select
                className="input-field"
                value={selectedChainId}
                onChange={(e) => setSelectedChainId(Number(e.target.value))}
                style={{ fontSize: "0.85rem" }}
              >
                {SUPPORTED_SOURCE_CHAINS.map((c: SourceChainConfig) => (
                  <option key={c.chainId} value={c.chainId}>
                    {c.name} (Chain ID: {c.chainId})
                  </option>
                ))}
              </select>
            </div>

            {activeTab === "wallet" && (
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.75rem",
                    color: "var(--muted, #8b92a8)",
                    marginBottom: "4px",
                  }}
                >
                  Wallet Address
                </label>
                <div style={{ display: "flex", gap: "6px" }}>
                  <input
                    type="text"
                    className="input-field font-mono"
                    value={queryAddress}
                    onChange={(e) => setQueryAddress(e.target.value)}
                    style={{ fontSize: "0.8rem" }}
                  />
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="btn-secondary"
                    disabled={loading}
                    style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                  >
                    {loading ? "..." : "Refresh"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {activeTab === "wallet" ? (
            <>
              {error && (
                <div
                  style={{
                    padding: "12px",
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "6px",
                    color: "#ef4444",
                    fontSize: "0.85rem",
                  }}
                >
                  {error}
                </div>
              )}

              {loading ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px",
                    color: "var(--muted, #8b92a8)",
                  }}
                >
                  Fetching transaction candidates...
                </div>
              ) : transactions.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px",
                    color: "var(--muted, #8b92a8)",
                  }}
                >
                  No transactions found for this address on the selected chain.
                </div>
              ) : (
                transactions.map((tx) => {
                  const explorerUrl = getExplorerTxUrl(
                    tx.sourceChainId,
                    tx.sourceTransactionHash,
                  );
                  return (
                    <div
                      key={`${tx.sourceChainId}-${tx.sourceTransactionHash}-${tx.claimSlot}`}
                      style={{
                        backgroundColor: tx.isClaimed
                          ? "rgba(239, 68, 68, 0.04)"
                          : "rgba(255, 255, 255, 0.02)",
                        border: `1px solid ${
                          tx.isClaimed
                            ? "rgba(239, 68, 68, 0.3)"
                            : "var(--border, #242738)"
                        }`,
                        borderRadius: "8px",
                        padding: "14px 16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "8px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <span
                            className="font-mono"
                            style={{
                              fontSize: "1.05rem",
                              fontWeight: 600,
                              color: "var(--foreground, #fff)",
                            }}
                          >
                            {tx.formattedAmount} {tx.assetSymbol}
                          </span>
                          <span
                            style={{
                              fontSize: "0.7rem",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              textTransform: "uppercase",
                              fontWeight: 600,
                              backgroundColor:
                                tx.status === "confirmed"
                                  ? "rgba(34, 197, 94, 0.15)"
                                  : tx.status === "failed"
                                    ? "rgba(239, 68, 68, 0.15)"
                                    : "rgba(234, 179, 8, 0.15)",
                              color:
                                tx.status === "confirmed"
                                  ? "#22c55e"
                                  : tx.status === "failed"
                                    ? "#ef4444"
                                    : "#eab308",
                            }}
                          >
                            {tx.status}
                          </span>
                          {tx.isClaimed && (
                            <span
                              style={{
                                fontSize: "0.7rem",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                backgroundColor: "rgba(239, 68, 68, 0.2)",
                                color: "#ef4444",
                                fontWeight: 600,
                              }}
                            >
                              CLAIMED IN WORKSPACE
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={tx.isClaimed || tx.status === "failed"}
                          onClick={() => {
                            onSelectTransaction(tx, "imported_transaction");
                            onClose();
                          }}
                          className={
                            tx.isClaimed || tx.status === "failed"
                              ? "btn-secondary"
                              : "btn-primary"
                          }
                          style={{ fontSize: "0.8rem", padding: "6px 14px" }}
                        >
                          {tx.isClaimed
                            ? "Already Claimed"
                            : tx.status === "failed"
                              ? "Payment Failed"
                              : "Autofill Draft →"}
                        </button>
                      </div>

                      {/* Details row */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(200px, 1fr))",
                          gap: "8px",
                          fontSize: "0.75rem",
                          color: "var(--muted, #8b92a8)",
                        }}
                      >
                        <div>
                          <span>Hash: </span>
                          <span className="font-mono">
                            {tx.sourceTransactionHash.slice(0, 10)}...
                            {tx.sourceTransactionHash.slice(-8)}
                          </span>
                          {explorerUrl && (
                            <a
                              href={explorerUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: "var(--monad-purple, #836ef9)",
                                marginLeft: "6px",
                                textDecoration: "none",
                              }}
                            >
                              ↗
                            </a>
                          )}
                        </div>
                        <div>
                          <span>To: </span>
                          <span className="font-mono">
                            {tx.recipient
                              ? `${tx.recipient.slice(0, 8)}...${tx.recipient.slice(-6)}`
                              : "Contract creation"}
                          </span>
                        </div>
                        {tx.blockTimestamp && (
                          <div>
                            <span>Date: </span>
                            <span>
                              {new Date(tx.blockTimestamp).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Warning notification */}
                      {tx.warning && (
                        <div
                          style={{
                            fontSize: "0.72rem",
                            color: tx.isClaimed ? "#ef4444" : "#eab308",
                            backgroundColor: tx.isClaimed
                              ? "rgba(239, 68, 68, 0.08)"
                              : "rgba(234, 179, 8, 0.08)",
                            padding: "6px 8px",
                            borderRadius: "4px",
                          }}
                        >
                          ⚠️ {tx.warning}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          ) : (
            /* Direct Hash Lookup Tab */
            <div
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    color: "var(--muted, #8b92a8)",
                    marginBottom: "6px",
                  }}
                >
                  Enter Source Transaction Hash (0x...)
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    className="input-field font-mono"
                    placeholder="0x..."
                    value={lookupHash}
                    onChange={(e) => setLookupHash(e.target.value)}
                    style={{ fontSize: "0.85rem" }}
                  />
                  <button
                    type="button"
                    onClick={handleLookup}
                    disabled={lookupLoading || !lookupHash.trim()}
                    className="btn-primary"
                    style={{ fontSize: "0.85rem", padding: "8px 18px" }}
                  >
                    {lookupLoading ? "Looking up..." : "Lookup"}
                  </button>
                </div>
              </div>

              {lookupError && (
                <div
                  style={{
                    padding: "12px",
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "6px",
                    color: "#ef4444",
                    fontSize: "0.85rem",
                  }}
                >
                  {lookupError}
                </div>
              )}

              {lookupCandidate && (
                <div
                  style={{
                    backgroundColor: lookupCandidate.isClaimed
                      ? "rgba(239, 68, 68, 0.04)"
                      : "rgba(255, 255, 255, 0.02)",
                    border: `1px solid ${
                      lookupCandidate.isClaimed
                        ? "rgba(239, 68, 68, 0.3)"
                        : "var(--border, #242738)"
                    }`,
                    borderRadius: "8px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div
                        className="font-mono"
                        style={{
                          fontSize: "1.1rem",
                          fontWeight: 600,
                          color: "var(--foreground, #fff)",
                        }}
                      >
                        {lookupCandidate.formattedAmount}{" "}
                        {lookupCandidate.assetSymbol}
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--muted, #8b92a8)",
                          marginTop: "2px",
                        }}
                      >
                        Status:{" "}
                        <span
                          style={{
                            fontWeight: 600,
                            color:
                              lookupCandidate.status === "confirmed"
                                ? "#22c55e"
                                : "#ef4444",
                          }}
                        >
                          {lookupCandidate.status.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={
                        lookupCandidate.isClaimed ||
                        lookupCandidate.status === "failed"
                      }
                      onClick={() => {
                        onSelectTransaction(
                          lookupCandidate,
                          "transaction_hash",
                        );
                        onClose();
                      }}
                      className={
                        lookupCandidate.isClaimed ||
                        lookupCandidate.status === "failed"
                          ? "btn-secondary"
                          : "btn-primary"
                      }
                      style={{ fontSize: "0.85rem", padding: "8px 16px" }}
                    >
                      {lookupCandidate.isClaimed
                        ? "Already Claimed"
                        : lookupCandidate.status === "failed"
                          ? "Payment Failed"
                          : "Use Transaction Hash →"}
                    </button>
                  </div>

                  {lookupCandidate.warning && (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: lookupCandidate.isClaimed
                          ? "#ef4444"
                          : "#eab308",
                        backgroundColor: lookupCandidate.isClaimed
                          ? "rgba(239, 68, 68, 0.08)"
                          : "rgba(234, 179, 8, 0.08)",
                        padding: "8px 10px",
                        borderRadius: "4px",
                      }}
                    >
                      ⚠️ {lookupCandidate.warning}
                    </div>
                  )}

                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--muted, #8b92a8)",
                      lineHeight: "1.6",
                    }}
                  >
                    <div>
                      Sender:{" "}
                      <span className="font-mono">
                        {lookupCandidate.sender}
                      </span>
                    </div>
                    <div>
                      Recipient:{" "}
                      <span className="font-mono">
                        {lookupCandidate.recipient || "None"}
                      </span>
                    </div>
                    {lookupCandidate.blockTimestamp && (
                      <div>
                        Timestamp:{" "}
                        {new Date(
                          lookupCandidate.blockTimestamp,
                        ).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid var(--border, #242738)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            style={{ fontSize: "0.85rem", padding: "6px 14px" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
