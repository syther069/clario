"use client";

import { useClarioAuth } from "@/lib/auth/use-clario-auth";
import {
  LogIn,
  LogOut,
  Wallet,
  Check,
  Copy,
  Link2,
  KeyRound,
  ExternalLink,
  ShieldCheck,
  ArrowRightLeft,
  ChevronDown,
  Fingerprint,
  Mail,
} from "lucide-react";
import { MonadLogo } from "@/components/ui/crypto-icon";
import { useState, useRef, useEffect } from "react";
import type { ConnectedWallet } from "@privy-io/react-auth";

export function UserButton() {
  const {
    isReady,
    isAuthenticated,
    user,
    displayName,
    primaryEmail,
    activeWalletAddress,
    embeddedWalletAddress,
    wallets,
    isActiveWalletEmbedded,
    linkWallet,
    linkEmail,
    linkGoogle,
    linkPasskey,
    setWalletRecovery,
    exportWallet,
    setActiveWallet,
    login,
    logout,
  } = useClarioAuth();

  const [copied, setCopied] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isReady) {
    return (
      <div className="h-9 w-24 animate-pulse rounded-lg bg-[#e5e7eb] border-2 border-[#121212]" />
    );
  }

  if (!isAuthenticated) {
    return (
      <button
        onClick={() => login()}
        className="flex items-center gap-1.5 rounded-lg border-2 border-[#121212] bg-[#836EF9] px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-white shadow-[2px_2px_0_0_#121212] transition hover:bg-[#7257f8] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
      >
        <LogIn className="h-3.5 w-3.5" />
        <span>Sign In</span>
      </button>
    );
  }

  const handleCopy = () => {
    if (activeWalletAddress) {
      navigator.clipboard.writeText(activeWalletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const hasMultipleWallets = wallets.length > 1;

  // Check which accounts are linked
  const hasLinkedEmail = Boolean(user?.email || user?.google);
  const hasLinkedPasskey = Boolean(
    user?.linkedAccounts?.some((a) => a.type === "passkey"),
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 rounded-lg border-2 border-[#121212] bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wider text-[#121212] shadow-[2px_2px_0_0_#121212] transition hover:bg-[#f3f4f6] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
        aria-label="User account and wallet menu"
        aria-expanded={dropdownOpen}
      >
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#836EF9] text-white font-black text-[10px] border border-[#121212]">
          {displayName.slice(0, 1).toUpperCase()}
        </div>
        <span className="max-w-[110px] truncate">{displayName}</span>
        <ChevronDown
          className={`h-3 w-3 transition-transform text-[#121212] ${dropdownOpen ? "rotate-180" : ""}`}
        />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-96 origin-top-right rounded-xl border-2 border-[#121212] bg-white p-3.5 shadow-[4px_4px_0_0_#121212] z-50 animate-in fade-in zoom-in-95 duration-100 max-h-[85vh] overflow-y-auto">
          {/* User Profile Header */}
          <div className="border-b-2 border-[#121212] pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wider text-[#121212] truncate">
                  {displayName}
                </p>
                {primaryEmail && (
                  <p className="text-[11px] text-slate-500 truncate mt-0.5 font-mono">
                    {primaryEmail}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="inline-flex items-center gap-1 rounded bg-[#836EF9]/10 px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider text-[#836EF9] border border-[#836EF9]/40">
                  <MonadLogo className="h-2.5 w-2.5" />
                  Monad (10143)
                </span>
              </div>
            </div>

            {/* Active Wallet Card */}
            {activeWalletAddress && (
              <div className="mt-3 rounded-lg bg-[#f8f9fa] p-2.5 border-2 border-[#121212]">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider font-bold mb-1.5">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Wallet className="h-3 w-3 text-[#836EF9]" />
                    Active Onchain Signer
                  </span>
                  {isActiveWalletEmbedded ? (
                    <span className="rounded bg-[#836EF9]/20 px-1.5 py-0.2 text-[9px] font-black text-[#836EF9]">
                      Privy Embedded
                    </span>
                  ) : (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[9px] font-black text-emerald-800">
                      External EVM
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded border border-[#121212]">
                  <span className="font-mono text-[#121212] font-bold text-xs">
                    {activeWalletAddress.slice(0, 6)}...
                    {activeWalletAddress.slice(-4)}
                  </span>
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://testnet.monadexplorer.com/address/${activeWalletAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-500 hover:text-black p-0.5 transition"
                      title="View on Monad Explorer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                      onClick={handleCopy}
                      className="text-slate-600 hover:text-black p-0.5 transition"
                      title="Copy wallet address"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Connected Wallets Switcher (if multiple wallets connected) */}
          {hasMultipleWallets && (
            <div className="py-2.5 border-b-2 border-[#121212]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase font-black text-[#121212] tracking-wider flex items-center gap-1">
                  <ArrowRightLeft className="h-3 w-3 text-[#836EF9]" />
                  Switch Active Wallet ({wallets.length})
                </span>
              </div>
              <div className="space-y-1.5">
                {wallets.map((w: ConnectedWallet) => {
                  const isCurrent =
                    w.address.toLowerCase() ===
                    activeWalletAddress?.toLowerCase();
                  const isEmbedded = w.walletClientType === "privy";
                  const label = isEmbedded
                    ? "Embedded Monad"
                    : w.walletClientType || "External EVM";

                  return (
                    <div
                      key={w.address}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs transition ${
                        isCurrent
                          ? "bg-[#836EF9]/10 border-[#836EF9] font-bold"
                          : "bg-white border-[#e5e7eb] hover:border-[#121212]"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-mono text-[11px] truncate">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${isCurrent ? "bg-emerald-500" : "bg-slate-300"}`}
                        />
                        <span className="font-sans font-bold capitalize text-[#121212]">
                          {label}:
                        </span>
                        <span className="text-slate-600">
                          {w.address.slice(0, 6)}...{w.address.slice(-4)}
                        </span>
                      </div>

                      {isCurrent ? (
                        <span className="font-mono text-[9px] uppercase font-black text-[#836EF9]">
                          Active
                        </span>
                      ) : (
                        <button
                          onClick={() => setActiveWallet(w)}
                          className="font-mono text-[9px] uppercase font-black px-2 py-0.5 rounded bg-white border border-[#121212] shadow-[1px_1px_0_0_#121212] hover:bg-[#836EF9] hover:text-white transition"
                        >
                          Use
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Account Security & Embedded Wallet Management */}
          {embeddedWalletAddress && (
            <div className="py-2.5 border-b-2 border-[#121212] space-y-1">
              <span className="text-[10px] font-mono uppercase font-black text-[#121212] tracking-wider block mb-1">
                Embedded Wallet Security
              </span>
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  setWalletRecovery();
                }}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#121212] hover:bg-[#836EF9]/10 hover:text-[#836EF9] transition"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Set Recovery Password</span>
                </div>
                <span className="text-[9px] font-mono uppercase bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">
                  Cloud / PIN
                </span>
              </button>

              <button
                onClick={() => {
                  setDropdownOpen(false);
                  exportWallet();
                }}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#121212] hover:bg-slate-100 transition"
              >
                <div className="flex items-center gap-2">
                  <KeyRound className="h-3.5 w-3.5 text-amber-600" />
                  <span>Export Private Key</span>
                </div>
                <span className="text-[9px] font-mono uppercase bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">
                  Self-Custody
                </span>
              </button>
            </div>
          )}

          {/* Progressive Account Linking */}
          <div className="py-2.5 border-b-2 border-[#121212] space-y-1">
            <span className="text-[10px] font-mono uppercase font-black text-[#121212] tracking-wider block mb-1">
              Link Accounts
            </span>

            <button
              onClick={() => {
                setDropdownOpen(false);
                linkWallet();
              }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#121212] hover:bg-[#836EF9]/10 hover:text-[#836EF9] transition"
            >
              <div className="flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5 text-[#836EF9]" />
                <span>Link External Wallet</span>
              </div>
              <span className="text-[9px] font-mono text-slate-400">
                MetaMask, Rabby
              </span>
            </button>

            {!hasLinkedEmail && (
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  linkEmail();
                }}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#121212] hover:bg-slate-100 transition"
              >
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-slate-600" />
                  <span>Link Email</span>
                </div>
              </button>
            )}

            {!user?.google && (
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  linkGoogle();
                }}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#121212] hover:bg-slate-100 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-red-500 text-xs font-mono">G</span>
                  <span>Link Google Account</span>
                </div>
              </button>
            )}

            {!hasLinkedPasskey && (
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  linkPasskey();
                }}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#121212] hover:bg-slate-100 transition"
              >
                <div className="flex items-center gap-2">
                  <Fingerprint className="h-3.5 w-3.5 text-slate-600" />
                  <span>Link Passkey (Biometrics)</span>
                </div>
              </button>
            )}
          </div>

          {/* Session Teardown & Logout */}
          <div className="pt-2.5">
            <button
              onClick={async () => {
                setDropdownOpen(false);
                await logout();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wider text-red-600 border border-transparent hover:border-red-600 hover:bg-red-50 transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
