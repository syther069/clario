"use client";

import React, { useEffect } from "react";
import { ShieldCheck, RefreshCw, Lock } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Clario Global Root Interruption:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#fafafa] text-[#121212] flex flex-col font-sans p-4 items-center justify-center">
        <div className="w-full max-w-lg bg-white border-2 border-[#121212] rounded-2xl shadow-[8px_8px_0_0_#121212] p-8 text-center">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-[#fee2e2] border-2 border-[#121212] flex items-center justify-center text-[#ef4444] shadow-[3px_3px_0_0_#121212] mb-5">
            <Lock className="h-8 w-8 text-[#dc2626]" />
          </div>

          <div className="inline-block text-[11px] font-mono font-black uppercase tracking-wider bg-[#dcfce7] border-1.5 border-[#121212] text-[#15803d] px-3 py-0.5 rounded-full shadow-[1px_1px_0_0_#121212] mb-3">
            Core Ledger Protected
          </div>

          <h1 className="text-2xl font-black uppercase tracking-wide text-[#121212] mb-3">
            System Protected — Data Safe
          </h1>

          <div className="bg-[#f0fdf4] border-2 border-[#121212] rounded-xl p-4 text-xs text-[#166534] font-medium leading-relaxed mb-6 shadow-[2px_2px_0_0_#121212] text-left">
            <div className="flex items-center gap-2 font-black uppercase font-mono text-[11px] text-[#15803d] mb-1">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#16a34a]" />
              <span>Non-Custodial Architecture</span>
            </div>
            Your funds, wallet, and private financial records remain 100%
            secure. A temporary interface crash cannot compromise your
            cryptographic state.
          </div>

          <button
            onClick={() => reset()}
            className="w-full border-2 border-[#121212] bg-[#836EF9] hover:bg-[#7257f8] text-white font-black uppercase text-xs tracking-wider py-3 px-4 rounded-xl shadow-[3px_3px_0_0_#121212] flex items-center justify-center gap-2 transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Restore Clario Session</span>
          </button>
        </div>
      </body>
    </html>
  );
}
