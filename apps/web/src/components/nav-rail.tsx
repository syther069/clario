"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  LayoutDashboard,
  Receipt,
  ClipboardCheck,
  Landmark,
  ShieldCheck,
  Building2,
  Menu,
  X,
  Sun,
  Moon,
} from "lucide-react";

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
    Icon: LayoutDashboard,
  },
  {
    id: "expenses",
    label: "Expenses",
    Icon: Receipt,
  },
  {
    id: "review",
    label: "Review",
    Icon: ClipboardCheck,
  },
  {
    id: "treasury",
    label: "Treasury",
    Icon: Landmark,
  },
  {
    id: "verification",
    label: "Verification",
    Icon: ShieldCheck,
  },
  {
    id: "workspace",
    label: "Workspace",
    Icon: Building2,
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
          {menuOpen ? (
            <X className="w-5 h-5 shrink-0" aria-hidden="true" />
          ) : (
            <Menu className="w-5 h-5 shrink-0" aria-hidden="true" />
          )}
        </button>

        <nav
          id="primary-navigation"
          className={`primary-navigation${menuOpen ? " is-open" : ""}`}
          aria-label="Primary"
        >
          {navItems.map((item) => {
            const isActive = currentRoute === item.id;
            const ItemIcon = item.Icon;
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
                <ItemIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
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
          {theme === "light" ? (
            <Moon className="w-4 h-4 shrink-0" aria-hidden="true" />
          ) : (
            <Sun className="w-4 h-4 shrink-0" aria-hidden="true" />
          )}
          <span>Use {theme === "light" ? "dark" : "light"} theme</span>
        </button>
      </footer>
    </aside>
  );
}
