"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Tag, Check, X, Trash2, Wallet } from "lucide-react";

interface EditNicknameModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentNickname: string | null;
  walletAddress: string | null;
  onSave: (nickname: string, walletAddress?: string) => void;
  title?: string;
}

export function EditNicknameModal({
  isOpen,
  onClose,
  currentNickname,
  walletAddress,
  onSave,
  title = "Set Wallet Nickname",
}: EditNicknameModalProps) {
  const [nicknameInput, setNicknameInput] = useState(currentNickname || "");
  const [prevCurrent, setPrevCurrent] = useState(currentNickname);
  if (currentNickname !== prevCurrent) {
    setPrevCurrent(currentNickname);
    setNicknameInput(currentNickname || "");
  }

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(nicknameInput.trim(), walletAddress || undefined);
    onClose();
  };

  const handleClear = () => {
    onSave("", walletAddress || undefined);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        {/* Backdrop motion */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", stiffness: 380, damping: 26 }}
          className="relative w-full max-w-md rounded-2xl border-2 border-[#121212] bg-white p-6 shadow-[6px_6px_0_0_#121212] z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-[#121212] pb-4 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-[#121212] bg-[#836EF9] text-white shadow-[2px_2px_0_0_#121212]">
                <Tag className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-base font-black uppercase tracking-wider text-[#121212]">
                  {title}
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Custom label for your connected identity
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-[#121212] bg-[#f8f9fa] text-[#121212] hover:bg-[#e5e7eb] transition shadow-[1px_1px_0_0_#121212] active:translate-x-[1px] active:translate-y-[1px]"
              aria-label="Close dialog"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Canonical Wallet Info */}
          {walletAddress && (
            <div className="mb-4 rounded-lg bg-[#f8f9fa] p-3 border border-slate-300">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase font-bold text-slate-500 mb-1">
                <span className="flex items-center gap-1">
                  <Wallet className="h-3 w-3 text-[#836EF9]" />
                  Canonical Wallet Address
                </span>
                <span className="text-slate-400">Read-Only</span>
              </div>
              <p className="font-mono text-xs font-bold text-[#121212] truncate">
                {walletAddress}
              </p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="nickname-input"
                className="block text-xs font-black uppercase tracking-wider text-[#121212] mb-1.5"
              >
                Friendly Nickname
              </label>
              <input
                id="nickname-input"
                type="text"
                autoFocus
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                placeholder="e.g. My Main Wallet, Personal Treasury, Founder Ops..."
                maxLength={40}
                className="w-full rounded-xl border-2 border-[#121212] bg-white px-3.5 py-2.5 text-sm font-bold text-[#121212] placeholder:text-slate-400 shadow-[2px_2px_0_0_#121212] focus:outline-none focus:ring-2 focus:ring-[#836EF9] transition"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                This friendly name will appear across your Clario dashboards, navigation, and exports.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-2">
              {currentNickname ? (
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex items-center gap-1.5 rounded-xl border-2 border-red-600/40 bg-red-50 px-3 py-2 text-xs font-mono font-bold uppercase text-red-600 hover:bg-red-100 hover:border-red-600 transition shadow-[2px_2px_0_0_#121212] active:translate-x-[1px] active:translate-y-[1px]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border-2 border-[#121212] bg-white px-3.5 py-2 text-xs font-mono font-bold uppercase text-[#121212] hover:bg-slate-100 transition shadow-[2px_2px_0_0_#121212] active:translate-x-[1px] active:translate-y-[1px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl border-2 border-[#121212] bg-[#836EF9] px-4 py-2 text-xs font-mono font-black uppercase text-white shadow-[2px_2px_0_0_#121212] hover:bg-[#7257f8] transition active:translate-x-[1px] active:translate-y-[1px]"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Save Nickname</span>
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
