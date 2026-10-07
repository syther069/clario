"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  XCircle,
  CheckCircle2,
  Receipt,
  EyeOff,
  CopyCheck,
  Zap,
  Info,
  Clock,
  FileQuestion,
  FileSpreadsheet,
  AlertTriangle,
  Layers,
} from "lucide-react";

interface ComparisonItem {
  id: string;
  problemTitle: string;
  problemIcon: React.ComponentType<{ className?: string }>;
  withoutClario: string;
  withClario: string;
}

const COMPARISON_ITEMS: ComparisonItem[] = [
  {
    id: "lost-receipts",
    problemTitle: "Lost receipts and forgotten invoices",
    problemIcon: FileQuestion,
    withoutClario:
      "Paper receipts fade in a shoebox, and email invoices get buried in crowded inboxes.",
    withClario:
      "Snap or upload on your phone or laptop; receipts stay encrypted on your device and never get lost.",
  },
  {
    id: "exposed-vendors",
    problemTitle: "Vendor names exposed in shared spreadsheets",
    problemIcon: FileSpreadsheet,
    withoutClario:
      "Shared spreadsheets and accounting tools expose confidential vendor names and personal notes to everyone.",
    withClario:
      "Only an unreadable cryptographic fingerprint touches the ledger; vendor names and line items stay private to you.",
  },
  {
    id: "double-reimbursement",
    problemTitle: "The same expense reimbursed twice",
    problemIcon: AlertTriangle,
    withoutClario:
      "Employees accidentally submit the same receipt across different reports, leading to double payouts.",
    withClario:
      "Smart contracts check the fingerprint instantly; the exact same receipt can never be reimbursed twice.",
  },
  {
    id: "waiting-payouts",
    problemTitle: "Waiting days for review and payout",
    problemIcon: Clock,
    withoutClario:
      "Expense reports sit in email chains for weeks, and bank transfers take 3–5 business days to clear.",
    withClario:
      "Reviewers approve with one click, and funds settle on Monad in under a second.",
  },
];

export function BeforeAfterSection() {
  const [activeView, setActiveView] = useState<"both" | "without" | "with">(
    "both"
  );

  return (
    <section
      id="comparison"
      className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-gray-200"
    >
      <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
        <span className="text-xs font-semibold text-[#7C6CF6] bg-[#f5f3ff] px-2.5 py-1 rounded-md border border-[#e0dbfd] inline-block mb-3">
          Everyday differences
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 leading-tight [text-wrap:balance]">
          Before and after Clario
        </h2>
        <p className="text-base sm:text-lg text-gray-600 mt-3 leading-relaxed">
          How simple receipt privacy and fast onchain verification solve everyday expense headaches.
        </p>

        {/* View Toggle Tabs */}
        <div className="flex items-center justify-center gap-1.5 mt-8 p-1.5 bg-gray-100 rounded-xl max-w-xs mx-auto border border-gray-200 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveView("without")}
            className={`flex-1 py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
              activeView === "without"
                ? "bg-white text-gray-900 shadow-2xs font-bold"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Without Clario
          </button>
          <button
            type="button"
            onClick={() => setActiveView("both")}
            className={`hidden sm:block py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
              activeView === "both"
                ? "bg-white text-gray-900 shadow-2xs font-bold"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Side by side
          </button>
          <button
            type="button"
            onClick={() => setActiveView("with")}
            className={`flex-1 py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
              activeView === "with"
                ? "bg-[#7C6CF6] text-white shadow-2xs font-bold"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            With Clario
          </button>
        </div>
      </div>

      {/* 4 Everyday Problem Rows */}
      <div className="space-y-4">
        {COMPARISON_ITEMS.map((item, idx) => {
          const Icon = item.problemIcon;
          return (
            <div
              key={item.id}
              className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-xs transition hover:border-gray-300"
            >
              <div className="flex items-center gap-2.5 mb-4 text-xs font-semibold text-gray-500">
                <div className="h-6 w-6 rounded-md bg-gray-100 flex items-center justify-center text-gray-700">
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <span className="text-gray-900 font-bold sm:text-sm">
                  {item.problemTitle}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Without Clario Side */}
                {(activeView === "both" || activeView === "without") && (
                  <div
                    className={`rounded-xl border p-4 transition-all ${
                      activeView === "without"
                        ? "border-red-200 bg-red-50/40"
                        : "border-gray-200 bg-gray-50/60"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2 text-xs font-bold text-gray-700">
                      <XCircle className="h-4 w-4 text-gray-400" />
                      <span>Without Clario</span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {item.withoutClario}
                    </p>
                  </div>
                )}

                {/* With Clario Side */}
                {(activeView === "both" || activeView === "with") && (
                  <div
                    className={`rounded-xl border p-4 transition-all ${
                      activeView === "with"
                        ? "border-[#7C6CF6] bg-[#f5f3ff]/50 shadow-2xs"
                        : "border-emerald-200 bg-emerald-50/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2 text-xs font-bold text-emerald-800">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>With Clario</span>
                    </div>
                    <p className="text-sm text-gray-900 font-medium leading-relaxed">
                      {item.withClario}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Honest Coming Later Note */}
      <div className="mt-8 p-4 rounded-xl border border-gray-200 bg-gray-50 flex items-center gap-3 text-xs text-gray-600">
        <Info className="h-4 w-4 text-[#7C6CF6] shrink-0" aria-hidden="true" />
        <span>
          <strong className="text-gray-900 font-semibold">Coming later:</strong>{" "}
          Native mobile apps (iOS &amp; Android) and direct QuickBooks sync are currently in active development.
        </span>
      </div>
    </section>
  );
}
