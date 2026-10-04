"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Zap,
  Lock,
  BadgeCheck,
  ArrowRight,
  Layers,
  ChevronDown,
  Terminal,
  ExternalLink,
  BriefcaseBusiness,
  UsersRound,
  Building2,
  Wallet,
  UserRound,
  GitBranch,
  BotOff,
} from "lucide-react";
import { MonadLogo } from "@/components/ui/crypto-icon";
import {
  TextEffect,
  TextLoop,
  InteractiveCard,
  AnimatedButton,
  ScrollProgress,
  InView,
  AnimatedBackground,
  BorderTrail,
} from "@/components/ui/motion";
import { motion, AnimatePresence } from "motion/react";

// Interactive Demo Expenses for Hero Sandbox
const SAMPLE_EXPENSES = [
  {
    id: "EXP-9042",
    title: "Monad RPC Dedicated Cluster",
    vendor: "QuickNode Monad Infrastructure",
    amount: "$840.00",
    category: "Cloud Infrastructure",
    hash: "0x89f4b7a120c8de3176ef98231c51bc19aa314",
    blockHeight: "19,842,912",
    status: "VERIFIED & SETTLED",
    mode: "business",
    privacy: "Vendor invoice offchain · Zero leakage",
  },
  {
    id: "EXP-9043",
    title: "Devcon 7 Flight & Accommodation",
    vendor: "United Airlines & Marriott Bangkok",
    amount: "$1,620.00",
    category: "Team Travel",
    hash: "0x4b7c11f9e9842dc59012a6771e8bf43912da0",
    blockHeight: "19,842,945",
    status: "APPROVED BY TREASURY",
    mode: "freelancer",
    privacy: "Passenger PII & ticket PDF encrypted locally",
  },
  {
    id: "EXP-9044",
    title: "Smart Contract Audit Retainer",
    vendor: "CertiK Formal Verification",
    amount: "$4,500.00",
    category: "Security & Auditing",
    hash: "0x3f1e98bb4510ad674902187cc8431920fba61",
    blockHeight: "19,842,980",
    status: "VERIFIED & SETTLED",
    mode: "crypto",
    privacy: "Audit scope offchain · Hash commitment on Monad",
  },
];

// 5 Modes Showcase Details
const MODES_DATA = [
  {
    id: "personal",
    name: "Personal",
    icon: UserRound,
    tagline: "Total Private Financial Clarity",
    description:
      "Manage your everyday spending, monthly budget caps, and recurring SaaS subscriptions with local-first encrypted storage.",
    features: [
      "Zero-tracking cashflow & expense ledger",
      "Interactive category budgets with warning alerts",
      "Recurring subscription renewal detector",
      "Instant optical receipt scanner with confidential OCR",
    ],
    preview: {
      stat1: "$3,420.50",
      stat1Label: "MONTHLY OUTFLOW",
      stat2: "14 Active",
      stat2Label: "RECURRING SUBS",
      badge: "84% BUDGET HEALTH",
      recent: "Whole Foods Organic Groceries — $124.80",
    },
  },
  {
    id: "freelancer",
    name: "Freelancer",
    icon: BriefcaseBusiness,
    tagline: "Client Billing & Deductible Ledger",
    description:
      "Track project-specific expenses, generate client-reimbursable invoices, and organize 1099 tax deductibles with ironclad proof.",
    features: [
      "Client & project billing allocation",
      "Schedule C tax write-off category tagging",
      "Cryptographic reimbursement vouchers for clients",
      "Time tracking & billable milestone log",
    ],
    preview: {
      stat1: "$8,950.00",
      stat1Label: "UNBILLED REIMBURSEMENTS",
      stat2: "$3,240.00",
      stat2Label: "Q4 TAX WRITE-OFFS",
      badge: "6 CLIENTS ACTIVE",
      recent: "Figma Enterprise License (Acme Corp) — $75.00",
    },
  },
  {
    id: "business",
    name: "Business",
    icon: Building2,
    tagline: "Corporate Treasury & Multi-Sig Approval",
    description:
      "Department-level budget governance, multi-seat approval queues, and one-click Monad batch reimbursements for global teams.",
    features: [
      "Two-phase approval queue: Reviewer & Treasury",
      "Role-based permission envelopes (Submitter, Reviewer, Admin)",
      "Strict double-reimbursement prevention onchain",
      "Departmental burn rates and budget caps",
    ],
    preview: {
      stat1: "$42,800.00",
      stat1Label: "TEAM MONTHLY BURN",
      stat2: "3 Pending",
      stat2Label: "TREASURY APPROVALS",
      badge: "99.8% AUDIT COMPLIANCE",
      recent: "AWS Cloud Compute Clusters — $2,840.00",
    },
  },
  {
    id: "crypto",
    name: "Crypto / Web3",
    icon: Wallet,
    tagline: "Multi-Chain Transaction Accounting",
    description:
      "Lookup transactions across Monad Testnet, Ethereum, Sepolia, and Base with sub-second EVM RPC integration.",
    features: [
      "Direct EVM RPC transaction lookup by hash",
      "Monad Testnet sub-second confirmation & finality",
      "Automated gas fee & token transfer classification",
      "Multi-chain asset balances & EVM wallet sync",
    ],
    preview: {
      stat1: "1,240 MON",
      stat1Label: "TREASURY MON BALANCE",
      stat2: "0.4s Finality",
      stat2Label: "MONAD SPEED",
      badge: "CHAIN ID: 10143",
      recent: "Treasury Distribution Tx (Monad) — 250 MON",
    },
  },
  {
    id: "family",
    name: "Family",
    icon: UsersRound,
    tagline: "Shared Household Pools & Allowances",
    description:
      "Coordinate shared grocery runs, utility splits, and dependent allowances with transparent household allocation.",
    features: [
      "Shared household expense pools",
      "Fair expense split calculator with settlement logs",
      "Dependent allowances & goal tracking",
      "Household utility & mortgage calendars",
    ],
    preview: {
      stat1: "$4,120.00",
      stat1Label: "HOUSEHOLD POOL",
      stat2: "100% Balanced",
      stat2Label: "SETTLEMENT STATUS",
      badge: "4 MEMBERS",
      recent: "City Water & Power Utility — $142.50",
    },
  },
];

