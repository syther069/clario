"use client";

import React from "react";

export interface NavRailProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  userAddress?: string | undefined;
  connectedChainId?: number | undefined;
  targetChainId?: number | undefined;
}

export function NavRail({
  currentRoute,
  onNavigate,
  userAddress,
  connectedChainId = 31337,
  targetChainId = 31337,
}: NavRailProps) {
  const isCorrectNetwork = connectedChainId === targetChainId;

  const navItems = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "expenses", label: "Expenses", icon: "🧾" },
    { id: "review", label: "Review", icon: "⚖️" },
    { id: "treasury", label: "Treasury", icon: "🏦" },
    { id: "verification", label: "Verification", icon: "🛡️" },
    { id: "workspace", label: "Workspace", icon: "⚙️" },
  ];

  return (
    <aside className="nav-rail" aria-label="Main Navigation">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        {/* Brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--accent-primary)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              fontSize: "1.125rem",
            }}
          >
            C
          </div>
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: "1rem",
                letterSpacing: "-0.02em",
              }}
            >
              Clario
            </div>
            <div
              style={{
                fontSize: "0.6875rem",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Evidence Ledger
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <nav
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-1)",
          }}
        >
          {navItems.map((item) => {
            const isActive = currentRoute === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={`btn btn-ghost ${isActive ? "btn-secondary" : ""}`}
                style={{
                  justifyContent: "flex-start",
                  width: "100%",
                  borderLeft: isActive
                    ? "3px solid var(--accent-primary)"
                    : "3px solid transparent",
                  backgroundColor: isActive
                    ? "var(--surface-selected)"
                    : undefined,
                  color: isActive
                    ? "var(--accent-primary-strong)"
                    : "var(--text-primary)",
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Network & Identity Footer */}
      <div
        style={{
          borderTop: "1px solid var(--border-subtle)",
          paddingTop: "var(--space-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
        }}
      >
        {/* Network Status Indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.75rem",
          }}
        >
          <span style={{ color: "var(--text-muted)" }}>Network:</span>
          {isCorrectNetwork ? (
            <span
              className="badge badge-success"
              title={`Connected to Chain ${connectedChainId}`}
            >
              ● Monad ({connectedChainId})
            </span>
          ) : (
            <span
              className="badge badge-danger"
              title={`Wrong network: expected ${targetChainId}, got ${connectedChainId}`}
            >
              ⚠️ Wrong Net ({connectedChainId})
            </span>
          )}
        </div>

        {/* User Account */}
        {userAddress ? (
          <div
            style={{
              padding: "var(--space-2) var(--space-3)",
              backgroundColor: "var(--background-secondary)",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.75rem",
              fontFamily: "monospace",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span title={userAddress}>
              {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
            </span>
            <span
              className="badge badge-neutral"
              style={{ fontSize: "0.6875rem" }}
            >
              Active
            </span>
          </div>
        ) : (
          <button
            className="btn btn-secondary btn-sm"
            style={{ width: "100%" }}
          >
            Connect Wallet
          </button>
        )}
      </div>
    </aside>
  );
}
