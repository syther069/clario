"use client";

import type { PlatformMode } from "@/lib/supabase/types";
import {
  UserRound,
  BriefcaseBusiness,
  UsersRound,
  Building2,
  ChevronDown,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";

interface ModeSwitcherProps {
  currentMode: PlatformMode;
  onModeChange: (mode: PlatformMode) => void;
}

const MODES: Array<{
  id: PlatformMode;
  label: string;
  description: string;
  icon: typeof UserRound;
  badge?: string;
}> = [
  {
    id: "personal",
    label: "Personal",
    description: "Income, expenses, budgets & on-chain activity",
    icon: UserRound,
  },
  {
    id: "freelancer",
    label: "Freelancer",
    description: "Client expenses, invoices & receipts",
    icon: BriefcaseBusiness,
  },
  {
    id: "family",
    label: "Family",
    description: "Shared household expenses & budgets",
    icon: UsersRound,
  },
  {
    id: "business",
    label: "Business",
    description: "Team reimbursements, policies & audit log",
    icon: Building2,
  },
];

import { motion, AnimatePresence } from "motion/react";
import { AnimatedBackground } from "@/components/ui/motion/animated-background";

export function ModeSwitcher({ currentMode, onModeChange }: ModeSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const active = MODES.find((m) => m.id === currentMode) ?? MODES[0]!;
  const Icon = active.icon;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Switch platform mode. Currently in ${active.label} mode`}
        className="flex items-center gap-2 rounded-lg border-2 border-[#121212] bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wider text-[#121212] shadow-[2px_2px_0_0_#121212] transition hover:bg-[#f3f4f6] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none min-h-[36px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#836EF9]"
      >
        <Icon className="h-3.5 w-3.5 text-[#836EF9]" aria-hidden="true" />
        <span>{active.label}</span>
        {active.badge && (
          <span className="rounded bg-[#f3f0ff] px-1.5 py-0.5 text-[9px] font-black uppercase text-[#836EF9] border border-[#121212]">
            {active.badge}
          </span>
        )}
        <ChevronDown
          className={`h-3.5 w-3.5 text-[#121212] transition-transform ${isOpen ? "rotate-180 text-[#836EF9]" : ""}`}
          aria-hidden="true"
        />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ type: "spring", stiffness: 450, damping: 25 }}
            role="menu"
            className="absolute left-0 mt-2 w-72 origin-top-left rounded-xl border-2 border-[#121212] bg-white p-2 shadow-[4px_4px_0_0_#121212] z-50"
          >
            <div className="px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500 font-mono">
              Switch Platform Mode
            </div>
            <div className="space-y-1">
              {MODES.map((mode) => {
                const ModeIcon = mode.icon;
                const isSelected = mode.id === currentMode;
                return (
                  <button
                    key={mode.id}
                    role="menuitem"
                    onClick={() => {
                      onModeChange(mode.id);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition cursor-pointer ${
                      isSelected
                        ? "bg-[#f3f0ff] text-[#836EF9] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]"
                        : "text-[#121212] hover:bg-[#f9fafb] border-2 border-transparent"
                    }`}
                  >
                    <ModeIcon
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        isSelected ? "text-[#836EF9]" : "text-[#121212]"
                      }`}
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black uppercase tracking-wider">
                          {mode.label}
                        </span>
                        {mode.badge && (
                          <span className="rounded bg-[#836EF9] text-white px-1 py-0.2 text-[9px] font-black uppercase border border-[#121212]">
                            {mode.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {mode.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
