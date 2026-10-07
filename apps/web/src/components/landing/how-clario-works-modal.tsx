"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Lock,
  BadgeCheck,
  ShieldCheck,
  Zap,
  Layers,
  FileText,
  UserRound,
  BriefcaseBusiness,
  UsersRound,
  Building2,
  ExternalLink,
  Receipt,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MonadLogo } from "@/components/ui/crypto-icon";
import { ClarioLogo } from "@/components/ui/clario-logo";
import { AnimatedButton } from "@/components/ui/motion/animated-button";
import { TransitionPanel } from "@/components/ui/motion/transition-panel";

interface HowClarioWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSlide?: number;
}

export interface GuideSlide {
  id: string;
  stepNumber: string;
  category: string;
  title: string;
  description: string;
  takeaways: Array<{ title: string; desc: string }>;
  renderVisual: (onClose?: () => void) => React.ReactNode;
}

export const GUIDE_SLIDES: GuideSlide[] = [
  {
    id: "dual-ledger",
      stepNumber: "01",
      category: "DUAL SUB-LEDGER",
      title: "One Ledger for Cash, Cards & On-Chain Tokens",
      description:
        "Traditional finance apps ignore crypto wallets, while raw Web3 wallets have zero receipt organization. Clario unifies both into separate sub-ledgers under a single, coherent view.",
      takeaways: [
        {
          title: "Personal Sub-Ledger",
          desc: "Log daily cash, bank transfers, and debit card purchases without sharing bank login credentials.",
        },
        {
          title: "On-Chain Sub-Ledger",
          desc: "Ingest Monad Testnet (10143), Base, and Ethereum transactions directly via public EVM RPC.",
        },
        {
          title: "Zero Co-Mingling",
          desc: "Keep personal living expenses completely separated from protocol operations and client bills.",
        },
      ],
      renderVisual: () => (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b-2 border-[#121212] pb-3">
            <span className="text-[10px] font-mono font-black uppercase tracking-wider text-gray-500">
              LEDGER SEGREGATION ENGINE
            </span>
            <span className="text-[10px] font-mono font-bold bg-[#836EF9] text-white px-2 py-0.5 rounded">
              DUAL PIPELINE ACTIVE
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Fiat Sub-Ledger */}
            <div className="bg-[#f8f9fa] rounded-xl border-2 border-[#121212] p-3 shadow-[2px_2px_0_0_#121212]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono font-black uppercase text-gray-700">
                  FIAT SUB-LEDGER
                </span>
                <span className="text-[9px] font-mono uppercase bg-white border border-[#121212] px-1.5 py-0.5 rounded font-bold">
                  LOCAL VAULT
                </span>
              </div>
              <div className="text-base font-black text-[#121212]">$2,450.00</div>
              <div className="text-[10px] font-mono text-gray-500 mt-1">
                Checking · Cash · Credit Card
              </div>
              <div className="mt-2.5 pt-2 border-t border-gray-200 text-[10px] font-mono text-gray-700 flex items-center justify-between">
                <span>Recent:</span>
                <span className="font-bold text-[#121212]">Coffee & Lunch — $18.40</span>
              </div>
            </div>

            {/* Onchain Sub-Ledger */}
            <div className="bg-[#f3f0ff] rounded-xl border-2 border-[#121212] p-3 shadow-[2px_2px_0_0_#121212]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono font-black uppercase text-[#836EF9]">
                  ON-CHAIN SUB-LEDGER
                </span>
                <span className="text-[9px] font-mono uppercase bg-[#836EF9] text-white px-1.5 py-0.5 rounded font-black">
                  CHAIN 10143
                </span>
              </div>
              <div className="text-base font-black text-[#121212]">1,280.50 MON</div>
              <div className="text-[10px] font-mono text-gray-500 mt-1">
                Monad Testnet · Base · Sepolia
              </div>
              <div className="mt-2.5 pt-2 border-t border-[#836EF9]/20 text-[10px] font-mono text-gray-700 flex items-center justify-between">
                <span>Direct RPC:</span>
                <span className="font-bold text-[#836EF9]">Auto-Ingested Viem</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border-2 border-dashed border-[#836EF9] bg-white p-3 font-mono text-[11px] text-gray-700">
            <span className="font-bold text-[#836EF9] uppercase block mb-1">
              Synchronized Balance Summary
            </span>
            Both ledgers calculate combined net cashflow while preserving pristine audit boundaries for taxes and reimbursements.
          </div>
        </div>
      ),
    },
    {
      id: "four-modes",
      stepNumber: "02",
      category: "DEDICATED WORKSPACES",
      title: "Workspaces Built for How You Actually Spend",
      description:
        "Finance tools fail when one rigid UI tries to fit solo spending, client billing, and corporate policies. Clario gives you 4 distinct workspace engines with 1-click switching.",
      takeaways: [
        {
          title: "Personal Workspace",
          desc: "Monthly category budget caps, live warning alerts, and automatic recurring SaaS subscription renewal detection.",
        },
        {
          title: "Freelancer Workspace",
          desc: "Assign expenses to clients, issue milestone invoices, and categorize Schedule C tax deductibles.",
        },
        {
          title: "Family Workspace",
          desc: "Shared household pools, transparent member breakdowns, and automated balance settlement calculations.",
        },
        {
          title: "Business Workspace",
          desc: "Multi-seat team members, structured approval queues, departmental policy rules, and reimbursement ledgers.",
        },
      ],
      renderVisual: () => (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white border-2 border-[#121212] rounded-xl p-2.5 shadow-[2px_2px_0_0_#121212]">
              <div className="flex items-center gap-1.5 text-xs font-mono font-black uppercase text-[#121212]">
                <UserRound className="h-3.5 w-3.5 text-[#836EF9]" />
                Personal
              </div>
              <p className="text-[10px] text-gray-600 font-mono mt-1">
                Budgets, recurring alerts & dual sub-ledger.
              </p>
            </div>
            <div className="bg-white border-2 border-[#121212] rounded-xl p-2.5 shadow-[2px_2px_0_0_#121212]">
              <div className="flex items-center gap-1.5 text-xs font-mono font-black uppercase text-[#121212]">
                <BriefcaseBusiness className="h-3.5 w-3.5 text-[#836EF9]" />
                Freelancer
              </div>
              <p className="text-[10px] text-gray-600 font-mono mt-1">
                Client billing, invoices & Schedule C write-offs.
              </p>
            </div>
            <div className="bg-white border-2 border-[#121212] rounded-xl p-2.5 shadow-[2px_2px_0_0_#121212]">
              <div className="flex items-center gap-1.5 text-xs font-mono font-black uppercase text-[#121212]">
                <UsersRound className="h-3.5 w-3.5 text-[#836EF9]" />
                Family
              </div>
              <p className="text-[10px] text-gray-600 font-mono mt-1">
                Household pools, shared bills & fair split settlements.
              </p>
            </div>
            <div className="bg-white border-2 border-[#121212] rounded-xl p-2.5 shadow-[2px_2px_0_0_#121212]">
              <div className="flex items-center gap-1.5 text-xs font-mono font-black uppercase text-[#121212]">
                <Building2 className="h-3.5 w-3.5 text-[#836EF9]" />
                Business
              </div>
              <p className="text-[10px] text-gray-600 font-mono mt-1">
                Team approvals, spending caps & nullifier payouts.
              </p>
            </div>
          </div>

          <div className="bg-[#121212] text-white rounded-xl p-3 border-2 border-[#121212] font-mono text-[11px] space-y-1">
            <div className="flex items-center justify-between text-[#836EF9] font-black uppercase">
              <span>Instant Workspace Switching</span>
              <span className="text-white text-[10px] bg-white/20 px-1.5 py-0.5 rounded">1-CLICK</span>
            </div>
            <p className="text-gray-300">
              No new accounts or re-logging required. Switch modes instantly from the top navigation bar while keeping your local preferences and data intact.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "private-evidence",
      stepNumber: "03",
      category: "CONFIDENTIAL ENVELOPE",
      title: "What Happens in Your Receipt Stays in Your Vault",
      description:
        "Founder Invariant #1: Private evidence remains offchain. When you attach a receipt or invoice, Clario never uploads private PDFs, vendor names, or customer PII to any public blockchain.",
      takeaways: [
        {
          title: "Local-First Hashing",
          desc: "Your browser computes an irreversible SHA-256 digest of the raw receipt bytes directly on your device.",
        },
        {
          title: "Confidential OCR",
          desc: "Merchant names and line items are extracted client-side to automate expense drafting without data leakage.",
        },
        {
          title: "Cryptographic Commitment",
          desc: "Only the mathematical 32-byte digest hash is committed to Monad, ensuring private commercial confidentiality.",
        },
      ],
      renderVisual: () => (
        <div className="space-y-3 font-mono">
          <div className="bg-[#ffffff] rounded-xl border-2 border-[#121212] p-3 shadow-[2px_2px_0_0_#121212] space-y-2">
            <div className="flex items-center gap-2 text-xs font-black text-[#121212] uppercase">
              <Receipt className="h-4 w-4 text-[#836EF9]" />
              <span>Step 1: Receipt Upload in Browser</span>
            </div>
            <div className="bg-[#f8f9fa] border border-gray-300 rounded p-2 text-[10px] text-gray-700">
              <span className="font-bold text-gray-900">Offchain Vault:</span> Invoice-1049.pdf (Vendor, Itemized amounts, Tax ID)
            </div>
          </div>

          <div className="text-center font-bold text-xs text-[#836EF9] uppercase">
            ↓ SHA-256 Digest Computed Locally ↓
          </div>

          <div className="bg-[#121212] text-white rounded-xl border-2 border-[#121212] p-3 shadow-[2px_2px_0_0_#836EF9] space-y-1.5">
            <div className="flex items-center justify-between text-xs font-black text-[#836EF9] uppercase">
              <span className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                Step 2: On-Chain Commitment
              </span>
              <span className="text-[9px] bg-[#836EF9] text-white px-1.5 py-0.5 rounded">
                MONAD #10143
              </span>
            </div>
            <div className="text-[10px] text-gray-300 break-all bg-black/50 p-2 rounded border border-white/10">
              0x89f4b7a120c8de3176ef98231c51bc19aa314
            </div>
            <p className="text-[9px] text-[#10b981] font-bold">
              ✓ Verified offchain link · Zero leaked vendor PII
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "settlement-proof",
      stepNumber: "04",
      category: "DETERMINISTIC SETTLEMENT",
      title: "Sub-Second Monad Finality & Anti-Duplicate Nullifiers",
      description:
        "When business treasury approves a reimbursement or an expense is settled, Monad executes with sub-second parallel finality. An onchain nullifier guarantees that duplicate reimbursement claims fail permanently.",
      takeaways: [
        {
          title: "Sub-Second Finality (< 0.8s)",
          desc: "Monad's 10,000 TPS parallel EVM confirms transactions virtually instantaneously with micro-gas fees ($0.0003).",
        },
        {
          title: "Strict Anti-Duplicate Nullifier",
          desc: "Smart contracts record a cryptographic nullifier for every settled commitment; duplicate submissions revert immediately.",
        },
        {
          title: "AI Has Zero Authority",
          desc: "AI assists with classification and duplicate warnings, but cannot sign transactions or move treasury funds.",
        },
      ],
      renderVisual: () => (
        <div className="space-y-3 font-mono">
          <div className="bg-[#ffffff] rounded-xl border-2 border-[#121212] p-3 shadow-[2px_2px_0_0_#121212] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-gray-700">
                MONAD PARALLEL CONSENSUS
              </span>
              <span className="text-[10px] font-black text-[#10b981] bg-[#dcfce7] px-2 py-0.5 rounded border border-[#15803d]">
                FINALIZED IN 0.74s
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-[#f8f9fa] p-2 rounded border border-gray-200">
                <span className="text-[9px] text-gray-500 block">GAS FEE PAID:</span>
                <span className="font-bold text-[#121212]">0.00012 MON</span>
              </div>
              <div className="bg-[#f8f9fa] p-2 rounded border border-gray-200">
                <span className="text-[9px] text-gray-500 block">NULLIFIER STATE:</span>
                <span className="font-bold text-[#836EF9]">UNSPENT → CLAIMED</span>
              </div>
            </div>
          </div>

          <div className="bg-[#f3f0ff] rounded-xl border-2 border-[#121212] p-3 text-xs text-gray-800 space-y-1 shadow-[2px_2px_0_0_#121212]">
            <span className="font-black text-[#836EF9] uppercase block text-[10px]">
              Independent Verification
            </span>
            <p className="text-[11px] leading-relaxed">
              Anyone with the voucher hash can independently verify settlement validity in the Proof Center without contacting a bank or logging into private servers.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "ready-to-begin",
      stepNumber: "05",
      category: "GET STARTED NOW",
      title: "Start Free in Under 10 Seconds",
      description:
        "No wallet setup required to begin. Manage your personal spending, family expenses, or freelance client records immediately in your browser, and connect Monad when you want cryptographic proofs.",
      takeaways: [
        {
          title: "Instant In-Browser Setup",
          desc: "Start tracking expenses right away; your workspace preferences and records persist safely.",
        },
        {
          title: "Flexible Authentication",
          desc: "Sign in with Email, Passkeys, Google, or your Web3 Wallet whenever you want cloud backup.",
        },
        {
          title: "Public Proof Verifier",
          desc: "Test the sandbox anytime with live transaction hashes on Monad Testnet.",
        },
      ],
      renderVisual: (onClose) => (
        <div className="bg-[#ffffff] rounded-xl border-2 border-[#121212] p-4 shadow-[3px_3px_0_0_#121212] space-y-3 font-mono">
          <div className="text-center pb-2 border-b-2 border-[#121212]/15">
            <span className="text-xs font-black uppercase text-[#836EF9]">
              Choose Your Starting Workspace
            </span>
            <p className="text-[11px] text-gray-600 mt-0.5">
              Select any mode to launch immediately:
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/?mode=personal"
              onClick={() => onClose?.()}
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border-2 border-[#121212] bg-[#f8f9fa] hover:bg-[#836EF9] hover:text-white transition font-black text-[11px] uppercase shadow-[1.5px_1.5px_0_0_#121212]"
            >
              <UserRound className="h-3.5 w-3.5" />
              <span>Personal</span>
            </Link>
            <Link
              href="/?mode=freelancer"
              onClick={() => onClose?.()}
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border-2 border-[#121212] bg-[#f8f9fa] hover:bg-[#836EF9] hover:text-white transition font-black text-[11px] uppercase shadow-[1.5px_1.5px_0_0_#121212]"
            >
              <BriefcaseBusiness className="h-3.5 w-3.5" />
              <span>Freelancer</span>
            </Link>
            <Link
              href="/?mode=family"
              onClick={() => onClose?.()}
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border-2 border-[#121212] bg-[#f8f9fa] hover:bg-[#836EF9] hover:text-white transition font-black text-[11px] uppercase shadow-[1.5px_1.5px_0_0_#121212]"
            >
              <UsersRound className="h-3.5 w-3.5" />
              <span>Family</span>
            </Link>
            <Link
              href="/?mode=business"
              onClick={() => onClose?.()}
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border-2 border-[#121212] bg-[#f8f9fa] hover:bg-[#836EF9] hover:text-white transition font-black text-[11px] uppercase shadow-[1.5px_1.5px_0_0_#121212]"
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Business</span>
            </Link>
          </div>

          <div className="pt-2 text-center">
            <Link
              href="/proof"
              onClick={() => onClose?.()}
              className="text-[10px] font-bold text-[#836EF9] hover:underline uppercase inline-flex items-center gap-1"
            >
              <ShieldCheck className="h-3 w-3" />
              Or explore the independent Proof Center
            </Link>
          </div>
        </div>
      ),
    },
  ];

  export function HowClarioWorksModal({
    isOpen,
    onClose,
    initialSlide = 0,
  }: HowClarioWorksModalProps) {
    const [activeSlide, setActiveSlide] = useState(initialSlide);

    useEffect(() => {
      if (isOpen) {
        setActiveSlide(initialSlide);
      }
    }, [isOpen, initialSlide]);

    // Lock body scroll when modal is open
    useEffect(() => {
      if (isOpen) {
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = "unset";
      }
      return () => {
        document.body.style.overflow = "unset";
      };
    }, [isOpen]);

    const handleNext = useCallback(() => {
      setActiveSlide((prev) => (prev < 4 ? prev + 1 : prev));
    }, []);

    const handlePrev = useCallback(() => {
      setActiveSlide((prev) => (prev > 0 ? prev - 1 : prev));
    }, []);

    // Keyboard navigation: Escape closes, Left/Right arrows navigate
    useEffect(() => {
      if (!isOpen) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        } else if (e.key === "ArrowRight") {
          handleNext();
        } else if (e.key === "ArrowLeft") {
          handlePrev();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose, handleNext, handlePrev]);

    const slides = GUIDE_SLIDES;
    const currentSlide = slides[activeSlide] ?? slides[0]!;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#121212]/75 backdrop-blur-sm cursor-pointer"
            aria-hidden="true"
          />

          {/* Modal Container */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-modal-title"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl bg-[#ffffff] rounded-2xl border-3 border-[#121212] shadow-[8px_8px_0_0_#121212] overflow-hidden z-10 my-auto flex flex-col"
          >
            {/* Top Bar */}
            <div className="bg-[#121212] text-white px-4 sm:px-6 py-3 flex items-center justify-between border-b-2 border-[#121212]">
              <div className="flex items-center gap-3">
                <ClarioLogo size={24} />
                <span className="text-xs font-mono font-black uppercase tracking-wider text-gray-200">
                  How Clario Works
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-[#836EF9] text-white px-2 py-0.5 rounded uppercase">
                  <MonadLogo className="h-2.5 w-2.5" />
                  Monad Parallel EVM
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-gray-400">
                  <span className="text-white font-black">{currentSlide.stepNumber}</span> / 05
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close guide modal"
                  className="rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-white/10 transition border border-transparent hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#836EF9]"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Segmented Step Tabs */}
            <div className="bg-[#f9fafb] border-b-2 border-[#121212] px-3 sm:px-6 py-2.5 overflow-x-auto">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-max">
                {slides.map((s, idx) => {
                  const isActive = activeSlide === idx;
                  const isCompleted = activeSlide > idx;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveSlide(idx)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-mono text-[11px] font-black uppercase tracking-wider transition border-1.5 ${
                        isActive
                          ? "bg-[#836EF9] text-white border-[#121212] shadow-[2px_2px_0_0_#121212]"
                          : isCompleted
                          ? "bg-white text-gray-900 border-[#121212] hover:bg-gray-100"
                          : "bg-transparent text-gray-500 border-transparent hover:text-gray-900 hover:border-gray-300"
                      }`}
                    >
                      <span>{s.stepNumber}</span>
                      <span className="hidden md:inline">{s.category}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Slide Body Content */}
            <div className="p-5 sm:p-8 overflow-y-auto max-h-[calc(85vh-160px)]">
              <TransitionPanel
                activeIndex={activeSlide}
                className="w-full"
                transition={{
                  type: "spring",
                  stiffness: 340,
                  damping: 30,
                }}
              >
                {slides.map((slide) => (
                  <div
                    key={slide.id}
                    className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start"
                  >
                    {/* Left Editorial Content */}
                    <div className="lg:col-span-7 space-y-4">
                      <div>
                        <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#836EF9] bg-[#f3f0ff] px-2.5 py-1 rounded border border-[#836EF9]/40">
                          {slide.category}
                        </span>
                        <h2
                          id="guide-modal-title"
                          className="text-xl sm:text-2xl lg:text-3xl font-black text-[#121212] tracking-tight mt-2.5 leading-snug"
                        >
                          {slide.title}
                        </h2>
                      </div>

                      <p className="text-xs sm:text-sm text-gray-700 font-medium leading-relaxed">
                        {slide.description}
                      </p>

                      {/* Takeaways list */}
                      <div className="space-y-2.5 pt-2 border-t-2 border-[#121212]/10">
                        {slide.takeaways.map((point, pIdx) => (
                          <div key={pIdx} className="flex items-start gap-2.5">
                            <BadgeCheck
                              className="h-4 w-4 text-[#836EF9] shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                            <div>
                              <span className="text-xs font-mono font-bold text-[#121212]">
                                {point.title}:{" "}
                              </span>
                              <span className="text-xs text-gray-600 font-medium leading-relaxed">
                                {point.desc}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right Interactive Mockup Card */}
                    <div className="lg:col-span-5 bg-grid rounded-xl border-2 border-[#121212] p-4 shadow-[4px_4px_0_0_#121212] bg-[#fafafa]">
                      {slide.renderVisual(onClose)}
                    </div>
                  </div>
                ))}
              </TransitionPanel>
            </div>

            {/* Bottom Controls Bar */}
            <div className="bg-[#ffffff] border-t-2 border-[#121212] px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
              {/* Previous Button */}
              <AnimatedButton
                variant="secondary"
                size="sm"
                onClick={handlePrev}
                disabled={activeSlide === 0}
                icon={<ChevronLeft className="h-4 w-4" aria-hidden="true" />}
              >
                Previous
              </AnimatedButton>

              {/* Step indicator dots */}
              <div className="flex items-center gap-1.5">
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveSlide(idx)}
                    aria-label={`Go to slide ${idx + 1}`}
                    className={`h-2 rounded-full transition-all ${
                      activeSlide === idx
                        ? "w-6 bg-[#836EF9]"
                        : "w-2 bg-gray-300 hover:bg-gray-400"
                    }`}
                  />
                ))}
              </div>

              {/* Next / Launch Button */}
              {activeSlide < 4 ? (
                <AnimatedButton
                  variant="primary"
                  size="sm"
                  onClick={handleNext}
                  rightIcon={<ChevronRight className="h-4 w-4" aria-hidden="true" />}
                >
                  Next Step
                </AnimatedButton>
              ) : (
                <Link href="/?mode=personal" onClick={onClose}>
                  <AnimatedButton
                    variant="primary"
                    size="sm"
                    rightIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
                  >
                    Launch App Free
                  </AnimatedButton>
                </Link>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
