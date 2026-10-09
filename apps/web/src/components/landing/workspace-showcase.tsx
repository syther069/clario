"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
} from "motion/react";
import {
  UserRound,
  BriefcaseBusiness,
  UsersRound,
  Building2,
  ArrowRight,
  Check,
  BadgeCheck,
} from "lucide-react";
import { WORKSPACES_DATA, type WorkspaceModeData } from "./workspaces-data";

const MODE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  personal: UserRound,
  freelancer: BriefcaseBusiness,
  family: UsersRound,
  business: Building2,
};

export function WorkspaceShowcase() {
  const [activeTabId, setActiveTabId] = useState<string>("personal");
  const [direction, setDirection] = useState<number>(0);
  const shouldReduceMotion = useReducedMotion();

  const currentIndex = WORKSPACES_DATA.findIndex((w) => w.id === activeTabId);
  const activeMode: WorkspaceModeData =
    WORKSPACES_DATA[currentIndex] ?? WORKSPACES_DATA[0]!;

  const handleSelectTab = (newId: string) => {
    const newIndex = WORKSPACES_DATA.findIndex((w) => w.id === newId);
    setDirection(newIndex > currentIndex ? 1 : -1);
    setActiveTabId(newId);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "ArrowRight") {
      const nextIndex = (index + 1) % WORKSPACES_DATA.length;
      handleSelectTab(WORKSPACES_DATA[nextIndex]!.id);
    } else if (e.key === "ArrowLeft") {
      const prevIndex =
        (index - 1 + WORKSPACES_DATA.length) % WORKSPACES_DATA.length;
      handleSelectTab(WORKSPACES_DATA[prevIndex]!.id);
    }
  };

  const slideVariants = {
    enter: (dir: number) => ({
      x: shouldReduceMotion ? 0 : dir > 0 ? 24 : -24,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.28,
        ease: "easeOut" as const,
      },
    },
    exit: (dir: number) => ({
      x: shouldReduceMotion ? 0 : dir > 0 ? -24 : 24,
      opacity: 0,
      transition: {
        duration: 0.22,
        ease: "easeOut" as const,
      },
    }),
  };

  return (
    <section
      id="modes"
      className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t-2 border-[#121212]"
    >
      <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
        <span className="font-mono text-xs font-black uppercase tracking-wider text-[#836EF9] bg-[#f5f3ff] px-3 py-1 rounded-md border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] inline-flex items-center gap-1.5 mb-3">
          Dedicated Workspaces
        </span>
        <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-[#121212] leading-tight [text-wrap:balance]">
          Four Workspaces. One Private System.
        </h2>
        <p className="text-base sm:text-lg text-gray-700 font-medium mt-3 leading-relaxed">
          Switch between personal cashflow, freelance client billing, household budgets, and team expenses with one click.
        </p>
      </div>

      {/* Tab Bar with Sliding Active Indicator */}
      <div
        role="tablist"
        aria-label="Workspace modes"
        className="flex flex-wrap items-center justify-center gap-1.5 mb-8 p-1.5 bg-[#f8f9fa] rounded-xl max-w-fit mx-auto border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]"
      >
        {WORKSPACES_DATA.map((mode, idx) => {
          const Icon = MODE_ICONS[mode.id] ?? UserRound;
          const isActive = activeTabId === mode.id;

          return (
            <button
              key={mode.id}
              role="tab"
              id={`tab-${mode.id}`}
              aria-controls={`panel-${mode.id}`}
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              type="button"
              onClick={() => handleSelectTab(mode.id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`relative flex items-center gap-2 pl-3.5 pr-4 py-2 rounded-lg font-mono text-xs font-black uppercase tracking-wider transition-colors duration-150 ease-out active:scale-[0.96] cursor-pointer focus:outline-none ${
                isActive
                  ? "bg-[#836EF9] !text-white border-2 border-[#121212] shadow-[1px_1px_0_0_#121212]"
                  : "!text-[#121212] hover:!text-[#836EF9] border-2 border-transparent"
              }`}
            >
              <span className="relative z-10 flex items-center gap-2">
                <Icon className={`h-4 w-4 stroke-[2.5] ${isActive ? "!text-white" : "text-[#836EF9]"}`} aria-hidden="true" />
                <span>{mode.name}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Single Large Workspace Card */}
      <div
        id={`panel-${activeMode.id}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeMode.id}`}
        className="rounded-2xl border-2 border-[#121212] bg-white p-6 sm:p-10 shadow-[6px_6px_0_0_#121212] overflow-hidden"
      >
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={activeMode.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center"
          >
            {/* Left Column: Promise, Description, Best For, Situations, and Link */}
            <div className="lg:col-span-7 flex flex-col items-start gap-5">
              <div>
                <span className="font-mono text-xs font-black uppercase tracking-wider text-[#836EF9] bg-[#f5f3ff] px-2.5 py-1 rounded border-2 border-[#121212] shadow-[1px_1px_0_0_#121212]">
                  {activeMode.name} Mode
                </span>
                <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#121212] mt-3 leading-snug">
                  {activeMode.promise}
                </h3>
              </div>

              <p className="text-gray-700 text-sm sm:text-base leading-relaxed font-normal">
                {activeMode.description}
              </p>

              {/* Best for line */}
              <div className="text-xs font-mono font-bold text-[#121212] bg-[#f8f9fa] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] rounded-xl px-4 py-2.5 w-full uppercase tracking-wider">
                <span className="text-[#836EF9] font-black">Best for:</span>{" "}
                <span className="text-gray-800">{activeMode.bestFor}</span>
              </div>

              {/* How people use it: 3 situations */}
              <div className="w-full pt-1 space-y-2.5">
                <span className="font-mono text-xs font-black uppercase tracking-wider text-[#121212] block mb-2">
                  How People Use It
                </span>
                {activeMode.useCases.map((useCase, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.25,
                      delay: shouldReduceMotion ? 0 : idx * 0.04,
                      ease: "easeOut",
                    }}
                    className="flex items-start gap-2.5 text-sm text-gray-800 font-medium"
                  >
                    <div className="h-5 w-5 rounded-md bg-[#f5f3ff] text-[#836EF9] flex items-center justify-center shrink-0 mt-0.5 border-2 border-[#121212] shadow-[1px_1px_0_0_#121212]">
                      <Check className="h-3 w-3 stroke-[2.5]" aria-hidden="true" />
                    </div>
                    <span className="leading-snug">{useCase}</span>
                  </motion.div>
                ))}
              </div>

              {/* Single text link at the bottom */}
              <div className="pt-2">
                <Link
                  href={`/?mode=${activeMode.id}`}
                  className="inline-flex items-center gap-2 font-mono text-xs font-black uppercase tracking-wider !text-[#836EF9] hover:underline transition-colors"
                >
                  <span className="!text-[#836EF9]">{activeMode.linkText}</span>
                  <ArrowRight className="h-4 w-4 stroke-[2.5] !text-[#836EF9]" aria-hidden="true" />
                </Link>
              </div>
            </div>

            {/* Right Column: Product Preview Mock */}
            <div data-image-surface className="lg:col-span-5 rounded-2xl border-2 border-[#121212] bg-white overflow-hidden shadow-[4px_4px_0_0_#121212] w-full">
              {/* Montally Frame Header */}
              <div className="bg-[#121212] border-b-2 border-[#121212] px-3.5 py-2.5 flex items-center justify-between text-xs text-white">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-black uppercase tracking-wider bg-[#836EF9] text-white px-2 py-0.5 rounded">
                    Workspace Preview
                  </span>
                </div>
                <span className="font-mono text-[11px] text-gray-300">
                  mode={activeMode.id}
                </span>
                <span className="text-[10px] font-mono font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded">
                  Live Testnet
                </span>
              </div>

              <div className="p-5 space-y-4 bg-white">
                <div className="flex items-center justify-between border-b-2 border-[#121212]/10 pb-3">
                  <span className="font-mono text-xs font-black text-[#121212] uppercase tracking-wider">
                    {activeMode.name} Workspace
                  </span>
                  <span className="font-mono text-xs font-black uppercase tracking-wider bg-[#f5f3ff] text-[#836EF9] border border-[#836EF9]/50 px-2 py-0.5 rounded">
                    {activeMode.preview.badge}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#f8f9fa] rounded-xl border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] p-3">
                    <span className="font-mono text-[11px] text-gray-600 font-bold uppercase tracking-wider block">
                      {activeMode.preview.stat1Label}
                    </span>
                    <span className="text-xl font-mono font-black tabular-nums text-[#121212] mt-1 block">
                      {activeMode.preview.stat1}
                    </span>
                  </div>
                  <div className="bg-[#f8f9fa] rounded-xl border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] p-3">
                    <span className="font-mono text-[11px] text-gray-600 font-bold uppercase tracking-wider block">
                      {activeMode.preview.stat2Label}
                    </span>
                    <span className="text-xl font-mono font-black tabular-nums text-[#836EF9] mt-1 block">
                      {activeMode.preview.stat2}
                    </span>
                  </div>
                </div>

                <div className="bg-[#f8f9fa] rounded-xl border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] p-3">
                  <span className="font-mono text-[11px] text-gray-600 font-bold uppercase tracking-wider block mb-1">
                    Latest Activity
                  </span>
                  <p className="text-xs font-bold text-[#121212] truncate">
                    {activeMode.preview.recent}
                  </p>
                  <div className="flex items-center justify-between text-xs font-mono font-bold uppercase mt-2 pt-2 border-t border-[#121212]/10">
                    <span className="text-gray-500">Status:</span>
                    <span className="text-emerald-700 inline-flex items-center gap-1 font-black">
                      <BadgeCheck className="h-3.5 w-3.5 stroke-[2.5]" aria-hidden="true" />
                      {activeMode.preview.recentStatus}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
