"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Receipt,
  Lock,
  UserCheck,
  CheckCircle2,
  ChevronDown,
  ShieldCheck,
  Layers,
} from "lucide-react";
import { MonadLogo } from "@/components/ui/crypto-icon";

export interface ReceiptStep {
  step: string;
  title: string;
  summary: string;
  badge: string;
  illustrationType: "capture" | "fingerprint" | "approval" | "payout";
  technicalDetails: {
    rule: string;
    description: string;
    spec: string;
  };
}

export const FOLLOW_RECEIPT_STEPS: ReceiptStep[] = [
  {
    step: "01",
    title: "You snap a receipt. It stays on your device.",
    summary:
      "Take a photo or upload an invoice from your laptop. Your receipt is encrypted directly in your browser. Nobody else sees who you paid, what you bought, or your personal notes.",
    badge: "Local-first privacy",
    illustrationType: "capture",
    technicalDetails: {
      rule: "Offchain Private Evidence",
      description:
        "Evidence files and vendor metadata are AES-256 encrypted locally in browser storage. Only an irreversible 32-byte cryptographic digest is anchored to Monad.",
      spec: "AES-256 local storage encryption + SHA-256 integrity digest",
    },
  },
  {
    step: "02",
    title: "Clario locks in a fingerprint so nobody can quietly change it later.",
    summary:
      "A unique mathematical fingerprint is created for the exact numbers. If anyone tries to alter an amount, change a date, or swap an invoice later, the fingerprint breaks instantly.",
    badge: "Tamper-proof record",
    illustrationType: "fingerprint",
    technicalDetails: {
      rule: "Immutable Material Versions",
      description:
        "Material edits generate a discrete successor version hash. Approvals bind to the exact version state, preventing retroactive or undetected edits.",
      spec: "Discrete successor state versions prevent silent modifications",
    },
  },
  {
    step: "03",
    title: "Someone approves it. AI can suggest, but only people decide.",
    summary:
      "Smart OCR reads the text and flags possible duplicate submissions, but automation has zero power to move money. An authorized human must review and sign off on the expense.",
    badge: "Human governance",
    illustrationType: "approval",
    technicalDetails: {
      rule: "Zero AI Authority",
      description:
        "The machine learning copilot assists with OCR extraction and anomaly detection, but possesses zero signing keys. Releases require EIP-712 human signatures.",
      spec: "Mandatory human cryptographic signature required for fund release",
    },
  },
  {
    step: "04",
    title: "Payment goes out once. The same receipt can never be paid twice.",
    summary:
      "Settlement finishes in under a second on Monad. The smart contract marks the receipt fingerprint as paid forever, so accidental double-reimbursements are physically impossible.",
    badge: "Duplicate-proof settlement",
    illustrationType: "payout",
    technicalDetails: {
      rule: "Deterministic Settlement & Duplicate Guard",
      description:
        "Monad smart contracts store an immutable settlement record bound to the expense version. Any repeated submission reverts immediately with DuplicateSettlement.",
      spec: "Monad onchain settlement registry permanently prevents duplicate reimbursement",
    },
  },
];

