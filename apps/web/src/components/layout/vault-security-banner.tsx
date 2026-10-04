"use client";

import React, { useState } from "react";
import { ShieldCheck, ChevronRight, X, Lock } from "lucide-react";
import { DataSafetyModal } from "./data-safety-modal";

interface VaultSecurityBannerProps {
  initialVisible?: boolean;
}

export function VaultSecurityBanner({
  initialVisible = true,
}: VaultSecurityBannerProps) {
  const [isVisible, setIsVisible] = useState(initialVisible);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!isVisible) return null;

  return (
    <>
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-3 animate-in fade-in slide-in-from-top-1 duration-200">
        <div className="bg-[#f0fdf4] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] rounded-lg px-3.5 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded-md bg-[#22c55e] border border-[#121212] flex items-center justify-center text-white shrink-0">
              <Lock className="h-3 w-3" />
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-white border border-[#121212] text-[#15803d] px-1.5 py-0.2 rounded">
                Vault Active
              </span>
              <span className="text-xs text-[#166534] font-medium">
                Non-custodial cryptographic ledger & private receipts on Monad.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => setIsModalOpen(true)}
              className="border border-[#121212] bg-white hover:bg-slate-50 text-[#121212] font-bold uppercase text-[10px] tracking-wider px-2 py-1 rounded shadow-[1px_1px_0_0_#121212] flex items-center gap-1 transition-all active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none"
            >
              <ShieldCheck className="h-3 w-3 text-[#22c55e]" />
              <span>Guarantees</span>
              <ChevronRight className="h-2.5 w-2.5 text-slate-400" />
            </button>

            <button
              onClick={() => setIsVisible(false)}
              aria-label="Dismiss security notice"
              className="h-5 w-5 rounded border border-[#121212] bg-white hover:bg-slate-100 flex items-center justify-center text-slate-500"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        </div>
      </div>

      <DataSafetyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
