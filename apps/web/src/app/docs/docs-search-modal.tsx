"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, X, Hash, ArrowRight, CornerDownLeft } from "lucide-react";
import { DOC_SECTIONS, type DocSection } from "./docs-data";

interface DocsSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSection: (sectionId: string, subsectionId?: string) => void;
}

export function DocsSearchModal({
  isOpen,
  onClose,
  onSelectSection,
}: DocsSearchModalProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const normalizedQuery = query.toLowerCase().trim();

  const results: Array<{
    section: DocSection;
    subId?: string;
    subTitle?: string;
    matchType: "section" | "subsection" | "description";
  }> = [];

  DOC_SECTIONS.forEach((section) => {
    const titleMatch = section.title.toLowerCase().includes(normalizedQuery);
    const descMatch = section.description.toLowerCase().includes(normalizedQuery);

    if (titleMatch || descMatch || !normalizedQuery) {
      results.push({
        section,
        matchType: titleMatch ? "section" : "description",
      });
    }

    section.subsections.forEach((sub) => {
      if (sub.title.toLowerCase().includes(normalizedQuery)) {
        results.push({
          section,
          subId: sub.id,
          subTitle: sub.title,
          matchType: "subsection",
        });
      }
    });
  });

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/70 animate-in fade-in duration-100"
    >
      <div
        className="w-full max-w-2xl rounded-md border-2 border-[#121212] bg-white p-4 sm:p-5 shadow-[6px_6px_0_0_#121212] text-[#121212] flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b-2 border-[#121212] pb-3">
          <div className="font-mono text-sm font-black text-[#836EF9] select-none">&gt;</div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search specs, contracts, verification CLI, and schemas..."
            className="flex-1 bg-transparent text-sm sm:text-base font-mono font-bold placeholder:text-slate-400 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:text-black hover:bg-slate-100 border border-[#121212]"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search Results List */}
        <div className="mt-3 flex-1 overflow-y-auto space-y-1.5 pr-1 font-mono">
          {results.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 font-bold uppercase tracking-wider">
              No matching specifications found for &quot;{query}&quot;
            </div>
          ) : (
            results.slice(0, 8).map((item, idx) => (
              <button
                key={`${item.section.id}-${item.subId || "root"}-${idx}`}
                onClick={() => onSelectSection(item.section.id, item.subId)}
                className="w-full flex items-center justify-between rounded p-2.5 text-left transition hover:bg-[#FAF8FF] border border-transparent hover:border-[#121212] group"
              >
                <div className="flex items-center gap-3 truncate">
                  <div className="flex h-7 w-7 items-center justify-center rounded border border-[#121212] bg-[#F4F4F0] text-xs font-bold text-[#121212] group-hover:bg-[#836EF9] group-hover:text-white transition-colors">
                    <Hash className="h-3.5 w-3.5" />
                  </div>
                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-[#121212] uppercase tracking-tight">
                        {item.section.title}
                      </span>
                      {item.subTitle && (
                        <>
                          <span className="text-slate-400 text-xs">/</span>
                          <span className="text-xs font-bold text-[#836EF9]">
                            {item.subTitle}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-sans font-medium truncate mt-0.5">
                      {item.section.description}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-[#836EF9] group-hover:translate-x-0.5 transition-all" />
              </button>
            ))
          )}
        </div>

        {/* Search Footer Shortcuts */}
        <div className="mt-3 border-t-2 border-[#121212]/15 pt-2 flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="border border-slate-300 bg-slate-100 px-1 rounded">ESC</kbd> CLOSE
            </span>
            <span>
              <kbd className="border border-slate-300 bg-slate-100 px-1 rounded">↵</kbd> SELECT
            </span>
          </div>
          <span>TOTAL SPECIFICATIONS: {DOC_SECTIONS.length}</span>
        </div>
      </div>
    </div>
  );
}
