"use client";

import React from "react";
import Link from "next/link";
import { ModeSwitcher } from "./mode-switcher";
import { UserButton } from "../auth/user-button";
import { MonadLogo } from "@/components/ui/crypto-icon";
import { Bot, Compass, BookOpen } from "lucide-react";
import type { PlatformMode } from "@/lib/supabase/types";
import { ClarioButton, ClarioBadge } from "@/components/ui/clario-ui";
import { ClarioLogo } from "@/components/ui/clario-logo";

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

      {/* Right: Landing Tour, Docs, AI Copilot & Auth */}
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <Link href="/docs">
          <ClarioButton
            variant="secondary"
            size="sm"
            leftIcon={<BookOpen className="h-3.5 w-3.5 text-[#836EF9]" />}
          >
            Docs
          </ClarioButton>
        </Link>

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
            Clario
          </ClarioButton>
        )}

        <UserButton />
      </div>
    </div>
  );
}
