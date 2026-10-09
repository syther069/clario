"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ModeHeader } from "@/components/layout/mode-header";
import { useClarioAuth } from "@/lib/auth/use-clario-auth";
import {
  Settings,
  ShieldCheck,
  Wallet,
  Mail,
  Globe,
  Fingerprint,
  KeyRound,
  Check,
  Copy,
  ExternalLink,
  Lock,
  LogOut,
  Coins,
  Shield,
  Layers,
  Pencil,
  ArrowLeft,
  CheckCircle2,
  Database,
  Cpu,
  Zap,
  Loader2,
} from "lucide-react";
import { MonadLogo } from "@/components/ui/crypto-icon";
import type { PlatformMode } from "@/lib/supabase/types";
import { EditNicknameModal } from "@/components/auth/edit-nickname-modal";
import { ContextualIconSwap } from "@/components/ui/motion";

export default function AccountSettingsPage() {
  const router = useRouter();
  const [activeMode, setActiveMode] = useState<PlatformMode>("personal");
  const [copied, setCopied] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [autoVerify, setAutoVerify] = useState(true);

  // Nickname Modal State
  const [nicknameModalOpen, setNicknameModalOpen] = useState(false);
  const [targetWalletForNickname, setTargetWalletForNickname] = useState<string | null>(null);
  const [targetTitleForNickname, setTargetTitleForNickname] = useState("Set Wallet Nickname");

  // Inline Quick-Edit State for Profile Card
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [inlineNickname, setInlineNickname] = useState("");

  // 1-Click Session Signing State
  const [isDelegating, setIsDelegating] = useState(false);
  const [delegationFeedback, setDelegationFeedback] = useState<string | null>(null);

  const {
    displayName,
    nickname,
    walletNicknames,
    setNickname,
    getNickname,
    primaryEmail,
    activeWalletAddress,
    embeddedWalletAddress,
    wallets,
    externalEvmWallets,
    isActiveWalletEmbedded,
    linkWallet,
    linkEmail,
    linkGoogle,
    linkPasskey,
    unlinkWallet,
    unlinkEmail,
    unlinkGoogle,
    unlinkPasskey,
    setWalletRecovery,
    exportWallet,
    logout,
    user,
    isSessionDelegated,
    canDelegate,
    enableSessionSigning,
    revokeSessionSigning,
    fundWallet,
  } = useClarioAuth();

  const handleCopy = (address: string) => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const hasLinkedExternalWallet = Boolean(
    (externalEvmWallets && externalEvmWallets.length > 0) ||
      wallets.some((w) => w.walletClientType !== "privy") ||
      user?.linkedAccounts?.some(
        (a) =>
          a.type === "wallet" &&
          (a as { walletClientType?: string }).walletClientType !== "privy",
      ),
  );
  const hasLinkedEmail = Boolean(
    user?.email?.address ||
      (user?.email && typeof user.email === "string") ||
      user?.linkedAccounts?.some((a) => a.type === "email"),
  );
  const hasLinkedGoogle = Boolean(
    user?.google ||
      user?.linkedAccounts?.some((a) => a.type === "google_oauth"),
  );
  const hasLinkedPasskey = Boolean(
    user?.linkedAccounts?.some((a) => a.type === "passkey"),
  );

  const externalWallet =
    (externalEvmWallets && externalEvmWallets[0]) ||
    wallets.find((w) => w.walletClientType !== "privy");
  const linkedExternalWalletAddress =
    externalWallet?.address ||
    (
      user?.linkedAccounts?.find(
        (a) =>
          a.type === "wallet" &&
          (a as { walletClientType?: string }).walletClientType !== "privy",
      ) as { address?: string } | undefined
    )?.address;

  const linkedEmailAddress =
    user?.email?.address ||
    (typeof user?.email === "string" ? user.email : null) ||
    (
      user?.linkedAccounts?.find((a) => a.type === "email") as
        | { address?: string }
        | undefined
    )?.address;

  const linkedGoogleEmail =
    user?.google?.email ||
    (
      user?.linkedAccounts?.find((a) => a.type === "google_oauth") as
        | { email?: string }
        | undefined
    )?.email;
  const linkedGoogleSubject =
    user?.google?.subject ||
    (
      user?.linkedAccounts?.find((a) => a.type === "google_oauth") as
        | { subject?: string }
        | undefined
    )?.subject;

  const linkedPasskeyId =
    (
      user?.linkedAccounts?.find((a) => a.type === "passkey") as
        | { credentialId?: string; id?: string }
        | undefined
    )?.credentialId ||
    (
      user?.linkedAccounts?.find((a) => a.type === "passkey") as
        | { credentialId?: string; id?: string }
        | undefined
    )?.id;

  const totalLinkedCount =
    (hasLinkedExternalWallet ? 1 : 0) +
    (hasLinkedEmail ? 1 : 0) +
    (hasLinkedGoogle ? 1 : 0) +
    (hasLinkedPasskey ? 1 : 0) +
    (embeddedWalletAddress ? 1 : 0);
  const canUnlink = totalLinkedCount > 1;

  const openNicknameModal = (walletAddr: string | null, title?: string) => {
    setTargetWalletForNickname(walletAddr);
    setTargetTitleForNickname(title || "Set Wallet Nickname");
    setNicknameModalOpen(true);
  };

  const handleStartInlineEdit = () => {
    setInlineNickname(nickname || "");
    setIsEditingInline(true);
  };

  const handleSaveInlineEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setNickname(inlineNickname.trim(), activeWalletAddress || undefined);
    setIsEditingInline(false);
  };

  const externalWalletNickname = linkedExternalWalletAddress
    ? getNickname(linkedExternalWalletAddress)
    : null;

  return (
    <div className="min-h-screen bg-grid text-[#121212] font-sans flex flex-col pb-16">
      {/* Top Main Container - max-w-6xl for optimal readability and screen proportions */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Page-Level Header: Mode Selector & Brand */}
        <ModeHeader
          currentMode={activeMode}
          onModeChange={(mode) => {
            setActiveMode(mode);
            router.push(`/?mode=${mode}&view=overview`);
          }}
        />

        {/* Breadcrumb & Top Page Header */}
        <div className="rounded-xl border-2 border-[#121212] bg-white p-4 sm:p-5 shadow-[4px_4px_0_0_#121212]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#121212] bg-slate-50 px-2.5 py-1 text-xs font-mono font-bold uppercase tracking-wider text-[#121212] shadow-[2px_2px_0_0_#121212] hover:bg-slate-100 transition active:translate-x-[1px] active:translate-y-[1px]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Workspace</span>
                </Link>
                <span className="text-slate-400 font-mono text-xs">/</span>
                <span className="font-mono text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Settings
                </span>
              </div>
              <div className="flex items-center gap-2.5 pt-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-[#121212] bg-[#836EF9] text-white shadow-[2px_2px_0_0_#121212]">
                  <Settings className="h-4 w-4" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[#121212]">
                    Account Settings & Security
                  </h1>
                  <p className="text-xs text-slate-600 font-medium">
                    Manage your connected wallets, security credentials, and platform preferences.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#836EF9]/10 px-3 py-1.5 font-mono text-xs font-black uppercase tracking-wider text-[#836EF9] border-2 border-[#836EF9]/40 shadow-[2px_2px_0_0_#836EF9]/20">
                <MonadLogo className="h-4 w-4" />
                <span>Monad Testnet</span>
              </span>
            </div>
          </div>
        </div>

        {/* Main Balanced 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (5 of 12): Identity Profile, Active Signer & Controls */}
          <div className="lg:col-span-5 space-y-6">
            {/* Primary Profile Identity Card */}
            <div className="rounded-xl border-2 border-[#121212] bg-white p-5 sm:p-6 shadow-[4px_4px_0_0_#121212]">
              {/* Profile Header */}
              <div className="flex items-start justify-between gap-3 border-b-2 border-[#121212] pb-4 mb-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-[#836EF9] text-white font-black text-2xl border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] shrink-0">
                    {displayName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    {!isEditingInline ? (
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base sm:text-lg font-black uppercase tracking-wide truncate text-[#121212]">
                            {displayName}
                          </h2>
                          <button
                            onClick={handleStartInlineEdit}
                            className="relative text-slate-400 hover:text-[#836EF9] p-1 transition-colors duration-150 ease-out rounded hover:bg-slate-100 after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2 after:content-['']"
                            title="Edit Nickname"
                            aria-label="Edit Nickname"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {primaryEmail ? (
                          <p className="text-xs text-slate-500 font-mono truncate mt-0.5">
                            {primaryEmail}
                          </p>
                        ) : activeWalletAddress ? (
                          <p className="text-xs text-slate-500 font-mono truncate mt-0.5">
                            {activeWalletAddress.slice(0, 6)}...{activeWalletAddress.slice(-4)}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-500 font-mono mt-0.5">
                            Anonymous Signer
                          </p>
                        )}
                      </div>
                    ) : (
                      <form onSubmit={handleSaveInlineEdit} className="space-y-2">
                        <input
                          type="text"
                          value={inlineNickname}
                          onChange={(e) => setInlineNickname(e.target.value)}
                          placeholder="Enter friendly nickname"
                          maxLength={32}
                          autoFocus
                          className="w-full rounded-lg border-2 border-[#121212] bg-white px-2.5 py-1 text-xs font-bold text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="submit"
                            className="rounded-md bg-[#836EF9] px-2.5 py-1 text-xs font-mono font-bold uppercase text-white hover:bg-[#7257f8] transition shadow-[1px_1px_0_0_#121212]"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingInline(false)}
                            className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-mono font-bold uppercase text-slate-700 hover:bg-slate-200 transition border border-slate-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>

                <span className="text-[10px] font-mono uppercase bg-emerald-50 text-emerald-800 font-black px-2 py-0.5 rounded border border-emerald-300 shrink-0">
                  Active
                </span>
              </div>

              {/* Active Signer Details Box */}
              {activeWalletAddress && (
                <div className="rounded-lg bg-[#f8f9fa] p-3.5 border-2 border-[#121212] space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase font-bold">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Wallet className="h-3.5 w-3.5 text-[#836EF9]" />
                      Active EVM Signer
                    </span>
                    {isActiveWalletEmbedded ? (
                      <span className="rounded bg-[#836EF9]/15 px-2 py-0.5 text-[9px] font-black text-[#836EF9] border border-[#836EF9]/30">
                        Privy Embedded
                      </span>
                    ) : (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[9px] font-black text-emerald-800 border border-emerald-300">
                        External Wallet
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-[#121212]">
                    <div className="min-w-0 flex-1">
                      {nickname && (
                        <span className="block text-[11px] font-black uppercase text-[#836EF9] truncate">
                          {nickname}
                        </span>
                      )}
                      <span className="font-mono text-[#121212] font-bold text-xs truncate block">
                        {activeWalletAddress}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() =>
                          openNicknameModal(activeWalletAddress, "Edit Active Wallet Nickname")
                        }
                        className="relative text-slate-500 hover:text-[#836EF9] p-1.5 transition-colors duration-150 ease-out rounded hover:bg-slate-100 after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2 after:content-['']"
                        title="Set / Edit Nickname"
                        aria-label="Set / Edit Nickname"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <a
                        href={`https://testnet.monadexplorer.com/address/${activeWalletAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative text-slate-500 hover:text-black p-1.5 transition-colors duration-150 ease-out rounded hover:bg-slate-100 after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2 after:content-['']"
                        title="View on Monad Explorer"
                        aria-label="View on Monad Explorer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button
                        onClick={() => handleCopy(activeWalletAddress)}
                        className="relative text-slate-600 hover:text-black p-1.5 transition-colors duration-150 ease-out rounded hover:bg-slate-100 after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2 after:content-['']"
                        title="Copy wallet address"
                        aria-label="Copy wallet address"
                      >
                        <ContextualIconSwap
                          isActive={copied}
                          initialIcon={<Copy className="h-3.5 w-3.5" />}
                          activeIcon={<Check className="h-3.5 w-3.5 text-emerald-600" />}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Identity & Security Metrics */}
              <div className="grid grid-cols-2 gap-2.5 mt-4 pt-3 border-t border-slate-200">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                    <Layers className="h-3.5 w-3.5 text-[#836EF9]" />
                    <span className="text-[10px] font-mono uppercase font-bold">
                      Linked Accounts
                    </span>
                  </div>
                  <span className="block text-sm font-black text-[#121212]">
                    {totalLinkedCount} Providers
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-[10px] font-mono uppercase font-bold">
                      Offchain Privacy
                    </span>
                  </div>
                  <span className="block text-sm font-black text-emerald-700">
                    Encrypted Safe
                  </span>
                </div>
              </div>

              {/* Log Out Action */}
              <div className="mt-5 pt-4 border-t-2 border-[#121212]/15">
                <button
                  onClick={async () => {
                    await logout();
                    router.push("/");
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-mono font-bold uppercase tracking-wider text-red-600 border-2 border-red-600/30 hover:border-red-600 hover:bg-red-50 transition shadow-[2px_2px_0_0_#121212] active:translate-x-[1px] active:translate-y-[1px]"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Log Out of Session</span>
                </button>
              </div>
            </div>

            {/* Preferences & Auditing Card */}
            <div className="rounded-xl border-2 border-[#121212] bg-white p-5 sm:p-6 shadow-[4px_4px_0_0_#121212]">
              <div className="flex items-center gap-2 pb-3 border-b-2 border-[#121212] mb-4">
                <Coins className="h-4 w-4 text-[#836EF9]" />
                <h2 className="text-sm font-black uppercase tracking-wider text-[#121212]">
                  Preferences & Auditing
                </h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-[#121212]">
                      Primary Reporting Currency
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Display value conversions across dashboards
                    </p>
                  </div>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    aria-label="Primary Reporting Currency"
                    className="rounded-lg border-2 border-[#121212] bg-white px-3 py-1.5 font-mono text-xs font-bold text-[#121212] shadow-[2px_2px_0_0_#121212] shrink-0 focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="MON">MON (Native)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between gap-4 pt-3 border-t border-slate-200">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-[#121212]">
                      Automatic Onchain Anchoring
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Anchor hashes directly to Monad Testnet upon approval
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoVerify}
                    onChange={(e) => setAutoVerify(e.target.checked)}
                    aria-label="Automatic Onchain Anchoring"
                    className="h-4 w-4 rounded border-2 border-[#121212] accent-[#836EF9] shrink-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (7 of 12): Linked Accounts, Hardware Security & Protocol Proofs */}
          <div className="lg:col-span-7 space-y-6">
            {/* Linked Identity Providers Card */}
            <div className="rounded-xl border-2 border-[#121212] bg-white p-5 sm:p-6 shadow-[4px_4px_0_0_#121212]">
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#121212] mb-4">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#836EF9]" />
                  <h2 className="text-sm font-black uppercase tracking-wider text-[#121212]">
                    Linked Accounts & Signers
                  </h2>
                </div>
                <span className="text-[10px] font-mono uppercase bg-slate-100 px-2.5 py-0.5 rounded border border-slate-300 font-bold">
                  {totalLinkedCount} Connected
                </span>
              </div>

              <div className="space-y-3.5">
                {/* 1. External Wallet */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 rounded-xl border-2 border-[#121212] bg-[#fbfbfc] gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#836EF9]/10 border border-[#836EF9]/30 text-[#836EF9] shrink-0">
                      <Wallet className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-black uppercase tracking-wider text-[#121212] truncate">
                          {externalWalletNickname || "External Wallet"}
                        </p>
                        {externalWalletNickname && (
                          <span className="text-[9px] font-mono uppercase bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 text-slate-500 font-bold">
                            Wallet
                          </span>
                        )}
                      </div>
                      {linkedExternalWalletAddress ? (
                        <p className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                          {linkedExternalWalletAddress}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">Not linked</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    {hasLinkedExternalWallet ? (
                      <>
                        <span className="text-[9px] font-mono uppercase bg-emerald-50 text-emerald-800 font-black px-2 py-0.5 rounded border border-emerald-200">
                          Connected
                        </span>
                        {linkedExternalWalletAddress && (
                          <button
                            onClick={() =>
                              openNicknameModal(
                                linkedExternalWalletAddress,
                                "Edit External Wallet Nickname",
                              )
                            }
                            className="text-[10px] font-mono font-bold uppercase text-[#836EF9] hover:underline px-2 py-1 rounded bg-[#836EF9]/10 flex items-center gap-1 transition"
                            title="Set / Edit Nickname"
                          >
                            <Pencil className="h-3 w-3" />
                            <span>{externalWalletNickname ? "Edit Name" : "Set Name"}</span>
                          </button>
                        )}
                        {canUnlink && linkedExternalWalletAddress && (
                          <button
                            onClick={() => unlinkWallet(linkedExternalWalletAddress)}
                            className="text-[10px] font-mono font-bold uppercase text-red-600 hover:underline px-2 py-1"
                          >
                            Unlink
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => linkWallet()}
                        className="text-[10px] font-mono font-black uppercase text-[#836EF9] bg-[#836EF9]/10 px-3.5 py-1.5 rounded-lg border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] hover:bg-[#836EF9] hover:text-white transition active:translate-x-[1px] active:translate-y-[1px]"
                      >
                        Link Wallet
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Email Address */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 rounded-xl border-2 border-[#121212] bg-[#fbfbfc] gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 border border-slate-300 text-slate-700 shrink-0">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black uppercase tracking-wider text-[#121212]">
                        Email Address
                      </p>
                      {linkedEmailAddress ? (
                        <p className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                          {linkedEmailAddress}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">Not linked</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    {hasLinkedEmail ? (
                      <>
                        <span className="text-[9px] font-mono uppercase bg-emerald-50 text-emerald-800 font-black px-2 py-0.5 rounded border border-emerald-200">
                          Connected
                        </span>
                        {canUnlink && linkedEmailAddress && (
                          <button
                            onClick={() => unlinkEmail(linkedEmailAddress)}
                            className="text-[10px] font-mono font-bold uppercase text-red-600 hover:underline px-2 py-1"
                          >
                            Unlink
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => linkEmail()}
                        className="text-[10px] font-mono font-black uppercase text-[#836EF9] bg-[#836EF9]/10 px-3.5 py-1.5 rounded-lg border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] hover:bg-[#836EF9] hover:text-white transition active:translate-x-[1px] active:translate-y-[1px]"
                      >
                        Link Email
                      </button>
                    )}
                  </div>
                </div>

                {/* 3. Google OAuth */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 rounded-xl border-2 border-[#121212] bg-[#fbfbfc] gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 border border-red-200 text-red-600 shrink-0">
                      <Globe className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black uppercase tracking-wider text-[#121212]">
                        Google Account
                      </p>
                      {linkedGoogleEmail ? (
                        <p className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                          {linkedGoogleEmail}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">Not linked</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    {hasLinkedGoogle ? (
                      <>
                        <span className="text-[9px] font-mono uppercase bg-emerald-50 text-emerald-800 font-black px-2 py-0.5 rounded border border-emerald-200">
                          Connected
                        </span>
                        {canUnlink && (
                          <button
                            onClick={() => unlinkGoogle(linkedGoogleSubject)}
                            className="text-[10px] font-mono font-bold uppercase text-red-600 hover:underline px-2 py-1"
                          >
                            Unlink
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => linkGoogle()}
                        className="text-[10px] font-mono font-black uppercase text-[#836EF9] bg-[#836EF9]/10 px-3.5 py-1.5 rounded-lg border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] hover:bg-[#836EF9] hover:text-white transition active:translate-x-[1px] active:translate-y-[1px]"
                      >
                        Link Google
                      </button>
                    )}
                  </div>
                </div>

                {/* 4. Passkey */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 rounded-xl border-2 border-[#121212] bg-[#fbfbfc] gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 shrink-0">
                      <Fingerprint className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black uppercase tracking-wider text-[#121212]">
                        Passkey / Biometrics
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Hardware security key or device biometrics
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    {hasLinkedPasskey ? (
                      <>
                        <span className="text-[9px] font-mono uppercase bg-emerald-50 text-emerald-800 font-black px-2 py-0.5 rounded border border-emerald-200">
                          Configured
                        </span>
                        {canUnlink && (
                          <button
                            onClick={() => unlinkPasskey(linkedPasskeyId)}
                            className="text-[10px] font-mono font-bold uppercase text-red-600 hover:underline px-2 py-1"
                          >
                            Unlink
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => linkPasskey()}
                        className="text-[10px] font-mono font-black uppercase text-[#836EF9] bg-[#836EF9]/10 px-3.5 py-1.5 rounded-lg border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] hover:bg-[#836EF9] hover:text-white transition active:translate-x-[1px] active:translate-y-[1px]"
                      >
                        Configure Passkey
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Embedded Wallet Security Card */}
            {embeddedWalletAddress && (
              <div className="rounded-xl border-2 border-[#121212] bg-white p-5 sm:p-6 shadow-[4px_4px_0_0_#121212]">
                <div className="flex items-center justify-between pb-3 border-b-2 border-[#121212] mb-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <h2 className="text-sm font-black uppercase tracking-wider text-[#121212]">
                      Embedded Wallet Security & Self-Custody
                    </h2>
                  </div>
                  <span className="text-[9px] font-mono uppercase bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded border border-emerald-300">
                    Hardware Encrypted
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <button
                    onClick={() => setWalletRecovery()}
                    className="flex items-center justify-between p-3.5 rounded-xl border-2 border-[#121212] bg-[#fbfbfc] hover:bg-[#836EF9]/10 hover:border-[#836EF9] transition text-left shadow-[2px_2px_0_0_#121212] active:translate-x-[1px] active:translate-y-[1px]"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-black uppercase text-[#121212]">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        Recovery Password
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Set cloud backup or custom PIN for instant device recovery
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => exportWallet()}
                    className="flex items-center justify-between p-3.5 rounded-xl border-2 border-[#121212] bg-[#fbfbfc] hover:bg-amber-50 hover:border-amber-400 transition text-left shadow-[2px_2px_0_0_#121212] active:translate-x-[1px] active:translate-y-[1px]"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-black uppercase text-[#121212]">
                        <KeyRound className="h-4 w-4 text-amber-600" />
                        Export Private Key
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Self-custody export for MetaMask, Rabby, or hardware wallets
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      if (embeddedWalletAddress) {
                        fundWallet({ address: embeddedWalletAddress });
                      }
                    }}
                    className="flex items-center justify-between p-3.5 rounded-xl border-2 border-[#121212] bg-[#fbfbfc] hover:bg-emerald-50 hover:border-emerald-500 transition text-left shadow-[2px_2px_0_0_#121212] active:translate-x-[1px] active:translate-y-[1px]"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-black uppercase text-[#121212]">
                        <Coins className="h-4 w-4 text-emerald-600" />
                        Fund Wallet (Privy)
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Deposit or transfer assets via Privy native modal
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* 1-Click Fast Anchoring (Privy Session Signer) Card */}
            <div className="rounded-xl border-2 border-[#121212] bg-white p-5 sm:p-6 shadow-[4px_4px_0_0_#121212]">
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#121212] mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#836EF9] text-white shadow-[1px_1px_0_0_#121212]">
                    <Zap className="h-4 w-4 fill-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wider text-[#121212]">
                      1-Click Fast Anchoring (Privy Session Signer)
                    </h2>
                  </div>
                </div>
                {isSessionDelegated ? (
                  <span className="text-[9px] font-mono uppercase bg-emerald-100 text-emerald-900 font-black px-2.5 py-0.5 rounded border border-emerald-400 flex items-center gap-1">
                    <Zap className="h-3 w-3 fill-emerald-700" />
                    Active
                  </span>
                ) : (
                  <span className="text-[9px] font-mono uppercase bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded border border-slate-300">
                    Disabled
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Pre-authorizes your Privy embedded wallet to sign transaction commitments and receipt proof hashes in the background on Monad Testnet without triggering signature popup modals each time you save an entry.
              </p>

              {canDelegate ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-xl border-2 border-[#121212] bg-[#fbf9fe]">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#836EF9]/10 text-[#836EF9] border border-[#836EF9]/30 shrink-0">
                      <Zap className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase text-[#121212]">
                        {isSessionDelegated ? "Session Signatures Authorized" : "Session Authorization Required"}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500">
                        {isSessionDelegated
                          ? "All receipt anchors & ledger entries sign silently in 1 click"
                          : "Standard prompt is currently required for every onchain anchor"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isSessionDelegated ? (
                      <button
                        type="button"
                        disabled={isDelegating}
                        onClick={async () => {
                          setIsDelegating(true);
                          try {
                            await revokeSessionSigning();
                            setDelegationFeedback("1-Click session authorization revoked.");
                          } catch (err) {
                            setDelegationFeedback(err instanceof Error ? err.message : "Failed to revoke authorization.");
                          } finally {
                            setIsDelegating(false);
                          }
                        }}
                        className="w-full sm:w-auto px-3.5 py-2 rounded-lg border-2 border-red-600/40 text-red-600 bg-red-50 hover:bg-red-100 hover:border-red-600 font-mono text-xs font-black uppercase tracking-wider transition shadow-[2px_2px_0_0_#121212] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer disabled:opacity-50"
                      >
                        {isDelegating ? "Revoking..." : "Revoke Fast Mode"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isDelegating}
                        onClick={async () => {
                          setIsDelegating(true);
                          try {
                            await enableSessionSigning();
                            setDelegationFeedback("1-Click Fast Anchoring activated successfully!");
                          } catch (err) {
                            setDelegationFeedback(err instanceof Error ? err.message : "Failed to enable 1-Click Fast Anchoring.");
                          } finally {
                            setIsDelegating(false);
                          }
                        }}
                        className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border-2 border-[#121212] bg-[#836EF9] hover:bg-[#7257f8] text-white font-mono text-xs font-black uppercase tracking-wider transition shadow-[2px_2px_0_0_#121212] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer disabled:opacity-50"
                      >
                        {isDelegating ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Authorizing...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="h-3.5 w-3.5 fill-white" />
                            <span>Enable 1-Click Fast Mode</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl border-2 border-dashed border-[#121212]/30 bg-slate-50 text-slate-600 text-xs">
                  <div className="flex items-center gap-2 font-bold uppercase text-[11px] text-slate-700">
                    <Wallet className="h-4 w-4 text-[#836EF9]" />
                    <span>Embedded Wallet Required for 1-Click Delegation</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed">
                    1-Click background signing uses Privy delegated actions, which are exclusive to embedded wallets. External browser extensions (e.g. MetaMask) require manual EIP-1193 confirmation for security.
                  </p>
                </div>
              )}

              {delegationFeedback && (
                <div className="mt-3 p-2.5 rounded-lg border border-[#121212] bg-slate-100 text-[11px] font-mono text-[#121212] flex items-center justify-between">
                  <span>{delegationFeedback}</span>
                  <button
                    onClick={() => setDelegationFeedback(null)}
                    className="text-slate-400 hover:text-black font-bold ml-2 text-xs"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Cryptographic Proof Assurance Note */}
            <div className="rounded-xl border-2 border-[#121212] bg-[#f5f3ff] p-4 sm:p-5 shadow-[3px_3px_0_0_#121212] flex items-start gap-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#836EF9] text-white border border-[#121212] shrink-0 shadow-[1px_1px_0_0_#121212]">
                <Shield className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#121212]">
                    Monad Invariant & Cryptographic Preimage Integrity
                  </h3>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  Your private evidence and receipts remain strictly offchain in local storage and encrypted databases. Only immutable state commitments and authorization signatures are published to Monad Testnet.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Edit Nickname Modal */}
      <EditNicknameModal
        isOpen={nicknameModalOpen}
        onClose={() => setNicknameModalOpen(false)}
        walletAddress={targetWalletForNickname}
        currentNickname={targetWalletForNickname ? getNickname(targetWalletForNickname) : nickname}
        onSave={(newNickname, targetAddress) => {
          setNickname(newNickname, targetAddress || undefined);
        }}
        title={targetTitleForNickname}
      />
    </div>
  );
}
