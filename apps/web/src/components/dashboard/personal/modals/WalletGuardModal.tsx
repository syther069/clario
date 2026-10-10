"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Wallet, X } from "lucide-react";

export interface WalletGuardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectWallet: () => void;
}

export function WalletGuardModal({
  isOpen,
  onClose,
  onConnectWallet,
}: WalletGuardModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="relative z-10 w-full max-w-sm rounded-2xl border-2 border-[#121212] bg-white p-6 shadow-[6px_6px_0_0_#121212] text-[#121212]"
          >
            <div className="flex items-start justify-between pb-3 border-b-2 border-[#121212]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f3f0ff] text-[#836EF9] border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-[#121212]">
                    EVM Wallet Needed
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-[#f3f4f6] hover:text-[#121212] border border-transparent hover:border-[#121212] transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-sm font-bold text-[#121212]">
                To save this receipt on Monad, connect a wallet to your Clario account.
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Your Clario account remains the permanent owner of all your data
                and receipts. Connecting an EVM wallet allows you to anchor the
                cryptographic receipt commitment directly to Monad Testnet (Chain ID 10143).
              </p>
            </div>

            <div className="mt-6 space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onConnectWallet();
                }}
                className="w-full border-2 border-[#121212] bg-[#836EF9] hover:bg-[#725aeb] text-white font-black uppercase text-xs tracking-wider py-3 px-4 rounded-xl shadow-[3px_3px_0_0_#121212] flex items-center justify-center gap-2 transition-all active:translate-x-[1px] active:translate-y-[1px]"
              >
                <Wallet className="h-4 w-4" />
                <span>CONNECT WALLET</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full border-2 border-[#121212] bg-white hover:bg-[#f9fafb] text-[#121212] font-black uppercase text-xs tracking-wider py-2.5 px-4 rounded-xl shadow-[3px_3px_0_0_#121212] flex items-center justify-center transition-all active:translate-x-[1px] active:translate-y-[1px]"
              >
                <span>CANCEL</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
