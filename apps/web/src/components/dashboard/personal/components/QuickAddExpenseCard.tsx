"use client";

import React, { useState } from "react";
import { Plus, Banknote, Smartphone, CreditCard, Building2 } from "lucide-react";
import { motion } from "motion/react";
import { WatermelonButton } from "@/components/ui/watermelon-button";
import type { Transaction } from "@/lib/supabase/types";

export interface QuickAddExpenseCardProps {
  currencySymbol: string;
  currencyCode: string;
  userId: string;
  onAddExpense?: ((tx: Transaction) => void) | undefined;
}

export function QuickAddExpenseCard({
  currencySymbol,
  currencyCode,
  userId,
  onAddExpense,
}: QuickAddExpenseCardProps) {
  const [quickDesc, setQuickDesc] = useState("");
  const [quickAmount, setQuickAmount] = useState("");
  const [quickPaymentMethod, setQuickPaymentMethod] = useState("Credit Card");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickDesc.trim() || !quickAmount) return;
    const num = parseFloat(quickAmount);
    if (isNaN(num) || num <= 0) return;

    onAddExpense?.({
      id: crypto.randomUUID(),
      user_id: userId,
      type: "expense",
      amount: num,
      currency: currencyCode,
      merchant: quickDesc.trim(),
      description: quickDesc.trim(),
      category: "food_dining",
      category_id: "food_dining",
      date: new Date().toISOString().split("T")[0]!,
      timestamp: new Date().toISOString(),
      payment_method: quickPaymentMethod,
      verification_state: "unverified",
      verification_status: "unverified",
      blockchain_status: null,
      source: "manual",
      version: 1,
    } as Transaction);

    setQuickDesc("");
    setQuickAmount("");
  };

  return (
    <div className="neo-card p-5 bg-[#fbf9fe] border-2 border-[#121212] shadow-[4px_4px_0_0_#121212]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-[#836EF9] text-white flex items-center justify-center border border-[#121212] shadow-[1px_1px_0_0_#121212]">
            <Plus className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-xs font-black uppercase tracking-wider text-[#121212]">
            Quick Add Personal Expense
          </h3>
          <span className="text-[10px] font-mono font-bold uppercase text-slate-500 bg-white px-2 py-0.5 rounded border border-[#121212]">
            Instant Entry
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { label: "Cash", icon: Banknote },
            { label: "UPI", icon: Smartphone },
            { label: "Credit Card", icon: CreditCard },
            { label: "Bank Transfer", icon: Building2 },
          ].map((m) => (
            <motion.button
              key={m.label}
              type="button"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setQuickPaymentMethod(m.label)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-black uppercase rounded-lg border-2 border-[#121212] transition-all cursor-pointer ${
                quickPaymentMethod === m.label
                  ? "bg-[#836EF9] text-white shadow-[2px_2px_0_0_#121212]"
                  : "bg-white text-slate-700 shadow-[1.5px_1.5px_0_0_#121212] hover:bg-[#f3f4f6]"
              }`}
            >
              <m.icon className="h-3 w-3" />
              <span>{m.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center"
      >
        <input
          type="text"
          placeholder="Merchant / Purpose (e.g. Starbucks, Groceries, Metro, Gym)"
          value={quickDesc}
          onChange={(e) => setQuickDesc(e.target.value)}
          className="flex-1 neo-input text-xs !py-2"
          required
        />
        <div className="relative w-full sm:w-44">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-mono font-bold text-slate-500 pointer-events-none">
            {currencySymbol}
          </span>
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={quickAmount}
            onChange={(e) => setQuickAmount(e.target.value)}
            className="w-full neo-input !pl-8 text-xs font-mono font-bold !py-2"
            required
          />
        </div>
        <WatermelonButton
          type="submit"
          variant="primary"
          size="sm"
          textMorph
          leftIcon={<Plus className="h-3.5 w-3.5" />}
          className="!py-2 !px-5 whitespace-nowrap shadow-[3px_3px_0_0_#121212]"
        >
          Add Expense
        </WatermelonButton>
      </form>
    </div>
  );
}
