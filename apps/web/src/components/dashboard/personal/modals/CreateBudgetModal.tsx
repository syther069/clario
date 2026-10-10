"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, X } from "lucide-react";
import { NeoSelect } from "@/components/ui/neo-select";

export interface CreateBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  budgetCategoryInput: string;
  setBudgetCategoryInput: (val: string) => void;
  budgetLimitInput: string;
  setBudgetLimitInput: (val: string) => void;
  currencySymbol: string;
}

export function CreateBudgetModal({
  isOpen,
  onClose,
  onSubmit,
  budgetCategoryInput,
  setBudgetCategoryInput,
  budgetLimitInput,
  setBudgetLimitInput,
  currencySymbol,
}: CreateBudgetModalProps) {
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
                  Create Category Budget
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
                  Budget Category
                </label>
                <NeoSelect
                  fullWidth
                  value={budgetCategoryInput}
                  onChange={setBudgetCategoryInput}
                  options={[
                    { value: "food_dining", label: "Food & Dining" },
                    { value: "software_tools", label: "Software & Tools" },
                    { value: "transportation", label: "Transportation" },
                    { value: "utilities", label: "Bills & Utilities" },
                    { value: "housing", label: "Housing & Rent" },
                    { value: "health", label: "Health & Medical" },
                    { value: "shopping", label: "Shopping & Retail" },
                    { value: "education", label: "Education" },
                    { value: "other", label: "General / Other" },
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-[#121212] mb-1">
                  Monthly Limit ({currencySymbol})
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 500"
                  value={budgetLimitInput}
                  onChange={(e) => setBudgetLimitInput(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[#121212] rounded-lg text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#836EF9]"
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
                  <span>Save Budget</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
