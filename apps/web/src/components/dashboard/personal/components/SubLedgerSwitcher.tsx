"use client";

import React from "react";
import { CreditCard, Layers } from "lucide-react";
import { MonadLogo } from "@/components/ui/crypto-icon";
import { motion } from "motion/react";

export interface FiatCurrencyOption {
  code: string;
  symbol: string;
}

export interface SubLedgerSwitcherProps {
  subLedger: "all" | "fiat" | "onchain";
  onSubLedgerChange: (ledger: "all" | "fiat" | "onchain") => void;
  fiatCurrency: FiatCurrencyOption;
  onCurrencyChange: (currency: FiatCurrencyOption) => void;
}

export const CURRENCY_OPTIONS: FiatCurrencyOption[] = [
  { code: "USD", symbol: "$" },
  { code: "INR", symbol: "₹" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
];

export function SubLedgerSwitcher({
  subLedger,
  onSubLedgerChange,
  fiatCurrency,
  onCurrencyChange,
}: SubLedgerSwitcherProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white border-2 border-[#121212] shadow-[4px_4px_0_0_#121212] rounded-2xl">
      <div className="flex items-center gap-2 p-1.5 bg-[#f3f4f6] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] rounded-xl flex-wrap">
        <motion.button
          type="button"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => onSubLedgerChange("all")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-black uppercase tracking-wider transition-[background-color,border-color,box-shadow,color] duration-150 ease-out cursor-pointer ${
            subLedger === "all"
              ? "bg-[#836EF9] text-white border-2 border-[#121212] shadow-[2.5px_2.5px_0_0_#121212]"
              : "bg-white text-slate-700 border-2 border-transparent hover:border-[#121212] hover:bg-[#fafafa]"
          }`}
        >
          <Layers className={`h-3.5 w-3.5 ${subLedger === "all" ? "text-white" : "text-[#836EF9]"}`} />
          <span>All Activity</span>
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
              subLedger === "all"
                ? "bg-white/20 text-white border-white/40"
                : "bg-slate-100 text-slate-700 border-slate-300"
            }`}
          >
            Unified
          </span>
        </motion.button>

        <motion.button
          type="button"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => onSubLedgerChange("fiat")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-black uppercase tracking-wider transition-[background-color,border-color,box-shadow,color] duration-150 ease-out cursor-pointer ${
            subLedger === "fiat"
              ? "bg-[#836EF9] text-white border-2 border-[#121212] shadow-[2.5px_2.5px_0_0_#121212]"
              : "bg-white text-slate-700 border-2 border-transparent hover:border-[#121212] hover:bg-[#fafafa]"
          }`}
        >
          <CreditCard className={`h-3.5 w-3.5 ${subLedger === "fiat" ? "text-white" : "text-[#836EF9]"}`} />
          <span>Personal Finance</span>
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
              subLedger === "fiat"
                ? "bg-white/20 text-white border-white/40"
                : "bg-emerald-100 text-emerald-800 border-emerald-300"
            }`}
          >
            Fiat
          </span>
        </motion.button>

        <motion.button
          type="button"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => onSubLedgerChange("onchain")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-black uppercase tracking-wider transition-[background-color,border-color,box-shadow,color] duration-150 ease-out cursor-pointer ${
            subLedger === "onchain"
              ? "bg-[#836EF9] text-white border-2 border-[#121212] shadow-[2.5px_2.5px_0_0_#121212]"
              : "bg-white text-slate-700 border-2 border-transparent hover:border-[#121212] hover:bg-[#fafafa]"
          }`}
        >
          <MonadLogo className="h-3.5 w-3.5" />
          <span>On-Chain</span>
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
              subLedger === "onchain"
                ? "bg-white/20 text-white border-white/40"
                : "bg-purple-100 text-[#836EF9] border-purple-300"
            }`}
          >
            Web3
          </span>
        </motion.button>
      </div>

      <div className="flex items-center gap-2.5">
        {subLedger !== "onchain" ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-500">
              Currency:
            </span>
            <div className="flex items-center gap-1.5">
              {CURRENCY_OPTIONS.map((cur) => (
                <motion.button
                  key={cur.code}
                  type="button"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onCurrencyChange(cur)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-black uppercase border-2 transition-all cursor-pointer ${
                    fiatCurrency.code === cur.code
                      ? "bg-[#836EF9] text-white border-[#121212] shadow-[2px_2px_0_0_#121212]"
                      : "bg-white text-slate-700 border-[#121212] shadow-[1.5px_1.5px_0_0_#121212] hover:bg-[#f3f4f6]"
                  }`}
                >
                  {cur.code} ({cur.symbol})
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-black uppercase tracking-wider text-[#836EF9] bg-[#f3f0ff] px-3 py-1.5 rounded-lg border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] flex items-center gap-1.5">
              <MonadLogo className="h-3.5 w-3.5" />
              <span>Monad Testnet (10143)</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
