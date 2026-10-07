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
      className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-gray-200"
    >
      <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
        <span className="text-xs font-semibold text-[#7C6CF6] bg-[#f5f3ff] px-2.5 py-1 rounded-md border border-[#e0dbfd] inline-block mb-3">
          Dedicated workspaces
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 leading-tight [text-wrap:balance]">
          Four workspaces. One private system.
        </h2>
        <p className="text-base sm:text-lg text-gray-600 font-normal mt-3 leading-relaxed">
          Switch between personal cashflow, freelance client billing, household budgets, and team expenses with one click.
        </p>
      </div>

      {/* Tab Bar with Sliding Active Indicator */}
      <div
        role="tablist"
        aria-label="Workspace modes"
        className="flex flex-wrap items-center justify-center gap-1.5 mb-8 p-1.5 bg-gray-100 rounded-xl max-w-fit mx-auto border border-gray-200"
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
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CF6] ${
                isActive ? "text-gray-900" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="workspace-active-tab-indicator"
                  className="absolute inset-0 bg-white rounded-lg shadow-xs"
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 32,
                  }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon className="h-4 w-4 text-[#7C6CF6]" aria-hidden="true" />
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
        className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-10 shadow-sm overflow-hidden"
      >
        <AnimatePresence mode="wait" custom={direction}>
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
                <span className="text-xs font-semibold text-[#7C6CF6] bg-[#f5f3ff] px-2.5 py-1 rounded-md border border-[#e0dbfd]">
                  {activeMode.name} Mode
                </span>
                <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-3 leading-snug">
                  {activeMode.promise}
                </h3>
              </div>

              <p className="text-gray-600 text-base leading-relaxed">
                {activeMode.description}
              </p>

              {/* Best for line */}
              <div className="text-sm font-medium text-gray-900 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 w-full">
                <span className="text-[#7C6CF6] font-bold">Best for:</span>{" "}
                <span className="text-gray-700">{activeMode.bestFor}</span>
              </div>

              {/* How people use it: 3 situations */}
              <div className="w-full pt-1 space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2">
                  How people use it
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
                    className="flex items-start gap-2.5 text-sm text-gray-700"
                  >
                    <div className="h-5 w-5 rounded-full bg-purple-50 text-[#7C6CF6] flex items-center justify-center shrink-0 mt-0.5 border border-purple-200">
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
                  className="inline-flex items-center gap-2 text-sm font-bold text-[#7C6CF6] hover:text-[#6c5be8] hover:underline transition-colors"
                >
                  <span>{activeMode.linkText}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>

            {/* Right Column: Product Preview Mock */}
            <div className="lg:col-span-5 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden shadow-xs w-full">
              {/* Browser Frame Header */}
              <div className="bg-gray-100 border-b border-gray-200 px-3 py-2 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                  <div className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                  <div className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                </div>
                <span className="font-mono text-[11px] text-gray-600 bg-white px-3 py-0.5 rounded border border-gray-200">
                  app.clario.finance/?mode={activeMode.id}
                </span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                  Live
                </span>
              </div>

              <div className="p-5 space-y-4 bg-white">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <span className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
                    {activeMode.name} Workspace
                  </span>
                  <span className="text-xs font-medium bg-[#f5f3ff] text-[#7C6CF6] px-2 py-0.5 rounded">
                    {activeMode.preview.badge}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                    <span className="text-xs text-gray-500 font-medium block">
                      {activeMode.preview.stat1Label}
                    </span>
                    <span className="text-xl font-bold text-gray-900 mt-1 block">
                      {activeMode.preview.stat1}
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                    <span className="text-xs text-gray-500 font-medium block">
                      {activeMode.preview.stat2Label}
                    </span>
                    <span className="text-xl font-bold text-[#7C6CF6] mt-1 block">
                      {activeMode.preview.stat2}
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                  <span className="text-xs text-gray-500 font-medium block mb-1">
                    Latest Activity
                  </span>
                  <p className="text-xs font-semibold text-gray-900 truncate">
                    {activeMode.preview.recent}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
                    <span>Status:</span>
                    <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                      <BadgeCheck className="h-3 w-3" aria-hidden="true" />
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