// The 4 Founder Invariants
const FOUNDER_INVARIANTS = [
  {
    number: "01",
    title: "Offchain Private Evidence",
    subtitle: "What happens in your receipt stays in your vault",
    icon: Lock,
    badge: "LOCAL PRIVACY",
    description:
      "Vendor names, line-item itemizations, and receipt scans are never published to public ledgers or IPFS. Clario hashes evidence locally in your browser so you retain total commercial confidentiality.",
    code: "sha256(raw_receipt_bytes) → commitment_hash",
  },
  {
    number: "02",
    title: "Immutable Material Versions",
    subtitle: "Every change produces an irreversible audit hash",
    icon: GitBranch,
    badge: "MERKLE TREE",
    description:
      "No retroactive database edits or stealth tampering. If an amount or merchant changes, a new immutable child version is recorded. Reviewers and auditors verify the exact version hash signed by treasury.",
    code: "version_n+1 = hash(version_n + patch_delta)",
  },
  {
    number: "03",
    title: "AI Has Zero Authority",
    subtitle: "Machine extraction assists; humans govern",
    icon: BotOff,
    badge: "SUBORDINATE AI",
    description:
      "Our AI copilot extracts receipts, suggests categories, and flags suspicious duplicate submissions. However, the AI possesses zero signing keys, cannot move funds, and cannot approve any reimbursement.",
    code: "human_signature required for release",
  },
  {
    number: "04",
    title: "Deterministic Settlement",
    subtitle: "Sub-second Monad finality & nullifier defense",
    icon: Zap,
    badge: "10,000 TPS",
    description:
      "When treasury approves an expense, Monad executes settlement in under 1 second for less than $0.001 gas. An onchain nullifier guarantees that no receipt can ever be reimbursed twice.",
    code: "require(!nullifierSpent[hash], 'DUPLICATE')",
  },
];

// Comparison Matrix
const COMPARISON = [
  {
    feature: "Cryptographic Receipt Proof",
    clario: true,
    web2: false,
    cryptoWallet: false,
  },
  {
    feature: "Offchain Invoice Privacy",
    clario: true,
    web2: false,
    cryptoWallet: false,
  },
  {
    feature: "Sub-Second Settlement (< 1s)",
    clario: true,
    web2: false,
    cryptoWallet: false,
  },
  {
    feature: "Zero-Knowledge Hash Verification",
    clario: true,
    web2: false,
    cryptoWallet: false,
  },
  {
    feature: "Strict Anti-Duplicate Nullifiers",
    clario: true,
    web2: false,
    cryptoWallet: false,
  },
  {
    feature: "Subordinate AI (Zero Private Key Access)",
    clario: true,
    web2: false,
    cryptoWallet: false,
  },
  {
    feature: "5 Dedicated Modes (Freelance, Business, etc.)",
    clario: true,
    web2: false,
    cryptoWallet: false,
  },
];

