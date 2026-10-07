"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  BadgeCheck,
  ArrowRight,
  Layers,
  ChevronDown,
  ExternalLink,
  Receipt,
  Check,
  Copy,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { MonadLogo } from "@/components/ui/crypto-icon";
import { ClarioLogo } from "@/components/ui/clario-logo";
import {
  TextEffect,
  InteractiveCard,
  ScrollProgress,
  Magnetic,
} from "@/components/ui/motion";
import { motion, AnimatePresence, useScroll } from "motion/react";
import { HowClarioWorksModal } from "@/components/landing/how-clario-works-modal";
import { WorkspaceShowcase } from "@/components/landing/workspace-showcase";
import { FollowReceiptRail } from "@/components/landing/follow-receipt-rail";
import { BeforeAfterSection } from "@/components/landing/before-after-section";

// Sample Expenses for Hero Voucher Sandbox
const SAMPLE_EXPENSES = [
  {
    id: "EXP-9042",
    title: "Dedicated Cloud Cluster",
    vendor: "QuickNode Infrastructure",
    amount: "$840.00",
    category: "Cloud Services",
    hash: "0x89f4b7a120c8de3176ef98231c51bc19aa314",
    blockHeight: "19,842,912",
    status: "Verified & Settled",
    privacy: "Invoice stays on your laptop · Never published publicly",
    gasFee: "0.00012 MON (< $0.001)",
    verificationMethod: "SHA-256 pre-image commitment with unspent nullifier",
  },
  {
    id: "EXP-9043",
    title: "Team Conference Flight & Hotel",
    vendor: "United Airlines & Marriott",
    amount: "$1,620.00",
    category: "Team Travel",
    hash: "0x4b7c11f9e9842dc59012a6771e8bf43912da0",
    blockHeight: "19,842,945",
    status: "Approved by Treasury",
    privacy: "Ticket details and passenger names encrypted on device",
    gasFee: "0.00014 MON (< $0.001)",
    verificationMethod: "EIP-712 treasury approval over canonical hash",
  },
  {
    id: "EXP-9044",
    title: "Security Review Retainer",
    vendor: "Independent Security Lab",
    amount: "$4,500.00",
    category: "Security Review",
    hash: "0x3f1e98bb4510ad674902187cc8431920fba61",
    blockHeight: "19,842,980",
    status: "Verified & Settled",
    privacy: "Scope and notes offchain · Proof fingerprint on Monad",
    gasFee: "0.00011 MON (< $0.001)",
    verificationMethod: "SHA-256 pre-image commitment with unspent nullifier",
  },
];

// Plain-English FAQs
const FAQS = [
  {
    question: "How much does it cost to use Clario?",
    answer:
      "Clario is completely free to test on Monad testnet. Recording verified proof only costs a tiny fraction of a cent in testnet gas fees.",
  },
  {
    question: "What wallets are supported?",
    answer:
      "You can connect any standard crypto wallet, including MetaMask, Rabby, Phantom, and WalletConnect. We support Monad Testnet, Ethereum, Base, and Sepolia.",
  },
  {
    question: "How do my receipts stay private?",
    answer:
      "Your invoices and receipts are encrypted and stored directly on your own device. Only an unreadable mathematical fingerprint is saved to Monad. Nobody on the blockchain can view your merchant names, line items, or uploaded PDFs.",
  },
  {
    question: "How does duplicate payout prevention work?",
    answer:
      "When an expense is approved and settled, the smart contract marks that receipt's unique fingerprint as paid. If someone accidentally submits the same receipt again, the contract rejects it automatically.",
  },
  {
    question: "How do I back up my receipts?",
    answer:
      "You can download a complete backup package (ZIP) from your workspace with one click. Save it on your computer or forward it to your accountant anytime.",
  },
  {
    question: "What happens if I clear my browser history or switch computers?",
    answer:
      "Your verified proof stays permanently safe on Monad. Because receipt images stay on your own computer rather than our servers, we recommend downloading a backup package before clearing browser storage.",
  },
  {
    question: "Can an auditor or tax authority verify my expenses?",
    answer:
      "Yes. Anyone with your exported backup package or expense link can verify the proof offline in seconds, without needing an account or asking Clario for permission.",
  },
  {
    question: "Is Clario audited?",
    answer:
      "Clario is currently experimental software running on Monad testnet for community demonstration. The smart contracts have not yet completed a formal third-party security audit. Please do not use it with real funds.",
  },
];

