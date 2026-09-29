"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

export interface NavRailProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  userAddress?: string | undefined;
  connectedChainId?: number | undefined;
  targetChainId?: number | undefined;
}

const navItems = [
  {
    id: "overview",
    label: "Overview",
    icon: "M3 10.5 12 3l9 7.5M5.5 9v11h13V9M9 20v-6h6v6",
  },
  {
    id: "expenses",
    label: "Expenses",
    icon: "M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm7 0v5h5M8 13h8M8 17h8",
  },
  { id: "review", label: "Review", icon: "m5 12 4 4L19 6M4 3h16v18H4z" },
  {
    id: "treasury",
    label: "Treasury",
    icon: "M3 9h18L12 3 3 9Zm2 2v8m5-8v8m4-8v8m5-8v8M3 21h18",
  },
  {
    id: "verification",
    label: "Verification",
    icon: "M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Zm-3-11 2 2 4-4",
  },
  {
    id: "workspace",
    label: "Workspace",
    icon: "M4 5h16v14H4zM8 9h8M8 13h5M8 17h3",
  },
];

function getThemeSnapshot(): "light" | "dark" {
  return window.localStorage.getItem("clario-theme") === "dark"
    ? "dark"
    : "light";
}

function subscribeToTheme(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("clario-theme-change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("clario-theme-change", onChange);
  };
}

export function NavRail({
  currentRoute,
  onNavigate,
  userAddress,
  connectedChainId,
  targetChainId,
}: NavRailProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    () => "light",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("clario-theme", nextTheme);
    window.dispatchEvent(new Event("clario-theme-change"));
  }

  const localDevelopment = connectedChainId === 31337;
  const networkLabel = localDevelopment
    ? "Local development"
    : connectedChainId === targetChainId
      ? `Chain ${connectedChainId}`
      : connectedChainId
        ? `Wrong network · ${connectedChainId}`
        : "Network not connected";

  return (
    <aside className="nav-rail" aria-label="Clario workspace">
      <div className="nav-rail-top">
        <a
          className="brand-lockup"
          href="#main-content"
          aria-label="Clario home"
        >
          <span className="brand-mark" aria-hidden="true">
            C
          </span>
          <span className="brand-copy">
            <span className="brand-name">Clario</span>
            <span className="brand-caption">Evidence Ledger</span>
          </span>
        </a>

        <button
          type="button"
          className="mobile-nav-toggle"
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span>{menuOpen ? "Close menu" : "Menu"}</span>
          <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
            {menuOpen ? (
              <path d="m5 5 10 10M15 5 5 15" />
            ) : (
              <path d="M3 5h14M3 10h14M3 15h14" />
            )}
          </svg>
        </button>

        <nav
          id="primary-navigation"
          className={`primary-navigation${menuOpen ? " is-open" : ""}`}
          aria-label="Primary"
        >
          {navItems.map((item) => {
            const isActive = currentRoute === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onNavigate(item.id);
                  setMenuOpen(false);
                }}
                aria-current={isActive ? "page" : undefined}
                className={`nav-link${isActive ? " is-active" : ""}`}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                  <path d={item.icon} />
                </svg>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <footer className="nav-rail-footer">
        <div className="network-status">
          <span className="network-status-label">Network</span>
          <span
            className={`network-status-value${localDevelopment ? " is-local" : ""}${connectedChainId && targetChainId && connectedChainId !== targetChainId ? " is-warning" : ""}`}
          >
            <span className="network-status-mark" aria-hidden="true" />
            {networkLabel}
          </span>
        </div>
        {userAddress ? (
          <div className="identity-chip" title={userAddress}>
            <span className="identity-indicator" aria-hidden="true" />
            <span className="identity-address">
              {userAddress.slice(0, 6)}…{userAddress.slice(-4)}
            </span>
            <span className="identity-label">Connected</span>
          </div>
        ) : null}
        <button type="button" className="theme-toggle" onClick={toggleTheme}>
          <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
            {theme === "light" ? (
              <path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" />
            ) : (
              <path d="M12 3v2m0 14v2M3 12h2m14 0h2m-2.6-6.4-1.4 1.4M7 17l-1.4 1.4m12.8 0L17 17M7 7 5.6 5.6M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
            )}
          </svg>
          <span>Use {theme === "light" ? "dark" : "light"} theme</span>
        </button>
      </footer>
    </aside>
  );
}
