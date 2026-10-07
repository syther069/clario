"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  FileCheck2,
  Cpu,
  ChevronRight,
  CheckCircle2,
  X,
  ExternalLink,
} from "lucide-react";
import { MonadLogo } from "@/components/ui/crypto-icon";
import {
  MorphingPopover,
  MorphingPopoverTrigger,
  MorphingPopoverContent,
} from "@/components/ui/motion/morphing-popover";

interface LandingExplainerProps {
  onExploreClick?: () => void;
}

export function LandingExplainer({ onExploreClick }: LandingExplainerProps) {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const STEPS = [
    {
      step: "01",
      title: "Log or Import Expenses",
      tagline: "Offchain & 100% Private",
      icon: Lock,
      description:
        "Submit expenses, invoices, or multi-chain transfers. Raw receipts, merchant names, and personal notes are AES-256 encrypted locally and never leaked onchain.",
      proof: "Private Evidence · Zero Data Leaks",
      specDetails: [
        "AES-256-GCM envelope encryption with ephemeral 256-bit DEK",
        "Deterministic RFC 8785 canonical record encoding",
        "Zero merchant, notes, or PII exposed to public mempool",
      ],
      linkText: "Explore Private Evidence Storage",
      linkHref: "/docs?s=evidence",
    },
    {
      step: "02",
      title: "Exact-Version Cryptographic Hash",
      tagline: "Immutable Commitments",
      icon: Cpu,
      description:
        "Every expense version is bound to an RFC 8785 canonical hash commitment with a cryptographic salt. Any edit creates an explicit, auditable successor version.",
      proof: "Monad Testnet · Chain ID 10143",
      specDetails: [
        "Cryptographically secure 32-byte salt prevents rainbow table attacks",
        "Monad ExpenseRegistry contract stores bytes32 commitment",
        "Cross-runtime golden vectors test suite verified (105 tests)",
      ],
      linkText: "Inspect Canonical Schema V1",
      linkHref: "/docs?s=protocol",
    },
    {
      step: "03",
      title: "Authoritative Human Review & Decision",
      tagline: "No AI Authority",
      icon: FileCheck2,
      description:
        "Authorized reviewers approve or reject exact version states using EIP-712 typed signatures. AI only assists with OCR extraction and anomaly warnings.",
      proof: "EIP-712 Typed Data Signatures",
      specDetails: [
        "Decision binds to exact (workspace, expense, version, commitment)",
        "Stale approvals automatically invalidate if a material edit occurs",
        "AI has ZERO authority to approve, reject, or transfer funds",
      ],
      linkText: "Review Authority Invariants",
      linkHref: "/docs?s=decisions",
    },
    {
      step: "04",
      title: "USDC Settlement & Independent Proof",
      tagline: "Mathematical Tamper Detection",
      icon: ShieldCheck,
      description:
        "Treasury reimburses on Monad with contract-enforced duplicate prevention. Anyone can download a standalone ZIP package and independently verify proof without trusting Clario servers.",
      proof: "Offline Deterministic Verifier CLI",
      specDetails: [
        "Smart contract level atomic transfer & duplicate settlement guard",
        "Standalone CLI (`pnpm verify:package`) verifies cryptographic proof",
        "Operates directly against Monad EVM RPC without private db",
      ],
      linkText: "Download Verifiable Package Sample",
      linkHref: "/proof",
    },
  ];

  return (
    <section className="relative w-full border-2 border-[#121212] bg-white rounded-xl shadow-[4px_4px_0px_#121212] overflow-hidden">
      {/* Top Header Bar */}
      <div className="bg-[#f5f3ff] border-b-2 border-[#121212] px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-[#836EF9] border border-[#121212] flex items-center justify-center text-white shrink-0 shadow-[1px_1px_0_0_#121212]">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#121212]">
              How Clario Works
            </h2>
            <span className="text-[10px] font-mono font-bold uppercase text-[#836EF9] bg-white px-2 py-0.5 rounded border border-[#836EF9]/40 shadow-[1px_1px_0_0_#836EF9]">
              The Verifiable Proof Chain
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/landing"
            className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-[#836EF9] hover:text-[#7257f8] hover:underline"
          >
            <span>Full Architecture Tour</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            aria-label="Dismiss banner"
            className="text-slate-400 hover:text-black p-0.5 rounded transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Interactive Core Workflow Carousel / Grid */}
      <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4">
        {STEPS.map((item, idx) => {
          const Icon = item.icon;
          const isSelected = activeStep === idx;
          return (
            <div
              key={item.step}
              onClick={() => setActiveStep(idx)}
              className={`p-4 rounded-xl border-2 border-[#121212] transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? "bg-[#faf9ff] shadow-[3px_3px_0_0_#836EF9] border-[#836EF9]"
                  : "bg-white hover:bg-slate-50 shadow-[2px_2px_0_0_#121212]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono font-black uppercase px-2 py-0.5 rounded bg-[#121212] text-white">
                    {item.step}
                  </span>
                  <div
                    className={`h-7 w-7 rounded-lg border border-[#121212] flex items-center justify-center ${
                      isSelected
                        ? "bg-[#836EF9] text-white"
                        : "bg-[#f3f0ff] text-[#836EF9]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                </div>

                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#121212] mb-1">
                  {item.title}
                </h3>
                <p className="text-[10px] font-mono font-bold uppercase text-[#836EF9] mb-2">
                  {item.tagline}
                </p>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  {item.description}
                </p>
              </div>

              {/* Morphing Popover for Technical Spec Deep-Dive */}
              <div className="pt-2 border-t border-[#121212]/15 flex items-center justify-between">
                <MorphingPopover>
                  <MorphingPopoverTrigger className="text-[10px] font-mono font-bold uppercase text-[#836EF9] hover:underline flex items-center gap-1">
                    <span>Inspect Specs</span>
                    <ChevronRight className="h-3 w-3" />
                  </MorphingPopoverTrigger>
                  <MorphingPopoverContent className="w-72 sm:w-80 font-sans z-50 text-left">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 bg-[#836EF9] text-white rounded">
                        Step {item.step} Specification
                      </span>
                    </div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-[#121212] mb-2">
                      {item.title}
                    </h4>
                    <ul className="space-y-1.5 text-[11px] text-slate-600 font-mono mb-3">
                      {item.specDetails.map((detail, dIdx) => (
                        <li key={dIdx} className="flex items-start gap-1.5">
                          <span className="text-[#836EF9] font-bold">›</span>
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={item.linkHref}
                      className="inline-flex items-center gap-1 text-[11px] font-mono font-black uppercase text-[#836EF9] hover:underline"
                    >
                      <span>{item.linkText}</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </MorphingPopoverContent>
                </MorphingPopover>

                <CheckCircle2
                  className={`h-3.5 w-3.5 shrink-0 ${
                    isSelected ? "text-[#836EF9]" : "text-slate-300"
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Real Invariants Assurance Banner */}
      <div className="bg-[#fafafa] border-t-2 border-[#121212] px-4 py-3 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold uppercase text-[#121212] flex items-center gap-1.5">
            <MonadLogo className="h-3.5 w-3.5 text-[#836EF9]" />
            Real Monad Testnet Invariants:
          </span>
          <span className="text-slate-600">
            • Private Data Offchain
          </span>
          <span className="text-slate-600">
            • Exact Approval Binding
          </span>
          <span className="text-slate-600">
            • Zero Duplicate Settlement
          </span>
        </div>

        <Link
          href="/proof"
          className="inline-flex items-center gap-1 font-black uppercase text-[#836EF9] hover:underline shrink-0"
        >
          <span>Verify Package in Proof Center</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
