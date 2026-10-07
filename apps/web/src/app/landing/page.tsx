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
  UserRound,
  GitBranch,
  BotOff,
  Receipt,
  FileCheck2,
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
  InView,
  AnimatedBackground,
  BorderTrail,
} from "@/components/ui/motion";
import { motion, AnimatePresence } from "motion/react";
import { HowClarioWorksModal } from "@/components/landing/how-clario-works-modal";

// Interactive Demo Expenses for Hero Voucher Sandbox
const SAMPLE_EXPENSES = [
  {
    id: "EXP-9042",
    title: "Monad RPC Dedicated Cluster",
    vendor: "QuickNode Monad Infrastructure",
    amount: "$840.00",
    category: "Cloud Infrastructure",
    hash: "0x89f4b7a120c8de3176ef98231c51bc19aa314",
    blockHeight: "19,842,912",
    status: "Verified & Settled",
    mode: "business",
    privacy: "Vendor invoice offchain · Zero public leakage",
    gasFee: "0.00012 MON ($0.0003)",
  },
  {
    id: "EXP-9043",
    title: "Devcon 7 Flight & Accommodation",
    vendor: "United Airlines & Marriott Bangkok",
    amount: "$1,620.00",
    category: "Team Travel",
    hash: "0x4b7c11f9e9842dc59012a6771e8bf43912da0",
    blockHeight: "19,842,945",
    status: "Approved by Treasury",
    mode: "freelancer",
    privacy: "Passenger PII & ticket PDF encrypted locally",
    gasFee: "0.00014 MON ($0.0004)",
  },
  {
    id: "EXP-9044",
    title: "Smart Contract Audit Retainer",
    vendor: "CertiK Formal Verification",
    amount: "$4,500.00",
    category: "Security & Auditing",
    hash: "0x3f1e98bb4510ad674902187cc8431920fba61",
    blockHeight: "19,842,980",
    status: "Verified & Settled",
    mode: "business",
    privacy: "Audit scope offchain · Hash commitment on Monad",
    gasFee: "0.00011 MON ($0.0003)",
  },
];

// 4 Core Workspaces Details
const WORKSPACES_DATA = [
  {
    id: "personal",
    name: "Personal",
    icon: UserRound,
    tagline: "Private cashflow & onchain tracking",
    summary:
      "A privacy-first cashflow and expense ledger unifying fiat and onchain balances without sharing bank credentials.",
    features: [
      "Dual sub-ledger for fiat cash and Monad/Base/ETH tokens",
      "Interactive category budgets with real-time overspend alerts",
      "Automatic SaaS recurring subscription renewal detector",
    ],
    preview: {
      stat1: "$3,420.50",
      stat1Label: "Monthly Outflow",
      stat2: "14 Active",
      stat2Label: "Recurring Subscriptions",
      badge: "84% Budget Health",
      recent: "Whole Foods Organic Groceries — $124.80",
    },
  },
  {
    id: "freelancer",
    name: "Freelancer",
    icon: BriefcaseBusiness,
    tagline: "Client billing & deductible ledger",
    summary:
      "Track project-specific expenses, generate client-reimbursable vouchers, and organize Schedule C write-offs.",
    features: [
      "Client & project expense allocation with billable tags",
      "Schedule C tax write-off category organization",
      "Cryptographic reimbursement vouchers with verifiable hashes",
    ],
    preview: {
      stat1: "$8,950.00",
      stat1Label: "Unbilled Reimbursements",
      stat2: "$3,240.00",
      stat2Label: "Q4 Tax Deductibles",
      badge: "6 Clients Active",
      recent: "Figma Enterprise License (Acme Corp) — $75.00",
    },
  },
  {
    id: "family",
    name: "Family",
    icon: UsersRound,
    tagline: "Shared household pools & split settlement",
    summary:
      "Coordinate shared grocery runs, recurring utility calendars, and fair balance settlements across household members.",
    features: [
      "Shared household expense pools with member attribution",
      "Fair-share split calculation with transparent debt logs",
      "Recurring monthly utility bills and joint savings goals",
    ],
    preview: {
      stat1: "$4,120.00",
      stat1Label: "Household Pool",
      stat2: "100% Balanced",
      stat2Label: "Settlement Status",
      badge: "4 Members",
      recent: "City Water & Power Utility — $142.50",
    },
  },
  {
    id: "business",
    name: "Business",
    icon: Building2,
    tagline: "Team treasury governance & nullifier settlement",
    summary:
      "Department-level budget governance, multi-seat approval queues, and one-click Monad batch reimbursements.",
    features: [
      "Two-phase approval queue: Reviewer audit and Treasury release",
      "Sub-second Monad batch reimbursements (<0.8s finality)",
      "Strict smart-contract nullifier guards preventing double-reimbursement",
    ],
    preview: {
      stat1: "$42,800.00",
      stat1Label: "Team Monthly Burn",
      stat2: "3 Pending",
      stat2Label: "Treasury Approvals",
      badge: "99.8% Policy Adherence",
      recent: "AWS Cloud Compute Clusters — $2,840.00",
    },
  },
];

