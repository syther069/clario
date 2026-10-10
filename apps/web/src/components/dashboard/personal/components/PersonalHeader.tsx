"use client";

import React from "react";
import { Plus, Receipt } from "lucide-react";
import { MonadLogo } from "@/components/ui/crypto-icon";
import { Magnetic } from "@/components/ui/motion";
import { WatermelonButton } from "@/components/ui/watermelon-button";

export interface PersonalHeaderProps {
  subLedger: "all" | "fiat" | "onchain";
  onAddTransaction?: ((subLedger?: "fiat" | "onchain") => void) | undefined;
  onUploadReceipt?: (() => void) | undefined;
}

export function PersonalHeader({
  subLedger,
  onAddTransaction,
  onUploadReceipt,
}: PersonalHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          {subLedger === "onchain" ? (
            <>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#836EF9] bg-[#f3f0ff] px-2 py-0.5 rounded border border-[#121212] shadow-[1px_1px_0_0_#121212] flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#836EF9] animate-pulse" />
                Universal Ledger & Proof Spines
              </span>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-700 bg-white px-2 py-0.5 rounded border border-[#121212] flex items-center gap-1">
                <MonadLogo className="h-3 w-3" />
                Monad Testnet (10143)
              </span>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-[#121212]">
                Zero Private Data Onchain
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-700 bg-white px-2 py-0.5 rounded border border-[#121212] shadow-[1px_1px_0_0_#121212] flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                {subLedger === "all" ? "Complete Financial Ledger" : "Personal Finance Ledger"}
              </span>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-[#121212]">
                100% Private & Off-Chain
              </span>
            </>
          )}
        </div>
        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#121212]">
          {subLedger === "onchain"
            ? "On-Chain & Web3 Activity"
            : subLedger === "fiat"
              ? "Personal Finance & Daily Living"
              : "Personal Finance & Activity"}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 font-medium mt-0.5">
          {subLedger === "onchain"
            ? "Multi-chain transaction indexing, gas metrics, and Monad registry notarizations across EVM networks."
            : "Track daily spending, rent, groceries, cards, and subscriptions with optional 1-click Monad cryptographic proof."}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {subLedger === "onchain" ? (
          <>
            <Magnetic range={60} intensity={0.35}>
              <WatermelonButton
                onClick={() => onAddTransaction?.("onchain")}
                variant="secondary"
                icon={<MonadLogo className="h-4 w-4" />}
                morphText="Sync via Alchemy"
              />
            </Magnetic>

            <Magnetic range={70} intensity={0.4}>
              <WatermelonButton
                onClick={() => onAddTransaction?.("onchain")}
                variant="primary"
                icon={<Plus className="h-4 w-4" />}
                morphText="Add On-Chain TX"
              />
            </Magnetic>
          </>
        ) : (
          <>
            <Magnetic range={60} intensity={0.35}>
              <WatermelonButton
                onClick={onUploadReceipt}
                variant="secondary"
                icon={<Receipt className="h-4 w-4 text-[#836EF9]" />}
                morphText="Scan Receipt"
              />
            </Magnetic>

            <Magnetic range={70} intensity={0.4}>
              <WatermelonButton
                onClick={() => onAddTransaction?.("fiat")}
                variant="primary"
                icon={<Plus className="h-4 w-4" />}
                morphText="Add Expense"
              />
            </Magnetic>
          </>
        )}
      </div>
    </div>
  );
}
