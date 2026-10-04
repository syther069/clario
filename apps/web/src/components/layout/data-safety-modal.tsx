"use client";

import React from "react";
import {
  Shield,
  Lock,
  FileCheck,
  Key,
  Cpu,
  X,
  CheckCircle2,
} from "lucide-react";

interface DataSafetyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DataSafetyModal({ isOpen, onClose }: DataSafetyModalProps) {
  if (!isOpen) return null;

  const securityPillars = [
    {
      icon: Key,
      title: "Non-Custodial Architecture",
      badge: "Zero Key Access",
      desc: "Clario never asks for or stores private keys or seed phrases. All transaction signatures and approvals require explicit confirmation in your connected wallet.",
    },
    {
      icon: Lock,
      title: "Offchain Envelope Encryption",
      badge: "AES-256-GCM",
      desc: "Receipt images, merchant names, and itemized line items are encrypted using individual Data Encryption Keys (DEKs). Raw financial documents are never exposed on public blockchains.",
    },
    {
      icon: FileCheck,
      title: "Monad Cryptographic Proofs",
      badge: "SHA-256 Commitments",
      desc: "Only mathematical digests (canonical RFC 8785 commitment hashes) anchor to the Monad ledger. Auditors can verify authenticity without revealing private financial details.",
    },
    {
      icon: Shield,
      title: "Offline-First Data Vault",
      badge: "Zero Data Loss",
      desc: "All draft edits, calculations, and categorized expenses are preserved in a secure local vault. If network sync pauses, your work is never lost.",
    },
    {
      icon: Cpu,
      title: "AI With Zero Authority",
      badge: "Human Verified",
      desc: "Gemini 2.5 Flash and Groq AI models operate strictly in advisory mode. AI can never move funds, sign transactions, or alter approved records without human authorization.",
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="safety-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-2xl bg-white border-2 border-[#121212] rounded-2xl shadow-[8px_8px_0_0_#121212] overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b-2 border-[#121212] bg-[#f9fafb] p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#836EF9] border-2 border-[#121212] flex items-center justify-center text-white shadow-[2px_2px_0_0_#121212]">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-[#dcfce7] text-[#15803d] border-1.5 border-[#121212] px-2 py-0.5 rounded-full font-mono">
                  100% Encrypted & Safe
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider bg-[#f3f0ff] text-[#836EF9] border-1.5 border-[#121212] px-2 py-0.5 rounded-full font-mono">
                  Monad Certified
                </span>
              </div>
              <h2
                id="safety-modal-title"
                className="text-lg font-black uppercase tracking-wide text-[#121212] mt-0.5"
              >
                Clario Data Security & Privacy Guarantees
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg border-2 border-[#121212] bg-white hover:bg-slate-100 flex items-center justify-center text-[#121212] shadow-[2px_2px_0_0_#121212] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="text-xs text-slate-600 font-medium leading-relaxed bg-[#f3f0ff]/50 border-2 border-[#836EF9]/30 rounded-xl p-3.5">
            Clario is architected from the ground up around{" "}
            <strong>5 Immutable Founder Invariants</strong>. Your money, wallet,
            and private business receipts are strictly non-custodial and
            protected from data loss or unauthorized exposure.
          </p>

          <div className="space-y-3">
            {securityPillars.map((p, i) => {
              const Icon = p.icon;
              return (
                <div
                  key={i}
                  className="border-2 border-[#121212] rounded-xl p-3.5 bg-white shadow-[3px_3px_0_0_#121212] flex items-start gap-3.5"
                >
                  <div className="h-8 w-8 rounded-lg bg-[#f3f0ff] border-2 border-[#121212] flex items-center justify-center text-[#836EF9] shrink-0 mt-0.5">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="text-xs font-black uppercase tracking-wider text-[#121212]">
                        {p.title}
                      </h3>
                      <span className="text-[9px] font-mono font-black uppercase tracking-wider bg-slate-100 border border-[#121212] px-2 py-0.5 rounded text-slate-700 shrink-0">
                        {p.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-normal">
                      {p.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-2 border-[#121212] bg-[#f0fdf4] rounded-xl p-3.5 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-[#16a34a] shrink-0" />
            <div className="text-[11px] text-[#166534] font-medium leading-tight">
              <strong>Zero Leakage Guarantee:</strong> Even in the event of an
              interface error, your local cache and onchain state remain
              completely isolated and intact.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-[#121212] bg-[#f9fafb] p-4 flex items-center justify-end">
          <button
            onClick={onClose}
            className="border-2 border-[#121212] bg-[#836EF9] hover:bg-[#7257f8] text-white font-black uppercase text-xs tracking-wider px-5 py-2.5 rounded-xl shadow-[3px_3px_0_0_#121212] transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
          >
            I Understand — My Data Is Safe
          </button>
        </div>
      </div>
    </div>
  );
}
