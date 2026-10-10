"use client";

import React from "react";
import { motion } from "motion/react";
import { type DocSubsection } from "./docs-data";
import { ChevronRight } from "lucide-react";

interface DocsTocProps {
  subsections: DocSubsection[];
  activeSubsectionId: string;
  onSelectSubsection: (id: string) => void;
}

/**
 * Skiper 60 Inspired Side-Scroll Sticky Outline Component
 * Clean, technical vertical outline with active tracking and smooth jump scrolling.
 */
export function DocsToc({
  subsections,
  activeSubsectionId,
  onSelectSubsection,
}: DocsTocProps) {
  if (!subsections || subsections.length === 0) return null;

  return (
    <div className="hidden xl:block w-64 shrink-0">
      <div className="sticky top-20 space-y-3.5 rounded-md border-2 border-[#121212] bg-white p-3.5 shadow-[4px_4px_0_0_#121212] max-h-[calc(100vh-6rem)] overflow-y-auto overscroll-contain custom-scrollbar select-none">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b-2 border-[#121212]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#836EF9]" />
            <span className="text-[11px] font-mono font-black uppercase tracking-wider text-[#121212]">
              On This Page
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500 font-bold">
            [ {subsections.length} ]
          </span>
        </div>

        {/* Outline Navigation Track */}
        <nav className="relative space-y-0.5" aria-label="Table of contents">
          {subsections.map((sub, idx) => {
            const isActive = activeSubsectionId === sub.id;
            return (
              <div key={sub.id} className="relative">
                <button
                  onClick={() => onSelectSubsection(sub.id)}
                  className={`group relative z-10 w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left transition-colors duration-150 ${
                    isActive
                      ? "text-white"
                      : "text-slate-700 hover:text-[#121212] hover:bg-black/[0.03]"
                  }`}
                >
                  {/* Gliding Active Indicator */}
                  {isActive && (
                    <motion.span
                      layoutId="active-toc-pill"
                      className="absolute inset-0 bg-[#836EF9] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] rounded -z-10"
                      transition={{
                        type: "spring",
                        stiffness: 450,
                        damping: 32,
                      }}
                    />
                  )}

                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className={`text-[10px] font-mono font-bold ${
                        isActive ? "text-white/90" : "text-slate-400 group-hover:text-[#836EF9]"
                      }`}
                    >
                      {String(idx + 1).padStart(2, "0")}.
                    </span>
                    <span
                      className={`truncate text-xs tracking-tight ${
                        isActive ? "font-bold text-white" : "font-medium text-slate-700 group-hover:text-black"
                      }`}
                    >
                      {sub.title}
                    </span>
                  </div>

                  <ChevronRight
                    className={`h-3 w-3 shrink-0 transition-transform ${
                      isActive
                        ? "opacity-100 translate-x-0.5 text-white"
                        : "opacity-0 group-hover:opacity-60 text-slate-400"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </nav>

        {/* Monad Protocol Badge */}
        <div className="pt-2 border-t border-[#121212]/15 flex items-center justify-between text-[10px] font-mono text-slate-500">
          <span>SPEC 1.0</span>
          <span className="text-[#836EF9] font-black uppercase">MONAD TESTNET</span>
        </div>
      </div>
    </div>
  );
}
