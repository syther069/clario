"use client";

import React from "react";
import { Plus, RotateCcw } from "lucide-react";
import type { Subscription } from "@/lib/supabase/types";

export interface UpcomingBillsCardProps {
  subscriptions: Subscription[];
  currencySymbol: string;
  onOpenAddSubscription: () => void;
}

export function UpcomingBillsCard({
  subscriptions,
  currencySymbol,
  onOpenAddSubscription,
}: UpcomingBillsCardProps) {
  return (
    <div className="neo-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-black uppercase tracking-wider text-[#121212]">
            Upcoming Bills
          </h2>
        </div>
        <button
          type="button"
          onClick={onOpenAddSubscription}
          className="px-2 py-1 text-[10px] font-black uppercase tracking-wider bg-white hover:bg-[#f3f0ff] text-[#836EF9] border border-[#121212] rounded shadow-[1px_1px_0_0_#121212] flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          <span>Add</span>
        </button>
      </div>

      {subscriptions.length > 0 ? (
        <div className="space-y-3">
          {subscriptions.slice(0, 4).map((sub) => (
            <div
              key={sub.id}
              className="flex items-center justify-between p-3 rounded-lg bg-white border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f3f0ff] text-[#836EF9] font-black text-xs border border-[#121212]">
                  {sub.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-[#121212]">
                    {sub.name}
                  </p>
                  <p className="text-[10px] font-mono text-slate-500">
                    Renews {sub.next_billing_date}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-black font-mono tabular-nums text-[#121212]">
                  {currencySymbol}
                  {Number(sub.amount).toFixed(2)}
                </p>
                <p className="text-[9px] font-black text-slate-500 uppercase">
                  {sub.frequency}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 flex flex-col items-center justify-center border-2 border-dashed border-[#121212] rounded-xl text-center p-4 bg-[#f8f9fa]">
          <RotateCcw className="h-6 w-6 text-slate-400 mb-2" aria-hidden="true" />
          <p className="text-xs font-black uppercase tracking-wider text-[#121212]">
            No recurring bills
          </p>
          <button
            type="button"
            onClick={onOpenAddSubscription}
            className="mt-2 px-3 py-1 text-xs font-black uppercase bg-[#836EF9] text-white border border-[#121212] rounded shadow-[2px_2px_0_0_#121212]"
          >
            + Add Bill
          </button>
        </div>
      )}
    </div>
  );
}
