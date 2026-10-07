"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  AnimatePresence,
} from "motion/react";
import {
  Receipt,
  Lock,
  UserCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  Zap,
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
        "Evidence files and vendor metadata are AES-256 encrypted locally in browser storage. Only an irreversible 32-byte SHA-256 hash digest is anchored to Monad.",
      spec: "sha256(raw_receipt_bytes) → commitment_hash",
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
      spec: "version_n+1 = hash(version_n + patch_delta)",
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
      spec: "human_signature required for fund release",
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
      rule: "Deterministic Settlement & Nullifier Guard",
      description:
        "Monad smart contracts store a spent nullifier derived from the receipt commitment. Any repeated submission reverts immediately with DUPLICATE_NULLIFIER.",
      spec: "require(!nullifierSpent[hash], 'DUPLICATE')",
    },
  },
];

export function FollowReceiptRail() {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [expandedTechnical, setExpandedTechnical] = useState<number | null>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Transform vertical scroll progress into horizontal translateX for desktop
  const translateX = useTransform(
    scrollYProgress,
    [0, 1],
    ["0%", "-75%"]
  );

  const toggleTechnical = (idx: number) => {
    setExpandedTechnical((prev) => (prev === idx ? null : idx));
  };

  const handleNext = () => {
    setActiveStepIndex((prev) => Math.min(FOLLOW_RECEIPT_STEPS.length - 1, prev + 1));
  };

  const handlePrev = () => {
    setActiveStepIndex((prev) => Math.max(0, prev - 1));
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        setActiveStepIndex((prev) => Math.min(FOLLOW_RECEIPT_STEPS.length - 1, prev + 1));
      } else if (e.key === "ArrowLeft") {
        setActiveStepIndex((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <section id="receipt-flow" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-gray-200">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 sm:mb-16">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold text-[#7C6CF6] bg-[#f5f3ff] px-2.5 py-1 rounded-md border border-[#e0dbfd] inline-block mb-3">
            Life of an expense
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 leading-tight [text-wrap:balance]">
            Follow one receipt
          </h2>
          <p className="text-base sm:text-lg text-gray-600 mt-3 leading-relaxed">
            See how an everyday expense moves from your pocket to verified settlement without leaking private details.
          </p>
        </div>

        {/* Desktop Step Controls */}
        <div className="hidden lg:flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrev}
            disabled={activeStepIndex === 0}
            aria-label="Previous step"
            className="p-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4 text-gray-700" />
          </button>
          <div className="px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200 text-xs font-mono font-bold text-gray-700">
            {activeStepIndex + 1} / {FOLLOW_RECEIPT_STEPS.length}
          </div>
          <button
            type="button"
            onClick={handleNext}
            disabled={activeStepIndex === FOLLOW_RECEIPT_STEPS.length - 1}
            aria-label="Next step"
            className="p-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
          >
            <ChevronRight className="h-4 w-4 text-gray-700" />
          </button>
        </div>
      </div>

      {/* Mobile Stack Layout (< lg) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-6">
        {FOLLOW_RECEIPT_STEPS.map((step, idx) => (
          <div
            key={step.step}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono font-bold text-[#7C6CF6] bg-[#f5f3ff] px-2.5 py-1 rounded-md border border-[#e0dbfd]">
                  Step {step.step}
                </span>
                <span className="text-xs font-medium text-gray-500">
                  {step.badge}
                </span>
              </div>

              <h3 className="text-xl font-bold text-gray-900 leading-snug">
                {step.title}
              </h3>
              <p className="text-sm text-gray-600 mt-2.5 leading-relaxed">
                {step.summary}
              </p>

              {/* Mini UI Illustration */}
              <div className="mt-5 p-4 rounded-xl bg-gray-50 border border-gray-200">
                <StepIllustration type={step.illustrationType} />
              </div>
            </div>

            {/* Technical Details Toggle */}
            <div className="mt-6 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => toggleTechnical(idx)}
                className="text-xs font-medium text-[#7C6CF6] hover:text-[#6c5be8] flex items-center justify-between w-full cursor-pointer py-1"
              >
                <span>Technical details</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${
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
                    <div className="mt-3 p-3.5 rounded-lg bg-gray-50 border border-gray-200 text-xs space-y-2">
                      <div className="font-semibold text-gray-900">
                        {step.technicalDetails.rule}
                      </div>
                      <p className="text-gray-600 leading-relaxed">
                        {step.technicalDetails.description}
                      </p>
                      <div className="font-mono text-[11px] text-gray-800 bg-white p-2 rounded border border-gray-200">
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

      {/* Desktop Horizontal Rail Layout (lg:) */}
      <div className="hidden lg:block">
        <div className="grid grid-cols-4 gap-6">
          {FOLLOW_RECEIPT_STEPS.map((step, idx) => (
            <div
              key={step.step}
              className={`rounded-2xl border p-6 bg-white shadow-xs flex flex-col justify-between transition-all duration-200 ${
                activeStepIndex === idx
                  ? "border-[#7C6CF6] ring-2 ring-[#7C6CF6]/20 shadow-sm"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono font-bold text-[#7C6CF6] bg-[#f5f3ff] px-2.5 py-1 rounded-md border border-[#e0dbfd]">
                    Step {step.step}
                  </span>
                  <span className="text-xs font-medium text-gray-500">
                    {step.badge}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-gray-900 leading-snug">
                  {step.title}
                </h3>
                <p className="text-sm text-gray-600 mt-2.5 leading-relaxed">
                  {step.summary}
                </p>

                {/* Mini UI Illustration */}
                <div className="mt-5 p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                  <StepIllustration type={step.illustrationType} />
                </div>
              </div>

              {/* Technical Details Toggle */}
              <div className="mt-6 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => toggleTechnical(idx)}
                  className="text-xs font-medium text-[#7C6CF6] hover:text-[#6c5be8] flex items-center justify-between w-full cursor-pointer py-1"
                >
                  <span>Technical details</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
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
                      <div className="mt-3 p-3.5 rounded-lg bg-gray-50 border border-gray-200 text-xs space-y-2">
                        <div className="font-semibold text-gray-900">
                          {step.technicalDetails.rule}
                        </div>
                        <p className="text-gray-600 leading-relaxed text-[11px]">
                          {step.technicalDetails.description}
                        </p>
                        <div className="font-mono text-[11px] text-gray-800 bg-white p-2 rounded border border-gray-200">
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
      </div>
    </section>
  );
}

// Mini UI Illustration built entirely with existing UI parts
function StepIllustration({
  type,
}: {
  type: "capture" | "fingerprint" | "approval" | "payout";
}) {
  if (type === "capture") {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-medium text-gray-800">
            <Receipt className="h-3.5 w-3.5 text-[#7C6CF6]" />
            <span>Blue Bottle Coffee</span>
          </div>
          <span className="font-bold text-gray-900">$14.20</span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1.5 border-t border-gray-200">
          <span className="flex items-center gap-1 text-emerald-700 font-medium">
            <Lock className="h-3 w-3" /> Encrypted on device
          </span>
          <span>Zero cloud leak</span>
        </div>
      </div>
    );
  }

  if (type === "fingerprint") {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 font-medium">Digital Fingerprint:</span>
          <span className="text-[10px] font-mono bg-purple-100 text-[#7C6CF6] px-1.5 py-0.5 rounded font-bold">
            Locked
          </span>
        </div>
        <div className="font-mono text-[11px] text-gray-800 bg-white px-2 py-1 rounded border border-gray-200 truncate">
          0x89f4b7a1...bc19aa314
        </div>
        <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" /> Tamper-evident seal active
        </div>
      </div>
    );
  }

  if (type === "approval") {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-medium text-gray-800">
            <UserCheck className="h-3.5 w-3.5 text-[#7C6CF6]" />
            <span>Sarah (Treasury Lead)</span>
          </div>
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
            Approved
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1.5 border-t border-gray-200">
          <span>AI copilot flagged: OK</span>
          <span className="font-medium text-gray-800">Human signed</span>
        </div>
      </div>
    );
  }

  // payout
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-bold text-gray-900">
          <MonadLogo className="h-3.5 w-3.5 text-[#7C6CF6]" />
          <span>Settled on Monad</span>
        </div>
        <span className="font-mono font-bold text-emerald-700">&lt; 1 sec</span>
      </div>
      <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1.5 border-t border-gray-200">
        <span className="text-emerald-700 font-medium flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" /> Paid exactly once
        </span>
        <span className="text-gray-400 font-mono">0 duplicate</span>
      </div>
    </div>
  );
}
