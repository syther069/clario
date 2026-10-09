"use client";

import { useClarioAuth } from "@/lib/auth/use-clario-auth";
import {
  LogIn,
  LogOut,
  Wallet,
  Check,
  Copy,
  KeyRound,
  ExternalLink,
  ShieldCheck,
  ArrowRightLeft,
  ChevronDown,
  Fingerprint,
  Mail,
  WalletCards,
  Globe,
  Settings,
  Pencil,
  BookOpen,
  Zap,
  Coins,
} from "lucide-react";
import Link from "next/link";
import { MonadLogo } from "@/components/ui/crypto-icon";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ConnectedWallet } from "@privy-io/react-auth";
import { EditNicknameModal } from "./edit-nickname-modal";
import { ContextualIconSwap } from "@/components/ui/motion";

export function UserButton() {
  const router = useRouter();
  const {
    isReady,
    isAuthenticated,
    user,
    displayName,
    nickname,
    setNickname,
    getNickname,
    primaryEmail,
    activeWalletAddress,
    embeddedWalletAddress,
    wallets,
    externalEvmWallets,
    hasConnectedEvmWallet,
    connectEvmWallet,
    disconnectWallet,
    isEmailOnlyUser,
    accountType,
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
    setActiveWallet,
    login,
    logout,
    isSessionDelegated,
    canDelegate,
    enableSessionSigning,
    revokeSessionSigning,
    fundWallet,
  } = useClarioAuth();

  const [copied, setCopied] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [nicknameModalOpen, setNicknameModalOpen] = useState(false);
  const [targetWalletForEdit, setTargetWalletForEdit] = useState<string | null>(null);
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
        className="flex items-center gap-1.5 rounded-lg border-2 border-[#121212] bg-[#836EF9] px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-white shadow-[2px_2px_0_0_#121212] transition hover:bg-[#7257f8] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
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

  // Account identifiers for display & unlinking
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

  // Unlinking is permitted when user has at least 2 connected identity methods
  const totalLinkedCount =
    (hasLinkedExternalWallet ? 1 : 0) +
    (hasLinkedEmail ? 1 : 0) +
    (hasLinkedGoogle ? 1 : 0) +
    (hasLinkedPasskey ? 1 : 0) +
    (embeddedWalletAddress ? 1 : 0);
  const canUnlink = totalLinkedCount > 1;

  const handleUnlinkWallet = async (address: string) => {
    try {
      setDropdownOpen(false);
      await unlinkWallet(address);
    } catch (err) {
      console.warn("Could not unlink wallet:", err);
    }
  };

  const handleUnlinkEmail = async (emailAddr: string) => {
    try {
      setDropdownOpen(false);
      await unlinkEmail(emailAddr);
    } catch (err) {
      console.warn("Could not unlink email:", err);
    }
  };

  const handleUnlinkGoogle = async (subject?: string) => {
    try {
      setDropdownOpen(false);
      await unlinkGoogle(subject);
    } catch (err) {
      console.warn("Could not unlink Google account:", err);
    }
  };

  const handleUnlinkPasskey = async (passkeyId?: string) => {
    try {
      setDropdownOpen(false);
      await unlinkPasskey(passkeyId);
    } catch (err) {
      console.warn("Could not unlink passkey:", err);
    }
  };

  const externalWalletNickname = linkedExternalWalletAddress
    ? getNickname(linkedExternalWalletAddress)
    : null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 rounded-lg border-2 border-[#121212] bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wider text-[#121212] shadow-[2px_2px_0_0_#121212] transition hover:bg-[#f3f4f6] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
        aria-label="User account and wallet menu"
        aria-expanded={dropdownOpen}
      >
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#836EF9] text-white font-black text-[10px] border border-[#121212]">
          {displayName.slice(0, 1).toUpperCase()}
        </div>
        <span className="max-w-[120px] truncate">{displayName}</span>
        {hasConnectedEvmWallet && (
          <span
            className="h-2 w-2 rounded-full bg-emerald-500 border border-[#121212]"
            title="EVM Wallet Connected"
          />
        )}
        <ChevronDown
          className={`h-3 w-3 transition-transform text-[#121212] ${dropdownOpen ? "rotate-180" : ""}`}
        />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-[340px] max-w-[calc(100vw-2rem)] origin-top-right rounded-xl border-2 border-[#121212] bg-white p-3 shadow-[4px_4px_0_0_#121212] z-50 animate-in fade-in zoom-in-95 duration-100 max-h-[85vh] overflow-y-auto">
          {/* Section 1: Clario Account (App Identity & Saved Workspace) */}
          <div className="border-b-2 border-[#121212] pb-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono font-black uppercase tracking-wider text-[#836EF9] bg-[#f3f0ff] px-2 py-0.5 rounded border border-[#836EF9]/30">
                Clario Account
              </span>
              <span className="text-[9px] font-mono font-bold uppercase text-slate-500">
                Workspace Owner
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-black uppercase tracking-wider text-[#121212] truncate">
                    {displayName}
                  </p>
                  <button
                    onClick={() => {
                      setTargetWalletForEdit(activeWalletAddress);
                      setNicknameModalOpen(true);
                    }}
                    className="text-slate-400 hover:text-[#836EF9] p-0.5 transition cursor-pointer"
                    title="Set custom nickname"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
                {primaryEmail ? (
                  <p className="text-[11px] text-slate-600 truncate mt-0.5 font-mono">
                    {primaryEmail}
                  </p>
                ) : user?.id ? (
                  <p className="text-[10px] text-slate-500 truncate mt-0.5 font-mono">
                    ID: {user.id.slice(0, 18)}...
                  </p>
                ) : null}
              </div>
            </div>

            {/* Section 2: Connected Blockchain Wallet */}
            {hasConnectedEvmWallet && activeWalletAddress ? (
              <div className="mt-2.5 rounded-lg bg-[#f8f9fa] p-2 border-2 border-[#121212]">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider font-bold mb-1">
                  <span className="text-slate-600 flex items-center gap-1">
                    <Wallet className="h-3 w-3 text-[#836EF9]" />
                    Connected EVM Wallet
                  </span>
                  <span className="inline-flex items-center gap-1 rounded bg-[#836EF9]/10 px-1.5 py-0.5 text-[9px] font-black text-[#836EF9] border border-[#836EF9]/40">
                    <MonadLogo className="h-2 w-2" />
                    Monad Testnet
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 bg-white px-2 py-1 rounded border border-[#121212]">
                  <div className="min-w-0">
                    {nickname && (
                      <span className="block text-[11px] font-black uppercase text-[#836EF9] truncate">
                        {nickname}
                      </span>
                    )}
                    <span className="font-mono text-[#121212] font-bold text-xs">
                      {activeWalletAddress.slice(0, 6)}...
                      {activeWalletAddress.slice(-4)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={`https://testnet.monadexplorer.com/address/${activeWalletAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-500 hover:text-black p-0.5 transition cursor-pointer"
                      title="View on Monad Explorer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="relative size-6 flex items-center justify-center p-0.5 text-slate-600 hover:text-black transition-colors duration-150 cursor-pointer after:absolute after:top-1/2 after:left-1/2 after:size-10 after:-translate-1/2"
                      title="Copy wallet address"
                      aria-label="Copy wallet address"
                    >
                      <ContextualIconSwap
                        isActive={copied}
                        ActiveIcon={Check}
                        InactiveIcon={Copy}
                        className="h-3.5 w-3.5"
                        activeClassName="text-emerald-600"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => disconnectWallet(activeWalletAddress)}
                      className="text-[9px] font-mono font-black uppercase text-slate-400 hover:text-red-600 px-1 py-0.5 transition hover:underline cursor-pointer"
                      title="Disconnect wallet"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-2.5 rounded-lg bg-[#fbf9fe] p-2.5 border-2 border-dashed border-[#121212]">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider font-bold mb-1">
                  <span className="text-slate-600 flex items-center gap-1">
                    <Wallet className="h-3 w-3 text-slate-400" />
                    Blockchain Account
                  </span>
                  <span className="rounded bg-slate-100 text-slate-600 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase border border-slate-300">
                    Not Connected
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 font-mono leading-tight mb-2.5">
                  Connect an EVM wallet to fetch transaction history and anchor receipts on Monad.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false);
                    connectEvmWallet();
                  }}
                  className="w-full border-2 border-[#121212] bg-[#836EF9] hover:bg-[#725aeb] text-white font-mono font-black uppercase text-xs tracking-wider py-2 px-3 rounded-lg shadow-[2px_2px_0_0_#121212] flex items-center justify-center gap-2 transition active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
                >
                  <Wallet className="h-3.5 w-3.5" />
                  <span>Connect Wallet</span>
                </button>
              </div>
            )}
          </div>

          {/* Connected Wallets Switcher (if multiple wallets connected) */}
          {hasMultipleWallets && (
            <div className="py-2 border-b-2 border-[#121212]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono uppercase font-black text-[#121212] tracking-wider flex items-center gap-1">
                  <ArrowRightLeft className="h-3 w-3 text-[#836EF9]" />
                  Switch Active Wallet ({wallets.length})
                </span>
              </div>
              <div className="space-y-1">
                {wallets.map((w: ConnectedWallet) => {
                  const isCurrent =
                    w.address.toLowerCase() ===
                    activeWalletAddress?.toLowerCase();
                  const isEmbedded = w.walletClientType === "privy";
                  const wNickname = getNickname(w.address);
                  const label = wNickname
                    ? wNickname
                    : isEmbedded
                      ? "Embedded Monad"
                      : w.walletClientType || "External WALLET";

                  return (
                    <div
                      key={w.address}
                      className={`flex items-center justify-between px-2 py-1 rounded-lg border text-xs transition ${
                        isCurrent
                          ? "bg-[#836EF9]/10 border-[#836EF9] font-bold"
                          : "bg-white border-[#e5e7eb] hover:border-[#121212]"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-mono text-[11px] truncate">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${isCurrent ? "bg-emerald-500" : "bg-slate-300"}`}
                        />
                        <span className="font-sans font-bold capitalize text-[#121212] truncate max-w-[90px]">
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
            <div className="py-2 border-b-2 border-[#121212] space-y-1">
              <span className="text-[10px] font-mono uppercase font-black text-[#121212] tracking-wider block mb-1">
                Embedded Wallet & Fast Signing
              </span>

              {/* 1-Click Session Signing Quick Toggle */}
              <div className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-bold bg-[#fbf9fe] border border-[#836EF9]/30">
                <div className="flex items-center gap-1.5">
                  <Zap
                    className={`h-3.5 w-3.5 ${
                      isSessionDelegated
                        ? "text-[#836EF9] fill-[#836EF9]"
                        : "text-slate-400"
                    }`}
                  />
                  <div>
                    <span className="block text-[11px] font-black uppercase text-[#121212]">
                      1-Click Fast Mode
                    </span>
                    <span className="block text-[9px] font-mono text-slate-500">
                      {isSessionDelegated ? "Silent auto-sign" : "Modal prompt"}
                    </span>
                  </div>
                </div>
                {canDelegate && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (isSessionDelegated) {
                        await revokeSessionSigning();
                      } else {
                        await enableSessionSigning();
                      }
                    }}
                    className={`text-[9px] font-mono uppercase font-black px-2 py-0.5 rounded border transition cursor-pointer shadow-[1px_1px_0_0_#121212] active:translate-x-[1px] active:translate-y-[1px] ${
                      isSessionDelegated
                        ? "bg-emerald-50 text-emerald-800 border-emerald-400 hover:bg-red-50 hover:text-red-700 hover:border-red-400"
                        : "bg-[#836EF9] text-white border-[#121212] hover:bg-[#7257f8]"
                    }`}
                  >
                    {isSessionDelegated ? "Active" : "Enable"}
                  </button>
                )}
              </div>

              {/* Fund Wallet Action */}
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  if (activeWalletAddress || embeddedWalletAddress) {
                    fundWallet({
                      address: activeWalletAddress || embeddedWalletAddress!,
                    });
                  }
                }}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs font-bold text-[#121212] hover:bg-emerald-50 hover:text-emerald-700 transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Coins className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Fund Wallet (Privy)</span>
                </div>
                <span className="text-[9px] font-mono uppercase bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">
                  On-Ramp
                </span>
              </button>

              <button
                onClick={() => {
                  setDropdownOpen(false);
                  setWalletRecovery();
                }}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs font-bold text-[#121212] hover:bg-[#836EF9]/10 hover:text-[#836EF9] transition"
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
                className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs font-bold text-[#121212] hover:bg-slate-100 transition"
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

          {/* Progressive Account Linking & Status */}
          <div className="py-2 border-b-2 border-[#121212] space-y-1">
            <span className="text-[10px] font-mono uppercase font-black text-[#121212] tracking-wider block mb-1">
              Linked Accounts
            </span>

            {/* External Wallet */}
            {hasLinkedExternalWallet ? (
              <div className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs font-bold text-[#121212] bg-[#f8f9fa] border border-slate-200">
                <div className="flex items-center gap-2 min-w-0">
                  <WalletCards className="h-3.5 w-3.5 text-[#836EF9] shrink-0" />
                  <div className="min-w-0">
                    <span className="block truncate">
                      {externalWalletNickname || "External Wallet"}
                    </span>
                    {linkedExternalWalletAddress && (
                      <span className="block text-[10px] font-mono text-slate-400 font-normal">
                        {linkedExternalWalletAddress.slice(0, 6)}...
                        {linkedExternalWalletAddress.slice(-4)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] font-mono uppercase bg-emerald-50 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                    Connected
                  </span>
                  {linkedExternalWalletAddress && (
                    <button
                      onClick={() => {
                        setTargetWalletForEdit(linkedExternalWalletAddress);
                        setNicknameModalOpen(true);
                      }}
                      className="text-[9px] font-mono font-bold uppercase text-[#836EF9] hover:underline px-1 py-0.5"
                      title="Set / edit nickname"
                    >
                      {externalWalletNickname ? "Edit" : "Name"}
                    </button>
                  )}
                  {canUnlink && linkedExternalWalletAddress && (
                    <button
                      onClick={() => handleUnlinkWallet(linkedExternalWalletAddress)}
                      className="text-[9px] font-mono font-black uppercase text-slate-400 hover:text-red-600 px-1 py-0.5 transition hover:underline"
                      title="Unlink external wallet"
                    >
                      Unlink
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  linkWallet();
                }}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs font-bold text-[#121212] hover:bg-[#836EF9]/10 hover:text-[#836EF9] transition border border-transparent hover:border-[#836EF9]/30"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <WalletCards className="h-3.5 w-3.5 text-[#836EF9] shrink-0" />
                  <span>External Wallet</span>
                </div>
                <span className="text-[9px] font-mono uppercase text-[#836EF9] bg-[#836EF9]/10 font-black px-2 py-0.5 rounded border border-[#836EF9]/30 hover:bg-[#836EF9] hover:text-white transition shrink-0">
                  Link
                </span>
              </button>
            )}

            {/* Email */}
            {hasLinkedEmail ? (
              <div className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs font-bold text-[#121212] bg-[#f8f9fa] border border-slate-200">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                  <div className="min-w-0">
                    <span className="block truncate">Email</span>
                    {linkedEmailAddress && (
                      <span className="block text-[10px] font-mono text-slate-400 font-normal truncate max-w-[130px]">
                        {linkedEmailAddress}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] font-mono uppercase bg-emerald-50 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                    Connected
                  </span>
                  {canUnlink && linkedEmailAddress && (
                    <button
                      onClick={() => handleUnlinkEmail(linkedEmailAddress)}
                      className="text-[9px] font-mono font-black uppercase text-slate-400 hover:text-red-600 px-1 py-0.5 transition hover:underline"
                      title="Unlink email"
                    >
                      Unlink
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  linkEmail();
                }}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs font-bold text-[#121212] hover:bg-slate-100 transition border border-transparent hover:border-slate-300"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                  <span>Email</span>
                </div>
                <span className="text-[9px] font-mono uppercase text-[#836EF9] bg-[#836EF9]/10 font-black px-2 py-0.5 rounded border border-[#836EF9]/30 hover:bg-[#836EF9] hover:text-white transition shrink-0">
                  Link
                </span>
              </button>
            )}

            {/* Google */}
            {hasLinkedGoogle ? (
              <div className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs font-bold text-[#121212] bg-[#f8f9fa] border border-slate-200">
                <div className="flex items-center gap-2 min-w-0">
                  <Globe className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  <div className="min-w-0">
                    <span className="block truncate">Google</span>
                    {linkedGoogleEmail && (
                      <span className="block text-[10px] font-mono text-slate-400 font-normal truncate max-w-[130px]">
                        {linkedGoogleEmail}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] font-mono uppercase bg-emerald-50 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                    Connected
                  </span>
                  {canUnlink && (
                    <button
                      onClick={() => handleUnlinkGoogle(linkedGoogleSubject)}
                      className="text-[9px] font-mono font-black uppercase text-slate-400 hover:text-red-600 px-1 py-0.5 transition hover:underline"
                      title="Unlink Google account"
                    >
                      Unlink
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  linkGoogle();
                }}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs font-bold text-[#121212] hover:bg-slate-100 transition border border-transparent hover:border-slate-300"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Globe className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  <span>Google</span>
                </div>
                <span className="text-[9px] font-mono uppercase text-[#836EF9] bg-[#836EF9]/10 font-black px-2 py-0.5 rounded border border-[#836EF9]/30 hover:bg-[#836EF9] hover:text-white transition shrink-0">
                  Link
                </span>
              </button>
            )}

            {/* Passkey */}
            {hasLinkedPasskey ? (
              <div className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs font-bold text-[#121212] bg-[#f8f9fa] border border-slate-200">
                <div className="flex items-center gap-2 min-w-0">
                  <Fingerprint className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <div>
                    <span className="block truncate">Passkey</span>
                    <span className="block text-[10px] font-mono text-slate-400 font-normal">
                      Biometrics / Device
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] font-mono uppercase bg-emerald-50 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                    Configured
                  </span>
                  {canUnlink && (
                    <button
                      onClick={() => handleUnlinkPasskey(linkedPasskeyId)}
                      className="text-[9px] font-mono font-black uppercase text-slate-400 hover:text-red-600 px-1 py-0.5 transition hover:underline"
                      title="Unlink passkey"
                    >
                      Unlink
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  linkPasskey();
                }}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs font-bold text-[#121212] hover:bg-slate-100 transition border border-transparent hover:border-slate-300"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Fingerprint className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                  <span>Passkey</span>
                </div>
                <span className="text-[9px] font-mono uppercase text-[#836EF9] bg-[#836EF9]/10 font-black px-2 py-0.5 rounded border border-[#836EF9]/30 hover:bg-[#836EF9] hover:text-white transition shrink-0">
                  Link
                </span>
              </button>
            )}
          </div>

          {/* Documentation & Security Info */}
          <div className="py-1.5 border-b-2 border-[#121212] space-y-0.5">
            <Link
              href="/docs"
              onClick={() => setDropdownOpen(false)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-bold text-[#121212] hover:bg-slate-100 transition border border-transparent hover:border-slate-300"
            >
              <div className="flex items-center gap-2 min-w-0">
                <BookOpen className="h-3.5 w-3.5 text-[#836EF9] shrink-0" />
                <span>Documentation</span>
              </div>
              <span className="text-[9px] font-mono uppercase bg-purple-50 text-[#836EF9] px-1.5 py-0.5 rounded border border-purple-200">
                Guides
              </span>
            </Link>

            <button
              onClick={() => {
                setDropdownOpen(false);
                router.push("/settings");
              }}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-bold text-[#121212] hover:bg-slate-100 transition border border-transparent hover:border-slate-300"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Settings className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                <span>Account Settings</span>
              </div>
            </button>
          </div>

          {/* Session Teardown & Logout */}
          <div className="pt-1.5">
            <button
              onClick={async () => {
                setDropdownOpen(false);
                await logout();
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider text-red-600 hover:bg-red-50 hover:text-red-700 border border-transparent hover:border-red-200 transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Edit Nickname Modal */}
      <EditNicknameModal
        isOpen={nicknameModalOpen}
        onClose={() => setNicknameModalOpen(false)}
        walletAddress={targetWalletForEdit}
        currentNickname={targetWalletForEdit ? getNickname(targetWalletForEdit) : nickname}
        onSave={(newNickname, targetAddress) => {
          setNickname(newNickname, targetAddress || undefined);
        }}
      />
    </div>
  );
}

