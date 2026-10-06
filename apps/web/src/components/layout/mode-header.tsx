"use client";

import React from "react";
import Link from "next/link";
import { ModeSwitcher } from "./mode-switcher";
import { UserButton } from "../auth/user-button";
import { MonadLogo } from "@/components/ui/crypto-icon";
import { Bot, Compass, BookOpen, Plus, Receipt, ShieldCheck, BarChart3 } from "lucide-react";
import type { PlatformMode } from "@/lib/supabase/types";
import { ClarioButton, ClarioBadge } from "@/components/ui/clario-ui";
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
  onOpenCopilot,
  activeTab = "expenses",
  onTabChange,
  onLogExpense,
}: ModeHeaderProps) {
  const PILLARS: Array<{ id: CorePillar; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: "expenses", label: "Expenses", icon: Receipt },
    { id: "vault", label: "Vault & Proofs", icon: ShieldCheck },
    { id: "insights", label: "Insights", icon: BarChart3 },
  ];

  return (
    <header className="flex flex-col gap-3.5 pb-4 border-b-2 border-[#121212]/15">
      {/* Top Bar: Brand, Mode Switcher, and User Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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

        {/* Center/Desktop Navigation: 3 Core Pillars (Hick's Law - Reduced to 3 clear pillars) */}
        {onTabChange && (
          <nav aria-label="Core Navigation" className="hidden md:flex items-center gap-1.5 bg-[#f5f3ff] p-1 rounded-xl border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
            {PILLARS.map((p) => {
              const Icon = p.icon;
              const isActive = activeTab === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => onTabChange(p.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#836EF9] text-white border border-[#121212] shadow-[1px_1px_0_0_#121212]"
                      : "text-[#121212] hover:bg-white/80"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Right: Primary Action (Fitts's Law) + Secondary Tools */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {onLogExpense && (
            <button
              onClick={onLogExpense}
              className="flex items-center gap-1.5 rounded-lg border-2 border-[#121212] bg-[#836EF9] px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-white shadow-[2px_2px_0_0_#121212] transition hover:bg-[#7257f8] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>Log Expense</span>
            </button>
          )}

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
              variant="secondary"
              size="sm"
              onClick={onOpenCopilot}
              leftIcon={
                <Bot className="h-3.5 w-3.5 text-[#836EF9]" aria-hidden="true" />
              }
            >
              AI
            </ClarioButton>
          )}

          <UserButton />
        </div>
      </div>

      {/* Mobile/Tablet Core Navigation: 3 Core Pillars */}
      {onTabChange && (
        <div className="flex md:hidden items-center justify-around gap-1 bg-[#f5f3ff] p-1 rounded-xl border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            const isActive = activeTab === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onTabChange(p.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#836EF9] text-white border border-[#121212] shadow-[1px_1px_0_0_#121212]"
                    : "text-[#121212] hover:bg-white/80"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}