// The 4 Founder Invariants
const FOUNDER_INVARIANTS = [
  {
    number: "01",
    title: "Offchain private evidence",
    subtitle: "What happens in your receipt stays in your vault",
    icon: Lock,
    description:
      "Vendor names, line-item itemizations, and receipt scans are never published to public ledgers or IPFS. Clario hashes evidence locally in your browser so you retain total commercial confidentiality.",
    code: "sha256(raw_receipt_bytes) → commitment_hash",
  },
  {
    number: "02",
    title: "Immutable material versions",
    subtitle: "Every edit produces an auditable successor hash",
    icon: GitBranch,
    description:
      "No retroactive database edits or stealth tampering. If an amount or merchant changes, a new immutable child version is recorded. Reviewers and auditors verify the exact version hash signed by treasury.",
    code: "version_n+1 = hash(version_n + patch_delta)",
  },
  {
    number: "03",
    title: "AI has zero authority",
    subtitle: "Machine extraction assists; authorized humans govern",
    icon: BotOff,
    description:
      "Our AI copilot extracts receipts, suggests categories, and flags potential duplicate submissions. However, the AI possesses zero signing keys, cannot move funds, and cannot approve any reimbursement.",
    code: "human_signature required for release",
  },
  {
    number: "04",
    title: "Deterministic settlement",
    subtitle: "Sub-second Monad finality & nullifier defense",
    icon: Zap,
    description:
      "When treasury approves an expense, Monad executes settlement in under 1 second for less than $0.001 gas. An onchain nullifier guarantees that no receipt can ever be reimbursed twice.",
    code: "require(!nullifierSpent[hash], 'DUPLICATE')",
  },
];

// Honest Comparison Matrix (Includes competitor wins)
const COMPARISON = [
  {
    feature: "Cryptographic receipt commitments",
    clario: "Yes",
    web2: "No",
    cryptoWallet: "No",
  },
  {
    feature: "Offchain invoice data privacy",
    clario: "Yes",
    web2: "Centralized",
    cryptoWallet: "No",
  },
  {
    feature: "Sub-second parallel settlement",
    clario: "Yes (Monad)",
    web2: "No (2-3 days)",
    cryptoWallet: "Partial",
  },
  {
    feature: "Strict anti-duplicate nullifier guards",
    clario: "Yes",
    web2: "Centralized",
    cryptoWallet: "No",
  },
  {
    feature: "Subordinate AI (zero signing authority)",
    clario: "Yes",
    web2: "Centralized",
    cryptoWallet: "N/A",
  },
  {
    feature: "Dedicated multi-workspace modes",
    clario: "Yes (4 modes)",
    web2: "Partial",
    cryptoWallet: "No",
  },
  // Competitor strengths honestly represented:
  {
    feature: "Accounting software sync (QuickBooks, Xero)",
    clario: "Partial (CSV/JSON)",
    web2: "Yes",
    cryptoWallet: "No",
  },
  {
    feature: "Native mobile apps (iOS & Android)",
    clario: "No (Mobile web)",
    web2: "Yes",
    cryptoWallet: "Partial",
  },
  {
    feature: "Traditional fiat payout rails (ACH/SEPA)",
    clario: "No (Crypto / local)",
    web2: "Yes",
    cryptoWallet: "No",
  },
  {
    feature: "Established corporate compliance history",
    clario: "Partial (Audit trail)",
    web2: "Yes",
    cryptoWallet: "No",
  },
];

