"use client";

import React from "react";
import Link from "next/link";
import { ModeSwitcher } from "./mode-switcher";
import { UserButton } from "../auth/user-button";
import { MonadLogo } from "@/components/ui/crypto-icon";
import { BookOpen, Plus, Wallet } from "lucide-react";
import type { PlatformMode } from "@/lib/supabase/types";
import { ClarioButton, ClarioBadge } from "@/components/ui/clario-ui";
import { ClarioLogo } from "@/components/ui/clario-logo";
import { useClarioAuth } from "@/lib/auth/use-clario-auth";
import { AlchemyNetworkBadge } from "../alchemy/alchemy-network-badge";

export type CorePillar = "expenses" | "vault" | "insights";

interface ModeHeaderProps {
  currentMode: PlatformMode;
  onModeChange: (mode: PlatformMode) => void;
  onOpenCopilot?: () => void;
  activeTab?: CorePillar;
  onTabChange?: (tab: CorePillar) => void;
  onLogExpense?: () => void;
}

export function ModeHeader({
  currentMode,
  onModeChange,
  onLogExpense,
}: ModeHeaderProps) {
  const { isAuthenticated, hasConnectedEvmWallet, connectEvmWallet } =
    useClarioAuth();

  return (
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3.5 border-b-2 border-[#121212]/15">
      {/* Left: Clario Brand (Navigates to Landing Page) + Mode Selector */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 group cursor-pointer transition-transform hover:-translate-y-0.5 active:translate-y-0"
          title="Go to Clario Landing Page"
        >
          <ClarioLogo
            size={36}
            className="transition group-hover:scale-105"
          />
          <div className="flex flex-col">
            <span className="text-base font-black tracking-wider text-[#121212] uppercase flex items-center gap-1.5 font-sans">
              Clario
              <ClarioBadge variant="purple" size="sm" className="gap-1">
                <MonadLogo className="h-2.5 w-2.5" />
                Monad
              </ClarioBadge>
            </span>
          </div>
        </Link>

        <div className="h-5 w-[2px] bg-[#121212]/20 mx-1" />

        {/* Page-Level Mode Selector */}
        <ModeSwitcher currentMode={currentMode} onModeChange={onModeChange} />
      </div>

      {/* Right: Primary Action + Docs + AI Assistant + Wallet Profile */}
      <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
        {onLogExpense && (
          <button
            onClick={onLogExpense}
            className="flex items-center gap-1.5 rounded-lg border-2 border-[#121212] bg-[#836EF9] px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-white shadow-[2px_2px_0_0_#121212] transition hover:bg-[#7257f8] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Log Expense</span>
          </button>
        )}

        <AlchemyNetworkBadge />

        <Link href="/docs">
          <ClarioButton
            variant="secondary"
            size="sm"
            leftIcon={<BookOpen className="h-3.5 w-3.5 text-[#836EF9]" />}
          >
            Docs
          </ClarioButton>
        </Link>

        {isAuthenticated && !hasConnectedEvmWallet && (
          <button
            type="button"
            onClick={connectEvmWallet}
            className="flex items-center gap-1.5 rounded-lg border-2 border-[#121212] bg-white hover:bg-[#f3f4f6] px-3 py-1.5 text-xs font-mono font-black uppercase tracking-wider text-[#121212] shadow-[2px_2px_0_0_#121212] transition active:translate-x-[1px] active:translate-y-[1px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#836EF9]"
            title="Connect your EVM wallet for on-chain actions"
          >
            <Wallet className="h-3.5 w-3.5 text-[#836EF9] stroke-[2.5]" />
            <span>Connect Wallet</span>
          </button>
        )}

        <UserButton />
      </div>
    </header>
  );
}
