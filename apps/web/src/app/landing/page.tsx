"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Zap,
  Lock,
  BadgeCheck,
  ArrowRight,
  Layers,
  ChevronDown,
  ExternalLink,
  Receipt,
  Check,
  Copy,
  Info,
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
      "You can download a complete backup package (ZIP) from the Proof Center with one click. Save it on your computer or forward it to your accountant anytime.",
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
  { label: "How it works", href: "#receipt-flow" },
  { label: "Workspaces", href: "#modes" },
  { label: "Before & after", href: "#comparison" },
  { label: "Live sandbox", href: "#verifier" },
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
  const [verifierInput, setVerifierInput] = useState(
    "0x89f4b7a120c8de3176ef98231c51bc19aa314"
  );
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

      {/* Top Banner Notice */}
      <div className="bg-[#121212] text-white border-b border-gray-800 px-4 py-2 text-center text-xs font-sans font-medium flex items-center justify-center gap-2">
        <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>Monad Testnet Edition</span>
        <span className="text-gray-500">•</span>
        <span className="text-gray-300">
          Unaudited software for hackathon demonstration
        </span>
        <span className="text-gray-500">•</span>
        <Link
          href="/proof"
          className="text-[#9b8eff] hover:underline font-medium inline-flex items-center gap-1"
        >
          Explore Proof Center{" "}
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>

      {/* Navigation Header */}
      <header
        className={`sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 px-4 sm:px-8 transition-all duration-200 ${
          isNavCompact ? "py-2.5 shadow-2xs" : "py-3.5"
        }`}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <ClarioLogo
              size={34}
              className="transition group-hover:opacity-90"
            />
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-gray-900 flex items-center gap-2">
                Clario
                <span className="text-[11px] font-medium text-[#7C6CF6] bg-[#f5f3ff] px-2 py-0.5 rounded-full border border-[#e0dbfd] flex items-center gap-1">
                  <MonadLogo className="h-3 w-3" aria-hidden="true" />
                  Testnet
                </span>
              </span>
              <span className="text-[11px] text-gray-500 font-medium">
                Private receipts. Verifiable proof.
              </span>
            </div>
          </Link>

          {/* Nav Links with Shared Layout Sliding Pill */}
          <nav
            onMouseLeave={() => setHoveredNav(null)}
            className="hidden md:flex items-center gap-1 text-sm font-medium relative"
          >
            {NAV_LINKS.map((link) => {
              const isHovered = hoveredNav === link.href;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onMouseEnter={() => setHoveredNav(link.href)}
                  className="relative px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {isHovered && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-gray-100 rounded-lg -z-10"
                      transition={{
                        type: "spring",
                        stiffness: 350,
                        damping: 30,
                      }}
                    />
                  )}
                  <span>{link.label}</span>
                </a>
              );
            })}
          </nav>

          {/* Primary Action Buttons with Magnetic Pull */}
          <div className="flex items-center gap-3">
            <Link
              href="/proof"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-gray-900 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors shadow-2xs"
            >
              <ShieldCheck
                className="h-3.5 w-3.5 text-[#7C6CF6]"
                aria-hidden="true"
              />
              <span>Proof Center</span>
            </Link>

            <Magnetic range={80} maxTranslation={8} intensity={0.5}>
              <Link
                href="/?mode=personal"
                className="inline-flex items-center justify-center gap-1.5 font-bold text-xs px-3.5 py-2 rounded-xl bg-[#7C6CF6] text-white border-2 border-[#121212] shadow-[3px_3px_0_0_#121212] hover:bg-[#6c5be8] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
              >
                <span>Launch testnet app</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
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
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-200 bg-white/90 shadow-2xs text-xs font-medium text-gray-700">
                <span className="flex h-2 w-2 rounded-full bg-[#7C6CF6]" />
                <span>Live on Monad Testnet (Chain ID 10143)</span>
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
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 w-full sm:w-auto">
                <Magnetic range={80} maxTranslation={8} intensity={0.5}>
                  <Link
                    href="/?mode=personal"
                    className="inline-flex items-center justify-center gap-2 font-bold text-base px-6 py-3.5 rounded-xl bg-[#7C6CF6] text-white border-2 border-[#121212] shadow-[4px_4px_0_0_#121212] hover:bg-[#6c5be8] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                  >
                    <span>Launch testnet app</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Magnetic>

                <button
                  type="button"
                  onClick={() => setIsGuideOpen(true)}
                  className="inline-flex items-center justify-center gap-2 font-medium text-base px-5 py-3.5 rounded-xl border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 hover:border-gray-400 shadow-xs transition-all cursor-pointer"
                >
                  <Layers
                    className="h-4 w-4 text-[#7C6CF6]"
                    aria-hidden="true"
                  />
                  <span>See how it works</span>
                </button>
              </div>

              {/* Testnet Disclaimer */}
              <p className="text-xs text-gray-500 font-normal leading-normal">
                Unaudited testnet software on Monad Testnet (Chain ID 10143). No real money required.
              </p>

              {/* Micro Guarantees */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-gray-200 w-full text-left">
                <div>
                  <span className="text-sm font-semibold text-gray-900 block">
                    Local-first privacy
                  </span>
                  <span className="text-xs text-gray-500 leading-snug block mt-0.5">
                    Receipts stay on your device
                  </span>
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-900 block">
                    Tamper-proof records
                  </span>
                  <span className="text-xs text-gray-500 leading-snug block mt-0.5">
                    Locked with a private fingerprint
                  </span>
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-900 block">
                    Never paid twice
                  </span>
                  <span className="text-xs text-gray-500 leading-snug block mt-0.5">
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
                {/* Card Header Bar */}
                <div className="bg-[#121212] text-white px-4 py-3 flex items-center justify-between border-b-2 border-[#121212]">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#ef4444]" />
                    <div className="h-3 w-3 rounded-full bg-[#f59e0b]" />
                    <div className="h-3 w-3 rounded-full bg-[#10b981]" />
                    <span className="text-xs font-mono font-medium text-gray-300 ml-1.5">
                      Sample Receipt Voucher
                    </span>
                  </div>
                  <span className="text-[11px] font-mono bg-[#7C6CF6] text-white px-2 py-0.5 rounded font-bold">
                    Monad #10143
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
                    href="/proof"
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl border border-gray-900 bg-gray-900 text-white hover:bg-black transition-colors shadow-2xs"
                  >
                    <ShieldCheck
                      className="h-4 w-4 text-[#9b8eff]"
                      aria-hidden="true"
                    />
                    <span>Verify in Proof Center</span>
                  </Link>
                </div>
              </InteractiveCard>
            </div>
          </div>
        </section>

        {/* Trust Signals Strip / Built on Monad */}
        <section className="border-y border-gray-200 bg-white py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-left w-full md:w-auto">
              <div>
                <span className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                  &lt; 1 sec
                </span>
                <p className="text-xs font-medium text-gray-500 mt-0.5">
                  Instant settlement on Monad
                </p>
              </div>
              <div>
                <span className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                  100% Private
                </span>
                <p className="text-xs font-medium text-gray-500 mt-0.5">
                  Receipt files stay on your device
                </p>
              </div>
              <div>
                <span className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                  4 Modes
                </span>
                <p className="text-xs font-medium text-gray-500 mt-0.5">
                  Personal, freelance, family, business
                </p>
              </div>
              <div>
                <span className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                  0 Duplicate
                </span>
                <p className="text-xs font-medium text-gray-500 mt-0.5">
                  Impossible to reimburse twice
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-600 border-t md:border-t-0 md:border-l border-gray-200 pt-4 md:pt-0 md:pl-8">
              <div className="flex items-center gap-1.5 text-gray-900 font-semibold">
                <MonadLogo className="h-4 w-4" />
                <span>Built on Monad</span>
              </div>
              <span className="text-gray-300 hidden md:inline">•</span>
              <Link
                href="https://testnet.monadexplorer.com"
                target="_blank"
                rel="noreferrer"
                className="hover:text-gray-900 hover:underline flex items-center gap-1"
              >
                Explorer Contract{" "}
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </Link>
              <span className="text-gray-300 hidden md:inline">•</span>
              <Link
                href="https://github.com/clario-finance/clario"
                target="_blank"
                rel="noreferrer"
                className="hover:text-gray-900 hover:underline flex items-center gap-1"
              >
                GitHub Repo{" "}
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </Link>
              <span className="text-gray-300 hidden md:inline">•</span>
              <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                Unaudited testnet software
              </span>
            </div>
          </div>
        </section>

        {/* 4 Dedicated Workspaces: Single Card + Tabs */}
        <WorkspaceShowcase />

        {/* Follow One Receipt: 4-Step Plain Story Rail (Replaces Founder Invariants) */}
        <FollowReceiptRail />

        {/* Live Verifier Sandbox */}
        <section
          id="verifier"
          className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-gray-200"
        >
          <div className="rounded-2xl border border-gray-900 bg-[#121212] text-white p-6 sm:p-10 shadow-lg overflow-hidden">
            <div className="max-w-2xl">
              <span className="text-xs font-semibold text-[#9b8eff] bg-white/10 px-2.5 py-1 rounded-md border border-white/10 inline-block mb-3">
                Live Simulator
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white [text-wrap:balance]">
                Test receipt verification live
              </h2>
              <p className="text-gray-300 text-sm sm:text-base mt-2 leading-relaxed">
                Auditors, clients, and teammates can independently check that an expense
                has not been altered and has not been paid twice.
              </p>
            </div>

            {/* Sandbox Input Box */}
            <div className="mt-8 bg-[#1e1e1e] rounded-xl border border-white/15 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-400 block mb-1.5">
                    Paste a receipt fingerprint or verification hash:
                  </label>
                  <input
                    type="text"
                    value={verifierInput}
                    onChange={(e) => setVerifierInput(e.target.value)}
                    className="w-full bg-[#121212] text-white font-mono text-xs sm:text-sm px-4 py-3 rounded-lg border border-white/20 focus:border-[#7C6CF6] focus:outline-none"
                    placeholder="0x..."
                  />
                </div>
                <div className="self-end sm:self-auto">
                  <Magnetic range={60} maxTranslation={6} intensity={0.4}>
                    <button
                      type="button"
                      onClick={handleRunVerify}
                      disabled={isVerifying}
                      className="w-full sm:w-auto font-semibold text-sm px-5 py-3 rounded-lg bg-[#7C6CF6] text-white hover:bg-[#6c5be8] disabled:opacity-50 transition cursor-pointer"
                    >
                      {isVerifying ? "Verifying..." : "Verify fingerprint"}
                    </button>
                  </Magnetic>
                </div>
              </div>

              {/* Quick Sample Selector */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-sans">
                <span className="text-gray-400">Quick samples:</span>
                <button
                  type="button"
                  onClick={() =>
                    setVerifierInput("0x89f4b7a120c8de3176ef98231c51bc19aa314")
                  }
                  className="text-[#9b8eff] underline hover:text-white cursor-pointer"
                >
                  Cloud server receipt (#EXP-9042)
                </button>
                <span className="text-gray-600">•</span>
                <button
                  type="button"
                  onClick={() =>
                    setVerifierInput("0x4b7c11f9e9842dc59012a6771e8bf43912da0")
                  }
                  className="text-[#9b8eff] underline hover:text-white cursor-pointer"
                >
                  Conference travel (#EXP-9043)
                </button>
              </div>

              {/* Verification Result Output */}
              <AnimatePresence>
                {verificationResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="mt-4 rounded-lg border border-emerald-500/50 bg-emerald-950/20 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                        <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                        Receipt fingerprint verified valid
                      </span>
                      <span className="text-xs font-mono text-gray-400">
                        Monad Block #{verificationResult.block}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 font-mono">
                      {verificationResult.details}
                    </p>
                    <div className="pt-2 text-xs font-mono text-gray-400 flex flex-wrap gap-4 border-t border-white/10">
                      <span>
                        Authorized Signer: {verificationResult.approver}
                      </span>
                      <span>Network: Monad Testnet</span>
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
          <div className="rounded-3xl border border-gray-200 bg-gradient-to-b from-white to-[#f5f3ff] p-8 sm:p-14 text-center shadow-sm">
            <div className="max-w-xl mx-auto space-y-5">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 leading-tight [text-wrap:balance]">
                Ready to test private, verifiable expenses?
              </h2>
              <p className="text-gray-600 text-base leading-relaxed">
                Launch personal budgeting, freelance billing, or team expense approvals on Monad testnet in seconds.
              </p>

              <div className="pt-2 flex justify-center">
                <Magnetic range={80} maxTranslation={8} intensity={0.5}>
                  <Link
                    href="/?mode=personal"
                    className="inline-flex items-center justify-center gap-2 font-bold text-base px-6 py-3.5 rounded-xl bg-[#7C6CF6] text-white border-2 border-[#121212] shadow-[4px_4px_0_0_#121212] hover:bg-[#6c5be8] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                  >
                    <span>Launch testnet app</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Magnetic>
              </div>

              <p className="text-xs text-gray-500 font-normal pt-2">
                Free to test · No real money required · Monad Testnet Chain ID 10143
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Production-Grade Full Footer */}
      <footer className="border-t border-gray-200 bg-white py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 pb-12 border-b border-gray-200">
            {/* Col 1: Brand */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center gap-2.5">
                <ClarioLogo size={32} />
                <span className="text-base font-bold tracking-tight text-gray-900">
                  Clario
                </span>
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Testnet
                </span>
              </div>
              <p className="text-xs text-gray-600 max-w-sm leading-relaxed">
                Private expense tracking built on Monad. Keep receipts local on your own device while settling verified proof onchain.
              </p>
              <div className="pt-2 text-xs text-gray-500">
                Contact:{" "}
                <a
                  href="mailto:contact@clario.finance"
                  className="text-gray-900 underline hover:text-[#7C6CF6]"
                >
                  contact@clario.finance
                </a>
              </div>
            </div>

            {/* Col 2: Workspaces */}
            <div className="space-y-2.5 text-xs">
              <span className="font-semibold text-gray-900 uppercase tracking-wider block mb-3">
                Workspaces
              </span>
              <div>
                <Link
                  href="/?mode=personal"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Personal Mode
                </Link>
              </div>
              <div>
                <Link
                  href="/?mode=freelancer"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Freelancer Mode
                </Link>
              </div>
              <div>
                <Link
                  href="/?mode=family"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Family Pool
                </Link>
              </div>
              <div>
                <Link
                  href="/?mode=business"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Business Treasury
                </Link>
              </div>
              <div>
                <Link
                  href="/proof"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Proof Center
                </Link>
              </div>
            </div>

            {/* Col 3: Developers */}
            <div className="space-y-2.5 text-xs">
              <span className="font-semibold text-gray-900 uppercase tracking-wider block mb-3">
                Developers
              </span>
              <div>
                <Link
                  href="https://testnet.monadexplorer.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  Monad Explorer <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <div>
                <Link
                  href="https://github.com/clario-finance/clario"
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  GitHub Repository <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <div>
                <Link
                  href="/docs"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Protocol Docs
                </Link>
              </div>
              <div>
                <Link
                  href="https://docs.monad.xyz"
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  Monad Docs <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Col 4: Legal & Policies */}
            <div className="space-y-2.5 text-xs">
              <span className="font-semibold text-gray-900 uppercase tracking-wider block mb-3">
                Legal & Security
              </span>
              <div>
                <Link
                  href="/docs?s=privacy"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Privacy Policy
                </Link>
              </div>
              <div>
                <Link
                  href="/docs?s=terms"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Terms of Service
                </Link>
              </div>
              <div>
                <Link
                  href="/docs?s=security"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Security Details
                </Link>
              </div>
              <div>
                <Link
                  href="/docs?s=disclosure"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Responsible Disclosure
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom Disclaimer */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
            <span>© 2026 Clario Protocol. All rights reserved.</span>
            <span className="text-[11px] text-gray-500 max-w-xl text-center sm:text-right leading-relaxed">
              Disclaimer: Clario is experimental software deployed on Monad
              Testnet. It is not an audited financial product. Do not deposit real funds
              or rely on it for official tax filings without offline record backups.
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