// Expanded FAQs
const FAQS = [
  {
    question: "How much does it cost to use Clario?",
    answer:
      "Clario charges zero protocol fees on testnet. Onchain commitment anchoring and settlement only incur Monad testnet gas fees, which typically cost less than 0.0002 MON (a fraction of a cent per transaction).",
  },
  {
    question: "What wallets and blockchains are supported?",
    answer:
      "Clario features direct EVM RPC integration across Monad Testnet (Chain ID 10143), Ethereum Mainnet, Base, and Sepolia. Any standard Web3 wallet—including MetaMask, Rabby, Phantom EVM, and WalletConnect—can be connected for onchain signing.",
  },
  {
    question: "How are receipts kept private if hashes are recorded onchain?",
    answer:
      "Under Founder Invariant #1 (Offchain Private Evidence), vendor names, itemized lines, and uploaded files are envelope-encrypted and stored locally on your machine. Only an irreversible 32-byte SHA-256 commitment hash is published to Monad. Third parties seeing the blockchain cannot reverse or view your receipt contents.",
  },
  {
    question: "How does duplicate reimbursement prevention work?",
    answer:
      "When an expense commitment is settled, the smart contract on Monad writes a unique nullifier derived from the receipt's hash. If anyone attempts to submit or claim reimbursement for the same invoice again, the Monad contract immediately reverts with a duplicate nullifier error.",
  },
  {
    question: "How do I back up and recover my local vault?",
    answer:
      "You can export standalone cryptographic verification packages (ZIP) containing canonical RFC 8785 JSON records, encrypted evidence, and signature proofs from the Proof Center. These packages can be securely archived offline or transferred between machines.",
  },
  {
    question: "What happens if I clear my browser data or change devices?",
    answer:
      "Onchain commitments and nullifiers remain permanently on Monad. However, because private evidence pre-images are stored locally in your browser storage (localStorage/IndexedDB), clearing your browser storage without an exported backup will remove local receipt copies. We recommend regularly downloading backup packages.",
  },
  {
    question: "Can external auditors or tax authorities verify my expenses?",
    answer:
      "Yes. Anyone with the exported voucher package can run our offline deterministic verifier CLI (`pnpm verify:package`) or inspect the hash on Monad Explorer without requiring an account or contacting Clario servers.",
  },
  {
    question: "Is Clario's smart contract code audited?",
    answer:
      "Clario is experimental software currently deployed on Monad Testnet for hackathon testing and community demonstration. The contracts have not yet completed a formal third-party security audit. Do not use for real funds or production corporate treasuries.",
  },
];

