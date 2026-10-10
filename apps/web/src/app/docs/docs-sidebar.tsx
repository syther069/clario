"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import { DOC_SECTIONS } from "./docs-data";
import { ClarioLogo } from "@/components/ui/clario-logo";
import {
  Search,
  ArrowLeft,
  ChevronRight,
  X,
} from "lucide-react";

interface DocsSidebarProps {
  activeSectionId: string;
  activeSubsectionId?: string;
  onSelectSection: (id: string) => void;
  onSelectSubsection?: (subId: string) => void;
  onOpenSearch: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

const GROUP_INDEX: Record<string, string> = {
  "Getting Started": "01",
  "Product & Modes": "02",
  "Architecture & Verification": "03",
  "Integrations": "04",
  "Security & Ops": "05",
  "Hackathon": "06",
};

export function DocsSidebar({
  activeSectionId,
  activeSubsectionId,
  onSelectSection,
  onSelectSubsection,
  onOpenSearch,
  isOpenMobile,
  onCloseMobile,
}: DocsSidebarProps) {
  const groups = Array.from(
    new Set(DOC_SECTIONS.map((section) => section.group)),
  );

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  // Smoothly scroll active section into view within the sidebar if needed
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [activeSectionId]);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
        />
      )}

      {/* Sticky Desktop Sidebar / Fixed Mobile Drawer */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 lg:w-68 xl:w-72 border-r-2 border-[#121212] bg-[#FDFBF7] flex flex-col transition-transform duration-200 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:translate-x-0 lg:z-20 shrink-0 select-none ${
          isOpenMobile ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand & Docs Header (Visible on Mobile) */}
        <div className="p-3.5 border-b-2 border-[#121212] flex items-center justify-between bg-white lg:hidden">
          <Link href="/" className="flex items-center gap-2 group">
            <ClarioLogo
              size={28}
              className="transition group-hover:translate-x-[1px] group-hover:translate-y-[1px]"
            />
            <div className="flex items-center gap-1.5">
              <span className="font-black tracking-wider text-[#121212] uppercase font-sans text-sm">
                Clario
              </span>
              <span className="rounded border border-[#121212] bg-[#836EF9] text-white px-1.5 py-0.2 font-mono text-[9px] font-black uppercase shadow-[1px_1px_0_0_#121212]">
                Docs
              </span>
            </div>
          </Link>

          <button
            onClick={onCloseMobile}
            className="p-1 rounded text-slate-700 hover:text-black hover:bg-slate-100 border border-[#121212]"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quick Search Button */}
        <div className="p-3 border-b-2 border-[#121212] bg-[#F4F4F0] shrink-0">
          <button
            onClick={onOpenSearch}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md border-2 border-[#121212] bg-white shadow-[2px_2px_0_0_#121212] text-xs font-mono font-bold text-slate-600 hover:text-black hover:bg-slate-50 transition active:translate-x-[1px] active:translate-y-[1px]"
          >
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-[#836EF9]" />
              <span className="text-[11px] uppercase tracking-wider">Search Manual...</span>
            </div>
            <kbd className="font-mono text-[10px] bg-slate-100 border border-slate-300 rounded px-1.5 py-0.5 font-bold text-slate-700">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Navigation Sections with Precision Custom Scrollbar */}
        <nav
          onMouseLeave={() => setHoveredId(null)}
          className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3.5 scroll-smooth overscroll-contain"
        >
          <LayoutGroup id="docs-sidebar-nav">
            {groups.map((group) => {
              const sectionsInGroup = DOC_SECTIONS.filter(
                (sec) => sec.group === group,
              );
              const groupNum = GROUP_INDEX[group] || "00";
              return (
                <div key={group} className="space-y-1">
                  <div className="px-2 py-0.5 mb-1 border-b border-[#121212]/10 flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold tracking-wider text-slate-500 uppercase flex items-center gap-1.5">
                      <span className="text-[#836EF9] font-black">{groupNum}</span>
                      <span className="text-slate-300">{"//"}</span>
                      <span>{group}</span>
                    </span>
                  </div>
                  <div className="space-y-1">
                    {sectionsInGroup.map((section) => {
                      const isActive = activeSectionId === section.id;
                      const isHovered = hoveredId === section.id;

                      return (
                        <div key={section.id} className="relative">
                          <button
                            ref={isActive ? activeItemRef : null}
                            onMouseEnter={() => setHoveredId(section.id)}
                            onClick={() => {
                              onSelectSection(section.id);
                              onCloseMobile?.();
                            }}
                            className={`group relative z-10 w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left transition-colors duration-150 ${
                              isActive
                                ? "text-white"
                                : "text-neutral-800 hover:text-black"
                            }`}
                          >
                            {/* Gliding Active Pill Animation */}
                            {isActive && (
                              <motion.span
                                layoutId="active-sidebar-pill"
                                className="absolute inset-0 bg-[#836EF9] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] rounded-md -z-10"
                                transition={{
                                  type: "spring",
                                  stiffness: 420,
                                  damping: 32,
                                  mass: 0.8,
                                }}
                              />
                            )}

                            {/* Fluid Inactive Hover Glow Pill */}
                            {!isActive && isHovered && (
                              <motion.span
                                layoutId="hover-sidebar-pill"
                                className="absolute inset-0 bg-black/[0.05] border border-black/10 rounded-md -z-10"
                                transition={{
                                  type: "spring",
                                  stiffness: 450,
                                  damping: 35,
                                }}
                              />
                            )}

                            {/* Section Title Font Styling */}
                            <span
                              className={`truncate tracking-tight select-none ${
                                isActive
                                  ? "font-bold text-[13.5px] text-white"
                                  : "font-semibold text-[13px] text-neutral-800 group-hover:text-black"
                              }`}
                            >
                              {section.title}
                            </span>

                            {/* Section Badge & Chevron */}
                            <div className="flex items-center gap-1.5 shrink-0 ml-1">
                              {section.badge && (
                                <span
                                  className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-black shrink-0 tracking-wider transition-colors ${
                                    isActive
                                      ? "bg-white/25 text-white border border-white/40 shadow-xs"
                                      : "bg-white border border-[#121212]/15 text-slate-600 group-hover:border-[#121212] group-hover:text-black"
                                  }`}
                                >
                                  {section.badge}
                                </span>
                              )}
                              <ChevronRight
                                className={`h-3 w-3 shrink-0 transition-transform duration-200 ${
                                  isActive
                                    ? "text-white translate-x-0.5"
                                    : "text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5"
                                }`}
                              />
                            </div>
                          </button>

                          {/* Nested Accordion Subsections for Active Section */}
                          <AnimatePresence initial={false}>
                            {isActive && section.subsections && section.subsections.length > 0 && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                                className="overflow-hidden ml-3 pl-2.5 py-1 space-y-0.5 border-l-2 border-[#836EF9]/50 my-1"
                              >
                                {section.subsections.map((sub, sIdx) => {
                                  const isSubActive = activeSubsectionId === sub.id;
                                  return (
                                    <button
                                      key={sub.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectSubsection?.(sub.id);
                                        onCloseMobile?.();
                                      }}
                                      className={`group/sub flex items-center justify-between w-full px-2 py-1 rounded text-left transition-colors ${
                                        isSubActive
                                          ? "text-[#836EF9] font-bold bg-[#836EF9]/10"
                                          : "text-slate-600 hover:text-[#121212] hover:bg-black/[0.04]"
                                      }`}
                                    >
                                      <span className="truncate font-sans font-medium text-[12px] tracking-tight">
                                        {sub.title}
                                      </span>
                                      <span
                                        className={`font-mono text-[9px] font-bold shrink-0 ml-1 ${
                                          isSubActive ? "text-[#836EF9]" : "text-slate-400"
                                        }`}
                                      >
                                        {String(sIdx + 1).padStart(2, "0")}
                                      </span>
                                    </button>
                                  );
                                })}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </LayoutGroup>
        </nav>

        {/* Bottom Technical Telemetry Footer */}
        <div className="p-3 border-t-2 border-[#121212] bg-[#F4F4F0] space-y-2 shrink-0">
          <Link
            href="/"
            className="flex items-center justify-between w-full p-2 rounded-md border-2 border-[#121212] bg-white text-xs font-mono font-black uppercase tracking-wider text-[#121212] shadow-[2px_2px_0_0_#121212] hover:bg-slate-50 transition active:translate-x-[1px] active:translate-y-[1px]"
          >
            <div className="flex items-center gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to App</span>
            </div>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </Link>

          <div className="flex items-center justify-between px-1 text-[10px] font-mono text-slate-500 uppercase font-bold">
            <span>CHAIN ID: 10143</span>
            <span className="text-[#836EF9]">MONAD TESTNET</span>
          </div>
        </div>
      </aside>
    </>
  );
}
