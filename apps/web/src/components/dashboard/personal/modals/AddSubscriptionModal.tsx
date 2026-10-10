"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, X } from "lucide-react";
import { NeoSelect } from "@/components/ui/neo-select";
import { NeoDatePicker } from "@/components/ui/neo-date-picker";
import type { SubFrequency } from "../types";

export interface AddSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  subNameInput: string;
  setSubNameInput: (val: string) => void;
  subAmountInput: string;
  setSubAmountInput: (val: string) => void;
  subFrequencyInput: SubFrequency;
  setSubFrequencyInput: (val: SubFrequency) => void;
  subNextBillingInput: string;
  setSubNextBillingInput: (val: string) => void;
  currencySymbol: string;
}

export function AddSubscriptionModal({
  isOpen,
  onClose,
  onSubmit,
  subNameInput,
  setSubNameInput,
  subAmountInput,
  setSubAmountInput,
  subFrequencyInput,
  setSubFrequencyInput,
  subNextBillingInput,
  setSubNextBillingInput,
  currencySymbol,
}: AddSubscriptionModalProps) {
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
            className="relative z-10 w-full max-w-md bg-white border-2 border-[#121212] rounded-2xl shadow-[6px_6px_0_0_#121212] overflow-hidden"
          >
            <div className="p-4 border-b-2 border-[#121212] bg-[#f9fafb] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-[#121212]">
                  Add Subscription / Bill
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded text-slate-400 hover:text-[#121212] transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#121212] mb-1">
                  Service / Provider Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GitHub Copilot, Electricity"
                  value={subNameInput}
                  onChange={(e) => setSubNameInput(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[#121212] rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#121212] mb-1">
                    Amount ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="20.00"
                    value={subAmountInput}
                    onChange={(e) => setSubAmountInput(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-[#121212] rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#121212] mb-1">
                    Frequency
                  </label>
                  <NeoSelect
                    fullWidth
                    value={subFrequencyInput}
                    onChange={(val) => setSubFrequencyInput(val as SubFrequency)}
                    options={[
                      { value: "monthly", label: "Monthly" },
                      { value: "yearly", label: "Yearly" },
                      { value: "weekly", label: "Weekly" },
                    ]}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#121212] mb-1">
                  Next Billing Date
                </label>
                <NeoDatePicker
                  fullWidth
                  value={subNextBillingInput}
                  onChange={setSubNextBillingInput}
                  placeholder="Select Date"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border-2 border-[#121212] rounded-lg text-xs font-black uppercase bg-white hover:bg-[#f3f4f6] transition"
                >
                  Cancel
                </button>
                <button type="submit" className="neo-btn neo-btn-primary">
                  <Plus className="h-4 w-4" />
                  <span>Save Subscription</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
