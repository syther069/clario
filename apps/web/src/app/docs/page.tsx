"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { DOC_SECTIONS, type DocSection } from "./docs-data";
import { DocsSidebar } from "./docs-sidebar";
import { DocsToc } from "./docs-toc";
import { DocsSearchModal } from "./docs-search-modal";
import { DocSectionContent } from "./docs-content";
import { ClarioLogo } from "@/components/ui/clario-logo";
import { MonadLogo } from "@/components/ui/crypto-icon";
import { ScrollProgress } from "@/components/ui/motion/scroll-progress";
import {
  Search,
  Menu,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

function DocsMainContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialSection = searchParams.get("s") || "overview";
  const [activeSectionId, setActiveSectionId] = useState<string>(initialSection);
  const [activeSubsectionId, setActiveSubsectionId] = useState<string>("");
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Sync state if query changes
  useEffect(() => {
    const s = searchParams.get("s");
    if (s && DOC_SECTIONS.some((sec) => sec.id === s)) {
      setActiveSectionId(s);
    }
  }, [searchParams]);

  const activeSection: DocSection =
    DOC_SECTIONS.find((sec) => sec.id === activeSectionId) ?? DOC_SECTIONS[0]!;

  const currentIndex = DOC_SECTIONS.findIndex((sec) => sec.id === activeSection.id);
  const prevSection = currentIndex > 0 ? DOC_SECTIONS[currentIndex - 1] : null;
  const nextSection =
    currentIndex < DOC_SECTIONS.length - 1 ? DOC_SECTIONS[currentIndex + 1] : null;

  // Handle section switch
  const handleSelectSection = (id: string, subsectionId?: string) => {
    setActiveSectionId(id);
    setMobileMenuOpen(false);
    router.push(`/docs?s=${id}`, { scroll: false });

    if (subsectionId) {
      setTimeout(() => {
        const el = document.getElementById(subsectionId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          setActiveSubsectionId(subsectionId);
        }
      }, 50);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
      const firstSub = activeSection.subsections[0];
      if (firstSub) {
        setActiveSubsectionId(firstSub.id);
      }
    }
  };

  const handleSelectSubsection = (subId: string) => {
    setActiveSubsectionId(subId);
    const el = document.getElementById(subId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Scroll spy for active subsection with smooth requestAnimationFrame throttling
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setShowScrollTop(window.scrollY > 400);

          const subElements = activeSection.subsections
            .map((sub) => ({ id: sub.id, el: document.getElementById(sub.id) }))
            .filter((item): item is { id: string; el: HTMLElement } => item.el !== null);

          for (let i = subElements.length - 1; i >= 0; i--) {
            const item = subElements[i];
            if (!item) continue;
            const rect = item.el.getBoundingClientRect();
            if (rect.top <= 140) {
              setActiveSubsectionId(item.id);
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
  }, [activeSection]);

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#121212] font-sans selection:bg-[#836EF9]/20 selection:text-[#836EF9] scroll-smooth">
      {/* Top Reading Progress Bar */}
      <ScrollProgress className="h-1 bg-[#836EF9] z-50" />

      {/* Global Documentation Header - Solid Matte Substrate, Zero Glassmorphism */}
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b-2 border-[#121212] bg-[#FDFBF7] px-4 sm:px-6">
        <div className="flex items-center gap-3">
          {/* Mobile menu trigger */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open documentation navigation"
            className="flex h-9 w-9 items-center justify-center rounded-md border-2 border-[#121212] bg-white lg:hidden shadow-[2px_2px_0_0_#121212] active:translate-x-0.5 active:translate-y-0.5"
          >
            <Menu className="h-5 w-5 text-[#121212]" />
          </button>

          {/* Logo link back to dashboard */}
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <ClarioLogo className="h-7 w-7 transition-transform group-hover:scale-105" />
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-base font-black tracking-tight text-[#121212]">
                CLARIO
              </span>
              <span className="rounded border border-[#121212] bg-[#836EF9] px-1.5 py-0.2 font-mono text-[10px] font-black uppercase tracking-wider text-white shadow-[1px_1px_0_0_#121212]">
                DOCS
              </span>
            </div>
          </Link>
        </div>

        {/* Telemetry Status Strip */}
        <div className="hidden lg:flex items-center gap-2 font-mono text-[11px] font-bold text-slate-500 uppercase">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>SPECIFICATION // MONAD PROTOCOL REGISTRY (10143)</span>
        </div>

        {/* Search trigger & Header Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setSearchModalOpen(true)}
            className="flex items-center gap-2.5 rounded-md border-2 border-[#121212] bg-white px-3 py-1.5 text-xs font-mono font-bold text-slate-600 shadow-[2px_2px_0_0_#121212] transition hover:bg-slate-50 active:translate-x-0.5 active:translate-y-0.5"
          >
            <Search className="h-3.5 w-3.5 text-[#836EF9]" />
            <span className="hidden sm:inline uppercase tracking-wider">Search...</span>
            <kbd className="hidden sm:inline rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700 font-bold">
              ⌘K
            </kbd>
          </button>

          {/* External Links */}
          <div className="hidden md:flex items-center gap-2 pl-2 border-l-2 border-[#121212]/20">
            <a
              href="https://github.com/syther069/Clario"
              target="_blank"
              rel="noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-md border-2 border-[#121212] bg-white shadow-[2px_2px_0_0_#121212] hover:bg-slate-50 transition active:translate-x-0.5 active:translate-y-0.5"
              aria-label="GitHub Repository"
            >
              <GithubIcon className="h-4 w-4 text-[#121212]" />
            </a>
            <a
              href="https://docs.monad.xyz"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-md border-2 border-[#121212] bg-white px-2.5 py-1.5 text-xs font-mono font-bold text-[#121212] shadow-[2px_2px_0_0_#121212] hover:bg-[#836EF9]/10 transition active:translate-x-0.5 active:translate-y-0.5"
            >
              <MonadLogo className="h-3.5 w-3.5" />
              <span className="uppercase text-[11px]">Monad Docs</span>
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
            <Link
              href="/dashboard"
              className="flex items-center gap-1 rounded-md border-2 border-[#121212] bg-[#836EF9] px-3 py-1.5 text-xs font-mono font-black uppercase text-white shadow-[2px_2px_0_0_#121212] hover:bg-[#7257f8] transition active:translate-x-0.5 active:translate-y-0.5"
            >
              App <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Documentation Body */}
      <div className="mx-auto flex max-w-7xl">
        {/* Desktop Sidebar Navigation */}
        <DocsSidebar
          activeSectionId={activeSection.id}
          activeSubsectionId={activeSubsectionId}
          onSelectSection={(id) => handleSelectSection(id)}
          onSelectSubsection={handleSelectSubsection}
          onOpenSearch={() => setSearchModalOpen(true)}
          isOpenMobile={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        {/* Center Content Rail */}
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-12">
          {/* Breadcrumb Bar */}
          <nav aria-label="Breadcrumbs" className="mb-6 flex items-center gap-2 text-xs font-mono text-slate-500 pb-2 border-b border-[#121212]/15">
            <Link href="/docs" className="hover:text-[#121212] font-black uppercase">
              SPEC
            </Link>
            <span>//</span>
            <span className="font-bold text-slate-600 uppercase">{activeSection.group}</span>
            <span>//</span>
            <span className="font-black text-[#836EF9] uppercase tracking-wider">
              {activeSection.title}
            </span>
          </nav>

          {/* Section Dynamic Content */}
          <div className="min-h-[500px]">
            <DocSectionContent sectionId={activeSection.id} />
          </div>

          {/* Pagination: Previous & Next Section Buttons */}
          <div className="mt-16 pt-8 border-t-2 border-[#121212] grid grid-cols-1 sm:grid-cols-2 gap-4">
            {prevSection ? (
              <button
                onClick={() => handleSelectSection(prevSection.id)}
                className="group flex flex-col items-start rounded-md border-2 border-[#121212] bg-white p-4 text-left shadow-[3px_3px_0_0_#121212] transition hover:bg-slate-50 active:translate-x-0.5 active:translate-y-0.5"
              >
                <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase text-slate-500 group-hover:text-[#836EF9]">
                  <ArrowLeft className="h-3 w-3" /> [ PREV SPECIFICATION ]
                </div>
                <div className="mt-1 font-mono text-sm font-black text-[#121212]">
                  {prevSection.title}
                </div>
                <div className="text-xs text-slate-500 font-medium truncate w-full mt-0.5 font-sans">
                  {prevSection.description}
                </div>
              </button>
            ) : (
              <div />
            )}

            {nextSection && (
              <button
                onClick={() => handleSelectSection(nextSection.id)}
                className="group flex flex-col items-end rounded-md border-2 border-[#121212] bg-white p-4 text-right shadow-[3px_3px_0_0_#121212] transition hover:bg-slate-50 active:translate-x-0.5 active:translate-y-0.5 sm:col-start-2"
              >
                <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase text-slate-500 group-hover:text-[#836EF9]">
                  [ NEXT SPECIFICATION ] <ArrowRight className="h-3 w-3" />
                </div>
                <div className="mt-1 font-mono text-sm font-black text-[#121212]">
                  {nextSection.title}
                </div>
                <div className="text-xs text-slate-500 font-medium truncate w-full mt-0.5 font-sans">
                  {nextSection.description}
                </div>
              </button>
            )}
          </div>

          {/* Bottom Footer Info */}
          <footer className="mt-12 pt-6 border-t-2 border-[#121212]/15 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
            <div>
              CLARIO PROTOCOL // VERIFICATION &amp; LEDGER SPECIFICATION. MIT LICENSE.
            </div>
            <div className="flex items-center gap-4 uppercase font-bold">
              <a
                href="https://github.com/syther069/Clario"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#121212]"
              >
                [ GitHub ]
              </a>
              <a
                href="https://testnet.monadexplorer.com/address/0x92f9B76673C1D88c9E3c490A88eB95b08823bA87"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#121212]"
              >
                [ Monad Contract ]
              </a>
            </div>
          </footer>
        </main>

        {/* Skiper 60-Inspired Sticky Right Table of Contents */}
        <DocsToc
          subsections={activeSection.subsections}
          activeSubsectionId={activeSubsectionId}
          onSelectSubsection={handleSelectSubsection}
        />
      </div>

      {/* Instant Search Modal */}
      <DocsSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onSelectSection={(sectionId, subId) => {
          handleSelectSection(sectionId, subId);
          setSearchModalOpen(false);
        }}
      />

      {/* Floating Smooth Scroll-to-Top Indicator */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.9 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="Scroll back to top of document"
            className="fixed bottom-6 right-6 z-40 flex items-center gap-1.5 rounded-md border-2 border-[#121212] bg-white px-3 py-2 text-xs font-mono font-black uppercase text-[#121212] shadow-[3px_3px_0_0_#121212] transition hover:bg-[#836EF9] hover:text-white active:translate-x-0.5 active:translate-y-0.5"
          >
            <ArrowUp className="h-3.5 w-3.5" />
            <span>TOP</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function DocsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7] font-mono text-sm font-bold text-[#121212]">
          [ LOADING CLARIO SPECIFICATION MANUAL... ]
        </div>
      }
    >
      <DocsMainContent />
    </Suspense>
  );
}
