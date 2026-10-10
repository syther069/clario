"use client";

import React from "react";
import { AlertCircle } from "lucide-react";
import { AnimatedBackground } from "@/components/ui/motion";
import type { CashFlowBucket, CashFlowPeriod } from "@/domain/analytics/cashflow-calculator";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface CashFlowChartCardProps {
  chartData: CashFlowBucket[];
  cashFlowPeriod: CashFlowPeriod;
  onPeriodChange: (period: CashFlowPeriod) => void;
  hasData: boolean;
}

export function CashFlowChartCard({
  chartData,
  cashFlowPeriod,
  onPeriodChange,
  hasData,
}: CashFlowChartCardProps) {
  return (
    <div className="lg:col-span-2 neo-card p-6 flex flex-col justify-between">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-black uppercase tracking-wider text-[#121212]">
            Income vs Expenses
          </h2>
          <p className="text-xs text-slate-500">
            Real-time net cash flow across time intervals
          </p>
        </div>

        <div className="flex items-center gap-1 bg-[#f3f4f6] p-1 rounded-lg border-2 border-[#121212] shadow-[2px_2px_0_0_#121212]">
          <AnimatedBackground
            defaultValue={cashFlowPeriod}
            className="bg-[#836EF9] border border-[#121212] shadow-[1px_1px_0_0_#121212] rounded"
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 30,
            }}
          >
            {(["7D", "30D", "3M", "6M", "1Y"] as const).map((period) => (
              <button
                key={period}
                data-id={period}
                type="button"
                onClick={() => onPeriodChange(period)}
                className={`px-2.5 py-1 text-[11px] font-mono font-black uppercase rounded transition-colors ${
                  cashFlowPeriod === period
                    ? "text-white"
                    : "text-slate-600 hover:text-[#121212]"
                }`}
              >
                {period}
              </button>
            ))}
          </AnimatedBackground>
        </div>
      </div>

      <div className="h-64 w-full">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 2" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                stroke="#6b7280"
                fontSize={11}
                fontWeight={600}
              />
              <YAxis stroke="#6b7280" fontSize={11} fontWeight={600} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  borderColor: "#121212",
                  borderWidth: "2px",
                  borderRadius: "8px",
                  boxShadow: "2px 2px 0 0 #121212",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              />
              <Area
                type="monotone"
                dataKey="income"
                stroke="#15803d"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#incomeGrad)"
                name="Income"
              />
              <Area
                type="monotone"
                dataKey="expenses"
                stroke="#b91c1c"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#expenseGrad)"
                name="Expenses"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-[#121212] rounded-xl p-6 text-center bg-[#f8f9fa]">
            <AlertCircle className="h-8 w-8 text-slate-400 mb-2" />
            <p className="text-xs font-black uppercase tracking-wider text-[#121212]">
              No transaction activity recorded yet
            </p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
              Add your first income or expense transaction to unlock real-time
              cash flow analytics.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
