"use client";

import React from "react";
import Link from "next/link";
import {
  UserRound,
  BriefcaseBusiness,
  UsersRound,
  Building2,
  ArrowRight,
  CheckCircle2,
  BadgeCheck,
} from "lucide-react";
import { InteractiveCard } from "@/components/ui/motion/interactive-card";

export interface ModeExplanationItem {
  id: "personal" | "freelancer" | "family" | "business";
  name: string;
  badge: string;
  icon: typeof UserRound;
  whatItIs: string;
  whoItIsFor: string;
  whatYouCanDo: string[];
  primaryHref: string;
}

export const MODE_EXPLANATIONS: ModeExplanationItem[] = [
  {
    id: "personal",
    name: "Personal",
    badge: "DUAL SUB-LEDGER",
    icon: UserRound,
    whatItIs:
      "A privacy-first cashflow and expense ledger unifying fiat and onchain balances without bank login risks.",
    whoItIsFor:
      "Individuals, crypto natives, and privacy-conscious spenders who want full financial clarity without third-party tracking.",
    whatYouCanDo: [
      "Track fiat cash, bank cards, and Monad/Base/ETH onchain tokens side-by-side in segregated sub-ledgers.",
      "Set interactive category budget limits with instant warning alerts before you overspend.",
      "Detect recurring SaaS subscription renewals and scan receipts with confidential local OCR.",
    ],
    primaryHref: "/?mode=personal",
  },
  {
    id: "freelancer",
    name: "Freelancer",
    badge: "CLIENT BILLING & 1099",
    icon: BriefcaseBusiness,
    whatItIs:
      "A dedicated invoicing and deductible ledger designed to keep client billables and business write-offs airtight.",
    whoItIsFor:
      "Independent contractors, solo engineers, and studio founders managing client retainers and project reimbursables.",
    whatYouCanDo: [
      "Assign project expenses and billable receipt attachments directly to specific client accounts.",
      "Generate milestone invoices and send cryptographic reimbursement vouchers with verified hash proofs.",
      "Tag Schedule C write-offs for instant quarterly tax deductible reporting without receipt loss.",
    ],
    primaryHref: "/?mode=freelancer",
  },
  {
    id: "family",
    name: "Family",
    badge: "HOUSEHOLD POOLS",
    icon: UsersRound,
    whatItIs:
      "A transparent household pool for tracking shared domestic bills, utility calendars, and fair balance settlements.",
    whoItIsFor:
      "Couples, shared households, and families managing pooled rent, utilities, childcare, and grocery budgets.",
    whatYouCanDo: [
      "Pool joint household expenses with clear attribution across all family members.",
      "Calculate fair-share splits and log settled debt balances without awkward spreadsheet math.",
      "Monitor recurring monthly utility bills, mortgage calendars, and joint family savings goals.",
    ],
    primaryHref: "/?mode=family",
  },
  {
    id: "business",
    name: "Business",
    badge: "MULTI-SIG & NULLIFIERS",
    icon: Building2,
    whatItIs:
      "An enterprise-grade expense governance and treasury reimbursement pipeline with Monad parallel execution.",
    whoItIsFor:
      "Web3 protocol foundations, startup teams, and DAOs requiring compliant expense approvals and onchain settlement.",
    whatYouCanDo: [
      "Process team claims through a structured two-phase queue: Reviewer validation and Treasury payout.",
      "Execute sub-second batch reimbursements on Monad Testnet for less than $0.001 gas per transaction.",
      "Enforce company policy caps with an immutable audit log and zero-duplicate nullifier protection.",
    ],
    primaryHref: "/?mode=business",
  },
];

interface ModeExplanationCardsProps {
  activeModeId: string;
  onSelectMode: (modeId: string) => void;
}

export function ModeExplanationCards({
  activeModeId,
  onSelectMode,
}: ModeExplanationCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {MODE_EXPLANATIONS.map((mode) => {
        const Icon = mode.icon;
        const isSelected = activeModeId === mode.id;

        return (
          <InteractiveCard
            key={mode.id}
            rotationFactor={2.5}
            enableSpotlight={true}
            className={`rounded-2xl border-2 border-[#121212] bg-[#ffffff] p-5 flex flex-col justify-between transition-all duration-200 ${
              isSelected
                ? "shadow-[6px_6px_0_0_#836EF9] border-[#121212] ring-2 ring-[#836EF9]/50"
                : "shadow-[4px_4px_0_0_#121212] hover:shadow-[6px_6px_0_0_#121212] hover:-translate-y-0.5"
            }`}
          >
            <div className="space-y-4">
              {/* Card Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-9 w-9 rounded-xl border-2 border-[#121212] flex items-center justify-center ${
                      isSelected
                        ? "bg-[#836EF9] text-white shadow-[2px_2px_0_0_#121212]"
                        : "bg-[#f3f0ff] text-[#836EF9]"
                    }`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-black text-base uppercase text-[#121212] tracking-wide">
                      {mode.name}
                    </h3>
                  </div>
                </div>

                <span className="text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded bg-[#f3f0ff] text-[#836EF9] border border-[#836EF9]/30">
                  {mode.badge}
                </span>
              </div>

              {/* What it is */}
              <div>
                <span className="text-[10px] font-mono font-black uppercase text-gray-500 block">
                  WHAT IT IS
                </span>
                <p className="text-xs font-semibold text-gray-800 leading-snug mt-0.5">
                  {mode.whatItIs}
                </p>
              </div>

              {/* Who it is for */}
              <div className="pt-2 border-t border-gray-100">
                <span className="text-[10px] font-mono font-black uppercase text-[#836EF9] block">
                  WHO IT IS FOR
                </span>
                <p className="text-[11px] font-medium text-gray-600 leading-snug mt-0.5">
                  {mode.whoItIsFor}
                </p>
              </div>

              {/* What they can actually do */}
              <div className="pt-2 border-t border-gray-100 space-y-2">
                <span className="text-[10px] font-mono font-black uppercase text-gray-500 block">
                  WHAT YOU CAN DO
                </span>
                <ul className="space-y-2">
                  {mode.whatYouCanDo.map((action, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <BadgeCheck
                        className="h-3.5 w-3.5 text-[#836EF9] shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span className="text-[11px] font-mono text-gray-700 leading-snug">
                        {action}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="mt-5 pt-3 border-t-2 border-[#121212]/10 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onSelectMode(mode.id)}
                className={`text-[11px] font-mono font-black uppercase py-1.5 px-2.5 rounded-lg border transition ${
                  isSelected
                    ? "bg-[#836EF9] text-white border-[#121212] shadow-[1.5px_1.5px_0_0_#121212]"
                    : "bg-[#f8f9fa] text-gray-700 border-gray-300 hover:border-[#121212]"
                }`}
              >
                {isSelected ? "Preview Active" : "Preview Mode"}
              </button>

              <Link
                href={mode.primaryHref}
                className="text-[11px] font-mono font-black uppercase text-[#121212] hover:text-[#836EF9] inline-flex items-center gap-1 group/link"
              >
                <span>Open</span>
                <ArrowRight
                  className="h-3 w-3 transition-transform group-hover/link:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </InteractiveCard>
        );
      })}
    </div>
  );
}