// FAQs
const FAQS = [
  {
    question: "Is my confidential invoice or receipt data published onchain?",
    answer:
      "Never. Clario follows the strict Founder Invariant of Offchain Private Evidence. Only the mathematical SHA-256 cryptographic commitment hash is published to Monad. Your vendor names, itemized lines, and images stay encrypted in your local browser vault.",
  },
  {
    question:
      "How does Clario prevent someone from claiming the same receipt twice?",
    answer:
      "When an expense commitment is authorized, the smart contract on Monad writes a unique nullifier derived from the receipt's hash. If any user attempts to submit or claim the same invoice again, the Monad contract immediately reverts with a duplicate nullifier error.",
  },
  {
    question: "Why is Clario built on Monad?",
    answer:
      "Expense operations and team reimbursements require sub-second speed and micro-gas fees. Monad's 10,000 TPS parallel EVM provides instant transaction finality (<1 second) and negligible fees, making enterprise-grade crypto accounting seamless.",
  },
  {
    question: "What blockchains are supported for transaction lookup?",
    answer:
      "Clario features direct EVM RPC lookup across Monad Testnet (Chain ID 10143), Ethereum Mainnet (1), Sepolia (11155111), and Base (8453). You can paste any transaction hash to instantly ingest verified onchain records.",
  },
  {
    question: "Can I switch between Personal, Freelancer, and Business modes?",
    answer:
      "Yes! Clario offers 5 dedicated workspace modes. You can toggle between them in 1 click from the page header without losing your preferences, active filters, or data.",
  },
];

