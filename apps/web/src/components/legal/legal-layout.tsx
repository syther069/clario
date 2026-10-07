"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ClarioLogo } from "@/components/ui/clario-logo";
import { MonadLogo } from "@/components/ui/crypto-icon";
import { ScrollProgress } from "@/components/ui/motion/scroll-progress";
import {
  ExternalLink,
  ArrowRight,
  ArrowUp,
  FileText,
  Printer,
} from "lucide-react";
import type { LegalDocumentData } from "@/lib/legal/legal-data";
import {
  LegalSummaryCallout,
  LegalDraftBanner,
  LegalCallout,
  LegalSectionHeading,
  LegalTable,
  LegalTwoColumn,
  LegalCrossLinks,
  LegalContactBlock,
  LegalToc,
} from "./legal-components";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

interface LegalLayoutProps {
  data: LegalDocumentData;
}

export function LegalLayout({ data }: LegalLayoutProps) {
  const [activeSectionId, setActiveSectionId] = useState<string>(
    data.sections[0]?.id ?? "",
  );
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Scroll spy for table of contents active highlighting
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setShowScrollTop(window.scrollY > 400);

          const sectionElements = data.sections
            .map((sec) => ({ id: sec.id, el: document.getElementById(sec.id) }))
            .filter((item): item is { id: string; el: HTMLElement } => item.el !== null);

          for (let i = sectionElements.length - 1; i >= 0; i--) {
            const item = sectionElements[i];
            if (!item) continue;
            const rect = item.el.getBoundingClientRect();
            if (rect.top <= 140) {
              setActiveSectionId(item.id);
              break;
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [data.sections]);

  const handleSelectSection = (id: string) => {
    setActiveSectionId(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      if (typeof window !== "undefined" && window.history) {
        window.history.pushState(null, "", `#${id}`);
      }
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const tocItems = data.sections.map((s) => ({
    id: s.id,
    number: s.number,
    title: s.title,
  }));

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#121212] font-sans selection:bg-[#836EF9]/20 selection:text-[#836EF9] scroll-smooth antialiased print:bg-white print:text-black">
      {/* Skip to Content accessible link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#836EF9] focus:text-white focus:border-2 focus:border-black focus:shadow-[2px_2px_0_0_#000] focus:font-mono focus:text-xs focus:font-bold focus:rounded-md"
      >
        Skip to main content
      </a>

      {/* Reading Progress Bar */}
      <ScrollProgress className="h-1 bg-[#836EF9] z-50 print:hidden" />

      {/* Global Header (Matching Docs & Site UI) */}
      <header className="sticky top-0 z-40 border-b-2 border-[#121212] bg-[#FDFBF7] px-4 sm:px-8 py-3.5 shadow-[0_2px_0_0_#121212] print:hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo link */}
          <Link href="/landing" className="flex items-center gap-2.5 group">
            <ClarioLogo
              size={34}
              className="transition group-hover:translate-x-[1px] group-hover:translate-y-[1px]"
            />
            <div className="flex flex-col">
              <span className="text-base font-black tracking-wider uppercase text-[#121212] flex items-center gap-2 font-sans">
                Clario
                <span className="text-[10px] font-mono font-black uppercase text-[#836EF9] bg-[#f5f3ff] px-2 py-0.5 rounded border-2 border-[#121212] shadow-[1px_1px_0_0_#121212] flex items-center gap-1">
                  <MonadLogo className="h-3 w-3" aria-hidden="true" />
                  Testnet
                </span>
              </span>
              <span className="text-[10px] text-gray-600 font-mono font-bold uppercase tracking-wider">
                Legal &amp; Trust Center
              </span>
            </div>
          </Link>

          {/* Center Navigation Links */}
          <nav
            aria-label="Legal header links"
            className="hidden md:flex items-center gap-1 p-1 bg-[#f8f9fa] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] rounded-xl"
          >
            <Link
              href="/landing"
              className="px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-[#121212] hover:text-[#836EF9]"
            >
              Landing
            </Link>
            <Link
              href="/docs"
              className="px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-[#121212] hover:text-[#836EF9]"
            >
              Docs
            </Link>
            <Link
              href="/privacy"
              className={`px-3 py-1 font-mono text-xs font-black uppercase tracking-wider rounded-lg transition-colors ${
                data.slug === "privacy"
                  ? "bg-[#836EF9] text-white border-2 border-[#121212] shadow-[1px_1px_0_0_#121212]"
                  : "text-[#121212] hover:text-[#836EF9]"
              }`}
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className={`px-3 py-1 font-mono text-xs font-black uppercase tracking-wider rounded-lg transition-colors ${
                data.slug === "terms"
                  ? "bg-[#836EF9] text-white border-2 border-[#121212] shadow-[1px_1px_0_0_#121212]"
                  : "text-[#121212] hover:text-[#836EF9]"
              }`}
            >
              Terms
            </Link>
            <Link
              href="/security"
              className={`px-3 py-1 font-mono text-xs font-black uppercase tracking-wider rounded-lg transition-colors ${
                data.slug === "security"
                  ? "bg-[#836EF9] text-white border-2 border-[#121212] shadow-[1px_1px_0_0_#121212]"
                  : "text-[#121212] hover:text-[#836EF9]"
              }`}
            >
              Security
            </Link>
            <Link
              href="/disclosure"
              className={`px-3 py-1 font-mono text-xs font-black uppercase tracking-wider rounded-lg transition-colors ${
                data.slug === "disclosure"
                  ? "bg-[#836EF9] text-white border-2 border-[#121212] shadow-[1px_1px_0_0_#121212]"
                  : "text-[#121212] hover:text-[#836EF9]"
              }`}
            >
              Disclosure
            </Link>
          </nav>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              aria-label="Print document"
              className="hidden sm:flex items-center gap-1.5 rounded-md border-2 border-[#121212] bg-white px-2.5 py-1.5 text-xs font-mono font-bold text-slate-700 shadow-[2px_2px_0_0_#121212] hover:bg-slate-50 active:translate-x-0.5 active:translate-y-0.5"
            >
              <Printer className="h-3.5 w-3.5 text-[#836EF9]" />
              <span className="uppercase tracking-wider">Print</span>
            </button>

            <Link
              href="/?mode=personal"
              className="inline-flex items-center justify-center gap-1.5 font-mono text-xs font-black uppercase tracking-wider px-3.5 py-1.5 rounded-lg bg-[#836EF9] text-white border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] hover:bg-[#7257f8] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              <span>Launch App</span>
              <ArrowRight className="h-3.5 w-3.5 stroke-[2.5]" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Two-Column Layout */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:gap-10">
          {/* Main Article Body (68-72ch optimal reading column) */}
          <main
            id="main-content"
            tabIndex={-1}
            className="min-w-0 flex-1 max-w-[72ch] mx-auto lg:mx-0 outline-none animate-in fade-in duration-200"
          >
            {/* Breadcrumb strip */}
            <nav
              aria-label="Breadcrumbs"
              className="mb-4 flex items-center gap-2 text-xs font-mono text-slate-500 pb-2 border-b border-[#121212]/15 print:hidden"
            >
              <Link href="/landing" className="hover:text-[#121212] font-black uppercase">
                CLARIO
              </Link>
              <span>{"//"}</span>
              <span className="font-bold text-slate-600 uppercase">LEGAL</span>
              <span>{"//"}</span>
              <span className="font-black text-[#836EF9] uppercase tracking-wider">
                {data.title}
              </span>
            </nav>

            {/* Document Header & Title */}
            <header className="mb-8">
              <div className="inline-flex items-center gap-2 rounded border-2 border-[#121212] bg-[#836EF9] text-white px-2.5 py-0.5 font-mono text-[11px] font-black uppercase tracking-wider shadow-[2px_2px_0_0_#121212]">
                <FileText className="h-3 w-3" />
                <span>OFFICIAL SPECIFICATION // {data.version}</span>
              </div>

              <h1 className="mt-3 text-3xl sm:text-4xl font-black font-sans tracking-tight text-[#121212]">
                {data.title}
              </h1>

              <p className="mt-2 text-base text-slate-700 font-medium leading-relaxed">
                {data.subtitle}
              </p>

              {/* Metadata strip */}
              <div className="mt-4 pt-3 border-t-2 border-[#121212]/15 flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-xs font-bold text-slate-600 uppercase">
                <span>Version: <strong className="text-[#121212]">{data.version}</strong></span>
                <span>•</span>
                <span>Last Updated: <strong className="text-[#121212]">{data.lastUpdated}</strong></span>
                <span>•</span>
                <span>Target: <strong className="text-[#836EF9]">Monad Testnet (10143)</strong></span>
              </div>
            </header>

            {/* Draft Notice Banner (if draft) */}
            {data.isDraft && data.draftNotice && (
              <LegalDraftBanner notice={data.draftNotice} />
            )}

            {/* Plain-English Summary Box */}
            <LegalSummaryCallout summary={data.summary} />

            {/* Mobile Table of Contents */}
            <LegalToc
              sections={tocItems}
              activeSectionId={activeSectionId}
              onSelectSection={handleSelectSection}
            />

            {/* Rendered Sections */}
            <div className="space-y-6 text-base leading-[1.65] text-slate-800">
              {data.sections.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  <LegalSectionHeading
                    id={section.id}
                    number={section.number}
                    title={section.title}
                    level={2}
                  />

                  {section.description && (
                    <p className="mt-2 text-sm text-slate-600 font-medium">
                      {section.description}
                    </p>
                  )}

                  {section.paragraphs?.map((p, pIdx) => (
                    <p key={pIdx} className="mt-3 text-slate-800 font-medium">
                      {p}
                    </p>
                  ))}

                  {section.bullets && (
                    <ul className="mt-3 space-y-2 list-disc pl-5 font-medium text-slate-800">
                      {section.bullets.map((b, bIdx) => (
                        <li key={bIdx}>{b}</li>
                      ))}
                    </ul>
                  )}

                  {section.callout && <LegalCallout data={section.callout} />}

                  {section.table && <LegalTable data={section.table} />}

                  {section.twoColumn && (
                    <LegalTwoColumn
                      leftTitle={section.twoColumn.leftTitle}
                      leftItems={section.twoColumn.leftItems}
                      rightTitle={section.twoColumn.rightTitle}
                      rightItems={section.twoColumn.rightItems}
                    />
                  )}

                  {/* Nested Subsections */}
                  {section.subsections?.map((sub) => (
                    <div key={sub.id} id={sub.id} className="mt-6 scroll-mt-24">
                      <LegalSectionHeading
                        id={sub.id}
                        number={sub.number}
                        title={sub.title}
                        level={3}
                      />

                      {sub.paragraphs?.map((sp, spIdx) => (
                        <p key={spIdx} className="mt-2 text-slate-800 font-medium">
                          {sp}
                        </p>
                      ))}

                      {sub.bullets && (
                        <ul className="mt-2 space-y-1.5 list-disc pl-5 font-medium text-slate-800">
                          {sub.bullets.map((sb, sbIdx) => (
                            <li key={sbIdx}>{sb}</li>
                          ))}
                        </ul>
                      )}

                      {sub.callout && <LegalCallout data={sub.callout} />}
                      {sub.table && <LegalTable data={sub.table} />}
                    </div>
                  ))}
                </section>
              ))}
            </div>

            {/* Questions / Inquiries Block */}
            <LegalContactBlock />

            {/* Cross Links to Other 3 Legal Pages */}
            <LegalCrossLinks currentSlug={data.slug} />
          </main>

          {/* Desktop Sticky Right Table of Contents */}
          <LegalToc
            sections={tocItems}
            activeSectionId={activeSectionId}
            onSelectSection={handleSelectSection}
          />
        </div>
      </div>

      {/* Floating Scroll To Top Button */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Scroll back to top"
          className="fixed bottom-6 right-6 z-40 rounded-lg border-2 border-[#121212] bg-[#836EF9] p-2.5 text-white shadow-[3px_3px_0_0_#121212] hover:bg-[#7257f8] active:translate-x-0.5 active:translate-y-0.5 transition-all print:hidden"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}

      {/* Global Neo-Brutalist Footer (With Active State on Current Link) */}
      <footer className="mt-20 border-t-2 border-[#121212] bg-white py-14 px-4 sm:px-6 lg:px-8 print:hidden">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Col 1: Brand Info & Testnet Badge */}
            <div className="space-y-4 md:col-span-1">
              <Link href="/landing" className="flex items-center gap-2">
                <ClarioLogo size={28} />
                <span className="font-mono text-sm font-black text-[#121212] uppercase tracking-wider">
                  Clario
                </span>
              </Link>
              <p className="text-xs text-gray-700 font-medium leading-relaxed">
                Decentralized expense verification engine anchored to Monad Testnet.
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 border-[#121212] bg-[#f8f9fa] shadow-[2px_2px_0_0_#121212]">
                <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                <span className="font-mono text-[10px] font-black uppercase text-[#121212] tracking-wider">
                  Monad Testnet 10143
                </span>
              </div>
            </div>

            {/* Col 2: Navigation */}
            <div className="space-y-3">
              <span className="font-mono text-xs font-black text-[#121212] uppercase tracking-wider block mb-3.5 pb-1 border-b-2 border-[#121212]">
                Navigation
              </span>
              <ul className="space-y-2.5 font-mono text-xs font-bold uppercase tracking-wider">
                <li>
                  <Link
                    href="/landing"
                    className="text-gray-700 hover:text-[#836EF9] hover:translate-x-1 inline-flex items-center gap-1 transition-all"
                  >
                    Landing Overview
                  </Link>
                </li>
                <li>
                  <Link
                    href="/landing#modes"
                    className="text-gray-700 hover:text-[#836EF9] hover:translate-x-1 inline-flex items-center gap-1 transition-all"
                  >
                    Workspaces
                  </Link>
                </li>
                <li>
                  <Link
                    href="/landing#verifier"
                    className="text-gray-700 hover:text-[#836EF9] hover:translate-x-1 inline-flex items-center gap-1 transition-all"
                  >
                    Hash Simulator
                  </Link>
                </li>
                <li>
                  <Link
                    href="/?mode=personal"
                    className="text-gray-700 hover:text-[#836EF9] hover:translate-x-1 inline-flex items-center gap-1 transition-all"
                  >
                    Open Workspace
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 3: Resources */}
            <div className="space-y-3">
              <span className="font-mono text-xs font-black text-[#121212] uppercase tracking-wider block mb-3.5 pb-1 border-b-2 border-[#121212]">
                Resources
              </span>
              <ul className="space-y-2.5 font-mono text-xs font-bold uppercase tracking-wider">
                <li>
                  <Link
                    href="/docs"
                    className="text-gray-700 hover:text-[#836EF9] hover:translate-x-1 inline-flex items-center gap-1 transition-all"
                  >
                    Protocol Docs
                  </Link>
                </li>
                <li>
                  <a
                    href="https://docs.monad.xyz"
                    target="_blank"
                    rel="noreferrer"
                    className="text-gray-700 hover:text-[#836EF9] hover:translate-x-1 inline-flex items-center gap-1.5 transition-all"
                  >
                    Monad Docs <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/syther069/Clario"
                    target="_blank"
                    rel="noreferrer"
                    className="text-gray-700 hover:text-[#836EF9] hover:translate-x-1 inline-flex items-center gap-1.5 transition-all"
                  >
                    GitHub Source <GithubIcon className="h-3 w-3" />
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 4: Security & Legal (Highlights Current Active Page) */}
            <div className="space-y-3">
              <span className="font-mono text-xs font-black text-[#121212] uppercase tracking-wider block mb-3.5 pb-1 border-b-2 border-[#121212]">
                Security &amp; Legal
              </span>
              <ul className="space-y-2.5 font-mono text-xs font-bold uppercase tracking-wider">
                <li>
                  <Link
                    href="/privacy"
                    className={`inline-flex items-center gap-1.5 transition-all ${
                      data.slug === "privacy"
                        ? "text-[#836EF9] font-black underline decoration-2 underline-offset-4"
                        : "text-gray-700 hover:text-[#836EF9] hover:translate-x-1"
                    }`}
                  >
                    Privacy Policy
                    {data.slug === "privacy" && (
                      <span className="text-[10px] text-[#836EF9] font-black">[Active]</span>
                    )}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className={`inline-flex items-center gap-1.5 transition-all ${
                      data.slug === "terms"
                        ? "text-[#836EF9] font-black underline decoration-2 underline-offset-4"
                        : "text-gray-700 hover:text-[#836EF9] hover:translate-x-1"
                    }`}
                  >
                    Terms of Service
                    {data.slug === "terms" && (
                      <span className="text-[10px] text-[#836EF9] font-black">[Active]</span>
                    )}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/security"
                    className={`inline-flex items-center gap-1.5 transition-all ${
                      data.slug === "security"
                        ? "text-[#836EF9] font-black underline decoration-2 underline-offset-4"
                        : "text-gray-700 hover:text-[#836EF9] hover:translate-x-1"
                    }`}
                  >
                    Security Details
                    {data.slug === "security" && (
                      <span className="text-[10px] text-[#836EF9] font-black">[Active]</span>
                    )}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/disclosure"
                    className={`inline-flex items-center gap-1.5 transition-all ${
                      data.slug === "disclosure"
                        ? "text-[#836EF9] font-black underline decoration-2 underline-offset-4"
                        : "text-gray-700 hover:text-[#836EF9] hover:translate-x-1"
                    }`}
                  >
                    Disclosure
                    {data.slug === "disclosure" && (
                      <span className="text-[10px] text-[#836EF9] font-black">[Active]</span>
                    )}
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t-2 border-[#121212] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 font-mono text-xs font-black uppercase tracking-wider text-[#121212]">
              <span>© 2026 Clario Protocol</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-600 font-bold">All rights reserved</span>
            </div>
            <span className="font-mono text-[11px] font-bold text-gray-600 max-w-xl text-center sm:text-right leading-relaxed uppercase">
              Experimental software on Monad Testnet. Zero cloud leak. Immutable by code.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
