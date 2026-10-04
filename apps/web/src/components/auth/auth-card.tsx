"use client";

import React, { useState } from "react";
import { useClarioAuth } from "@/lib/auth/use-clario-auth";
import {
  Wallet,
  Mail,
  Fingerprint,
  ShieldCheck,
  Zap,
  Lock,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  LogOut,
} from "lucide-react";
import { MonadLogo } from "@/components/ui/crypto-icon";
import { ClarioBadge, ClarioButton } from "@/components/ui/clario-ui";

interface AuthCardProps {
  compact?: boolean | undefined;
  onSuccess?: (() => void) | undefined;
  className?: string | undefined;
  title?: string | undefined;
  description?: string | undefined;
}

export function AuthCard({
  compact = false,
  onSuccess,
  className = "",
  title = "Authenticate with Clario",
  description = "Verifiable Expense, Invoice & Cryptographic Audit Protocol on Monad",
}: AuthCardProps) {
  const {
    isReady,
    isAuthenticated,
    displayName,
    primaryEmail,
    activeWalletAddress,
    isActiveWalletEmbedded,
    login,
    logout,
    linkWallet,
  } = useClarioAuth();

  const [copied, setCopied] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleCopy = () => {
    if (activeWalletAddress) {
      navigator.clipboard.writeText(activeWalletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLoginMethod = async (method?: "wallet" | "email" | "google" | "passkey") => {
    try {
      setAuthError(null);
      setIsAuthenticating(true);
      if (method) {
        await login({ loginMethods: [method] });
      } else {
        await login();
      }
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication cancelled or failed";
      if (!msg.toLowerCase().includes("user exited") && !msg.toLowerCase().includes("cancelled")) {
        setAuthError(msg);
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  if (!isReady) {
    return (
      <div className={`rounded-xl border-2 border-[#121212] bg-white p-6 shadow-[4px_4px_0_0_#121212] animate-pulse space-y-4 ${className}`}>
        <div className="h-6 w-48 bg-slate-200 rounded" />
        <div className="h-4 w-72 bg-slate-100 rounded" />
        <div className="h-10 w-full bg-slate-200 rounded mt-4" />
      </div>
    );
  }

  // Already Authenticated View
  if (isAuthenticated) {
    return (
      <div
        className={`rounded-xl border-2 border-[#121212] bg-white p-5 sm:p-6 shadow-[4px_4px_0_0_#121212] ${className}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b-2 border-[#121212] pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="font-mono text-xs font-black uppercase tracking-wider text-[#121212]">
                Session Active • Monad Testnet (10143)
              </h3>
            </div>
            <p className="text-lg font-black tracking-tight text-[#121212] mt-1">
              {displayName}
            </p>
            {primaryEmail && (
              <p className="text-xs font-mono text-slate-500 truncate">{primaryEmail}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isActiveWalletEmbedded ? (
              <ClarioBadge variant="purple" size="sm" className="gap-1">
                <MonadLogo className="h-3 w-3" />
                Embedded Monad
              </ClarioBadge>
            ) : (
              <ClarioBadge variant="green" size="sm" className="gap-1">
                <Wallet className="h-3 w-3" />
                Connected EVM
              </ClarioBadge>
            )}
          </div>
        </div>

        {/* Active Signer Address */}
        {activeWalletAddress && (
          <div className="rounded-lg bg-[#f8f9fa] border-2 border-[#121212] p-3 mb-4">
            <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
              <span>Onchain Signer Address</span>
              <a
                href={`https://testnet.monadexplorer.com/address/${activeWalletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#836EF9] flex items-center gap-1 transition"
              >
                <span>Monad Explorer</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded border border-[#121212]">
              <span className="font-mono text-xs sm:text-sm font-bold text-[#121212] truncate">
                {activeWalletAddress}
              </span>
              <button
                onClick={handleCopy}
                className="p-1 rounded hover:bg-slate-100 transition text-slate-600 hover:text-black shrink-0"
                title="Copy address"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Secondary Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <ClarioButton
            variant="secondary"
            size="sm"
            onClick={() => linkWallet()}
            leftIcon={<Wallet className="h-3.5 w-3.5 text-[#836EF9]" />}
          >
            Link Another Wallet
          </ClarioButton>

          <button
            onClick={() => logout()}
            className="flex items-center gap-1.5 text-xs font-mono font-black uppercase text-red-600 hover:text-red-700 px-3 py-1.5 rounded hover:bg-red-50 transition"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  // Unauthenticated Sign-In Card
  return (
    <div
      className={`rounded-xl border-2 border-[#121212] bg-white p-5 sm:p-7 shadow-[4px_4px_0_0_#121212] ${className}`}
    >
      {/* Card Header */}
      <div className="border-b-2 border-[#121212] pb-4 mb-5">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#836EF9] text-white font-black text-sm border-2 border-[#121212] shadow-[1px_1px_0_0_#121212]">
              C
            </div>
            <span className="font-mono text-xs font-black uppercase tracking-wider text-[#836EF9]">
              Monad Testnet Protocol
            </span>
          </div>
          <ClarioBadge variant="purple" size="sm" className="gap-1">
            <MonadLogo className="h-3 w-3" />
            Chain 10143
          </ClarioBadge>
        </div>
        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[#121212]">
          {title}
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 mt-1">{description}</p>
      </div>

      {authError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border-2 border-red-500 bg-red-50 p-2.5 text-xs font-bold text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{authError}</span>
        </div>
      )}

      {/* Primary Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {/* Option 1: Web3 Wallet */}
        <button
          onClick={() => handleLoginMethod("wallet")}
          disabled={isAuthenticating}
          className="group relative flex flex-col justify-between p-4 rounded-xl border-2 border-[#121212] bg-[#f8f9fa] hover:bg-[#836EF9]/5 text-left shadow-[2px_2px_0_0_#121212] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#121212]"
        >
          <div className="flex items-center justify-between w-full mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#836EF9] text-white border border-[#121212]">
              <Wallet className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-mono uppercase font-black px-1.5 py-0.5 rounded bg-white border border-[#121212] text-[#121212]">
              Self-Custody
            </span>
          </div>
          <div>
            <div className="font-black text-sm text-[#121212] uppercase tracking-wide group-hover:text-[#836EF9] transition">
              Connect Web3 Wallet
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
              MetaMask, Rabby, Coinbase Wallet, Rainbow & WalletConnect
            </p>
          </div>
        </button>

        {/* Option 2: 1-Click Embedded (Email / Social / Passkey) */}
        <button
          onClick={() => handleLoginMethod()}
          disabled={isAuthenticating}
          className="group relative flex flex-col justify-between p-4 rounded-xl border-2 border-[#121212] bg-[#836EF9] text-white text-left shadow-[2px_2px_0_0_#121212] transition hover:bg-[#7257f8] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#121212]"
        >
          <div className="flex items-center justify-between w-full mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#836EF9] border border-[#121212]">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-mono uppercase font-black px-1.5 py-0.5 rounded bg-black/20 text-white border border-white/30">
              Zero Seed Phrase
            </span>
          </div>
          <div>
            <div className="font-black text-sm text-white uppercase tracking-wide">
              1-Click Instant Sign-In
            </div>
            <p className="text-[11px] text-white/80 mt-0.5 leading-snug">
              Google, Email OTP, or Biometric Passkey on Monad
            </p>
          </div>
        </button>
      </div>

      {/* Granular Login Method Badges */}
      {!compact && (
        <div className="pt-2 border-t border-slate-200 mb-5">
          <span className="text-[10px] font-mono uppercase font-bold text-slate-500 block mb-2">
            Direct Fast-Path:
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleLoginMethod("passkey")}
              disabled={isAuthenticating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#121212] bg-white text-xs font-bold text-[#121212] hover:bg-slate-50 transition"
            >
              <Fingerprint className="h-3.5 w-3.5 text-[#836EF9]" />
              <span>Passkey / Face ID</span>
            </button>

            <button
              onClick={() => handleLoginMethod("google")}
              disabled={isAuthenticating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#121212] bg-white text-xs font-bold text-[#121212] hover:bg-slate-50 transition"
            >
              <span className="font-bold text-red-500">G</span>
              <span>Google Account</span>
            </button>

            <button
              onClick={() => handleLoginMethod("email")}
              disabled={isAuthenticating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#121212] bg-white text-xs font-bold text-[#121212] hover:bg-slate-50 transition"
            >
              <Mail className="h-3.5 w-3.5 text-slate-600" />
              <span>Email Code</span>
            </button>
          </div>
        </div>
      )}

      {/* Security Invariants Footer Reassurance */}
      <div className="rounded-lg bg-[#f8f9fa] border border-[#121212]/20 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono text-slate-600">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Private evidence stays offchain (RFC 8785)</span>
        </div>
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-[#836EF9] shrink-0" />
          <span>Zero PII on Monad Testnet</span>
        </div>
      </div>
    </div>
  );
}