const NAV_LINKS = [
  { label: "How It Works", href: "#receipt-flow" },
  { label: "Workspaces", href: "#modes" },
  { label: "Advantage", href: "#comparison" },
  { label: "Simulator", href: "#verifier" },
  { label: "FAQ", href: "#faq" },
];

export default function LandingPage() {
  const [selectedExpense, setSelectedExpense] = useState(0);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [showVoucherDetails, setShowVoucherDetails] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [isNavCompact, setIsNavCompact] = useState(false);

  // Hash Verifier Simulator state
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<null | {
    valid: boolean;
    timestamp: string;
    block: string;
    approver: string;
    details: string;
  }>(null);

  // FAQ Accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const { scrollY } = useScroll();

  useEffect(() => {
    return scrollY.on("change", (latest) => {
      setIsNavCompact(latest > 24);
    });
  }, [scrollY]);

  const activeExpense =
    SAMPLE_EXPENSES[selectedExpense] ?? SAMPLE_EXPENSES[0]!;

  const handleCopyHash = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(activeExpense.hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const handleRunVerify = () => {
    setIsVerifying(true);
    setVerificationResult(null);
    setTimeout(() => {
      setIsVerifying(false);
      setVerificationResult({
        valid: true,
        timestamp: "Just now",
        block: "19,842,912",
        approver: "0x7E5F4552091A69125d5Dfcb7b8C2659029395Bdf",
        details:
          "Receipt fingerprint matches the local file. Record is verified on Monad Testnet and has not been paid twice.",
      });
    }, 600);
  };

  return (
    <div className="min-h-screen bg-grid text-gray-900 font-sans selection:bg-[#7C6CF6] selection:text-white relative">
      <ScrollProgress />


      {/* Navigation Header (Montally Neo-Brutalism) */}
      <header
        className={`sticky top-0 z-40 bg-white border-b-2 border-[#121212] px-4 sm:px-8 transition-all duration-200 ${
          isNavCompact ? "py-2.5 shadow-[0_2px_0_0_#121212]" : "py-3.5 shadow-[0_2px_0_0_#121212]"
        }`}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <ClarioLogo
              size={36}
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
                Private receipts · Verifiable proof
              </span>
            </div>
          </Link>

          {/* Nav Links */}
          <nav
            onMouseLeave={() => setHoveredNav(null)}
            className="hidden md:flex items-center gap-1 p-1 bg-[#f8f9fa] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] rounded-xl"
          >
            {NAV_LINKS.map((link) => {
              const isHovered = hoveredNav === link.href;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onMouseEnter={() => setHoveredNav(link.href)}
                  className={`relative px-3.5 py-1.5 rounded-lg font-mono text-xs font-black uppercase tracking-wider transition-all duration-100 ${
                    isHovered
                      ? "bg-[#836EF9] !text-white border-2 border-[#121212] shadow-[1px_1px_0_0_#121212]"
                      : "!text-[#121212] hover:!text-[#836EF9] border-2 border-transparent"
                  }`}
                >
                  <span>{link.label}</span>
                </a>
              );
            })}
          </nav>

          {/* Primary Action Button */}
          <div className="flex items-center gap-3">
            <Magnetic range={80} maxTranslation={8} intensity={0.5}>
              <Link
                href="/?mode=personal"
                className="inline-flex items-center justify-center gap-1.5 font-mono text-xs font-black uppercase tracking-wider px-4 py-2 rounded-xl bg-[#836EF9] !text-white border-2 border-[#121212] shadow-[3px_3px_0_0_#121212] hover:bg-[#7257f8] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
              >
                <span className="!text-white">Launch App</span>
                <ArrowRight className="h-3.5 w-3.5 !text-white stroke-[2.5]" aria-hidden="true" />
              </Link>
            </Magnetic>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="pt-14 sm:pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Hero Left Content */}
            <div className="lg:col-span-7 flex flex-col items-start gap-6">
              {/* Single Hero Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border-2 border-[#121212] bg-white shadow-[2px_2px_0_0_#121212] text-xs font-mono font-bold uppercase tracking-wider text-[#121212]">
                <span className="flex h-2 w-2 rounded-full bg-[#836EF9]" />
                <span>Live on Monad Testnet</span>
              </div>

              {/* Main Headline */}
              <TextEffect
                preset="fade-in-blur"
                per="word"
                as="h1"
                className="text-4xl sm:text-5xl lg:text-[52px] font-bold tracking-tight leading-[1.12] text-gray-900 [text-wrap:balance]"
              >
                Keep your receipts private. Prove every expense on Monad.
              </TextEffect>

              {/* Subtitle */}
              <p className="text-base sm:text-lg text-gray-600 font-normal leading-relaxed max-w-xl">
                Track everyday spending across four simple workspaces. Your receipts
                stay on your device, while Monad creates proof that nobody can dispute or change.
              </p>

              {/* Hero CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2 w-full sm:w-auto">
                <Magnetic range={80} maxTranslation={8} intensity={0.5}>
                  <Link
                    href="/?mode=personal"
                    className="inline-flex items-center justify-center gap-2 font-mono text-sm font-black uppercase tracking-wider px-6 py-3.5 rounded-xl bg-[#836EF9] !text-white border-2 border-[#121212] shadow-[4px_4px_0_0_#121212] hover:bg-[#7257f8] hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                  >
                    <span className="!text-white">Launch Testnet App</span>
                    <ArrowRight className="h-4 w-4 !text-white stroke-[2.5]" aria-hidden="true" />
                  </Link>
                </Magnetic>

                <button
                  type="button"
                  onClick={() => setIsGuideOpen(true)}
                  className="inline-flex items-center justify-center gap-2 font-mono text-sm font-black uppercase tracking-wider px-6 py-3.5 rounded-xl border-2 border-[#121212] bg-white !text-[#121212] hover:bg-[#f3f4f6] hover:-translate-y-0.5 shadow-[4px_4px_0_0_#121212] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
                >
                  <Layers
                    className="h-4 w-4 text-[#836EF9] stroke-[2.5]"
                    aria-hidden="true"
                  />
                  <span className="!text-[#121212]">See How It Works</span>
                </button>
              </div>

              {/* Testnet Disclaimer */}
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-gray-700">
                Unaudited testnet software on Monad Testnet. No real money required.
              </p>

              {/* Micro Guarantees */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t-2 border-[#121212] w-full text-left">
                <div>
                  <span className="font-mono text-xs font-black uppercase tracking-wider text-[#121212] block">
                    Local-first privacy
                  </span>
                  <span className="text-xs text-gray-700 leading-snug block mt-1 font-medium">
                    Receipts stay on your device
                  </span>
                </div>
                <div>
                  <span className="font-mono text-xs font-black uppercase tracking-wider text-[#121212] block">
                    Tamper-proof records
                  </span>
                  <span className="text-xs text-gray-700 leading-snug block mt-1 font-medium">
                    Locked with a private fingerprint
                  </span>
                </div>
                <div>
                  <span className="font-mono text-xs font-black uppercase tracking-wider text-[#121212] block">
                    Never paid twice
                  </span>
                  <span className="text-xs text-gray-700 leading-snug block mt-1 font-medium">
                    Smart contracts stop duplicate payouts
                  </span>
                </div>
              </div>
            </div>

            {/* Hero Right: Simplified Voucher Card */}
            <div className="lg:col-span-5">
              <InteractiveCard
                enableTilt={true}
                enableSpotlight={false}
                rotationFactor={3}
                className="p-0 overflow-hidden shadow-[4px_4px_0_0_#121212] rounded-2xl bg-white border-2 border-[#121212]"
              >
                {/* Card Header Bar (Montally Neo-Brutalist) */}
                <div className="bg-[#121212] text-white px-4 py-3 flex items-center justify-between border-b-2 border-[#121212]">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-[#836EF9]" />
                    <span className="text-xs font-mono font-black uppercase tracking-wider text-white">
                      Sample Receipt Voucher
                    </span>
                  </div>
                  <span className="text-[11px] font-mono bg-[#836EF9] text-white px-2.5 py-0.5 rounded border border-[#121212] font-black uppercase tracking-wider">
                    Monad Testnet
                  </span>
                </div>

                {/* Sample Selector Tabs */}
                <div className="bg-[#f9fafb] border-b border-gray-200 p-2 flex gap-1.5">
                  {SAMPLE_EXPENSES.map((exp, idx) => (
                    <button
                      key={exp.id}
                      type="button"
                      onClick={() => setSelectedExpense(idx)}
                      className={`flex-1 text-xs font-mono font-medium py-1.5 px-2 rounded-lg border transition-all text-center cursor-pointer ${
                        selectedExpense === idx
                          ? "bg-white text-gray-900 border-gray-900 shadow-2xs font-bold"
                          : "bg-transparent text-gray-600 border-transparent hover:bg-gray-100"
                      }`}
                    >
                      {exp.id}
                    </button>
                  ))}
                </div>

                {/* Simplified Voucher Content */}
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-medium text-[#7C6CF6] bg-[#f5f3ff] px-2.5 py-0.5 rounded border border-[#e0dbfd]">
                        {activeExpense.category}
                      </span>
                      <h3 className="text-lg font-bold text-gray-900 mt-2 leading-snug">
                        {activeExpense.title}
                      </h3>
                      <p className="text-xs text-gray-500 font-normal mt-0.5">
                        {activeExpense.privacy}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-2xl font-bold text-gray-900">
                        {activeExpense.amount}
                      </span>
                      <div className="mt-1">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <BadgeCheck
                            className="h-3 w-3 text-emerald-600"
                            aria-hidden="true"
                          />
                          {activeExpense.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Truncated Hash Row */}
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 font-medium">
                        Proof Fingerprint:
                      </span>
                      <div className="flex items-center gap-1.5 font-mono text-xs font-medium text-gray-800">
                        <span>
                          {activeExpense.hash.slice(0, 10)}...
                          {activeExpense.hash.slice(-8)}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyHash}
                          title="Copy fingerprint"
                          className="p-1 text-gray-400 hover:text-gray-700 transition cursor-pointer"
                        >
                          {copiedHash ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Details Row */}
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          setShowVoucherDetails(!showVoucherDetails)
                        }
                        className="text-[11px] font-medium text-[#7C6CF6] hover:underline flex items-center gap-1 pt-1 cursor-pointer"
                      >
                        <span>
                          {showVoucherDetails
                            ? "Hide technical details"
                            : "Show technical details"}
                        </span>
                        <ChevronDown
                          className={`h-3 w-3 transition-transform ${
                            showVoucherDetails ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      <AnimatePresence>
                        {showVoucherDetails && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="pt-2.5 mt-2 border-t border-gray-200 space-y-1.5 text-xs font-mono"
                          >
                            <div className="flex items-center justify-between text-gray-600">
                              <span>Monad Block:</span>
                              <span className="font-semibold text-gray-900">
                                #{activeExpense.blockHeight}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-gray-600">
                              <span>Settlement Gas:</span>
                              <span className="text-emerald-700 font-semibold">
                                {activeExpense.gasFee}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-gray-600">
                              <span>Verification Scheme:</span>
                              <span className="text-gray-800">
                                {activeExpense.verificationMethod}
                              </span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Action Link */}
                  <Link
                    href="#verifier"
                    className="w-full flex items-center justify-center gap-2 py-3 font-mono text-xs font-black uppercase tracking-wider rounded-xl border-2 border-[#121212] bg-[#121212] !text-white hover:bg-[#836EF9] hover:border-[#836EF9] transition-all shadow-[2px_2px_0_0_#121212]"
                  >
                    <ShieldCheck
                      className="h-4 w-4 text-[#836EF9] stroke-[2.5]"
                      aria-hidden="true"
                    />
                    <span className="!text-white">Inspect Verification Live</span>
                  </Link>
                </div>
              </InteractiveCard>
            </div>
          </div>
        </section>

        {/* 4 Dedicated Workspaces: Single Card + Tabs */}
        <WorkspaceShowcase />

        {/* Follow One Receipt: 4-Step Plain Story Rail */}
        <FollowReceiptRail />

        {/* Live Verifier Inspector */}
        <section
          id="verifier"
          className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t-2 border-[#121212]"
        >
          <div className="rounded-2xl border-2 border-[#121212] bg-[#121212] text-white p-6 sm:p-10 shadow-[6px_6px_0_0_#836EF9] overflow-hidden">
            <div className="max-w-2xl">
              <span className="font-mono text-xs font-black uppercase tracking-wider text-[#836EF9] bg-white/10 px-3 py-1 rounded-md border border-white/20 inline-flex items-center gap-1.5 mb-3">
                <Sparkles className="h-3 w-3" />
                Live Verification Inspector
              </span>
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white leading-tight">
                Inspect Receipt Integrity in Real Time
              </h2>
              <p className="text-gray-300 text-sm sm:text-base mt-2 leading-relaxed font-medium">
                Test how auditors, clients, and teammates can independently verify that an expense
                has not been altered and has never been double-reimbursed.
              </p>
            </div>

            {/* Interactive Inspector Box */}
            <div className="mt-8 bg-[#1a1a1a] rounded-xl border-2 border-white/20 p-5 sm:p-6 space-y-6">
              {/* Scenario Selector */}
              <div>
                <label className="font-mono text-xs font-bold uppercase tracking-wider text-gray-300 block mb-2.5">
                  Select a live expense scenario to inspect:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {SAMPLE_EXPENSES.map((exp, idx) => (
                    <button
                      key={exp.id}
                      type="button"
                      onClick={() => {
                        setSelectedExpense(idx);
                        setVerificationResult(null);
                      }}
                      className={`text-left p-3.5 rounded-lg border-2 transition-all cursor-pointer ${
                        selectedExpense === idx
                          ? "border-[#836EF9] bg-[#836EF9]/20 shadow-[2px_2px_0_0_#836EF9]"
                          : "border-white/10 bg-[#121212] hover:border-white/30 text-gray-400"
                      }`}
                    >
                      <div className="font-mono text-[11px] font-black uppercase text-[#836EF9]">{exp.id}</div>
                      <div className="text-xs font-bold text-white truncate mt-0.5">{exp.title}</div>
                      <div className="font-mono text-xs font-bold text-gray-300 mt-1">{exp.amount}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
                <div className="text-xs text-gray-400 font-mono">
                  Active Fingerprint: <span className="text-white font-bold">{activeExpense.hash.slice(0, 18)}...</span>
                </div>
                <button
                  type="button"
                  onClick={handleRunVerify}
                  disabled={isVerifying}
                  className="w-full sm:w-auto font-mono text-xs font-black uppercase tracking-wider px-6 py-3 rounded-lg bg-[#836EF9] text-white border-2 border-white shadow-[3px_3px_0_0_#fff] hover:bg-[#7257f8] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50 transition cursor-pointer"
                >
                  {isVerifying ? "Verifying Onchain Ledger..." : "Run Instant Verification"}
                </button>
              </div>

              {/* Real-time Verification Output */}
              <AnimatePresence>
                {verificationResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-xl border-2 border-emerald-500 bg-emerald-950/30 p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-emerald-500/30 pb-3">
                      <span className="font-mono text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                        <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                        Verification Passed: 100% Valid
                      </span>
                      <span className="font-mono text-xs text-emerald-300 font-bold">
                        Monad Block #{verificationResult.block}
                      </span>
                    </div>

                    {/* 4 Point Real-time Checklist */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      <div className="bg-[#121212]/80 border border-emerald-500/40 rounded-lg p-3">
                        <div className="font-mono text-[11px] font-black uppercase text-emerald-400 flex items-center gap-1.5 mb-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Zero Cloud Leak
                        </div>
                        <p className="text-[11px] text-gray-300">Receipt image and sensitive notes remained AES-256 encrypted in device storage.</p>
                      </div>

                      <div className="bg-[#121212]/80 border border-emerald-500/40 rounded-lg p-3">
                        <div className="font-mono text-[11px] font-black uppercase text-emerald-400 flex items-center gap-1.5 mb-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Tamper-Proof Match
                        </div>
                        <p className="text-[11px] text-gray-300">Amount, vendor, and date cryptographic fingerprint matches onchain anchor perfectly.</p>
                      </div>

                      <div className="bg-[#121212]/80 border border-emerald-500/40 rounded-lg p-3">
                        <div className="font-mono text-[11px] font-black uppercase text-emerald-400 flex items-center gap-1.5 mb-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Human Governance
                        </div>
                        <p className="text-[11px] text-gray-300">Authorized human officer signature verified. Automated AI copilot had zero release power.</p>
                      </div>

                      <div className="bg-[#121212]/80 border border-emerald-500/40 rounded-lg p-3">
                        <div className="font-mono text-[11px] font-black uppercase text-emerald-400 flex items-center gap-1.5 mb-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Zero Duplicate Settlement
                        </div>
                        <p className="text-[11px] text-gray-300">Nullifier recorded on Monad; the smart contract prevents duplicate reimbursement forever.</p>
                      </div>
                    </div>

                    {/* Expandable Technical Proof Payload */}
                    <div className="pt-2 border-t border-emerald-500/30">
                      <button
                        type="button"
                        onClick={() => setShowVoucherDetails(!showVoucherDetails)}
                        className="font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-300 flex items-center justify-between w-full cursor-pointer py-1"
                      >
                        <span>View Cryptographic Proof Payload (JSON / Signer)</span>
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showVoucherDetails ? "rotate-180" : ""}`} />
                      </button>

                      {showVoucherDetails && (
                        <div className="mt-3 p-3.5 rounded-lg bg-[#121212] border border-white/20 font-mono text-[11px] text-gray-300 space-y-1.5">
                          <div><span className="text-gray-500">Commitment Hash:</span> {activeExpense.hash}</div>
                          <div><span className="text-gray-500">Authorized Signer:</span> {verificationResult.approver}</div>
                          <div><span className="text-gray-500">Network:</span> Monad Testnet</div>
                          <div><span className="text-gray-500">Verification Spec:</span> {activeExpense.verificationMethod}</div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* Before and After Section (Replaces Comparison Table) */}
        <BeforeAfterSection />

        {/* Plain-English FAQ Section */}
        <section
          id="faq"
          className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto border-t border-gray-200"
        >
          <div className="text-center mb-12 sm:mb-14">
            <span className="text-xs font-semibold text-[#7C6CF6] bg-[#f5f3ff] px-2.5 py-1 rounded-md border border-[#e0dbfd] inline-block mb-3">
              Common questions
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 leading-tight [text-wrap:balance]">
              Frequently asked questions
            </h2>
            <p className="text-base sm:text-lg text-gray-600 mt-3 leading-relaxed">
              Clear answers about privacy, testnet use, and everyday expense workflows.
            </p>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-2xs"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between p-5 text-left font-bold text-base text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 pt-1 text-sm text-gray-600 font-normal leading-relaxed border-t border-gray-100">
                          {faq.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </section>

        {/* Closing Call to Action Section */}
        <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
          <div className="rounded-2xl border-2 border-[#121212] bg-white p-8 sm:p-14 text-center shadow-[6px_6px_0_0_#836EF9]">
            <div className="max-w-xl mx-auto space-y-5">
              <span className="font-mono text-xs font-black uppercase tracking-wider text-[#836EF9] bg-[#f5f3ff] px-3 py-1 rounded-md border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Get Started Today
              </span>
              <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-[#121212] leading-tight [text-wrap:balance]">
                Ready to test private, verifiable expenses?
              </h2>
              <p className="text-gray-700 text-sm sm:text-base leading-relaxed font-medium">
                Launch personal budgeting, freelance billing, or team expense approvals on Monad testnet in seconds.
              </p>

              <div className="pt-2 flex justify-center">
                <Magnetic range={80} maxTranslation={8} intensity={0.5}>
                  <Link
                    href="/?mode=personal"
                    className="inline-flex items-center justify-center gap-2 font-mono text-sm font-black uppercase tracking-wider px-6 py-3.5 rounded-xl bg-[#836EF9] !text-white border-2 border-[#121212] shadow-[4px_4px_0_0_#121212] hover:bg-[#7257f8] hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                  >
                    <span className="!text-white">Launch Testnet App</span>
                    <ArrowRight className="h-4 w-4 !text-white stroke-[2.5]" aria-hidden="true" />
                  </Link>
                </Magnetic>
              </div>

              <p className="text-xs text-gray-600 font-mono font-bold pt-2 uppercase tracking-wider">
                Free to test · No real money required · Monad Testnet
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Production-Grade Montally Neo-Brutalist Footer */}
      <footer className="border-t-2 border-[#121212] bg-white py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 lg:gap-12 pb-12">
            {/* Col 1: Brand & Status Card (spans 2 columns on md) */}
            <div className="md:col-span-2 space-y-4">
              <Link href="/" className="inline-flex items-center gap-2.5 group">
                <ClarioLogo
                  size={36}
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
                    Private receipts · Verifiable proof
                  </span>
                </div>
              </Link>

              <p className="text-xs text-gray-700 leading-relaxed font-medium max-w-sm">
                Private expense tracking built on Monad. Keep receipts local on your own device while settling verified cryptographic proofs onchain.
              </p>

              {/* Status Micro-Card */}
              <div className="p-3 rounded-xl border-2 border-[#121212] bg-[#f8f9fa] shadow-[2px_2px_0_0_#121212] inline-flex items-center gap-3">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <div className="flex flex-col">
                  <span className="font-mono text-[11px] font-black uppercase text-[#121212]">
                    Monad Testnet Ledger
                  </span>
                  <span className="font-mono text-[10px] font-bold uppercase text-gray-600">
                    Decentralized · Real-Time Proof
                  </span>
                </div>
              </div>

              <div className="pt-1">
                <a
                  href="mailto:contact@clario.finance"
                  className="font-mono text-xs font-black uppercase tracking-wider text-[#121212] hover:text-[#836EF9] inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>Contact: contact@clario.finance</span>
                </a>
              </div>
            </div>

            {/* Col 2: Workspaces */}
            <div className="space-y-3">
              <span className="font-mono text-xs font-black text-[#121212] uppercase tracking-wider block mb-3.5 pb-1 border-b-2 border-[#121212]">
                Workspaces
              </span>
              <ul className="space-y-2.5 font-mono text-xs font-bold uppercase tracking-wider">
                <li>
                  <Link
                    href="/?mode=personal"
                    className="text-gray-700 hover:text-[#836EF9] hover:translate-x-1 inline-flex items-center gap-1 transition-all"
                  >
                    Personal Mode
                  </Link>
                </li>
                <li>
                  <Link
                    href="/?mode=freelancer"
                    className="text-gray-700 hover:text-[#836EF9] hover:translate-x-1 inline-flex items-center gap-1 transition-all"
                  >
                    Freelancer Mode
                  </Link>
                </li>
                <li>
                  <Link
                    href="/?mode=family"
                    className="text-gray-700 hover:text-[#836EF9] hover:translate-x-1 inline-flex items-center gap-1 transition-all"
                  >
                    Family Pool
                  </Link>
                </li>
                <li>
                  <Link
                    href="/?mode=business"
                    className="text-gray-700 hover:text-[#836EF9] hover:translate-x-1 inline-flex items-center gap-1 transition-all"
                  >
                    Business Treasury
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 3: Developers */}
            <div className="space-y-3">
              <span className="font-mono text-xs font-black text-[#121212] uppercase tracking-wider block mb-3.5 pb-1 border-b-2 border-[#121212]">
                Developers
              </span>
              <ul className="space-y-2.5 font-mono text-xs font-bold uppercase tracking-wider">
                <li>
                  <Link
                    href="https://testnet.monadexplorer.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-gray-700 hover:text-[#836EF9] hover:translate-x-1 inline-flex items-center gap-1.5 transition-all"
                  >
                    Monad Explorer <ExternalLink className="h-3 w-3" />
                  </Link>
                </li>
                <li>
                  <Link
                    href="https://github.com/clario-finance/clario"
                    target="_blank"
                    rel="noreferrer"
                    className="text-gray-700 hover:text-[#836EF9] hover:translate-x-1 inline-flex items-center gap-1.5 transition-all"
                  >
                    GitHub Repo <ExternalLink className="h-3 w-3" />
                  </Link>
                </li>
                <li>
                  <Link
                    href="/docs"
                    className="text-gray-700 hover:text-[#836EF9] hover:translate-x-1 inline-flex items-center gap-1 transition-all"
                  >
                    Protocol Docs
                  </Link>
                </li>
                <li>
                  <Link
                    href="https://docs.monad.xyz"
                    target="_blank"
                    rel="noreferrer"
                    className="text-gray-700 hover:text-[#836EF9] hover:translate-x-1 inline-flex items-center gap-1.5 transition-all"
                  >
                    Monad Docs <ExternalLink className="h-3 w-3" />
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 4: Legal & Security */}
            <div className="space-y-3">
              <span className="font-mono text-xs font-black text-[#121212] uppercase tracking-wider block mb-3.5 pb-1 border-b-2 border-[#121212]">
                Security &amp; Legal
              </span>
              <ul className="space-y-2.5 font-mono text-xs font-bold uppercase tracking-wider">
                <li>
                  <Link
                    href="/privacy"
                    className="text-gray-700 hover:text-[#836EF9] hover:translate-x-1 inline-flex items-center gap-1 transition-all"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="text-gray-700 hover:text-[#836EF9] hover:translate-x-1 inline-flex items-center gap-1 transition-all"
                  >
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link
                    href="/security"
                    className="text-gray-700 hover:text-[#836EF9] hover:translate-x-1 inline-flex items-center gap-1 transition-all"
                  >
                    Security Details
                  </Link>
                </li>
                <li>
                  <Link
                    href="/disclosure"
                    className="text-gray-700 hover:text-[#836EF9] hover:translate-x-1 inline-flex items-center gap-1 transition-all"
                  >
                    Disclosure
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

      {/* Slide-Based How Clario Works Guide Modal */}
      <HowClarioWorksModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
}
