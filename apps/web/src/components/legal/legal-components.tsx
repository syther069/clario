"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  AlertCircle,
  Info,
  CheckCircle2,
  Link2,
  Check,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Mail,
  FileText,
  Shield,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import type {
  LegalCalloutData,
  LegalTableData,
} from "@/lib/legal/legal-data";
import { ContextualIconSwap } from "@/components/ui/motion";

// ==========================================
// 1. Plain-English Summary Box
// ==========================================

export function LegalSummaryCallout({ summary }: { summary: string[] }) {
  return (
    <div className="my-6 rounded-xl border-2 border-[#121212] bg-[#f5f3ff] p-5 shadow-[4px_4px_0_0_#836EF9] print:border-black print:bg-white print:shadow-none">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-[#121212]/20">
        <FileText className="h-4 w-4 text-[#836EF9]" aria-hidden="true" />
        <span className="font-mono text-xs font-black uppercase tracking-wider text-[#121212]">
          [ Plain-English Summary ]
        </span>
      </div>
      <ul className="space-y-2 font-sans text-sm font-medium text-slate-800 leading-relaxed">
        {summary.map((bullet, idx) => (
          <li key={idx} className="flex items-start gap-2.5">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#836EF9] shrink-0" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ==========================================
// 2. Draft Notice Banner (Testnet Preview)
// ==========================================

export function LegalDraftBanner({ notice }: { notice: string }) {
  return (
    <div className="mb-6 rounded-lg border-2 border-[#121212] bg-amber-50 px-4 py-2.5 shadow-[2px_2px_0_0_#121212] flex items-center justify-between gap-3 text-xs font-mono font-bold text-amber-900 print:border-black print:bg-white print:shadow-none">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-amber-700 shrink-0" aria-hidden="true" />
        <span className="uppercase tracking-wider">{notice}</span>
      </div>
      <span className="text-[10px] uppercase tracking-wider bg-white border border-[#121212] px-2 py-0.5 rounded shadow-[1px_1px_0_0_#121212]">
        Notice
      </span>
    </div>
  );
}

// ==========================================
// 3. Reusable Docs-Style Callout
// ==========================================

export function LegalCallout({ data }: { data: LegalCalloutData }) {
  const configs = {
    info: {
      border: "border-[#121212]",
      bg: "bg-[#836EF9]/5",
      icon: <Info className="h-4 w-4 text-[#836EF9] shrink-0" aria-hidden="true" />,
      badgeBg: "bg-[#836EF9] text-white",
    },
    warning: {
      border: "border-[#121212]",
      bg: "bg-amber-50",
      icon: <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" aria-hidden="true" />,
      badgeBg: "bg-amber-600 text-white",
    },
    important: {
      border: "border-[#121212]",
      bg: "bg-rose-50",
      icon: <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" aria-hidden="true" />,
      badgeBg: "bg-rose-600 text-white",
    },
    tip: {
      border: "border-[#121212]",
      bg: "bg-emerald-50",
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />,
      badgeBg: "bg-emerald-700 text-white",
    },
  }[data.type];

  return (
    <div
      className={`my-6 rounded-md border-2 ${configs.border} ${configs.bg} p-4 shadow-[4px_4px_0_0_#121212] print:border-black print:bg-white print:shadow-none`}
    >
      <div className="flex items-start gap-3">
        {configs.icon}
        <div className="space-y-1.5 text-sm text-slate-800">
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider ${configs.badgeBg}`}
            >
              [ {data.badge || data.title} ]
            </span>
          </div>
          <div className="font-medium leading-relaxed">
            {Array.isArray(data.content) ? (
              <ul className="list-disc pl-4 space-y-1">
                {data.content.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            ) : (
              data.content
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 4. Section Heading with Copy Anchor
// ==========================================

export function LegalSectionHeading({
  id,
  number,
  title,
  level = 2,
}: {
  id: string;
  number?: string;
  title: string;
  level?: 2 | 3;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof window !== "undefined") {
      const url = `${window.location.origin}${window.location.pathname}#${id}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (level === 3) {
    return (
      <h3
        id={id}
        className="group relative pt-6 pb-2 text-base font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2 scroll-mt-24"
      >
        {number && <span className="text-[#836EF9]">{number}.</span>}
        <span>{title}</span>
        <button
          onClick={handleCopy}
          aria-label={`Copy link to section ${title}`}
          className="relative opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 p-1 text-slate-400 hover:text-[#836EF9] transition-opacity print:hidden after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2 after:content-['']"
        >
          <ContextualIconSwap
            isActive={copied}
            initialIcon={<Link2 className="h-3.5 w-3.5" />}
            activeIcon={<Check className="h-3.5 w-3.5 text-emerald-600" />}
          />
        </button>
      </h3>
    );
  }

  return (
    <h2
      id={id}
      className="group relative pt-10 pb-3 border-t-2 border-[#121212]/15 text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center justify-between gap-3 scroll-mt-24 first:border-t-0"
    >
      <div className="flex items-center gap-2.5">
        {number && (
          <span className="rounded bg-[#836EF9] text-white px-2 py-0.5 text-xs font-mono font-black shadow-[1px_1px_0_0_#121212] border border-[#121212]">
            {number}
          </span>
        )}
        <span>{title}</span>
      </div>
      <button
        onClick={handleCopy}
        aria-label={`Copy link to section ${title}`}
        className="relative opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase text-slate-500 hover:text-[#836EF9] transition-opacity print:hidden after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2 after:content-['']"
      >
        <ContextualIconSwap
          isActive={copied}
          initialIcon={<Link2 className="h-3.5 w-3.5" />}
          activeIcon={<Check className="h-3.5 w-3.5 text-emerald-600" />}
        />
        {copied ? (
          <span className="text-emerald-600">[ Copied ]</span>
        ) : (
          <span>[ Link ]</span>
        )}
      </button>
    </h2>
  );
}

// ==========================================
// 5. Precision Legal Table
// ==========================================

export function LegalTable({ data }: { data: LegalTableData }) {
  return (
    <div className="my-6 overflow-hidden rounded-md border-2 border-[#121212] bg-white shadow-[4px_4px_0_0_#121212] print:border-black print:shadow-none">
      {data.caption && (
        <div className="border-b-2 border-[#121212] bg-[#F4F4F0] px-4 py-2 font-mono text-[11px] font-black uppercase tracking-wider text-[#121212] flex items-center justify-between">
          <span>{"//"} {data.caption}</span>
          <span className="text-slate-500 font-mono text-[10px]">[ ROWS: {data.rows.length} ]</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="border-b-2 border-[#121212] bg-[#ECEBE6] font-mono text-[11px] uppercase tracking-wider text-[#121212]">
            <tr>
              {data.headers.map((h, i) => (
                <th
                  key={i}
                  className="px-4 py-2.5 font-black border-r border-[#121212]/20 last:border-r-0"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y border-[#121212]/15 font-sans">
            {data.rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-50 transition-colors">
                {row.cells.map((cell, cIdx) => {
                  if (typeof cell === "object" && cell !== null) {
                    let statusBadge = null;
                    if (cell.status) {
                      const statusMap = {
                        built: "bg-emerald-100 text-emerald-800 border-emerald-800",
                        partial: "bg-amber-100 text-amber-800 border-amber-800",
                        planned: "bg-blue-100 text-blue-800 border-blue-800",
                        not_available: "bg-slate-100 text-slate-700 border-slate-700",
                      };
                      statusBadge = (
                        <span
                          className={`inline-block font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                            statusMap[cell.status]
                          }`}
                        >
                          {cell.text}
                        </span>
                      );
                    }

                    return (
                      <td
                        key={cIdx}
                        className={`px-4 py-3 border-r border-[#121212]/15 last:border-r-0 text-slate-800 ${
                          cell.mono ? "font-mono text-xs break-all" : "text-sm font-medium"
                        }`}
                      >
                        {statusBadge || cell.text}
                      </td>
                    );
                  }

                  return (
                    <td
                      key={cIdx}
                      className="px-4 py-3 border-r border-[#121212]/15 last:border-r-0 text-sm font-medium text-slate-800"
                    >
                      {cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==========================================
// 6. Two-Column Protection Matrix
// ==========================================

export function LegalTwoColumn({
  leftTitle,
  leftItems,
  rightTitle,
  rightItems,
}: {
  leftTitle: string;
  leftItems: string[];
  rightTitle: string;
  rightItems: string[];
}) {
  return (
    <div className="my-6 grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* What Clario Protects */}
      <div className="rounded-xl border-2 border-[#121212] bg-[#f0fdf4] p-5 shadow-[4px_4px_0_0_#121212] print:border-black print:bg-white print:shadow-none">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-[#121212]/20">
          <ShieldCheck className="h-4 w-4 text-emerald-700" />
          <span className="font-mono text-xs font-black uppercase tracking-wider text-[#121212]">
            {leftTitle}
          </span>
        </div>
        <ul className="space-y-2 text-sm font-medium text-slate-800">
          {leftItems.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="font-mono text-emerald-700 font-bold shrink-0">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* What Clario Does NOT Protect */}
      <div className="rounded-xl border-2 border-[#121212] bg-[#fff1f2] p-5 shadow-[4px_4px_0_0_#121212] print:border-black print:bg-white print:shadow-none">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-[#121212]/20">
          <ShieldAlert className="h-4 w-4 text-rose-700" />
          <span className="font-mono text-xs font-black uppercase tracking-wider text-[#121212]">
            {rightTitle}
          </span>
        </div>
        <ul className="space-y-2 text-sm font-medium text-slate-800">
          {rightItems.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="font-mono text-rose-700 font-bold shrink-0">✕</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ==========================================
// 7. Cross-Links to Other Legal Documents
// ==========================================

export function LegalCrossLinks({ currentSlug }: { currentSlug: string }) {
  const links = [
    { slug: "privacy", label: "Privacy Policy", icon: Shield, href: "/privacy" },
    { slug: "terms", label: "Terms of Service", icon: FileText, href: "/terms" },
    { slug: "security", label: "Security Details", icon: ShieldCheck, href: "/security" },
    { slug: "disclosure", label: "Risk Disclosure", icon: HelpCircle, href: "/disclosure" },
  ];

  return (
    <div className="mt-12 pt-8 border-t-2 border-[#121212] print:hidden">
      <div className="font-mono text-xs font-black uppercase tracking-wider text-[#121212] mb-3">
        {"//"} Legal &amp; Trust Document Center
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {links.map((link) => {
          const isCurrent = link.slug === currentSlug;
          const Icon = link.icon;
          return (
            <Link
              key={link.slug}
              href={link.href}
              className={`p-3 rounded-lg border-2 border-[#121212] text-left transition-all ${
                isCurrent
                  ? "bg-[#836EF9] text-white shadow-[2px_2px_0_0_#121212]"
                  : "bg-white hover:bg-slate-50 text-[#121212] shadow-[2px_2px_0_0_#121212] hover:-translate-y-0.5"
              }`}
            >
              <Icon className={`h-4 w-4 mb-1.5 ${isCurrent ? "text-white" : "text-[#836EF9]"}`} />
              <div className="font-mono text-xs font-black uppercase tracking-wider">
                {link.label}
              </div>
              {isCurrent && (
                <span className="font-mono text-[9px] uppercase tracking-wider opacity-80 block mt-0.5">
                  [ Current Page ]
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// 8. Questions & Contact Block
// ==========================================

export function LegalContactBlock() {
  return (
    <div className="mt-8 rounded-xl border-2 border-[#121212] bg-[#f8f9fa] p-5 shadow-[3px_3px_0_0_#121212] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:border-black print:shadow-none">
      <div className="space-y-1">
        <div className="flex items-center gap-2 font-mono text-xs font-black uppercase tracking-wider text-[#121212]">
          <Mail className="h-4 w-4 text-[#836EF9]" />
          <span>Questions or Legal Inquiries?</span>
        </div>
        <p className="text-xs text-slate-600 font-medium">
          Contact our team at <code className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-[#121212] text-[#121212]">[CONFIRM: contact email]</code>
        </p>
      </div>
      <a
        href="mailto:[CONFIRM: contact email]"
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-[#121212] bg-[#836EF9] px-3.5 py-2 font-mono text-xs font-black uppercase tracking-wider text-white shadow-[2px_2px_0_0_#121212] hover:bg-[#7257f8] active:translate-x-0.5 active:translate-y-0.5 transition-all self-start sm:self-auto"
      >
        <span>Send Email</span>
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

// ==========================================
// 9. Sticky Table of Contents (Desktop + Mobile)
// ==========================================

export function LegalToc({
  sections,
  activeSectionId,
  onSelectSection,
}: {
  sections: { id: string; number: string; title: string }[];
  activeSectionId: string;
  onSelectSection: (id: string) => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Collapsible TOC Dropdown */}
      <div className="lg:hidden mb-6 print:hidden">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-full flex items-center justify-between rounded-lg border-2 border-[#121212] bg-white px-4 py-2.5 font-mono text-xs font-black uppercase tracking-wider text-[#121212] shadow-[2px_2px_0_0_#121212]"
        >
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#836EF9]" />
            <span>On This Page ({sections.length} Sections)</span>
          </div>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${mobileOpen ? "rotate-180" : ""}`}
          />
        </button>

        {mobileOpen && (
          <div className="mt-2 rounded-lg border-2 border-[#121212] bg-white p-3 shadow-[3px_3px_0_0_#121212] space-y-1">
            {sections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => {
                  onSelectSection(sec.id);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left font-mono text-xs ${
                  activeSectionId === sec.id
                    ? "bg-[#836EF9] text-white font-bold"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="text-[10px] opacity-75">{sec.number}.</span>
                <span className="truncate">{sec.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Desktop Sticky Sidebar TOC */}
      <aside
        aria-label="Table of contents"
        className="hidden lg:block w-64 shrink-0 print:hidden"
      >
        <div className="sticky top-24 space-y-3 rounded-xl border-2 border-[#121212] bg-white p-4 shadow-[4px_4px_0_0_#121212] max-h-[calc(100vh-8rem)] overflow-y-auto overscroll-contain custom-scrollbar">
          <div className="flex items-center justify-between pb-2 border-b-2 border-[#121212]">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#836EF9]" />
              <span className="text-xs font-mono font-black uppercase tracking-wider text-[#121212]">
                On This Page
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold text-slate-500">
              [{sections.length}]
            </span>
          </div>

          <nav className="space-y-0.5">
            {sections.map((sec) => {
              const isActive = activeSectionId === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => onSelectSection(sec.id)}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-left transition-all text-xs font-mono ${
                    isActive
                      ? "bg-[#836EF9] text-white font-bold border-2 border-[#121212] shadow-[1px_1px_0_0_#121212]"
                      : "text-slate-700 hover:text-black hover:bg-slate-100 border-2 border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-[10px] opacity-70">{sec.number}.</span>
                    <span className="truncate">{sec.title}</span>
                  </div>
                  <ChevronRight
                    className={`h-3 w-3 shrink-0 ${
                      isActive ? "opacity-100 text-white" : "opacity-0"
                    }`}
                  />
                </button>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
