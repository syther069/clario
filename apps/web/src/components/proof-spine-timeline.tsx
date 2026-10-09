"use client";

import React, { useState } from "react";
import { Clock, AlertTriangle, Copy, Check } from "lucide-react";
import type { ExpenseTimelineResponse } from "@/lib/timeline/types";
import { ContextualIconSwap } from "@/components/ui/motion";

interface ProofSpineTimelineProps {
  readonly timeline: ExpenseTimelineResponse;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

export function ProofSpineTimeline({
  timeline,
  className,
  style,
}: ProofSpineTimelineProps) {
  const [filterMode, setFilterMode] = useState<"all" | "current" | "onchain">(
    "all",
  );
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const filteredEvents = timeline.events.filter((ev) => {
    if (filterMode === "current") return ev.isCurrentVersion;
    if (filterMode === "onchain")
      return (
        ev.source === "onchain_indexer" ||
        ev.source === "onchain_rpc" ||
        ev.source === "hybrid"
      );
    return true;
  });

  return (
    <section
      aria-label="Authoritative Activity Timeline and Proof Spine"
      className={className}
      style={{
        backgroundColor: "var(--surface-primary)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-subtle)",
        padding: "var(--space-6)",
        ...style,
      }}
    >
      {/* Header & Filter Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "var(--space-6)",
          flexWrap: "wrap",
          gap: "var(--space-4)",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "var(--accent-primary)",
              }}
            />
            <h3
              style={{
                margin: 0,
                fontSize: "1.125rem",
                fontWeight: 600,
                letterSpacing: "-0.01em",
                textWrap: "balance",
              }}
            >
              Proof Spine · Activity Timeline
            </h3>
          </div>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "0.8125rem",
              color: "var(--text-secondary)",
              textWrap: "pretty",
            }}
          >
            Authoritative lineage joining offchain evidence with verified Monad
            blocks.
          </p>
        </div>

        {/* Filter Tabs */}
        <div
          role="tablist"
          aria-label="Timeline Filters"
          style={{
            display: "inline-flex",
            backgroundColor: "var(--surface-secondary)",
            padding: "2px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {(
            [
              { id: "all", label: `All (${timeline.events.length})` },
              { id: "current", label: `Current v${timeline.currentVersion}` },
              { id: "onchain", label: "Onchain Only" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={filterMode === tab.id}
              onClick={() => setFilterMode(tab.id)}
              style={{
                padding: "4px 10px",
                fontSize: "0.75rem",
                fontWeight: filterMode === tab.id ? 600 : 500,
                color:
                  filterMode === tab.id
                    ? "var(--text-primary)"
                    : "var(--text-tertiary)",
                backgroundColor:
                  filterMode === tab.id
                    ? "var(--surface-primary)"
                    : "transparent",
                border: "none",
                borderRadius: "calc(var(--radius-md) - 2px)",
                cursor: "pointer",
                boxShadow:
                  filterMode === tab.id ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                transition: "color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Indexer Lag Status Banner */}
      {timeline.indexerLag.isLagging && (
        <div
          role="status"
          style={{
            marginBottom: "var(--space-4)",
            padding: "var(--space-3) var(--space-4)",
            backgroundColor: "rgba(245, 158, 11, 0.08)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            fontSize: "0.8125rem",
            color: "var(--status-warning)",
          }}
        >
          <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 600 }}>Indexer Lagging:</span>{" "}
            {timeline.indexerLag.message} (Latest block:{" "}
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {timeline.indexerLag.latestKnownBlock}
            </span>
            , Indexed:{" "}
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {timeline.indexerLag.indexedCheckpointBlock}
            </span>
            )
          </div>
        </div>
      )}

      {/* RPC Conflict / Reorg Alert Banner */}
      {timeline.rpcConflict.hasConflict && (
        <div
          role="alert"
          style={{
            marginBottom: "var(--space-4)",
            padding: "var(--space-3) var(--space-4)",
            backgroundColor: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            fontSize: "0.8125rem",
            color: "var(--status-danger)",
          }}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 600 }}>Chain Conflict / Reorg:</span>{" "}
            {timeline.rpcConflict.message}
          </div>
        </div>
      )}

      {/* Proof Spine Visualization List */}
      <div
        role="list"
        style={{
          position: "relative",
          paddingLeft: "32px",
          marginTop: "var(--space-4)",
        }}
      >
        {/* Continuous 1px vertical spine connecting all nodes */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "11px",
            top: "14px",
            bottom: "14px",
            width: "1px",
            backgroundColor: "var(--border-strong)",
          }}
        />

        {filteredEvents.map((event, idx) => {
          const isExpanded = expandedEventId === event.id;
          const isSuperseded = event.isSupersededBranch;
          const isFailedOrReorged =
            event.confirmationState === "failed" ||
            event.confirmationState === "reorged";
          const isCurrent = event.isCurrentVersion && !isSuperseded;

          return (
            <div
              key={event.id}
              role="listitem"
              style={{
                position: "relative",
                marginBottom:
                  idx === filteredEvents.length - 1 ? 0 : "var(--space-6)",
                paddingLeft: isSuperseded ? "var(--space-3)" : 0,
                transition: "transform 0.15s ease",
              }}
            >
              {/* Superseded Branch Indicator: bend left line */}
              {isSuperseded && (
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: "-21px",
                    top: "10px",
                    width: "14px",
                    height: "10px",
                    borderLeft: "1px dashed var(--border-strong)",
                    borderBottom: "1px dashed var(--border-strong)",
                    borderBottomLeftRadius: "6px",
                  }}
                />
              )}

              {/* Spine Node Marker */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: isSuperseded ? "-17px" : "-26px",
                  top: "4px",
                  width: "14px",
                  height: "14px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isCurrent
                    ? "var(--accent-primary)"
                    : isFailedOrReorged
                      ? "var(--status-danger)"
                      : "var(--surface-primary)",
                  border: isCurrent
                    ? "2px solid var(--accent-primary)"
                    : isFailedOrReorged
                      ? "2px solid var(--status-danger)"
                      : "2px solid var(--border-strong)",
                  boxShadow: isCurrent
                    ? "0 0 0 3px rgba(59, 130, 246, 0.2)"
                    : "none",
                  zIndex: 2,
                }}
              >
                {isFailedOrReorged && (
                  <span
                    style={{
                      color: "#fff",
                      fontSize: "10px",
                      fontWeight: 800,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </span>
                )}
                {!isFailedOrReorged && !isCurrent && (
                  <div
                    style={{
                      width: "4px",
                      height: "4px",
                      borderRadius: "50%",
                      backgroundColor: "var(--border-strong)",
                    }}
                  />
                )}
              </div>

              {/* Event Card Content */}
              <div
                style={{
                  backgroundColor: isExpanded
                    ? "var(--surface-secondary)"
                    : "transparent",
                  border: isExpanded
                    ? "1px solid var(--border-subtle)"
                    : "1px solid transparent",
                  borderRadius: "var(--radius-md)",
                  padding: isExpanded
                    ? "var(--space-3) var(--space-4)"
                    : "2px var(--space-2)",
                  transition: "background-color 0.15s ease, border-color 0.15s ease, padding 0.15s ease",
                }}
              >
                {/* Event Headline & Primary Badges */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "var(--space-2)",
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    setExpandedEventId(isExpanded ? null : event.id)
                  }
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        color: isSuperseded
                          ? "var(--text-secondary)"
                          : "var(--text-primary)",
                      }}
                    >
                      {event.title}
                    </span>

                    {/* Version Tag */}
                    {event.version && (
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          padding: "1px 6px",
                          borderRadius: "4px",
                          backgroundColor: isSuperseded
                            ? "var(--surface-tertiary)"
                            : "rgba(59, 130, 246, 0.1)",
                          color: isSuperseded
                            ? "var(--text-tertiary)"
                            : "var(--accent-primary)",
                        }}
                      >
                        v{event.version}
                        {isSuperseded && " (Superseded)"}
                      </span>
                    )}

                    {/* Source Pill */}
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 500,
                        padding: "1px 6px",
                        borderRadius: "4px",
                        backgroundColor: "var(--surface-secondary)",
                        border: "1px solid var(--border-subtle)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {event.source === "onchain_indexer"
                        ? "Indexed Onchain"
                        : event.source === "onchain_rpc"
                          ? "RPC Broadcast"
                          : event.source === "hybrid"
                            ? "Reconciled"
                            : "Application"}
                    </span>

                    {/* Confirmation State Pill */}
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        padding: "1px 6px",
                        borderRadius: "4px",
                        backgroundColor:
                          event.confirmationState === "confirmed"
                            ? "rgba(16, 185, 129, 0.1)"
                            : event.confirmationState === "confirming" ||
                                event.confirmationState === "pending"
                              ? "rgba(245, 158, 11, 0.1)"
                              : event.confirmationState === "reorged" ||
                                  event.confirmationState === "failed"
                                ? "rgba(239, 68, 68, 0.1)"
                                : "var(--surface-tertiary)",
                        color:
                          event.confirmationState === "confirmed"
                            ? "var(--status-success)"
                            : event.confirmationState === "confirming" ||
                                event.confirmationState === "pending"
                              ? "var(--status-warning)"
                              : event.confirmationState === "reorged" ||
                                  event.confirmationState === "failed"
                                ? "var(--status-danger)"
                                : "var(--text-tertiary)",
                      }}
                    >
                      {event.confirmationState}
                    </span>
                  </div>

                  {/* Primary Timestamp & Badge */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                    }}
                  >
                    <span
                      title={`Primary timestamp taxonomy: ${event.timestamp.primaryType}`}
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        padding: "1px 5px",
                        borderRadius: "3px",
                        letterSpacing: "0.02em",
                        backgroundColor:
                          event.timestamp.primaryType === "block"
                            ? "rgba(59, 130, 246, 0.1)"
                            : event.timestamp.primaryType === "indexer"
                              ? "rgba(168, 85, 247, 0.1)"
                              : "var(--surface-tertiary)",
                        color:
                          event.timestamp.primaryType === "block"
                            ? "var(--accent-primary)"
                            : event.timestamp.primaryType === "indexer"
                              ? "#8B5CF6"
                              : "var(--text-tertiary)",
                      }}
                    >
                      {event.timestamp.primaryType === "block"
                        ? "BLOCK"
                        : event.timestamp.primaryType === "indexer"
                          ? "INDEXER"
                          : "APP"}
                    </span>
                    <time
                      dateTime={event.timestamp.primary}
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-secondary)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {new Date(event.timestamp.primary).toLocaleTimeString(
                        [],
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        },
                      )}
                    </time>
                  </div>
                </div>

                {/* Description */}
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: "0.8125rem",
                    color: "var(--text-secondary)",
                    lineHeight: 1.4,
                    textWrap: "pretty",
                  }}
                >
                  {event.description}
                </p>

                {/* Multi-Dimensional Timestamps Detail */}
                <div
                  style={{
                    display: "flex",
                    gap: "var(--space-4)",
                    marginTop: "6px",
                    fontSize: "0.6875rem",
                    color: "var(--text-tertiary)",
                    flexWrap: "wrap",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {event.timestamp.applicationTime && (
                    <span>
                      App:{" "}
                      {new Date(
                        event.timestamp.applicationTime,
                      ).toLocaleTimeString()}
                    </span>
                  )}
                  {event.timestamp.blockTime && (
                    <span>
                      Block:{" "}
                      {new Date(event.timestamp.blockTime).toLocaleTimeString()}{" "}
                      {event.blockNumber && `(#${event.blockNumber})`}
                    </span>
                  )}
                  {event.timestamp.indexerTime && (
                    <span>
                      Indexed:{" "}
                      {new Date(
                        event.timestamp.indexerTime,
                      ).toLocaleTimeString()}
                    </span>
                  )}
                </div>

                {/* Expandable Technical Proof Details */}
                {isExpanded && (
                  <div
                    style={{
                      marginTop: "var(--space-3)",
                      paddingTop: "var(--space-3)",
                      borderTop: "1px solid var(--border-subtle)",
                      fontSize: "0.75rem",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(240px, 1fr))",
                        gap: "var(--space-2)",
                      }}
                    >
                      {/* Actor */}
                      <div>
                        <span
                          style={{
                            color: "var(--text-tertiary)",
                            display: "block",
                          }}
                        >
                          Actor ({event.actorRole ?? "user"}):
                        </span>
                        <code
                          style={{
                            fontSize: "0.6875rem",
                            wordBreak: "break-all",
                          }}
                        >
                          {event.actor}
                        </code>
                      </div>

                      {/* Commitment Hash */}
                      {event.commitment && (
                        <div>
                          <span
                            style={{
                              color: "var(--text-tertiary)",
                              display: "block",
                            }}
                          >
                            Commitment:
                          </span>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <code
                              style={{
                                fontSize: "0.6875rem",
                                wordBreak: "break-all",
                              }}
                            >
                              {event.commitment}
                            </code>
                            <button
                              type="button"
                              onClick={() =>
                                handleCopy(
                                  event.commitment!,
                                  `comm-${event.id}`,
                                )
                              }
                              className="relative after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2 after:content-[''] transition-colors duration-150 ease-out"
                              style={{
                                border: "none",
                                background: "none",
                                cursor: "pointer",
                                padding: "2px",
                                display: "inline-flex",
                                alignItems: "center",
                                color: "var(--text-tertiary)",
                              }}
                              title="Copy commitment hash"
                              aria-label="Copy commitment hash"
                            >
                              <ContextualIconSwap
                                isActive={copiedText === `comm-${event.id}`}
                                initialIcon={
                                  <Copy
                                    className="w-3.5 h-3.5 text-gray-500 hover:text-black"
                                    aria-label="Copy"
                                  />
                                }
                                activeIcon={
                                  <Check
                                    className="w-3.5 h-3.5 text-emerald-600"
                                    aria-label="Copied"
                                  />
                                }
                              />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Transaction Hash */}
                      {event.txHash && (
                        <div>
                          <span
                            style={{
                              color: "var(--text-tertiary)",
                              display: "block",
                            }}
                          >
                            Transaction Hash:
                          </span>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <code
                              style={{
                                fontSize: "0.6875rem",
                                wordBreak: "break-all",
                              }}
                            >
                              {event.txHash}
                            </code>
                            <button
                              type="button"
                              onClick={() =>
                                handleCopy(event.txHash!, `tx-${event.id}`)
                              }
                              className="relative after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2 after:content-[''] transition-colors duration-150 ease-out"
                              style={{
                                border: "none",
                                background: "none",
                                cursor: "pointer",
                                padding: "2px",
                                display: "inline-flex",
                                alignItems: "center",
                                color: "var(--text-tertiary)",
                              }}
                              title="Copy transaction hash"
                              aria-label="Copy transaction hash"
                            >
                              <ContextualIconSwap
                                isActive={copiedText === `tx-${event.id}`}
                                initialIcon={
                                  <Copy
                                    className="w-3.5 h-3.5 text-gray-500 hover:text-black"
                                    aria-label="Copy"
                                  />
                                }
                                activeIcon={
                                  <Check
                                    className="w-3.5 h-3.5 text-emerald-600"
                                    aria-label="Copied"
                                  />
                                }
                              />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