export function FollowReceiptRail() {
  const [expandedTechnical, setExpandedTechnical] = useState<number | null>(null);

  const toggleTechnical = (idx: number) => {
    setExpandedTechnical((prev) => (prev === idx ? null : idx));
  };

  return (
    <section
      id="receipt-flow"
      className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t-2 border-[#121212]"
    >
      {/* Section Header */}
      <div className="max-w-2xl mb-12 sm:mb-16">
        <span className="font-mono text-xs font-black uppercase tracking-wider text-[#836EF9] bg-[#f5f3ff] px-3 py-1 rounded-md border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] inline-flex items-center gap-1.5 mb-3">
          <Layers className="h-3 w-3" />
          Four-Stage Lifecycle
        </span>
        <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-[#121212] leading-tight text-balance">
          Follow One Receipt
        </h2>
        <p className="text-base sm:text-lg text-gray-700 mt-3 font-medium leading-relaxed text-pretty">
          See how an everyday expense moves from your pocket to verified settlement without leaking private details.
        </p>
      </div>

      {/* Spacious 2x2 Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        {FOLLOW_RECEIPT_STEPS.map((step, idx) => (
          <div
            key={step.step}
            className="rounded-2xl border-2 border-[#121212] bg-white p-6 sm:p-7 shadow-[4px_4px_0_0_#121212] flex flex-col justify-between transition-transform hover:-translate-y-0.5"
          >
            <div>
              <div className="flex items-center justify-between gap-3 mb-4">
                <span className="font-mono tabular-nums text-xs font-black uppercase tracking-wider text-[#836EF9] bg-[#f5f3ff] px-2.5 py-1 rounded border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] whitespace-nowrap">
                  Step {step.step}
                </span>
                <span className="font-mono text-xs font-black uppercase tracking-wider text-gray-600 bg-gray-100 px-2.5 py-1 rounded border border-[#121212]/30 whitespace-nowrap">
                  {step.badge}
                </span>
              </div>

              <h3 className="text-xl font-black uppercase text-[#121212] leading-snug text-balance">
                {step.title}
              </h3>
              <p className="text-sm text-gray-700 mt-3 leading-relaxed font-normal text-pretty">
                {step.summary}
              </p>

              {/* Mini UI Illustration */}
              <div className="mt-6 p-4 rounded-xl bg-[#fbfaff] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
                <StepIllustration type={step.illustrationType} />
              </div>
            </div>

            {/* Technical Details Dropdown */}
            <div className="mt-6 pt-4 border-t-2 border-[#121212]/10">
              <button
                type="button"
                onClick={() => toggleTechnical(idx)}
                className="font-mono text-xs font-black uppercase tracking-wider text-[#836EF9] hover:text-[#7257f8] flex items-center justify-between w-full cursor-pointer py-1"
              >
                <span>Technical Protocol Details</span>
                <ChevronDown
                  className={`h-4 w-4 stroke-[2.5] transition-transform duration-200 ${
                    expandedTechnical === idx ? "rotate-180" : ""
                  }`}
                />
              </button>

              <AnimatePresence>
                {expandedTechnical === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 p-4 rounded-xl bg-gray-50 border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] text-xs space-y-2">
                      <div className="font-mono font-black uppercase tracking-wide text-[#121212]">
                        {step.technicalDetails.rule}
                      </div>
                      <p className="text-gray-700 leading-relaxed font-normal">
                        {step.technicalDetails.description}
                      </p>
                      <div className="font-mono text-[11px] font-bold text-[#836EF9] bg-white p-2.5 rounded-lg border border-[#121212]/30">
                        {step.technicalDetails.spec}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StepIllustration({
  type,
}: {
  type: "capture" | "fingerprint" | "approval" | "payout";
}) {
  if (type === "capture") {
    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-bold text-[#121212]">
            <Receipt className="h-4 w-4 text-[#836EF9]" />
            <span>Blue Bottle Coffee</span>
          </div>
          <span className="font-mono font-black text-[#121212]">$14.20</span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-600 pt-2 border-t border-[#121212]/10 font-mono font-bold uppercase">
          <span className="flex items-center gap-1 text-emerald-700">
            <Lock className="h-3 w-3 stroke-[2.5]" /> Encrypted on device
          </span>
          <span className="text-gray-500">Zero cloud leak</span>
        </div>
      </div>
    );
  }

  if (type === "fingerprint") {
    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-xs font-bold text-gray-700 uppercase">Digital Fingerprint:</span>
          <span className="text-[10px] font-mono bg-[#f5f3ff] text-[#836EF9] border border-[#836EF9]/40 px-2 py-0.5 rounded font-black uppercase">
            Locked
          </span>
        </div>
        <div className="font-mono text-[11px] font-bold text-[#121212] bg-white px-2.5 py-1.5 rounded-lg border border-[#121212]/20 truncate">
          0x89f4b7a1...bc19aa314
        </div>
        <div className="text-[11px] text-emerald-700 font-mono font-bold uppercase flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5 stroke-[2.5]" /> Tamper-evident seal active
        </div>
      </div>
    );
  }

  if (type === "approval") {
    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-bold text-[#121212]">
            <UserCheck className="h-4 w-4 text-[#836EF9]" />
            <span>Sarah (Treasury Lead)</span>
          </div>
          <span className="text-[10px] font-mono font-black uppercase text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded">
            Approved
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-600 pt-2 border-t border-[#121212]/10 font-mono font-bold uppercase">
          <span>AI copilot flagged: OK</span>
          <span className="text-[#121212]">Human signed</span>
        </div>
      </div>
    );
  }

  // payout
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-black text-[#121212] uppercase font-mono">
          <MonadLogo className="h-4 w-4 text-[#836EF9]" />
          <span>Settled on Monad</span>
        </div>
        <span className="font-mono font-black text-emerald-700">&lt; 1 sec</span>
      </div>
      <div className="flex items-center justify-between text-[11px] text-gray-600 pt-2 border-t border-[#121212]/10 font-mono font-bold uppercase">
        <span className="text-emerald-700 flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5 stroke-[2.5]" /> Paid exactly once
        </span>
        <span className="text-gray-500">0 duplicate</span>
      </div>
    </div>
  );
}
