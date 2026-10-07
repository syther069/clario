"use client";

import React from "react";
import Link from "next/link";
import { ModeSwitcher } from "./mode-switcher";
import { UserButton } from "../auth/user-button";
import { MonadLogo } from "@/components/ui/crypto-icon";
import { Lock } from "lucide-react";
import type { PlatformMode } from "@/lib/supabase/types";
import { ClarioBadge } from "@/components/ui/clario-ui";
import { ClarioLogo } from "@/components/ui/clario-logo";

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
}: ModeHeaderProps) {
  return (
    <header className="pb-3 border-b-2 border-[#121212]/15">
      {/* Top Bar: Brand, Mode Switcher, and User Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Left: Clario Brand (redirects to /landing) + Mode Selector */}
        <div className="flex items-center gap-3">
          <Link
            href="/landing"
            className="flex items-center gap-2.5 group"
            title="Return to Clario Landing Page"
          >
            <ClarioLogo
              size={36}
              className="transition group-hover:translate-x-[1px] group-hover:translate-y-[1px]"
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

        {/* Right: Security Badge / Lock + User Authentication */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          {/* Subtle Non-Custodial Vault Indicator */}
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-[#121212]/20 bg-white/60 text-[#121212] text-xs font-mono text-[11px]"
            title="Non-custodial cryptographic vault on Monad. Private keys never leave your device."
          >
            <Lock className="h-3 w-3 text-emerald-600" />
            <span className="hidden md:inline text-slate-600">Vault secured</span>
          </div>

          <UserButton />
        </div>
      </div>
    </header>
  );
}