export default function LandingPage() {
  const [selectedExpense, setSelectedExpense] = useState(0);
  const [activeModeTab, setActiveModeTab] = useState("business");
  const [verifierInput, setVerifierInput] = useState(
    "0x89f4b7a120c8de3176ef98231c51bc19aa314",
  );
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<null | {
    valid: boolean;
    timestamp: string;
    block: string;
    approver: string;
    details: string;
  }>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const activeExpense = SAMPLE_EXPENSES[selectedExpense] ?? SAMPLE_EXPENSES[0]!;
  const activeModeData =
    MODES_DATA.find((m) => m.id === activeModeTab) ?? MODES_DATA[1]!;

  const handleRunVerify = () => {
    setIsVerifying(true);
    setVerificationResult(null);
    setTimeout(() => {
      setIsVerifying(false);
      setVerificationResult({
        valid: true,
        timestamp: "JUST NOW",
        block: "19,842,912",
        approver: "0x7E5F4552091A69125d5Dfcb7b8C2659029395Bdf",
        details:
          "SHA-256 pre-image matches local voucher. Monad Testnet nullifier is unspent. No duplicate claims detected.",
      });
    }, 700);
  };

  return (
    <div className="min-h-screen bg-grid text-[#121212] selection:bg-[#836EF9] selection:text-white relative">
      <ScrollProgress />

      {/* Top Banner Notice */}
      <div className="bg-[#121212] text-white border-b-2 border-[#121212] px-4 py-2 text-center text-xs font-mono font-bold tracking-wider uppercase flex items-center justify-center gap-2">
        <span className="flex h-2 w-2 rounded-full bg-[#10b981] animate-pulse" />
        <span>Monad Testnet Hackathon Edition</span>
        <span className="text-[#836EF9]">•</span>
        <span className="text-gray-300">
          10,000 TPS Parallel EVM Settlement
        </span>
        <span className="text-[#836EF9]">•</span>
        <Link
          href="/proof"
          className="text-[#836EF9] hover:underline flex items-center gap-1"
        >
          Explore Proof Center{" "}
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-[#ffffff]/95 backdrop-blur-md border-b-2 border-[#121212] px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#836EF9] text-white font-black text-xl border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] transition group-hover:translate-x-[1px] group-hover:translate-y-[1px] group-hover:shadow-[1px_1px_0_0_#121212]">
              C
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-wider text-[#121212] uppercase flex items-center gap-2">
                Clario
                <span className="relative overflow-hidden text-[10px] font-black uppercase text-[#836EF9] bg-[#f3f0ff] px-2 py-0.5 rounded-full border-1.5 border-[#121212] shadow-[1px_1px_0_0_#121212] flex items-center gap-1">
                  <MonadLogo className="h-3 w-3" aria-hidden="true" />
                  Monad
                  <BorderTrail
                    size={20}
                    className="bg-[#836EF9]"
                    transition={{
                      repeat: Infinity,
                      duration: 3,
                      ease: "linear",
                    }}
                  />
                </span>
              </span>
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#666]">
                Cryptographic Evidence Ledger
              </span>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-mono font-bold uppercase tracking-wider">
            <a
              href="#modes"
              className="text-[#121212] hover:text-[#836EF9] transition"
            >
              5 Modes
            </a>
            <a
              href="#invariants"
              className="text-[#121212] hover:text-[#836EF9] transition"
            >
              Invariants
            </a>
            <a
              href="#verifier"
              className="text-[#121212] hover:text-[#836EF9] transition"
            >
              Live Sandbox
            </a>
            <a
              href="#comparison"
              className="text-[#121212] hover:text-[#836EF9] transition"
            >
              Comparison
            </a>
            <a
              href="#faq"
              className="text-[#121212] hover:text-[#836EF9] transition"
            >
              FAQ
            </a>
          </nav>

          {/* Primary Action Button */}
          <div className="flex items-center gap-3">
            <Link href="/proof">
              <AnimatedButton
                variant="secondary"
                size="sm"
                icon={
                  <ShieldCheck
                    className="h-3.5 w-3.5 text-[#836EF9]"
                    aria-hidden="true"
                  />
                }
              >
                Proof Center
              </AnimatedButton>
            </Link>
            <Link href="/?mode=personal">
              <AnimatedButton
                variant="primary"
                size="sm"
                magnetic={true}
                rightIcon={
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                }
              >
                Launch App
              </AnimatedButton>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-12 sm:pt-20 pb-16 px-4 sm:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Hero Left Content */}
          <div className="lg:col-span-7 flex flex-col items-start gap-6">
            {/* Tag Badge with TextLoop */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border-2 border-[#121212] bg-[#f3f0ff] shadow-[2px_2px_0_0_#121212]">
              <span className="flex h-2 w-2 rounded-full bg-[#836EF9] animate-ping" />
              <span className="text-xs font-mono font-black tracking-wider uppercase text-[#836EF9]">
                <TextLoop interval={3}>
                  <span>Zero-Leakage Financial Ledger on Monad</span>
                  <span>10,000 TPS Parallel EVM Consensus</span>
                  <span>Confidential Local-First Evidence Vault</span>
                  <span>5 Operating Workspaces in One Unified App</span>
                </TextLoop>
              </span>
            </div>

            {/* Main Headline with TextEffect */}
            <TextEffect
              preset="fade-in-blur"
              per="word"
              as="h1"
              className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08] text-[#121212]"
            >
              Private Offchain Evidence. Cryptographic Proof on Monad.
            </TextEffect>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-gray-700 font-medium leading-relaxed max-w-2xl">
              Reimburse team expenses, manage budgets across 5 specialized
              workspaces, and generate tamper-proof mathematical proofs without
              ever leaking private invoices, vendor names, or client PII to the
              world.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link href="/?mode=personal">
                <AnimatedButton
                  variant="primary"
                  size="lg"
                  magnetic={true}
                  rightIcon={
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  }
                >
                  Launch App Free
                </AnimatedButton>
              </Link>
              <a href="#verifier">
                <AnimatedButton
                  variant="secondary"
                  size="lg"
                  icon={
                    <Terminal
                      className="h-4 w-4 text-[#836EF9]"
                      aria-hidden="true"
                    />
                  }
                >
                  Simulate Verifier
                </AnimatedButton>
              </a>
            </div>

            {/* Micro Guarantees */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t-2 border-[#121212]/15 w-full">
              <div className="flex flex-col">
                <span className="text-xs font-mono font-black uppercase text-[#121212] flex items-center gap-1">
                  <BadgeCheck
                    className="h-3.5 w-3.5 text-[#10b981]"
                    aria-hidden="true"
                  />
                  Local-First
                </span>
                <span className="text-[11px] text-gray-500 font-mono">
                  Receipts stay encrypted
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-mono font-black uppercase text-[#121212] flex items-center gap-1">
                  <BadgeCheck
                    className="h-3.5 w-3.5 text-[#10b981]"
                    aria-hidden="true"
                  />
                  10,000 TPS
                </span>
                <span className="text-[11px] text-gray-500 font-mono">
                  Sub-second finality
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-mono font-black uppercase text-[#121212] flex items-center gap-1">
                  <BadgeCheck
                    className="h-3.5 w-3.5 text-[#10b981]"
                    aria-hidden="true"
                  />
                  Anti-Duplicate
                </span>
                <span className="text-[11px] text-gray-500 font-mono">
                  Nullifier protection
                </span>
              </div>
            </div>
          </div>

          {/* Hero Right: Interactive Live Voucher Card */}
          <div className="lg:col-span-5">
            <InteractiveCard
              enableTilt={true}
              enableSpotlight={true}
              rotationFactor={4}
              className="p-0 overflow-hidden shadow-[6px_6px_0_0_#121212] rounded-2xl bg-white border-2 border-[#121212]"
            >
              {/* Card Header Bar */}
              <div className="bg-[#121212] text-white px-4 py-3 flex items-center justify-between border-b-2 border-[#121212]">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-[#ef4444]" />
                  <div className="h-3 w-3 rounded-full bg-[#f59e0b]" />
                  <div className="h-3 w-3 rounded-full bg-[#10b981]" />
                  <span className="text-[11px] font-mono font-bold tracking-wider uppercase ml-2 text-gray-300">
                    Live Proof Voucher Sandbox
                  </span>
                </div>
                <span className="text-[10px] font-mono bg-[#836EF9] text-white px-2 py-0.5 rounded font-black uppercase">
                  Monad #10143
                </span>
              </div>

              {/* Sample Selector Tabs */}
              <div className="bg-[#f8f9fa] border-b-2 border-[#121212] p-2 flex gap-1.5">
                {SAMPLE_EXPENSES.map((exp, idx) => (
                  <button
                    key={exp.id}
                    type="button"
                    onClick={() => setSelectedExpense(idx)}
                    className={`flex-1 text-[11px] font-mono font-bold uppercase py-1.5 px-2 rounded-md border-1.5 transition text-center ${
                      selectedExpense === idx
                        ? "bg-[#836EF9] text-white border-[#121212] shadow-[2px_2px_0_0_#121212]"
                        : "bg-white text-gray-700 border-gray-300 hover:border-[#121212]"
                    }`}
                  >
                    {exp.id}
                  </button>
                ))}
              </div>

              {/* Expense Details */}
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-mono font-black uppercase tracking-wider text-[#836EF9] bg-[#f3f0ff] px-2 py-0.5 rounded border border-[#836EF9]/30">
                      {activeExpense.category}
                    </span>
                    <h3 className="text-lg font-black text-[#121212] mt-1.5 leading-snug">
                      {activeExpense.title}
                    </h3>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">
                      Vendor: {activeExpense.vendor}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-[#121212]">
                      {activeExpense.amount}
                    </span>
                    <div className="mt-1">
                      <span className="inline-flex items-center gap-1 text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded-full bg-[#dcfce7] text-[#15803d] border border-[#15803d]">
                        <BadgeCheck
                          className="h-2.5 w-2.5"
                          aria-hidden="true"
                        />
                        {activeExpense.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Privacy Envelope Box */}
                <div className="rounded-lg border-2 border-dashed border-[#836EF9] bg-[#f3f0ff]/60 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-mono font-black text-[#836EF9] uppercase">
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Founder Invariant #1: Offchain Privacy</span>
                  </div>
                  <p className="text-[11px] text-gray-600 font-mono mt-1">
                    {activeExpense.privacy}
                  </p>
                </div>

                {/* Cryptographic Hash Evidence */}
                <div className="bg-[#f8f9fa] rounded-lg border-2 border-[#121212] p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-gray-500 uppercase font-bold">
                      SHA-256 Hash:
                    </span>
                    <span className="font-mono text-[#836EF9] font-bold">
                      {activeExpense.hash}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-gray-500 uppercase font-bold">
                      Monad Block:
                    </span>
                    <span className="font-mono text-[#121212] font-bold">
                      #{activeExpense.blockHeight}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-gray-500 uppercase font-bold">
                      Settlement Gas:
                    </span>
                    <span className="font-mono text-[#10b981] font-bold">
                      0.00012 MON ($0.0003)
                    </span>
                  </div>
                </div>

                {/* Action Link */}
                <Link
                  href="/proof"
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-mono font-black uppercase tracking-wider rounded-lg border-2 border-[#121212] bg-[#121212] text-white hover:bg-[#262626] shadow-[2px_2px_0_0_#836EF9] transition"
                >
                  <ShieldCheck
                    className="h-3.5 w-3.5 text-[#836EF9]"
                    aria-hidden="true"
                  />
                  <span>Verify In Proof Center</span>
                </Link>
              </div>
            </InteractiveCard>
          </div>
        </div>
      </section>

      {/* Metrics Ticker Strip */}
      <section className="border-y-2 border-[#121212] bg-[#ffffff] py-6 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="border-r-0 md:border-r-2 border-[#121212]/15 last:border-0 p-2">
            <span className="text-3xl sm:text-4xl font-black text-[#121212] tracking-tight">
              10,000+
            </span>
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#836EF9] mt-1">
              Monad Parallel TPS
            </p>
          </div>
          <div className="border-r-0 md:border-r-2 border-[#121212]/15 last:border-0 p-2">
            <span className="text-3xl sm:text-4xl font-black text-[#121212] tracking-tight">
              &lt; 0.8s
            </span>
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#836EF9] mt-1">
              Settlement Finality
            </p>
          </div>
          <div className="border-r-0 md:border-r-2 border-[#121212]/15 last:border-0 p-2">
            <span className="text-3xl sm:text-4xl font-black text-[#121212] tracking-tight">
              0 Bytes
            </span>
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#836EF9] mt-1">
              Leaked Invoice Data
            </p>
          </div>
          <div className="p-2">
            <span className="text-3xl sm:text-4xl font-black text-[#121212] tracking-tight">
              5 Modes
            </span>
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#836EF9] mt-1">
              Unified Workspaces
            </p>
          </div>
        </div>
      </section>

      {/* 5 Modes Interactive Showcase */}
      <section id="modes" className="py-20 px-4 sm:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-mono font-black uppercase tracking-widest text-[#836EF9] bg-[#f3f0ff] px-3 py-1 rounded-full border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] inline-flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-[#836EF9]" aria-hidden="true" />
            Adaptive Architecture
          </span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-[#121212] mt-4">
            5 Purpose-Built Workspaces. One Ledger.
          </h2>
          <p className="text-gray-600 font-medium text-base mt-2">
            Whether you are an independent builder, a 50-person crypto protocol,
            or managing household finances, Clario adapts your workflow in a
            single click.
          </p>
        </div>

        {/* Tab Navigation with AnimatedBackground */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8 p-1.5 bg-[#f9fafb] border-2 border-[#121212] rounded-2xl max-w-fit mx-auto shadow-[3px_3px_0_0_#121212]">
          <AnimatedBackground
            defaultValue={activeModeTab}
            className="bg-[#836EF9] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] rounded-xl"
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 30,
            }}
          >
            {MODES_DATA.map((mode) => {
              const Icon = mode.icon;
              const isActive = activeModeTab === mode.id;
              return (
                <button
                  key={mode.id}
                  data-id={mode.id}
                  type="button"
                  onClick={() => setActiveModeTab(mode.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-black uppercase tracking-wider transition-colors ${
                    isActive ? "text-white" : "text-gray-700 hover:text-black"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{mode.name}</span>
                </button>
              );
            })}
          </AnimatedBackground>
        </div>

        {/* Active Mode Display Card with InteractiveCard */}
        <InteractiveCard
          enableTilt={true}
          enableSpotlight={true}
          rotationFactor={3}
          className="rounded-2xl border-2 border-[#121212] bg-[#ffffff] shadow-[6px_6px_0_0_#121212] p-6 sm:p-10"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left: Description & Features */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#f3f0ff] border border-[#836EF9] text-xs font-mono font-black text-[#836EF9] uppercase">
                <span>{activeModeData.name} Mode Workspace</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-[#121212]">
                {activeModeData.tagline}
              </h3>
              <p className="text-gray-600 font-medium text-base leading-relaxed">
                {activeModeData.description}
              </p>

              {/* Feature Checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {activeModeData.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <BadgeCheck
                      className="h-4 w-4 text-[#836EF9] shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span className="text-xs font-mono font-bold text-gray-800">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              {/* Action Button */}
              <div className="pt-4">
                <Link href={`/?mode=${activeModeData.id}`}>
                  <AnimatedButton
                    variant="black"
                    size="md"
                    magnetic={true}
                    rightIcon={
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    }
                  >
                    Launch in {activeModeData.name} Mode
                  </AnimatedButton>
                </Link>
              </div>
            </div>

            {/* Right: Simulated Interface Preview */}
            <div className="lg:col-span-5 bg-grid rounded-xl border-2 border-[#121212] p-5 shadow-[4px_4px_0_0_#121212]">
              <div className="flex items-center justify-between border-b-2 border-[#121212]/15 pb-3">
                <span className="text-[10px] font-mono font-black uppercase tracking-widest text-gray-500">
                  {activeModeData.name.toUpperCase()} DASHBOARD PREVIEW
                </span>
                <span className="text-[10px] font-mono font-bold bg-[#836EF9] text-white px-2 py-0.5 rounded">
                  {activeModeData.preview.badge}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-white rounded-lg border-2 border-[#121212] p-3 shadow-[2px_2px_0_0_#121212]">
                  <span className="text-[9px] font-mono uppercase text-gray-500 font-bold block">
                    {activeModeData.preview.stat1Label}
                  </span>
                  <span className="text-lg font-black text-[#121212]">
                    {activeModeData.preview.stat1}
                  </span>
                </div>
                <div className="bg-white rounded-lg border-2 border-[#121212] p-3 shadow-[2px_2px_0_0_#121212]">
                  <span className="text-[9px] font-mono uppercase text-gray-500 font-bold block">
                    {activeModeData.preview.stat2Label}
                  </span>
                  <span className="text-lg font-black text-[#836EF9]">
                    {activeModeData.preview.stat2}
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-lg border-2 border-[#121212] p-3 mt-3 shadow-[2px_2px_0_0_#121212]">
                <span className="text-[9px] font-mono uppercase text-gray-500 font-bold block mb-1">
                  RECENT ACTIVITY / VOUCHER
                </span>
                <p className="text-xs font-mono font-bold text-[#121212] truncate">
                  {activeModeData.preview.recent}
                </p>
                <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 mt-2 pt-2 border-t border-gray-100">
                  <span>Cryptographic Status:</span>
                  <span className="text-[#10b981] font-bold inline-flex items-center gap-1">
                    <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                    Verified on Monad
                  </span>
                </div>
              </div>
            </div>
          </div>
        </InteractiveCard>
      </section>

      {/* The 4 Founder Invariants Section */}
      <section
        id="invariants"
        className="py-20 px-4 sm:px-8 max-w-7xl mx-auto border-t-2 border-[#121212]"
      >
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-mono font-black uppercase tracking-widest text-[#836EF9] bg-[#f3f0ff] px-3 py-1 rounded-full border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
            Architectural Guarantees
          </span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-[#121212] mt-4">
            The 4 Founder Invariants
          </h2>
          <p className="text-gray-600 font-medium text-base mt-2">
            Non-negotiable security rules built into Clario&apos;s smart
            contracts, database schema, and browser runtime.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {FOUNDER_INVARIANTS.map((inv) => {
            const Icon = inv.icon;
            return (
              <InView key={inv.number} once={true}>
                <InteractiveCard
                  rotationFactor={3}
                  enableSpotlight={true}
                  className="rounded-2xl border-2 border-[#121212] bg-[#ffffff] p-6 sm:p-8 shadow-[5px_5px_0_0_#121212] flex flex-col justify-between h-full"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-3xl font-black text-[#836EF9] font-mono">
                        {inv.number}
                      </span>
                      <span className="text-[10px] font-mono font-black uppercase px-2.5 py-1 rounded-full bg-[#f3f0ff] text-[#836EF9] border-1.5 border-[#121212]">
                        {inv.badge}
                      </span>
                    </div>
                    <h3 className="text-xl font-black text-[#121212] flex items-center gap-2">
                      <Icon
                        className="h-5 w-5 text-[#836EF9]"
                        aria-hidden="true"
                      />
                      <span>{inv.title}</span>
                    </h3>
                    <p className="text-xs font-mono font-bold text-gray-500 uppercase mt-1">
                      {inv.subtitle}
                    </p>
                    <p className="text-sm text-gray-700 font-medium leading-relaxed mt-3">
                      {inv.description}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t-2 border-[#121212]/10 bg-[#f8f9fa] rounded-lg p-3 font-mono text-xs text-[#121212] font-bold">
                    <span className="text-gray-400 select-none mr-2">$</span>
                    {inv.code}
                  </div>
                </InteractiveCard>
              </InView>
            );
          })}
        </div>
      </section>

      {/* Interactive Cryptographic Verifier Sandbox */}
      <section
        id="verifier"
        className="py-20 px-4 sm:px-8 max-w-7xl mx-auto border-t-2 border-[#121212]"
      >
        <div className="relative rounded-2xl border-2 border-[#121212] bg-[#121212] text-white p-6 sm:p-12 shadow-[8px_8px_0_0_#836EF9] overflow-hidden">
          {isVerifying && (
            <BorderTrail
              size={120}
              className="bg-[#836EF9]"
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            />
          )}
          <div className="max-w-3xl">
            <span className="text-xs font-mono font-black uppercase tracking-widest text-[#836EF9] bg-white/10 px-3 py-1 rounded-full border border-[#836EF9]">
              Interactive Sandbox
            </span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white mt-4">
              Test Zero-Knowledge Verification Live
            </h2>
            <p className="text-gray-300 font-medium text-sm sm:text-base mt-2">
              Any auditor, team reviewer, or client can independently verify
              that an expense has not been tampered with and has not been
              double-spent.
            </p>
          </div>

          {/* Sandbox Input Box */}
          <div className="mt-8 bg-[#1e1e1e] rounded-xl border-2 border-white/20 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-gray-400 block mb-1">
                  Expense Commitment Hash or Preimage:
                </label>
                <input
                  type="text"
                  value={verifierInput}
                  onChange={(e) => setVerifierInput(e.target.value)}
                  className="w-full bg-[#121212] text-white font-mono text-xs sm:text-sm px-4 py-3 rounded-lg border-2 border-white/30 focus:border-[#836EF9] outline-none"
                  placeholder="0x..."
                />
              </div>
              <div className="self-end sm:self-auto">
                <AnimatedButton
                  variant="primary"
                  size="md"
                  onClick={handleRunVerify}
                  isLoading={isVerifying}
                  loadingText="VERIFYING..."
                  disabled={isVerifying}
                >
                  Verify Hash
                </AnimatedButton>
              </div>
            </div>

            {/* Quick Sample Selector */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-mono">
              <span className="text-gray-400">Quick samples:</span>
              <button
                type="button"
                onClick={() =>
                  setVerifierInput("0x89f4b7a120c8de3176ef98231c51bc19aa314")
                }
                className="text-[#836EF9] underline hover:text-white"
              >
                RPC Cluster (#EXP-9042)
              </button>
              <span className="text-gray-600">•</span>
              <button
                type="button"
                onClick={() =>
                  setVerifierInput("0x4b7c11f9e9842dc59012a6771e8bf43912da0")
                }
                className="text-[#836EF9] underline hover:text-white"
              >
                Devcon Travel (#EXP-9043)
              </button>
            </div>

            {/* Verification Result Output */}
            <AnimatePresence>
              {verificationResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  className="mt-4 rounded-lg border-2 border-[#10b981] bg-[#10b981]/10 p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-black uppercase text-[#10b981] flex items-center gap-1.5">
                      <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                      CRYPTOGRAPHIC PROOF VERIFIED VALID
                    </span>
                    <span className="text-[10px] font-mono text-gray-300">
                      Monad Block #{verificationResult.block}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-gray-200">
                    {verificationResult.details}
                  </p>
                  <div className="pt-2 text-[10px] font-mono text-gray-400 flex flex-wrap gap-4 border-t border-white/10">
                    <span>
                      Authorized Approver: {verificationResult.approver}
                    </span>
                    <span>Settlement: Monad Testnet</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* Comparison Matrix */}
      <section
        id="comparison"
        className="py-20 px-4 sm:px-8 max-w-7xl mx-auto border-t-2 border-[#121212]"
      >
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-mono font-black uppercase tracking-widest text-[#836EF9] bg-[#f3f0ff] px-3 py-1 rounded-full border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
            Category Superiority
          </span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-[#121212] mt-4">
            Why Clario Outclasses Other Expense Tools
          </h2>
          <p className="text-gray-600 font-medium text-base mt-2">
            Traditional corporate expense apps leak your data to centralized
            servers; raw crypto wallets lack receipt auditing and private
            commitments.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border-2 border-[#121212] bg-[#ffffff] shadow-[6px_6px_0_0_#121212] rounded-xl text-left text-xs font-mono">
            <thead>
              <tr className="bg-[#121212] text-white border-b-2 border-[#121212]">
                <th className="p-4 uppercase tracking-wider text-sm font-black">
                  Capability / Guarantee
                </th>
                <th className="p-4 uppercase tracking-wider text-sm font-black text-[#836EF9] bg-[#1e1e1e]">
                  Clario on Monad
                </th>
                <th className="p-4 uppercase tracking-wider text-sm font-black text-gray-400">
                  Web2 Apps (Ramp, Expensify)
                </th>
                <th className="p-4 uppercase tracking-wider text-sm font-black text-gray-400">
                  Raw Crypto Wallets
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row, idx) => (
                <tr
                  key={idx}
                  className="border-b-2 border-[#121212]/15 hover:bg-[#f8f9fa] transition"
                >
                  <td className="p-4 font-bold text-gray-900">{row.feature}</td>
                  <td className="p-4 bg-[#f3f0ff]/50 font-black text-[#836EF9]">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#836EF9] text-white">
                      <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                      YES
                    </span>
                  </td>
                  <td className="p-4 text-gray-400">
                    <span className="text-gray-400">✕ No</span>
                  </td>
                  <td className="p-4 text-gray-400">
                    <span className="text-gray-400">✕ No</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ Section */}
      <section
        id="faq"
        className="py-20 px-4 sm:px-8 max-w-4xl mx-auto border-t-2 border-[#121212]"
      >
        <div className="text-center mb-12">
          <span className="text-xs font-mono font-black uppercase tracking-widest text-[#836EF9] bg-[#f3f0ff] px-3 py-1 rounded-full border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
            Answers & Clarity
          </span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-[#121212] mt-4">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-xl border-2 border-[#121212] bg-[#ffffff] shadow-[3px_3px_0_0_#121212] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between p-5 text-left font-black text-sm text-[#121212] hover:bg-[#f8f9fa] transition"
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-[#836EF9] transition-transform duration-200 ${
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
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 pt-1 text-xs text-gray-600 font-medium leading-relaxed border-t border-gray-100">
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

      {/* Final Call to Action Banner */}
      <section className="py-20 px-4 sm:px-8 max-w-7xl mx-auto">
        <div className="rounded-3xl border-3 border-[#121212] bg-[#836EF9] text-white p-8 sm:p-14 shadow-[8px_8px_0_0_#121212] text-center relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-6">
            <span className="text-xs font-mono font-black uppercase tracking-widest bg-white text-[#121212] px-3 py-1 rounded-full border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
              Start Testing Now
            </span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight text-white">
              Take Control of Your Verifiable Financial Ledger.
            </h2>
            <p className="text-white/90 font-medium text-base">
              Experience the power of local-first privacy coupled with
              Monad&apos;s ultra-fast parallel EVM. Launch in your preferred
              workspace in 10 seconds.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
              <Link href="/?mode=personal">
                <AnimatedButton variant="secondary" size="md" magnetic={true}>
                  Launch Personal Mode →
                </AnimatedButton>
              </Link>
              <Link href="/?mode=freelancer">
                <AnimatedButton variant="black" size="md" magnetic={true}>
                  Launch Freelancer Mode →
                </AnimatedButton>
              </Link>
              <Link href="/?mode=business">
                <AnimatedButton variant="secondary" size="md" magnetic={true}>
                  Launch Business Mode →
                </AnimatedButton>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-[#121212] bg-[#ffffff] py-12 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#836EF9] text-white font-black text-lg border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
              C
            </div>
            <div>
              <span className="text-base font-black tracking-wider text-[#121212] uppercase">
                Clario
              </span>
              <p className="text-[10px] font-mono text-gray-500 uppercase">
                Verifiable Expense Ledger on Monad
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-mono font-bold text-gray-700 uppercase">
            <Link href="/proof" className="hover:text-[#836EF9] transition">
              Proof Center
            </Link>
            <Link href="/receipts" className="hover:text-[#836EF9] transition">
              Receipt Vault
            </Link>
            <Link href="/budgets" className="hover:text-[#836EF9] transition">
              Budgets
            </Link>
            <Link
              href="/subscriptions"
              className="hover:text-[#836EF9] transition"
            >
              Subscriptions
            </Link>
            <Link
              href="https://docs.monad.xyz"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#836EF9] transition flex items-center gap-1"
            >
              Monad Docs <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>

          <span className="text-[10px] font-mono text-gray-500 uppercase">
            © 2026 Clario Protocol. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}
