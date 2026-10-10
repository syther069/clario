"use client";

import React, { useState } from "react";
import { Check, Copy, AlertCircle, Info, ShieldAlert, CheckCircle2 } from "lucide-react";
import { ContextualIconSwap } from "@/components/ui/motion";

// ==========================================
// 1. DocCodeBlock: High-contrast Tactical Code
// ==========================================

interface DocCodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
}

export function DocCodeBlock({
  code,
  language = "bash",
  filename,
  showLineNumbers = false,
}: DocCodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const lines = code.trim().split("\n");

  return (
    <div className="my-6 overflow-hidden rounded-md border-2 border-[#121212] bg-[#0E0E0E] text-slate-100 shadow-[4px_4px_0_0_#121212]">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b-2 border-[#121212] bg-[#181818] px-4 py-2.5 text-xs font-mono">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-[#836EF9]" />
          <span className="font-bold text-white tracking-wider uppercase text-[11px]">
            {filename || `SPEC // ${language.toUpperCase()}`}
          </span>
        </div>
        <button
          onClick={handleCopy}
          aria-label="Copy code to clipboard"
          className="relative flex items-center gap-1.5 rounded border border-white/20 bg-white/10 px-2.5 py-1 text-slate-300 font-mono text-[11px] font-bold uppercase tracking-wider transition-[transform,background-color,color] duration-150 ease-out hover:bg-white/20 hover:text-white active:scale-[0.96] after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2 after:content-['']"
        >
          <ContextualIconSwap
            isActive={copied}
            initialIcon={<Copy className="h-3 w-3" />}
            activeIcon={<Check className="h-3 w-3 text-emerald-400" />}
          />
          {copied ? (
            <span className="text-emerald-400">[ COPIED ]</span>
          ) : (
            <span>[ COPY ]</span>
          )}
        </button>
      </div>

      {/* Code body */}
      <div className="overflow-x-auto p-4 text-xs font-mono leading-relaxed">
        <pre className="flex">
          {showLineNumbers && (
            <div className="mr-4 select-none text-right text-slate-600 font-mono">
              {lines.map((_, i) => (
                <div key={i}>{String(i + 1).padStart(2, "0")}</div>
              ))}
            </div>
          )}
          <code className="text-slate-200">
            {lines.map((line, idx) => (
              <div key={idx} className="table-row">
                <span className="table-cell">{line}</span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}

// ==========================================
// 2. DocCallout: Neo-Brutalist Technical Alerts
// ==========================================

interface DocCalloutProps {
  type: "info" | "warning" | "important" | "tip";
  title?: string;
  children: React.ReactNode;
}

export function DocCallout({ type, title, children }: DocCalloutProps) {
  const configs = {
    info: {
      border: "border-[#121212]",
      bg: "bg-[#836EF9]/5",
      icon: <Info className="h-4 w-4 text-[#836EF9] shrink-0" />,
      badgeBg: "bg-[#836EF9] text-white",
      defaultTitle: "NOTE // ARCHITECTURE",
    },
    warning: {
      border: "border-[#121212]",
      bg: "bg-amber-50",
      icon: <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />,
      badgeBg: "bg-amber-600 text-white",
      defaultTitle: "SECURITY WARNING",
    },
    important: {
      border: "border-[#121212]",
      bg: "bg-rose-50",
      icon: <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />,
      badgeBg: "bg-rose-600 text-white",
      defaultTitle: "CRITICAL INVARIANT",
    },
    tip: {
      border: "border-[#121212]",
      bg: "bg-emerald-50",
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />,
      badgeBg: "bg-emerald-700 text-white",
      defaultTitle: "ENGINEERING DIRECTIVE",
    },
  }[type];

  return (
    <div
      className={`my-6 rounded-md border-2 ${configs.border} ${configs.bg} p-4 shadow-[4px_4px_0_0_#121212]`}
    >
      <div className="flex items-start gap-3">
        {configs.icon}
        <div className="space-y-1.5 text-sm text-slate-800">
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider ${configs.badgeBg}`}
            >
              [ {title || configs.defaultTitle} ]
            </span>
          </div>
          <div className="font-medium leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. DocTable: Precision Data Matrix
// ==========================================

interface DocTableProps {
  headers: string[];
  rows: (string | React.ReactNode)[][];
  caption?: string;
}

export function DocTable({ headers, rows, caption }: DocTableProps) {
  return (
    <div className="my-6 overflow-hidden rounded-md border-2 border-[#121212] bg-white shadow-[4px_4px_0_0_#121212]">
      {caption && (
        <div className="border-b-2 border-[#121212] bg-[#F4F4F0] px-4 py-2 font-mono text-[11px] font-black uppercase tracking-wider text-[#121212] flex items-center justify-between">
          <span>{"//"} {caption}</span>
          <span className="text-slate-500 font-mono text-[10px]">[ ROWS: {rows.length} ]</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="border-b-2 border-[#121212] bg-[#ECEBE6] font-mono text-[11px] uppercase tracking-wider text-[#121212]">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="px-4 py-3 font-black border-r border-[#121212]/20 last:border-r-0">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#121212]/15 font-sans">
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-[#F9F8F5] transition-colors">
                {row.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    className="px-4 py-3 text-slate-800 font-medium border-r border-[#121212]/10 last:border-r-0"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==========================================
// 4. DocStatGrid: Metric / Parameter matrix
// ==========================================

interface DocStatItem {
  label: string;
  value: string;
  description?: string;
  badge?: string;
}

export function DocStatGrid({ items }: { items: DocStatItem[] }) {
  return (
    <div className="my-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item, idx) => (
        <div
          key={idx}
          className="rounded-md border-2 border-[#121212] bg-white p-4 shadow-[3px_3px_0_0_#121212] flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-xs font-mono uppercase text-slate-500 font-bold mb-1">
            <span>{"//"} {item.label}</span>
            {item.badge && (
              <span className="rounded border border-[#121212] bg-[#836EF9] px-1.5 py-0.5 text-[9px] font-mono font-black uppercase text-white shadow-[1px_1px_0_0_#121212]">
                {item.badge}
              </span>
            )}
          </div>
          <div className="font-mono text-lg font-black text-[#121212] break-all tracking-tight my-1">
            {item.value}
          </div>
          {item.description && (
            <p className="mt-1 text-xs text-slate-600 font-medium">
              {item.description}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
