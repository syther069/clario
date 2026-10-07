"use client";

import React from "react";
import {
  XCircle,
  CheckCircle2,
  FileQuestion,
  FileSpreadsheet,
  AlertTriangle,
  Clock,
  Sparkles,
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
  return (
    <section
      id="comparison"
      className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t-2 border-[#121212]"
    >
      <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
        <span className="font-mono text-xs font-black uppercase tracking-wider text-[#836EF9] bg-[#f5f3ff] px-3 py-1 rounded-md border-2 border-[#121212] shadow-[2px_2px_0_0_#121212] inline-flex items-center gap-1.5 mb-3">
          <Sparkles className="h-3 w-3" />
          The Clario Advantage
        </span>
        <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-[#121212] leading-tight">
          The Clario Advantage
        </h2>
        <p className="text-base sm:text-lg text-gray-700 mt-3 font-medium leading-relaxed">
          Verifiable cryptographic certainty versus traditional expense friction.
        </p>
      </div>

      {/* Side-by-Side Comparison Cards */}
      <div className="space-y-6">
        {COMPARISON_ITEMS.map((item) => {
          const Icon = item.problemIcon;
          return (
            <div
              key={item.id}
              className="rounded-2xl border-2 border-[#121212] bg-white p-5 sm:p-7 shadow-[4px_4px_0_0_#121212]"
            >
              <div className="flex items-center gap-2.5 mb-5 pb-3 border-b-2 border-[#121212]/10">
                <div className="h-7 w-7 rounded-lg bg-[#f5f3ff] border-2 border-[#121212] flex items-center justify-center text-[#836EF9] shadow-[1px_1px_0_0_#121212]">
                  <Icon className="h-4 w-4 stroke-[2.5]" aria-hidden="true" />
                </div>
                <span className="text-base font-black text-[#121212] tracking-tight">
                  {item.problemTitle}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {/* Traditional Side */}
                <div className="rounded-xl border-2 border-[#121212] bg-[#fff8f8] p-4 sm:p-5 shadow-[2px_2px_0_0_#121212]">
                  <div className="flex items-center gap-2 mb-2.5 font-mono text-xs font-black uppercase tracking-wider text-rose-700">
                    <XCircle className="h-4 w-4 stroke-[2.5]" />
                    <span>Traditional Expense Process</span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed font-normal">
                    {item.withoutClario}
                  </p>
                </div>

                {/* Clario Standard Side */}
                <div className="rounded-xl border-2 border-[#121212] bg-[#fbfaff] p-4 sm:p-5 shadow-[2px_2px_0_0_#121212]">
                  <div className="flex items-center gap-2 mb-2.5 font-mono text-xs font-black uppercase tracking-wider text-[#836EF9]">
                    <CheckCircle2 className="h-4 w-4 stroke-[2.5]" />
                    <span>The Clario Standard</span>
                  </div>
                  <p className="text-sm text-[#121212] leading-relaxed font-semibold">
                    {item.withClario}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
