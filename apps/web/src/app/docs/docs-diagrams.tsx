"use client";

import React from "react";
import {
  ShieldCheck,
  Cpu,
  Lock,
  ArrowRight,
  Database,
  FileCheck,
  Fingerprint,
} from "lucide-react";
import { MonadLogo } from "@/components/ui/crypto-icon";

export function ClarioPipelineDiagram() {
  const steps = [
    {
      step: "01",
      label: "NON-CUSTODIAL AUTH",
      desc: "Privy embedded & external EVM signers. Zero server-side private key custody.",
      badge: "PRIVY DID",
    },
    {
      step: "02",
      label: "MULTI-MODE LEDGER",
      desc: "Raw transactions normalized via Alchemy & Viem RPC into unified SQL schema.",
      badge: "POSTGRES RLS",
    },
    {
      step: "03",
      label: "EVIDENCE VAULT",
      desc: "Receipt images & OCR metadata stored offchain with envelope encryption.",
      badge: "OFFCHAIN DEK",
    },
    {
      step: "04",
      label: "CANONICAL SERIALIZATION",
      desc: "RFC 8785 deterministic key ordering + SHA-256 binary evidence digest.",
      badge: "RFC 8785",
    },
    {
      step: "05",
      label: "MONAD COMMITMENT",
      desc: "Keccak-256 root anchored on Monad Testnet with 1s deterministic finality.",
      badge: "CHAIN 10143",
    },
    {
      step: "06",
      label: "INDEPENDENT AUDIT",
      desc: "Standalone zero-dependency CLI validates cryptographic proof offline.",
      badge: "ZERO TRUST",
    },
  ];

  return (
    <div className="my-6 rounded-md border-2 border-[#121212] bg-[#0E0E0E] p-5 text-white shadow-[4px_4px_0_0_#121212]">
      {/* Header telemetry */}
      <div className="flex items-center justify-between border-b-2 border-white/10 pb-3 mb-4 font-mono">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-200">
            SYSTEM BLUEPRINT // CRYPTOGRAPHIC VERIFICATION PIPELINE
          </span>
        </div>
        <span className="text-[10px] font-bold text-[#836EF9] border border-[#836EF9]/50 bg-[#836EF9]/10 px-2 py-0.5 rounded">
          RFC 8785 ──▶ KECCAK-256 ──▶ MONAD
        </span>
      </div>

      {/* Grid of pipeline steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 font-mono">
        {steps.map((item) => (
          <div
            key={item.step}
            className="rounded border-2 border-white/15 bg-[#181818] p-3.5 transition-all hover:border-[#836EF9] hover:bg-[#202020]"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-[#836EF9] bg-[#836EF9]/10 border border-[#836EF9]/30 px-1.5 py-0.5 rounded">
                STAGE {item.step}
              </span>
              <span className="text-[9px] font-bold text-slate-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                [ {item.badge} ]
              </span>
            </div>
            <div className="text-xs font-black text-white tracking-wide mb-1">
              {item.label}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed font-sans font-normal">
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DataSeparationDiagram() {
  return (
    <div className="my-6 grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Offchain Private Evidence */}
      <div className="rounded-md border-2 border-[#121212] bg-white p-5 shadow-[4px_4px_0_0_#121212]">
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#121212] mb-3">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-[#121212]" />
            <h4 className="font-mono text-xs font-black uppercase tracking-wider text-[#121212]">
              OFFCHAIN VAULT // CONFIDENTIAL
            </h4>
          </div>
          <span className="font-mono text-[9px] font-black uppercase px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded">
            NEVER BROADCAST
          </span>
        </div>
        <ul className="space-y-2 text-xs text-slate-700 font-medium font-sans">
          <li className="flex items-start gap-2">
            <span className="font-mono font-bold text-[#121212]">[ + ]</span>
            <span>Raw receipt scans, merchant names & invoice line items</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono font-bold text-[#121212]">[ + ]</span>
            <span>Customer PII, corporate tax registration numbers & payment details</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono font-bold text-[#121212]">[ + ]</span>
            <span>Protected by Supabase PostgreSQL Row Level Security (RLS)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono font-bold text-[#121212]">[ + ]</span>
            <span>Encrypted at rest via AES-256 envelope encryption (DEK/KEK)</span>
          </li>
        </ul>
      </div>

      {/* Onchain Public Commitments */}
      <div className="rounded-md border-2 border-[#121212] bg-[#FAF8FF] p-5 shadow-[4px_4px_0_0_#121212]">
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#121212] mb-3">
          <div className="flex items-center gap-2">
            <MonadLogo className="h-4 w-4 text-[#836EF9]" />
            <h4 className="font-mono text-xs font-black uppercase tracking-wider text-[#121212]">
              MONAD REGISTRY // IMMUTABLE
            </h4>
          </div>
          <span className="font-mono text-[9px] font-black uppercase px-2 py-0.5 bg-[#836EF9] text-white border border-[#121212] rounded shadow-[1px_1px_0_0_#121212]">
            ONCHAIN PUBLIC
          </span>
        </div>
        <ul className="space-y-2 text-xs text-slate-700 font-medium font-sans">
          <li className="flex items-start gap-2">
            <span className="font-mono font-bold text-[#836EF9]">[ ✓ ]</span>
            <span>32-byte Keccak-256 cryptographic commitment hash</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono font-bold text-[#836EF9]">[ ✓ ]</span>
            <span>Authorized creator / submitter EVM wallet address</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono font-bold text-[#836EF9]">[ ✓ ]</span>
            <span>Settlement recipient address & USDC reimbursement allocation</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono font-bold text-[#836EF9]">[ ✓ ]</span>
            <span>Block timestamp and transaction hash for permanent audit trails</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

export function AiBoundaryDiagram() {
  return (
    <div className="my-6 rounded-md border-2 border-[#121212] bg-white p-5 shadow-[4px_4px_0_0_#121212]">
      <div className="flex items-center justify-between border-b-2 border-[#121212] pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-[#836EF9]" />
          <h4 className="font-mono text-xs font-black uppercase tracking-wider text-[#121212]">
            AI BOUNDARY BLUEPRINT // STRICTLY ADVISORY (ZERO AUTHORITY)
          </h4>
        </div>
        <span className="font-mono text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white px-2 py-0.5 rounded border border-[#121212]">
          FOUNDER INVARIANT 05
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="rounded border-2 border-[#121212] bg-[#F4F4F0] p-3">
          <div className="font-mono font-black text-[#121212] mb-1">
            01 // PROBABILISTIC OCR
          </div>
          <p className="text-slate-600 font-medium leading-relaxed font-sans">
            Gemini 2.5 Flash extracts candidate fields (vendor, total, tax) into an unconfirmed draft payload.
          </p>
        </div>
        <div className="rounded border-2 border-[#121212] bg-[#FAF8FF] p-3 shadow-[2px_2px_0_0_#836EF9]">
          <div className="font-mono font-black text-[#836EF9] mb-1">
            02 // AUTHORIZED HUMAN REVIEW
          </div>
          <p className="text-slate-700 font-medium leading-relaxed font-sans">
            User inspects extracted figures, resolves ambiguities, and explicitly signs off before state mutation.
          </p>
        </div>
        <div className="rounded border-2 border-[#121212] bg-[#F4F9F4] p-3">
          <div className="font-mono font-black text-emerald-800 mb-1">
            03 // CANONICAL CONSENSUS
          </div>
          <p className="text-slate-600 font-medium leading-relaxed font-sans">
            Only verified data is canonicalized (RFC 8785) and anchored to the Monad registry smart contract.
          </p>
        </div>
      </div>
    </div>
  );
}
