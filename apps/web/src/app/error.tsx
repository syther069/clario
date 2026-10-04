"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  RefreshCw,
  Home,
  Lock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { DataSafetyModal } from "@/components/layout/data-safety-modal";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [safetyModalOpen, setSafetyModalOpen] = useState(false);

  useEffect(() => {
    // Log the error to console for diagnostics
    console.error("Clario View Interruption:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-grid text-[#121212] flex flex-col font-sans">
      {/* Mini top bar */}
      <header className="border-b-2 border-[#121212] bg-white px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#836EF9] text-white font-black text-base border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
            C
          </div>
          <span className="text-sm font-black uppercase tracking-wider text-[#121212]">
            Clario <span className="text-[#836EF9]">Monad</span>
          </span>
        </Link>
        <div className="flex items-center gap-1.5 text-[10px] font-mono font-black uppercase text-[#15803d] bg-[#dcfce7] border-1.5 border-[#121212] px-2.5 py-1 rounded-full shadow-[1px_1px_0_0_#121212]">
          <ShieldCheck className="h-3 w-3" />
          <span>Vault Isolated & Safe</span>
        </div>
      </header>

      {/* Main Error Reassurance Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-xl bg-white border-2 border-[#121212] rounded-2xl shadow-[8px_8px_0_0_#121212] p-6 sm:p-8 flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-2xl bg-[#fee2e2] border-2 border-[#121212] flex items-center justify-center text-[#ef4444] shadow-[3px_3px_0_0_#121212] mb-5">
            <Lock className="h-8 w-8 text-[#dc2626]" />
          </div>

          <div className="inline-block text-[11px] font-mono font-black uppercase tracking-wider bg-[#dcfce7] border-1.5 border-[#121212] text-[#15803d] px-3 py-0.5 rounded-full shadow-[1px_1px_0_0_#121212] mb-3">
            Session Vault Protected
          </div>

          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wide text-[#121212] mb-3">
            Interface Interrupted — Your Data Is Safe
          </h1>

          <div className="bg-[#f0fdf4] border-2 border-[#121212] rounded-xl p-4 text-xs text-[#166534] font-medium leading-relaxed mb-5 shadow-[2px_2px_0_0_#121212] text-left">
            <div className="flex items-center gap-2 font-black uppercase font-mono text-[11px] text-[#15803d] mb-1.5">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#16a34a]" />
              <span>Non-Custodial Architecture Guarantee</span>
            </div>
            A temporary visual rendering error occurred, but{" "}
            <strong>
              your financial transactions, encrypted receipts, and wallet state
              are completely preserved and safe
            </strong>
            . Because Clario uses decoupled offchain encryption and
            non-custodial wallet signatures, UI glitches cannot compromise your
            funds or private evidence.
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 w-full mb-4">
            <button
              onClick={() => reset()}
              className="flex-1 border-2 border-[#121212] bg-[#836EF9] hover:bg-[#7257f8] text-white font-black uppercase text-xs tracking-wider py-3 px-4 rounded-xl shadow-[3px_3px_0_0_#121212] flex items-center justify-center gap-2 transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Reload & Restore View</span>
            </button>

            <Link
              href="/"
              className="flex-1 border-2 border-[#121212] bg-white hover:bg-slate-50 text-[#121212] font-black uppercase text-xs tracking-wider py-3 px-4 rounded-xl shadow-[3px_3px_0_0_#121212] flex items-center justify-center gap-2 transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            >
              <Home className="h-4 w-4 text-[#836EF9]" />
              <span>Return to Overview</span>
            </Link>
          </div>

          <button
            onClick={() => setSafetyModalOpen(true)}
            className="text-xs font-mono font-bold text-[#836EF9] hover:underline mb-4"
          >
            How does Clario guarantee my data is safe?
          </button>

          {/* Technical Diagnostics (Collapsible) */}
          <div className="w-full text-left">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center justify-between w-full text-[11px] font-mono uppercase text-slate-500 hover:text-slate-800 py-1"
            >
              <span>Technical Diagnostics (Optional)</span>
              {showDetails ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
            {showDetails && (
              <div className="mt-2 p-3 bg-slate-50 border-2 border-[#121212] rounded-xl font-mono text-[10px] text-slate-700 break-all shadow-[2px_2px_0_0_#121212]">
                <p className="font-bold text-[#dc2626] mb-1">
                  {error?.message || "Unknown error encountered."}
                </p>
                {error?.digest && (
                  <p className="text-slate-500">Digest: {error.digest}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer reassurance */}
      <footer className="border-t-2 border-[#121212] bg-white py-3 px-4 text-center text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
        Non-Custodial • AES-256 Offchain Encrypted • Monad Consensus Verified
      </footer>

      <DataSafetyModal
        isOpen={safetyModalOpen}
        onClose={() => setSafetyModalOpen(false)}
      />
    </div>
  );
}
