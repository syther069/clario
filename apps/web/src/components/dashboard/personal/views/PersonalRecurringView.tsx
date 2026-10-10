"use client";

import React from "react";
import { Plus, RotateCcw } from "lucide-react";
import type { Subscription } from "@/lib/supabase/types";

export interface PersonalRecurringViewProps {
  currencySymbol: string;
  monthlyRecurringSpend: number;
  yearlyProjectedRecurring: number;
  localSubscriptions: Subscription[];
  onOpenAddSubscription: () => void;
  onToggleSubscriptionStatus: (subId: string) => void;
  onDeleteSubscription: (subId: string) => void;
}

export function PersonalRecurringView({
  currencySymbol,
  monthlyRecurringSpend,
  yearlyProjectedRecurring,
  localSubscriptions,
  onOpenAddSubscription,
  onToggleSubscriptionStatus,
  onDeleteSubscription,
}: PersonalRecurringViewProps) {
  const activeCount = localSubscriptions.filter((s) => s.status === "active").length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-wider text-[#121212]">
            Active Subscriptions & Recurring Bills
          </h2>
          <p className="text-xs text-slate-500">
            Track renewal dates, frequencies, and projected annualized cash burn.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenAddSubscription}
            className="neo-btn neo-btn-primary cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Subscription</span>
          </button>
        </div>
      </div>

      {/* Burn Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="neo-card p-5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Monthly Burn
          </span>
          <div className="text-2xl font-black font-mono text-[#836EF9] mt-1">
            {currencySymbol}
            {monthlyRecurringSpend.toFixed(2)}/mo
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Current monthly recurring commitment
          </p>
        </div>

        <div className="neo-card p-5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Yearly Projected Burn
          </span>
          <div className="text-2xl font-black font-mono text-[#121212] mt-1">
            {currencySymbol}
            {yearlyProjectedRecurring.toFixed(2)}/yr
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Annualized subscription cost
          </p>
        </div>

        <div className="neo-card p-5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Active Services
          </span>
          <div className="text-2xl font-black font-mono text-[#15803d] mt-1">
            {activeCount} Active
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Of {localSubscriptions.length} total tracked
          </p>
        </div>
      </div>

      {/* Subscriptions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {localSubscriptions.length === 0 ? (
          <div className="col-span-full rounded-xl border-2 border-dashed border-[#121212] p-12 text-center bg-white">
            <RotateCcw className="h-10 w-10 text-slate-400 mx-auto mb-2" aria-hidden="true" />
            <h3 className="text-sm font-black uppercase tracking-wider text-[#121212]">
              No Subscriptions Tracked
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Add subscriptions and recurring bills to forecast cash flow accurately.
            </p>
            <button
              type="button"
              onClick={onOpenAddSubscription}
              className="mt-4 neo-btn neo-btn-primary mx-auto cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add First Subscription</span>
            </button>
          </div>
        ) : (
          localSubscriptions.map((sub) => {
            const isPaused = sub.status === "paused";
            return (
              <div
                key={sub.id}
                className="neo-card p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f3f0ff] text-[#836EF9] font-black text-sm border-2 border-[#121212]">
                        {sub.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-[#121212]">
                          {sub.name}
                        </h3>
                        <span className="text-[10px] font-black uppercase text-slate-500">
                          Billed {sub.frequency}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border border-[#121212] ${
                        isPaused
                          ? "bg-slate-100 text-slate-600"
                          : "bg-[#dcfce7] text-[#15803d]"
                      }`}
                    >
                      {sub.status}
                    </span>
                  </div>

                  <div className="text-2xl font-black font-mono tabular-nums text-[#121212] mt-4">
                    {currencySymbol}
                    {Number(sub.amount).toFixed(2)}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#121212] space-y-2">
                  {sub.next_billing_date && (
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Next renewal:</span>
                      <span className="font-mono font-bold text-[#121212]">
                        {sub.next_billing_date}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => onToggleSubscriptionStatus(sub.id)}
                      className="text-[11px] font-bold text-[#836EF9] hover:underline cursor-pointer"
                    >
                      {isPaused ? "Resume" : "Pause"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSubscription(sub.id)}
                      className="text-[11px] font-bold text-slate-400 hover:text-[#b91c1c] transition cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
