"use client";

import React from "react";
import Link from "next/link";
import { ModeSwitcher } from "./mode-switcher";
import { UserButton } from "../auth/user-button";
import { MonadLogo } from "@/components/ui/crypto-icon";
import { Bot, Compass } from "lucide-react";
import type { PlatformMode } from "@/lib/supabase/types";
import { ClarioButton, ClarioBadge } from "@/components/ui/clario-ui";

interface ModeHeaderProps {
  currentMode: PlatformMode;
  onModeChange: (mode: PlatformMode) => void;
  onOpenCopilot?: () => void;
}

export function ModeHeader({
  currentMode,
  onModeChange,
  onOpenCopilot,
}: ModeHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 pb-4 border-b-2 border-[#121212]/15">
      {/* Left: Clario Brand + Mode Selector */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#836EF9] text-white font-black text-lg border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] transition group-hover:translate-x-[1px] group-hover:translate-y-[1px] group-hover:shadow-[1px_1px_0_0_#121212]">
            C
          </div>
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

      {/* Right: Landing Tour, AI Copilot & Auth */}
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <Link href="/landing">
          <ClarioButton
            variant="secondary"
            size="sm"
            leftIcon={<Compass className="h-3.5 w-3.5 text-[#836EF9]" />}
          >
            Tour
          </ClarioButton>
        </Link>

        {onOpenCopilot && (
          <ClarioButton
            variant="primary"
            size="sm"
            onClick={onOpenCopilot}
            leftIcon={
              <Bot className="h-3.5 w-3.5 text-white" aria-hidden="true" />
            }
          >
            Copilot
          </ClarioButton>
        )}

        <UserButton />
      </div>
    </div>
  );
}
