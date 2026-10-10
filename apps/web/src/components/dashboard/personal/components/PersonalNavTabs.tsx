"use client";

import React from "react";
import {
  LayoutDashboard,
  TrendingDown,
  TrendingUp,
  ChartNoAxesCombined,
  RotateCcw,
  Receipt,
  ArrowLeftRight,
  ShieldCheck,
} from "lucide-react";
import type { PersonalView } from "@/lib/supabase/types";
import { AnimatedBackground } from "@/components/ui/motion";

export interface PersonalNavTabsProps {
  subLedger: "all" | "fiat" | "onchain";
  currentView: PersonalView;
  onViewSelect: (view: PersonalView) => void;
  counts: {
    expenses: number;
    income: number;
    budgets: number;
    recurring: number;
    receipts: number;
    onchain: number;
  };
}

export function PersonalNavTabs({
  subLedger,
  currentView,
  onViewSelect,
  counts,
}: PersonalNavTabsProps) {
  const tabs =
    subLedger === "onchain"
      ? [
          { id: "overview" as PersonalView, label: "Web3 Overview", icon: LayoutDashboard },
          {
            id: "expenses" as PersonalView,
            label: "On-Chain Activity",
            icon: ArrowLeftRight,
            count: counts.onchain,
          },
          {
            id: "receipts" as PersonalView,
            label: "Monad Proofs",
            icon: ShieldCheck,
            count: counts.receipts,
          },
        ]
      : [
          { id: "overview" as PersonalView, label: "Overview", icon: LayoutDashboard },
          {
            id: "expenses" as PersonalView,
            label: "Expenses",
            icon: TrendingDown,
            count: counts.expenses,
          },
          {
            id: "income" as PersonalView,
            label: "Income",
            icon: TrendingUp,
            count: counts.income,
          },
          {
            id: "budgets" as PersonalView,
            label: "Budgets",
            icon: ChartNoAxesCombined,
            count: counts.budgets,
          },
          {
            id: "recurring" as PersonalView,
            label: "Recurring",
            icon: RotateCcw,
            count: counts.recurring,
          },
          {
            id: "receipts" as PersonalView,
            label: "Saved Receipts",
            icon: Receipt,
            count: counts.receipts,
          },
        ];

  return (
    <nav
      aria-label="Personal Navigation"
      className="p-1.5 bg-white border-2 border-[#121212] shadow-[3px_3px_0_0_#121212] rounded-xl flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none w-fit max-w-full"
    >
      <AnimatedBackground
        defaultValue={currentView}
        className="bg-[#836EF9] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] rounded-lg"
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 30,
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentView === tab.id;
          return (
            <button
              key={tab.id}
              data-id={tab.id}
              onClick={() => onViewSelect(tab.id)}
              className={`group inline-flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-xs font-mono font-black uppercase tracking-wider transition-colors shrink-0 cursor-pointer ${
                isActive ? "text-white" : "text-[#121212] hover:bg-[#f3f4f6]"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 transition-colors ${
                  isActive ? "text-white" : "text-[#836EF9] group-hover:text-[#7257f8]"
                }`}
                aria-hidden="true"
              />
              <span className="shrink-0">{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 text-[10px] font-mono font-black rounded-full border border-[#121212] leading-none shrink-0 transition-colors ${
                    isActive
                      ? "bg-white text-[#121212]"
                      : "bg-[#f3f0ff] text-[#836EF9]"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </AnimatedBackground>
    </nav>
  );
}