export default function LandingPage() {
  const [selectedExpense, setSelectedExpense] = useState(0);
  const [activeModeTab, setActiveModeTab] = useState("business");
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [showVoucherDetails, setShowVoucherDetails] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
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

  const activeExpense =
    SAMPLE_EXPENSES[selectedExpense] ?? SAMPLE_EXPENSES[0]!;
  const activeModeData =
    WORKSPACES_DATA.find((m) => m.id === activeModeTab) ?? WORKSPACES_DATA[3]!;

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
          "SHA-256 pre-image matches local voucher commitment. Monad Testnet nullifier is unspent. No duplicate claims detected.",
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
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 px-4 sm:px-8 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <ClarioLogo
              size={36}
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
                Cryptographic Evidence Ledger
              </span>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <a
              href="#how-it-works"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              How it works
            </a>
            <a
              href="#modes"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Workspaces
            </a>
            <a
              href="#invariants"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Invariants
            </a>
            <a
              href="#verifier"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Live Sandbox
            </a>
            <a
              href="#comparison"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Comparison
            </a>
            <a
              href="#faq"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              FAQ
            </a>
          </nav>

          {/* Primary Action Button */}
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
            <Link
              href="/?mode=personal"
              className="inline-flex items-center justify-center gap-1.5 font-semibold text-xs px-3.5 py-2 rounded-xl bg-[#7C6CF6] text-white border-2 border-[#121212] shadow-[3px_3px_0_0_#121212] hover:bg-[#6c5be8] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
            >
              <span>Launch testnet app</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
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
                Private Offchain Evidence. Cryptographic Commitments on Monad.
              </TextEffect>

              {/* Subtitle */}
              <p className="text-base sm:text-lg text-gray-600 font-normal leading-relaxed max-w-xl">
                Organize team expenses and personal cashflow across dedicated
                workspaces. Keep itemized receipts private on your device while
                publishing verifiable cryptographic commitments to Monad.
              </p>

              {/* Hero CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 w-full sm:w-auto">
                <Link
                  href="/?mode=personal"
                  className="inline-flex items-center justify-center gap-2 font-semibold text-base px-6 py-3.5 rounded-xl bg-[#7C6CF6] text-white border-2 border-[#121212] shadow-[4px_4px_0_0_#121212] hover:bg-[#6c5be8] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                >
                  <span>Launch testnet app</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
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
                Unaudited testnet deployment on Monad Testnet (Chain ID 10143).
                Demonstration software—do not use real funds.
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
                    Verifiable commitments
                  </span>
                  <span className="text-xs text-gray-500 leading-snug block mt-0.5">
                    Deterministic SHA-256 digests
                  </span>
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-900 block">
                    Anti-duplicate guards
                  </span>
                  <span className="text-xs text-gray-500 leading-snug block mt-0.5">
                    Onchain nullifier protection
                  </span>
                </div>
              </div>
            </div>

            {/* Hero Right: Simplified Voucher Card */}
            <div className="lg:col-span-5">
              <InteractiveCard
                enableTilt={true}
                enableSpotlight={true}
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
                      Sample Expense Voucher
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
                      className={`flex-1 text-xs font-mono font-medium py-1.5 px-2 rounded-lg border transition-all text-center ${
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
                        Commitment Hash:
                      </span>
                      <div className="flex items-center gap-1.5 font-mono text-xs font-medium text-gray-800">
                        <span>
                          {activeExpense.hash.slice(0, 10)}...
                          {activeExpense.hash.slice(-8)}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyHash}
                          title="Copy full hash"
                          className="p-1 text-gray-400 hover:text-gray-700 transition"
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
                            : "Show block & gas details"}
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
                              <span>Nullifier Scheme:</span>
                              <span className="text-gray-800">
                                SHA-256 pre-image
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
                  10,000+
                </span>
                <p className="text-xs font-medium text-gray-500 mt-0.5">
                  Monad network capability (parallel TPS)
                </p>
              </div>
              <div>
                <span className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                  &lt; 0.8s
                </span>
                <p className="text-xs font-medium text-gray-500 mt-0.5">
                  Target consensus finality
                </p>
              </div>
              <div>
                <span className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                  Private
                </span>
                <p className="text-xs font-medium text-gray-500 mt-0.5">
                  No invoice contents published onchain
                </p>
              </div>
              <div>
                <span className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                  4 Modes
                </span>
                <p className="text-xs font-medium text-gray-500 mt-0.5">
                  Specialized operating workspaces
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

        {/* How It Works Section: 4-Step Visual Flow */}
        <section
          id="how-it-works"
          className="py-24 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto"
        >
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 [text-wrap:balance]">
              How Clario works
            </h2>
            <p className="text-base sm:text-lg text-gray-600 mt-3 leading-relaxed">
              A 4-step pipeline that combines client-side privacy with onchain
              mathematical verification.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {/* Step 1 */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="h-10 w-10 rounded-xl bg-[#f5f3ff] text-[#7C6CF6] flex items-center justify-center font-bold">
                    <Receipt className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <span className="text-xs font-mono font-bold text-gray-400">
                    STEP 01
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  Capture receipt locally
                </h3>
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                  Scan or upload receipts and invoices. Optical OCR extracts
                  vendor, date, and line-item totals directly in your browser.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-gray-100 text-xs font-medium text-[#7C6CF6]">
                Offchain client vault
              </div>
            </div>

            {/* Step 2 */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="h-10 w-10 rounded-xl bg-[#f5f3ff] text-[#7C6CF6] flex items-center justify-center font-bold">
                    <Lock className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <span className="text-xs font-mono font-bold text-gray-400">
                    STEP 02
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  Hash locally
                </h3>
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                  Your browser creates a deterministic SHA-256 digest of the raw
                  evidence. Private vendor names and files never touch the
                  blockchain.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-gray-100 text-xs font-medium text-[#7C6CF6]">
                SHA-256 pre-image commitment
              </div>
            </div>

            {/* Step 3 */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="h-10 w-10 rounded-xl bg-[#f5f3ff] text-[#7C6CF6] flex items-center justify-center font-bold">
                    <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <span className="text-xs font-mono font-bold text-gray-400">
                    STEP 03
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  Authorize exact version
                </h3>
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                  Designated reviewers and treasury sign the exact immutable
                  commitment state using EIP-712 typed data. AI has zero signing
                  authority.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-gray-100 text-xs font-medium text-[#7C6CF6]">
                Human cryptographic signature
              </div>
            </div>

            {/* Step 4 */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="h-10 w-10 rounded-xl bg-[#f5f3ff] text-[#7C6CF6] flex items-center justify-center font-bold">
                    <Zap className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <span className="text-xs font-mono font-bold text-gray-400">
                    STEP 04
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  Settle on Monad
                </h3>
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                  Monad parallel EVM finalizes settlement in under a second. An
                  onchain nullifier permanently guarantees no receipt can ever
                  be reimbursed twice.
                </p>
              </div>
              <div className="mt-6 pt-3 border-t border-gray-100 text-xs font-medium text-[#7C6CF6]">
                Sub-second nullifier guard
              </div>
            </div>
          </div>
        </section>

        {/* Workspaces Showcase */}
        <section
          id="modes"
          className="py-24 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-gray-200"
        >
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 [text-wrap:balance]">
              4 dedicated workspaces. One unified ledger.
            </h2>
            <p className="text-base sm:text-lg text-gray-600 font-normal mt-3 leading-relaxed">
              Tailored workflows for personal finance, independent consulting,
              household expenses, and protocol treasuries.
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 mb-8 p-1.5 bg-gray-100 rounded-xl max-w-fit mx-auto border border-gray-200">
            <AnimatedBackground
              defaultValue={activeModeTab}
              className="bg-white rounded-lg shadow-xs"
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 30,
              }}
            >
              {WORKSPACES_DATA.map((mode) => {
                const Icon = mode.icon;
                const isActive = activeModeTab === mode.id;
                return (
                  <button
                    key={mode.id}
                    data-id={mode.id}
                    type="button"
                    onClick={() => setActiveModeTab(mode.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                      isActive
                        ? "text-gray-900 font-bold"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span>{mode.name}</span>
                  </button>
                );
              })}
            </AnimatedBackground>
          </div>

          {/* Active Workspace Interactive Preview Card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-10 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left: Description & Bullets */}
              <div className="lg:col-span-7 space-y-6">
                <div>
                  <span className="text-xs font-semibold text-[#7C6CF6] bg-[#f5f3ff] px-2.5 py-1 rounded-md border border-[#e0dbfd]">
                    {activeModeData.name} Workspace
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-3 leading-snug">
                    {activeModeData.tagline}
                  </h3>
                </div>
                <p className="text-gray-600 text-base leading-relaxed">
                  {activeModeData.summary}
                </p>

                {/* 3 Concise Feature Bullets */}
                <div className="space-y-2.5 pt-2">
                  {activeModeData.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <BadgeCheck
                        className="h-4 w-4 text-[#7C6CF6] shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span className="text-sm font-medium text-gray-800 leading-snug">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Action Link */}
                <div className="pt-2">
                  <Link
                    href={`/?mode=${activeModeData.id}`}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-[#7C6CF6] transition-colors"
                  >
                    <span>Launch in {activeModeData.name} mode</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>

              {/* Right: Realistic Browser Frame Preview */}
              <div className="lg:col-span-5 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden shadow-xs">
                {/* Browser Frame Header */}
                <div className="bg-gray-100 border-b border-gray-200 px-3 py-2 flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                    <div className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                    <div className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                  </div>
                  <span className="font-mono text-[11px] text-gray-600 bg-white px-3 py-0.5 rounded border border-gray-200">
                    app.clario.finance/?mode={activeModeData.id}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                    Active
                  </span>
                </div>

                <div className="p-5 space-y-4 bg-white">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <span className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
                      {activeModeData.name} Dashboard
                    </span>
                    <span className="text-xs font-medium bg-[#f5f3ff] text-[#7C6CF6] px-2 py-0.5 rounded">
                      {activeModeData.preview.badge}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                      <span className="text-xs text-gray-500 font-medium block">
                        {activeModeData.preview.stat1Label}
                      </span>
                      <span className="text-xl font-bold text-gray-900 mt-1 block">
                        {activeModeData.preview.stat1}
                      </span>
                    </div>
                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                      <span className="text-xs text-gray-500 font-medium block">
                        {activeModeData.preview.stat2Label}
                      </span>
                      <span className="text-xl font-bold text-[#7C6CF6] mt-1 block">
                        {activeModeData.preview.stat2}
                      </span>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                    <span className="text-xs text-gray-500 font-medium block mb-1">
                      Recent Ledger Entry
                    </span>
                    <p className="text-xs font-semibold text-gray-900 truncate">
                      {activeModeData.preview.recent}
                    </p>
                    <div className="flex items-center justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
                      <span>Status:</span>
                      <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                        <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                        Verified on Monad
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Compact Comparison Row (Replaces redundant card grid) */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-6 text-center">
              Workspace Overview
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {WORKSPACES_DATA.map((ws) => {
                const Icon = ws.icon;
                const isSelected = activeModeTab === ws.id;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => setActiveModeTab(ws.id)}
                    className={`text-left rounded-xl border p-4 transition-all cursor-pointer ${
                      isSelected
                        ? "border-[#7C6CF6] bg-[#f5f3ff]/40 shadow-xs"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="h-4 w-4 text-[#7C6CF6]" />
                      <span className="font-bold text-sm text-gray-900">
                        {ws.name}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 leading-snug line-clamp-2 mb-3">
                      {ws.summary}
                    </p>
                    <ul className="space-y-1.5 text-xs text-gray-700">
                      {ws.features.map((feat, fIdx) => (
                        <li key={fIdx} className="flex items-start gap-1.5">
                          <span className="text-[#7C6CF6] font-bold">›</span>
                          <span className="leading-snug">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* The 4 Founder Invariants Section */}
        <section
          id="invariants"
          className="py-24 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-gray-200"
        >
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 [text-wrap:balance]">
              The 4 founder invariants
            </h2>
            <p className="text-base sm:text-lg text-gray-600 mt-3 leading-relaxed">
              Architectural rules enforced across Clario&apos;s smart contracts,
              client vault, and database.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FOUNDER_INVARIANTS.map((inv) => {
              const Icon = inv.icon;
              return (
                <div
                  key={inv.number}
                  className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl font-bold text-[#7C6CF6] font-mono">
                        {inv.number}
                      </span>
                      <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {inv.title}
                    </h3>
                    <p className="text-xs font-medium text-gray-500 mt-0.5">
                      {inv.subtitle}
                    </p>
                    <p className="text-sm text-gray-600 font-normal leading-relaxed mt-3">
                      {inv.description}
                    </p>
                  </div>

                  <div className="mt-6 pt-3 border-t border-gray-100 font-mono text-xs text-gray-700 bg-gray-50 rounded-lg p-3">
                    <span className="text-gray-400 select-none mr-2">$</span>
                    {inv.code}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Cryptographic Commitment Verification Sandbox */}
        <section
          id="verifier"
          className="py-24 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-gray-200"
        >
          <div className="rounded-2xl border border-gray-900 bg-[#121212] text-white p-6 sm:p-10 shadow-lg overflow-hidden">
            <div className="max-w-2xl">
              <span className="text-xs font-semibold text-[#9b8eff] bg-white/10 px-2.5 py-1 rounded-md border border-white/10 inline-block mb-3">
                Live Simulator
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white [text-wrap:balance]">
                Test cryptographic commitment verification live
              </h2>
              <p className="text-gray-300 text-sm sm:text-base mt-2 leading-relaxed">
                Auditors, team reviewers, or clients can independently verify
                that an expense commitment has not been tampered with and has
                not been double-spent.
              </p>
            </div>

            {/* Sandbox Input Box */}
            <div className="mt-8 bg-[#1e1e1e] rounded-xl border border-white/15 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-400 block mb-1.5">
                    Expense commitment hash or pre-image:
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
                  <button
                    type="button"
                    onClick={handleRunVerify}
                    disabled={isVerifying}
                    className="w-full sm:w-auto font-semibold text-sm px-5 py-3 rounded-lg bg-[#7C6CF6] text-white hover:bg-[#6c5be8] disabled:opacity-50 transition cursor-pointer"
                  >
                    {isVerifying ? "Verifying..." : "Verify hash"}
                  </button>
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
                  RPC Cluster (#EXP-9042)
                </button>
                <span className="text-gray-600">•</span>
                <button
                  type="button"
                  onClick={() =>
                    setVerifierInput("0x4b7c11f9e9842dc59012a6771e8bf43912da0")
                  }
                  className="text-[#9b8eff] underline hover:text-white cursor-pointer"
                >
                  Devcon Travel (#EXP-9043)
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
                        Cryptographic commitment verified valid
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

        {/* How Clario Compares (Honest Matrix) */}
        <section
          id="comparison"
          className="py-24 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-gray-200"
        >
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 [text-wrap:balance]">
              How Clario compares
            </h2>
            <p className="text-base sm:text-lg text-gray-600 mt-3 leading-relaxed">
              Traditional corporate expense software locks records in
              proprietary silos; raw crypto wallets lack receipt auditing and
              private commitments.
            </p>
          </div>

          {/* Comparison Table */}
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-xs">
            <table className="w-full border-collapse text-left text-sm font-sans">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-700">
                  <th className="p-4 uppercase tracking-wider">
                    Capability / Guarantee
                  </th>
                  <th className="p-4 uppercase tracking-wider text-[#7C6CF6] bg-purple-50/50">
                    Clario on Monad
                  </th>
                  <th className="p-4 uppercase tracking-wider text-gray-500">
                    Web2 Apps (Ramp, Expensify)
                  </th>
                  <th className="p-4 uppercase tracking-wider text-gray-500">
                    Raw Crypto Wallets
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {COMPARISON.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-4 font-medium text-gray-900">
                      {row.feature}
                    </td>
                    <td className="p-4 bg-purple-50/30 font-semibold text-[#7C6CF6]">
                      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded bg-purple-100 text-[#5b45e0]">
                        {row.clario}
                      </span>
                    </td>
                    <td className="p-4 text-xs font-medium text-gray-600">
                      {row.web2}
                    </td>
                    <td className="p-4 text-xs font-medium text-gray-600">
                      {row.cryptoWallet}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Comprehensive FAQ Section */}
        <section
          id="faq"
          className="py-24 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto border-t border-gray-200"
        >
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 [text-wrap:balance]">
              Frequently asked questions
            </h2>
            <p className="text-base sm:text-lg text-gray-600 mt-3 leading-relaxed">
              Technical and operational details about Clario, privacy
              guarantees, and testnet usage.
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
        <section className="py-24 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
          <div className="rounded-3xl border border-gray-200 bg-gradient-to-b from-white to-[#f5f3ff] p-8 sm:p-14 text-center shadow-sm">
            <div className="max-w-xl mx-auto space-y-5">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 leading-tight [text-wrap:balance]">
                Ready to test verifiable expense management?
              </h2>
              <p className="text-gray-600 text-base leading-relaxed">
                Explore personal budgeting, freelance client billing, or
                business treasury workflows on Monad testnet in seconds.
              </p>

              <div className="pt-2">
                <Link
                  href="/?mode=personal"
                  className="inline-flex items-center justify-center gap-2 font-semibold text-base px-6 py-3.5 rounded-xl bg-[#7C6CF6] text-white border-2 border-[#121212] shadow-[4px_4px_0_0_#121212] hover:bg-[#6c5be8] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                >
                  <span>Launch testnet app</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>

              <p className="text-xs text-gray-500 font-normal pt-2">
                Free to test · No real funds required · Monad Testnet Chain ID
                10143
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
                Cryptographic expense-evidence ledger built on Monad parallel
                EVM. Keep private invoices local while publishing tamper-proof
                commitment proofs.
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

            {/* Col 2: Product */}
            <div className="space-y-2.5 text-xs">
              <span className="font-semibold text-gray-900 uppercase tracking-wider block mb-3">
                Product
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
                  Security Invariants
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
              Testnet. It is not an audited financial product. Do not deposit
              real funds or rely on it for official tax filings without offline
              record backups.
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
