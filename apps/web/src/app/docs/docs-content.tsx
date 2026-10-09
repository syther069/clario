"use client";

import React from "react";
import Link from "next/link";
import {
  DocCodeBlock,
  DocCallout,
  DocTable,
  DocStatGrid,
} from "./docs-components";
import {
  ClarioPipelineDiagram,
  DataSeparationDiagram,
  AiBoundaryDiagram,
} from "./docs-diagrams";
import {
  ShieldCheck,
  CheckCircle2,
  Terminal,
  ExternalLink,
  Cpu,
  Layers,
  Lock,
  ArrowRight,
  Database,
  FileCheck,
  Wallet,
  Code2,
} from "lucide-react";
import { MonadLogo } from "@/components/ui/crypto-icon";

interface SectionContentProps {
  sectionId: string;
}

export function DocSectionContent({ sectionId }: SectionContentProps) {
  switch (sectionId) {
    // ==========================================
    // 1. Overview & Vision
    // ==========================================
    case "overview":
      return (
        <div className="space-y-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded border-2 border-[#121212] bg-[#836EF9] text-white px-2.5 py-1 font-mono text-[11px] font-black uppercase tracking-wider shadow-[2px_2px_0_0_#121212]">
              <Layers className="h-3.5 w-3.5" />
              <span>Executive Overview</span>
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black font-sans tracking-tight text-[#121212]">
              Financial Intelligence, Operations & Verification
            </h1>
            <p className="mt-3 text-base text-slate-600 font-medium leading-relaxed max-w-3xl">
              Clario is a modern financial operations platform engineered for individuals, freelancers, families, and distributed businesses. It reconciles messy offchain financial evidence with onchain EVM ledgers, secured by high-speed cryptographic commitments anchored to the Monad network.
            </p>
          </div>

          <ClarioPipelineDiagram />

          {/* Section: What is Clario? */}
          <section id="what-is-clario" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> What is Clario?
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              Modern financial life is fractured. Users manage fiat bank accounts, crypto wallets across multiple chains, physical paper receipts, tax invoices, and collaborative expense reimbursements in siloed apps. Traditional accounting tools lack cryptographic integrity, while standard crypto wallets ignore offchain real-world receipts and tax contexts.
            </p>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              Clario bridges this gap through a three-layer architecture:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
              <div className="rounded-md border-2 border-[#121212] bg-white p-4 shadow-[3px_3px_0_0_#121212]">
                <div className="font-mono text-xs font-black uppercase text-[#836EF9] mb-1">// LAYER 01</div>
                <div className="font-mono font-black text-sm text-[#121212] mb-1">Financial Intelligence</div>
                <p className="text-xs text-slate-600 font-medium">
                  Automated categorization, multi-chain indexing via Alchemy, and multimodal receipt OCR powered by Gemini 2.5 Flash.
                </p>
              </div>
              <div className="rounded-md border-2 border-[#121212] bg-white p-4 shadow-[3px_3px_0_0_#121212]">
                <div className="font-mono text-xs font-black uppercase text-[#121212] mb-1">// LAYER 02</div>
                <div className="font-mono font-black text-sm text-[#121212] mb-1">Financial Operations</div>
                <p className="text-xs text-slate-600 font-medium">
                  Unified multi-mode ledger spanning Personal, Freelancer, Family, and Business accounts with shared budgets and invoices.
                </p>
              </div>
              <div className="rounded-md border-2 border-[#121212] bg-white p-4 shadow-[3px_3px_0_0_#121212]">
                <div className="font-mono text-xs font-black uppercase text-[#836EF9] mb-1">// LAYER 03</div>
                <div className="font-mono font-black text-sm text-[#121212] mb-1">Cryptographic Verification</div>
                <p className="text-xs text-slate-600 font-medium">
                  Canonical RFC 8785 JSON bundling, Keccak-256 commitments anchored on Monad Testnet, and offline verification CLI.
                </p>
              </div>
            </div>
          </section>

          {/* Section: The Problem Space */}
          <section id="the-problem" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> The Problem Space
            </h2>
            <div className="space-y-3 text-sm text-slate-700 font-medium leading-relaxed">
              <p>
                In standard business and personal accounting, financial records are subject to three systemic vulnerabilities:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Malleable Audit Trails:</strong> Traditional databases permit silent row edits, deletions, or retroactive back-dating of receipts and invoices with zero external verification.
                </li>
                <li>
                  <strong>Privacy Leakage on Blockchains:</strong> Naive Web3 expense tools post sensitive customer names, items, and tax identifiers directly to public chains, violating privacy laws like GDPR and CCPA.
                </li>
                <li>
                  <strong>Double Reimbursement & Fraud:</strong> Organizations lose billions annually to duplicate invoice submissions across different payment rails (e.g., paid in fiat, then resubmitted in crypto).
                </li>
              </ul>
            </div>
          </section>

          {/* Section: Who is Clario For? */}
          <section id="who-is-clario-for" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Who is Clario For?
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-md border-2 border-[#121212] bg-white shadow-[3px_3px_0_0_#121212]">
                <h4 className="font-mono font-black text-sm text-[#121212] mb-1">// FREELANCERS & CONTRACTORS</h4>
                <p className="text-xs text-slate-600 font-medium">
                  Issue verifiable milestone invoices, track project expenses, and calculate estimated quarterly tax obligations with audit-proof export packages.
                </p>
              </div>
              <div className="p-4 rounded-md border-2 border-[#121212] bg-white shadow-[3px_3px_0_0_#121212]">
                <h4 className="font-mono font-black text-sm text-[#121212] mb-1">// WEB3 STARTUPS & DAOS</h4>
                <p className="text-xs text-slate-600 font-medium">
                  Manage team expense reimbursements in USDC on Monad, guarantee non-duplication onchain, and maintain strict offchain evidence privacy.
                </p>
              </div>
              <div className="p-4 rounded-md border-2 border-[#121212] bg-white shadow-[3px_3px_0_0_#121212]">
                <h4 className="font-mono font-black text-sm text-[#121212] mb-1">// MODERN HOUSEHOLDS</h4>
                <p className="text-xs text-slate-600 font-medium">
                  Collaborative family budgeting, shared recurring subscription monitoring, and automated anomaly warnings when utility bills spike.
                </p>
              </div>
              <div className="p-4 rounded-md border-2 border-[#121212] bg-white shadow-[3px_3px_0_0_#121212]">
                <h4 className="font-mono font-black text-sm text-[#121212] mb-1">// CRYPTO NATIVES & INVESTORS</h4>
                <p className="text-xs text-slate-600 font-medium">
                  Aggregate multi-chain EVM wallet activities into a consolidated net worth view without sacrificing custody or private keys.
                </p>
              </div>
            </div>
          </section>

          {/* Section: The 6 Founder Invariants */}
          <section id="founder-invariants" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> The 6 Founder Invariants
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              Every system component in Clario is governed by six immutable mathematical and architectural invariants:
            </p>

            <div className="space-y-3 font-sans">
              <div className="rounded-md border-2 border-[#121212] bg-white p-4 shadow-[3px_3px_0_0_#121212]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-black text-white">01</span>
                  <span className="font-mono font-black text-sm text-[#121212]">Private Evidence Remains Offchain</span>
                </div>
                <p className="text-xs text-slate-600 font-medium">
                  Raw receipt scans, invoice line items, and PII are stored exclusively in encrypted offchain storage with Row Level Security. Never broadcast to public mempools.
                </p>
              </div>

              <div className="rounded-md border-2 border-[#121212] bg-white p-4 shadow-[3px_3px_0_0_#121212]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-black text-white">02</span>
                  <span className="font-mono font-black text-sm text-[#121212]">Material Edits Create Immutable Versions</span>
                </div>
                <p className="text-xs text-slate-600 font-medium">
                  Modifying an anchored receipt or transaction does not mutate existing rows in place; it generates an append-only revised bundle with a new cryptographic root.
                </p>
              </div>

              <div className="rounded-md border-2 border-[#121212] bg-white p-4 shadow-[3px_3px_0_0_#121212]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-black text-white">03</span>
                  <span className="font-mono font-black text-sm text-[#121212]">Approval Binds to an Exact Commitment & Human Signer</span>
                </div>
                <p className="text-xs text-slate-600 font-medium">
                  Signing an expense or invoice locks to the exact 32-byte Keccak-256 commitment of the RFC 8785 canonical representation and the authorized human’s EVM address.
                </p>
              </div>

              <div className="rounded-md border-2 border-[#121212] bg-white p-4 shadow-[3px_3px_0_0_#121212]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-black text-white">04</span>
                  <span className="font-mono font-black text-sm text-[#121212]">Duplicate Reimbursement Fails Deterministically</span>
                </div>
                <p className="text-xs text-slate-600 font-medium">
                  Smart contract-level mapping on Monad enforces that an anchored receipt commitment hash cannot be reimbursed more than once. Resubmission reverts.
                </p>
              </div>

              <div className="rounded-md border-2 border-[#121212] bg-white p-4 shadow-[3px_3px_0_0_#121212]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-rose-600 text-white">05</span>
                  <span className="font-mono font-black text-sm text-[#121212]">AI Has Strictly Zero Authority</span>
                </div>
                <p className="text-xs text-slate-600 font-medium">
                  AI models (Gemini 2.5 Flash, Copilot) provide advisory suggestions and draft extractions only. They have zero authority to commit funds, alter state, or sign onchain records.
                </p>
              </div>

              <div className="rounded-md border-2 border-[#121212] bg-white p-4 shadow-[3px_3px_0_0_#121212]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-[#836EF9] text-white">06</span>
                  <span className="font-mono font-black text-sm text-[#121212]">Verification Stays Independent</span>
                </div>
                <p className="text-xs text-slate-600 font-medium">
                  Any third party can audit and verify Clario receipt bundles offline using the open-source CLI verifier against public Monad RPC, without an account, API keys, or Clario servers.
                </p>
              </div>
            </div>
          </section>
        </div>
      );

    // ==========================================
    // 2. Developer Quickstart
    // ==========================================
    case "quickstart":
      return (
        <div className="space-y-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#121212] bg-emerald-100 px-3 py-1 font-mono text-xs font-black uppercase text-emerald-800 shadow-[2px_2px_0_0_#121212]">
              <Terminal className="h-3.5 w-3.5" />
              <span>Local Development</span>
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black font-sans tracking-tight text-[#121212]">
              Developer Quickstart
            </h1>
            <p className="mt-3 text-base text-slate-600 font-medium leading-relaxed max-w-3xl">
              Get Clario running locally in development mode in under 3 minutes. Clario uses a modern Turborepo monorepo with pnpm workspaces.
            </p>
          </div>

          <section id="prerequisites" className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> System Prerequisites
            </h2>
            <DocTable
              headers={["Tool", "Minimum Version", "Purpose"]}
              rows={[
                ["Node.js", ">= 18.18.0", "JavaScript runtime environment"],
                ["pnpm", ">= 9.0.0", "Fast disk-efficient monorepo package manager"],
                ["Git", ">= 2.30", "Version control & verification submodule checkout"],
                ["Supabase CLI (Optional)", ">= 1.150", "Local PostgreSQL container testing"],
              ]}
            />
          </section>

          <section id="clone-install" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Clone & Install
            </h2>
            <p className="text-sm text-slate-700 font-medium">
              Clone the repository and install all workspace dependencies:
            </p>
            <DocCodeBlock
              filename="Terminal"
              language="bash"
              code={`# 1. Clone repository
git clone https://github.com/syther069/Clario.git
cd Clario

# 2. Install monorepo dependencies
pnpm install`}
            />
          </section>

          <section id="environment-vars" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Environment Configuration
            </h2>
            <p className="text-sm text-slate-700 font-medium">
              Create your local environment file in <code className="font-mono bg-slate-100 px-1 py-0.5 border border-slate-300 rounded">apps/web/.env.local</code>:
            </p>
            <DocCodeBlock
              filename="apps/web/.env.local"
              language="bash"
              code={`# Privy Authentication
NEXT_PUBLIC_PRIVY_APP_ID="your-privy-app-id"

# Supabase Storage & Database
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_SERVICE_ROLE_KEY="your-server-service-role-key"

# Monad Testnet Configuration
NEXT_PUBLIC_MONAD_CHAIN_ID="10143"
NEXT_PUBLIC_MONAD_RPC_URL="https://testnet-rpc.monad.xyz"
NEXT_PUBLIC_MONAD_REGISTRY_ADDRESS="0x92f9B76673C1D88c9E3c490A88eB95b08823bA87"

# Gemini Multimodal OCR
GEMINI_API_KEY="AIzaSy..."`}
            />
          </section>

          <section id="local-dev-server" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Running Locally
            </h2>
            <p className="text-sm text-slate-700 font-medium">
              Launch the Next.js development server:
            </p>
            <DocCodeBlock
              filename="Terminal"
              language="bash"
              code={`# Start Next.js local dev server
pnpm dev

# The app will be available at:
# http://localhost:3000`}
            />
          </section>

          <section id="testing-verification" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Running Automated Tests
            </h2>
            <p className="text-sm text-slate-700 font-medium">
              Verify your workspace against Clario’s automated test suite:
            </p>
            <DocCodeBlock
              filename="Terminal"
              language="bash"
              code={`# Run Vitest unit & integration tests
pnpm --filter @clario/web test -- --run

# Run TypeScript typecheck
pnpm --filter @clario/web exec tsc --noEmit`}
            />
          </section>
        </div>
      );

    // ==========================================
    // 3. Platform Modes
    // ==========================================
    case "product-modes":
      return (
        <div className="space-y-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#121212] bg-blue-100 px-3 py-1 font-mono text-xs font-black uppercase text-blue-800 shadow-[2px_2px_0_0_#121212]">
              <Layers className="h-3.5 w-3.5" />
              <span>Multi-Mode Architecture</span>
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black font-sans tracking-tight text-[#121212]">
              Unified Ledger & Platform Modes
            </h1>
            <p className="mt-3 text-base text-slate-600 font-medium leading-relaxed max-w-3xl">
              Clario eliminates fragmented financial software by providing 4 distinct operating modes backed by a single, high-integrity relational ledger.
            </p>
          </div>

          <section id="unified-ledger" className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Unified Ledger Foundation
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              Unlike legacy financial apps that require maintaining completely distinct accounts for personal, freelance, and business expenses, Clario uses a <strong>Single Unified Ledger</strong>. Every transaction, receipt, and invoice shares the same normalized schema, tagged with category flags and workspace ownership. Switching modes alters the perspective, metrics, and workflows—not the underlying database.
            </p>
            <DocCallout type="tip" title="ZERO DATA DUPLICATION">
              Switching from Personal to Freelancer or Business mode does not copy data or bifurcate user identities. Your connected EVM wallets and verified receipts exist once in PostgreSQL and can be partitioned or bundled on demand.
            </DocCallout>
          </section>

          <section id="mode-personal" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Personal Mode
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              Designed for day-to-day individual cash flow and digital asset tracking:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-700 font-medium">
              <li><strong>Real-time Cashflow Overview:</strong> Total spend, income, and balance velocity.</li>
              <li><strong>Budget Categories:</strong> Custom limits for dining, software, utilities, travel, and investments.</li>
              <li><strong>Recurring Subscriptions:</strong> Automated detection of monthly SaaS and utility bills with renewal alerts.</li>
              <li><strong>Dual-Currency Totals:</strong> Consolidated calculation in fiat (USD) and onchain assets (MON, ETH, USDC).</li>
            </ul>
          </section>

          <section id="mode-freelancer" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Freelancer Mode
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              Specialized tools for solo operators, independent contractors, and consultants:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-700 font-medium">
              <li><strong>Client Directory:</strong> Contact information, billing rates, payment terms, and open balance tracking.</li>
              <li><strong>Milestone Invoicing:</strong> Generate branded invoices payable in fiat or crypto with direct Monad settlement links.</li>
              <li><strong>Billable Project Expenses:</strong> Tag receipts to specific client projects for easy pass-through reimbursement.</li>
              <li><strong>Estimated Tax Reserve:</strong> Automatic withholding calculations based on net taxable freelance revenue.</li>
            </ul>
          </section>

          <section id="mode-family" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Family Mode
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              Collaborative financial coordination for modern households:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-700 font-medium">
              <li><strong>Shared Vaults:</strong> Collective household grocery, mortgage, and child-care budgets.</li>
              <li><strong>Allowance & Dependent Tracking:</strong> Set card or wallet spending caps for teenagers and dependents.</li>
              <li><strong>Two-Party Approvals:</strong> Optional dual-confirmation workflow for large household purchases over a set threshold.</li>
            </ul>
          </section>

          <section id="mode-business" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Business Mode
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              High-throughput financial operations for distributed teams, startups, and Web3 agencies:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-700 font-medium">
              <li><strong>Team Role-Based Access:</strong> Admin, Manager, and Employee permission tiers.</li>
              <li><strong>Verifiable Expense Reimbursements:</strong> Employees submit OCR-parsed receipts; managers approve and reimburse in USDC via Monad.</li>
              <li><strong>Anti-Duplicate Protection:</strong> Smart contract invariant rejects duplicate receipt claims automatically.</li>
              <li><strong>Auditor Export Packages:</strong> One-click generation of <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">clario-export.zip</code> containing canonical JSON and evidence digests.</li>
            </ul>
          </section>
        </div>
      );

    // ==========================================
    // 4. AI & OCR Intelligence
    // ==========================================
    case "ai-copilot":
      return (
        <div className="space-y-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#121212] bg-purple-100 px-3 py-1 font-mono text-xs font-black uppercase text-purple-800 shadow-[2px_2px_0_0_#121212]">
              <Cpu className="h-3.5 w-3.5" />
              <span>Advisory Intelligence</span>
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black font-sans tracking-tight text-[#121212]">
              AI & Multimodal OCR
            </h1>
            <p className="mt-3 text-base text-slate-600 font-medium leading-relaxed max-w-3xl">
              How Clario uses Google Gemini 2.5 Flash for multimodal receipt extraction and Copilot financial anomaly detection while preserving strict non-authoritative boundaries.
            </p>
          </div>

          <AiBoundaryDiagram />

          <section id="ai-principles" className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> AI Has No Authority Invariant
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              A foundational design principle in Clario is: <strong>AI is advisory, never authoritative</strong>. Large Language Models (LLMs) and vision transformers are probabilistic. They hallucinate, misread faded thermal paper, or misinterpret currencies. In financial accounting, probabilistic guesses cannot determine balances or legal ownership.
            </p>
            <DocCallout type="important" title="FOUNDER INVARIANT #5">
              The AI engine cannot execute transfers, cannot commit onchain records, cannot overwrite historical data, and cannot approve reimbursements without explicit human signature.
            </DocCallout>
          </section>

          <section id="gemini-ocr" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Multimodal Gemini 2.5 Flash OCR
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              When a user uploads a receipt photograph (JPEG, PNG, WEBP), it is processed via Gemini 2.5 Flash with structured JSON schema constraints:
            </p>
            <DocCodeBlock
              filename="apps/web/src/lib/ocr/gemini.ts"
              language="typescript"
              code={`// Gemini 2.5 Flash Structured OCR Extraction
export const RECEIPT_SCHEMA = {
  type: "object",
  properties: {
    merchant: { type: "string", description: "Merchant / Vendor name" },
    date: { type: "string", description: "Transaction date in ISO-8601 YYYY-MM-DD" },
    total: { type: "number", description: "Final amount including tax" },
    currency: { type: "string", description: "3-letter currency code (e.g., USD, EUR)" },
    tax: { type: "number", description: "Sales tax or VAT if itemized" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          amount: { type: "number" },
          quantity: { type: "number" }
        }
      }
    }
  },
  required: ["merchant", "date", "total", "currency"]
};`}
            />
          </section>

          <section id="anomaly-detection" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Rule 40 Anomaly Engine
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              The Clario Copilot evaluates outgoing transactions against heuristic rules to flag potential issues before month-end reconciliations:
            </p>
            <DocTable
              headers={["Heuristic Rule", "Trigger Condition", "Copilot Signal"]}
              rows={[
                ["Spike Detection", "Amount > 2.5x 90-day category average", "Unusual high-spend alert"],
                ["Missing Evidence", "Business expense > $75 without attached receipt", "IRS compliance reminder"],
                ["Potential Duplicate", "Identical amount & merchant within 48 hours", "Double-charge check requested"],
                ["Subscription Creep", "Recurring vendor charge increases by > 15%", "Price hike notification"],
              ]}
            />
          </section>
        </div>
      );

    // ==========================================
    // 5. System Architecture
    // ==========================================
    case "architecture":
      return (
        <div className="space-y-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#121212] bg-emerald-100 px-3 py-1 font-mono text-xs font-black uppercase text-emerald-800 shadow-[2px_2px_0_0_#121212]">
              <Cpu className="h-3.5 w-3.5" />
              <span>Full Stack Blueprint</span>
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black font-sans tracking-tight text-[#121212]">
              System Architecture
            </h1>
            <p className="mt-3 text-base text-slate-600 font-medium leading-relaxed max-w-3xl">
              Detailed technical blueprint of Clario’s hybrid offchain/onchain infrastructure, database topology, and client-server security boundaries.
            </p>
          </div>

          <ClarioPipelineDiagram />
          <DataSeparationDiagram />

          <section id="component-stack" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Technology Infrastructure
            </h2>
            <DocTable
              headers={["Component", "Provider / Tech", "Role in Clario"]}
              rows={[
                ["Web Framework", "Next.js 15 (App Router)", "High-performance React frontend, Server Components, API routes"],
                ["Authentication", "Privy", "Non-custodial EVM embedded wallets & multi-wallet external linking"],
                ["Database & Auth", "Supabase (PostgreSQL 15)", "Relational ledger, Row Level Security (RLS), real-time synchronization"],
                ["Storage", "Supabase Storage", "Private encrypted buckets for receipt photos and PDF evidence"],
                ["Blockchain Ingestion", "Alchemy Asset Transfers API", "Historical multi-chain activity indexing across 8+ EVM networks"],
                ["Consensus & Proofs", "Monad Testnet (Chain ID 10143)", "Sub-second 10,000 TPS registry for cryptographic receipt commitments"],
                ["Smart Contracts", "Solidity (ClarioRegistry.sol)", "Immutable commitment storage and duplicate reimbursement prevention"],
                ["Verification Engine", "Standalone Node/TS CLI", "RFC 8785 canonical JSON serializer and offline proof auditor"],
              ]}
            />
          </section>

          <section id="data-isolation" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> State Separation & Vault Model
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              Clario enforces strict physical and logical boundaries between private evidence and public consensus. The Monad blockchain acts as an <strong>immutable notary</strong>—it never stores transaction amounts, merchant names, or employee notes. It stores only 32-byte cryptographic hashes that prove the private evidence has not been tampered with since creation.
            </p>
          </section>
        </div>
      );

    // ==========================================
    // 6. Verification Engine
    // ==========================================
    case "verification":
      return (
        <div className="space-y-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#121212] bg-[#836EF9]/10 px-3 py-1 font-mono text-xs font-black uppercase text-[#836EF9] shadow-[2px_2px_0_0_#121212]">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Independent Proof Engine</span>
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black font-sans tracking-tight text-[#121212]">
              Verification Engine
            </h1>
            <p className="mt-3 text-base text-slate-600 font-medium leading-relaxed max-w-3xl">
              How Clario produces deterministic cryptographic proofs using RFC 8785 canonical JSON, SHA-256 evidence digests, and Keccak-256 commitments anchored to Monad.
            </p>
          </div>

          <section id="canonical-json" className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Canonical JSON (RFC 8785)
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              Standard JSON serializers (<code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">JSON.stringify</code>) do not guarantee deterministic output. Key ordering varies across engines, whitespace changes byte length, and float representations differ. Clario implements an RFC 8785 canonical JSON serializer ensuring bit-exact hashing across any programming language:
            </p>
            <DocCodeBlock
              filename="apps/web/src/lib/verification/canonical.ts"
              language="typescript"
              code={`// RFC 8785 Canonical JSON Serialization
export function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalizeJson).join(",") + "]";
  }
  // Deterministic lexicographical key sorting
  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = sortedKeys.map(
    (key) => JSON.stringify(key) + ":" + canonicalizeJson((obj as Record<string, unknown>)[key])
  );
  return "{" + pairs.join(",") + "}";
}`}
            />
          </section>

          <section id="commitment-generation" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Commitment Hashing Algorithm
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              The receipt commitment is generated through a dual-stage hashing pipeline:
            </p>
            <ol className="list-decimal pl-5 space-y-2 text-xs text-slate-700 font-medium">
              <li>
                <strong>Evidence Digest (SHA-256):</strong> Binary hash of the raw receipt image or PDF file:
                <br />
                <code className="font-mono text-[#836EF9] font-bold">evidenceDigest = sha256(rawReceiptImageBytes)</code>
              </li>
              <li>
                <strong>Receipt Payload Hash (Keccak-256):</strong> Hash of the RFC 8785 canonical metadata:
                <br />
                <code className="font-mono text-[#836EF9] font-bold">metadataHash = keccak256(canonicalizeJson(metadata))</code>
              </li>
              <li>
                <strong>Final Commitment Root:</strong>
                <br />
                <code className="font-mono text-[#836EF9] font-bold">commitmentRoot = keccak256(abi.encodePacked(metadataHash, evidenceDigest))</code>
              </li>
            </ol>
          </section>

          <section id="independent-verifier" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Independent Verifier CLI
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              Anyone can audit a Clario export bundle (<code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">clario-export.zip</code>) offline without communicating with Clario’s servers. Run the open-source CLI:
            </p>
            <DocCodeBlock
              filename="Terminal"
              language="bash"
              code={`# Verify Clario receipt package against public Monad Testnet RPC
pnpm verify:package -- ./clario-export.zip --rpc https://testnet-rpc.monad.xyz

# Expected CLI Output:
# [✓] Extracted clario-export.zip
# [✓] Canonical JSON valid (RFC 8785)
# [✓] SHA-256 evidence image digest matches
# [✓] Recomputed commitment: 0x4a8f9c...
# [✓] Monad Testnet block #1294819 verified:
#     - Anchor TX: 0x7c9b...
#     - Submitter: 0xF929...B859
#     - Status: VERIFIED & UNTAMPERED`}
            />
          </section>
        </div>
      );

    // ==========================================
    // 7. Monad Integration
    // ==========================================
    case "monad-integration":
      return (
        <div className="space-y-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#121212] bg-[#836EF9]/10 px-3 py-1 font-mono text-xs font-black uppercase text-[#836EF9] shadow-[2px_2px_0_0_#121212]">
              <MonadLogo className="h-3.5 w-3.5" />
              <span>Consensus & Settlement Layer</span>
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black font-sans tracking-tight text-[#121212]">
              Monad Integration
            </h1>
            <p className="mt-3 text-base text-slate-600 font-medium leading-relaxed max-w-3xl">
              Why Clario chose Monad for onchain cryptographic anchoring, network parameters, deployed smart contracts, and USDC settlement asset specs.
            </p>
          </div>

          <DocStatGrid
            items={[
              { label: "Network", value: "Monad Testnet", badge: "Live" },
              { label: "Chain ID", value: "10143", badge: "EVM" },
              { label: "Throughput", value: "10,000 TPS", badge: "Async Execution" },
              { label: "Finality", value: "1 Second", badge: "Single Slot" },
              { label: "Gas Cost", value: "< $0.0001", badge: "Micro-commitments" },
              { label: "Settlement Asset", value: "USDC (6 dec)", badge: "0x7547...b603" },
            ]}
          />

          <section id="why-monad" className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Why Monad?
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              Anchoring high-volume micro-receipts and expense commitments on Ethereum L1 or traditional rollups is economically unfeasible ($1.50–$15 per transaction) and too slow for real-time user checkout.
            </p>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              Monad introduces <strong>asynchronous execution</strong> and <strong>pipelined consensus</strong>, delivering 10,000 transactions per second with 1-second single-slot finality. For Clario, this enables anchoring every single coffee receipt, subway ticket, or enterprise invoice commitment for fractions of a cent, with instant UI confirmation.
            </p>
          </section>

          <section id="smart-contracts" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Deployed Smart Contracts
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              The Clario registry smart contract is deployed on Monad Testnet:
            </p>
            <DocTable
              headers={["Contract Name", "Network", "Contract Address", "Explorer"]}
              rows={[
                [
                  "ClarioTransactionRegistry",
                  "Monad Testnet (10143)",
                  <code key="addr" className="font-mono text-xs font-bold text-[#836EF9]">
                    0x92f9B76673C1D88c9E3c490A88eB95b08823bA87
                  </code>,
                  <a
                    key="link"
                    href="https://testnet.monadexplorer.com/address/0x92f9B76673C1D88c9E3c490A88eB95b08823bA87"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-xs text-[#836EF9] hover:underline"
                  >
                    View Explorer <ExternalLink className="h-3 w-3" />
                  </a>,
                ],
              ]}
            />
          </section>

          <section id="settlement-asset" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Supported USDC Settlement Asset
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              For business and freelance expense reimbursements, Clario integrates with the official Monad Testnet USDC token:
            </p>
            <DocCodeBlock
              filename="Solidity Interface"
              language="solidity"
              code={`// Monad Testnet USDC Contract
address constant MONAD_TESTNET_USDC = 0x754704Bc059F8C67012fEd69BC8A327a5aafb603;
uint8 constant USDC_DECIMALS = 6;

// Anti-duplicate reimbursement check
function reimburseExpense(
    bytes32 commitmentHash,
    address payable recipient,
    uint256 amountUsdc
) external nonReentrant {
    require(!reimbursedCommitments[commitmentHash], "Clario: Already reimbursed");
    reimbursedCommitments[commitmentHash] = true;
    IERC20(MONAD_TESTNET_USDC).safeTransferFrom(msg.sender, recipient, amountUsdc);
    emit ExpenseReimbursed(commitmentHash, recipient, amountUsdc);
}`}
            />
          </section>
        </div>
      );

    // ==========================================
    // 8. Privy Authentication
    // ==========================================
    case "privy-auth":
      return (
        <div className="space-y-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#121212] bg-amber-100 px-3 py-1 font-mono text-xs font-black uppercase text-amber-800 shadow-[2px_2px_0_0_#121212]">
              <Wallet className="h-3.5 w-3.5" />
              <span>Identity & Signers</span>
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black font-sans tracking-tight text-[#121212]">
              Privy Authentication
            </h1>
            <p className="mt-3 text-base text-slate-600 font-medium leading-relaxed max-w-3xl">
              Non-custodial user onboarding with embedded EVM wallets, hardware security enclave isolation, external wallet connectors, and custom wallet nicknames.
            </p>
          </div>

          <section id="auth-model" className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Privy Identity Model
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              Clario uses Privy to eliminate seed-phrase friction without sacrificing decentralization. When a user signs in via Email, SMS, or Google, Privy automatically generates a self-custodial embedded EVM wallet protected by Shamir Secret Sharing and user PIN recovery. The user retains sole signing authority; Clario servers never hold private keys.
            </p>
          </section>

          <section id="custom-chain-injection" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Viem Monad Chain Injection
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              Monad Testnet is defined as a custom Viem chain and injected into Privy provider options:
            </p>
            <DocCodeBlock
              filename="apps/web/src/components/providers/privy-provider.tsx"
              language="typescript"
              code={`import { defineChain } from "viem";

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] },
    public: { http: ["https://testnet-rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: { name: "MonadExplorer", url: "https://testnet.monadexplorer.com" },
  },
  testnet: true,
});`}
            />
          </section>
        </div>
      );

    // ==========================================
    // 9. Alchemy Ingestion
    // ==========================================
    case "alchemy-ingestion":
      return (
        <div className="space-y-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#121212] bg-blue-100 px-3 py-1 font-mono text-xs font-black uppercase text-blue-800 shadow-[2px_2px_0_0_#121212]">
              <Database className="h-3.5 w-3.5" />
              <span>Multi-Chain Data Indexing</span>
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black font-sans tracking-tight text-[#121212]">
              Alchemy Ingestion
            </h1>
            <p className="mt-3 text-base text-slate-600 font-medium leading-relaxed max-w-3xl">
              Multi-chain EVM transaction retrieval using Alchemy Asset Transfers API with 8 strict ingestion and deduplication rules.
            </p>
          </div>

          <section id="alchemy-role" className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Role of Alchemy in Clario
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              While Monad Testnet provides direct RPC access for receipt registry lookups, Clario monitors the user’s broader crypto holdings across Ethereum Mainnet, Base, Sepolia, and other EVM networks via Alchemy’s Asset Transfers API.
            </p>
          </section>

          <section id="ingestion-rules" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Strict 8 Ingestion Rules
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              Implemented in <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">apps/web/src/lib/import/alchemy.ts</code> to prevent data poisoning:
            </p>
            <ol className="list-decimal pl-5 space-y-2 text-xs text-slate-700 font-medium">
              <li><strong>Zero-Value Filtering:</strong> Drop spam token drops with zero monetary value.</li>
              <li><strong>Unique Composite Key:</strong> Deduplicate by <code className="font-mono text-[#836EF9]">(chainId, txHash, logIndex)</code>.</li>
              <li><strong>Decimal Normalization:</strong> Convert raw wei/units using authoritative contract metadata (e.g. 6 decimals for USDC, 18 for MON/ETH).</li>
              <li><strong>Directional Classification:</strong> Tag transactions as INCOMING, OUTGOING, or SELF_TRANSFER.</li>
              <li><strong>Failed Transaction Preservation:</strong> Mark reverted transactions with <code className="font-mono text-rose-600">REVERTED</code> status; never drop them silently.</li>
              <li><strong>Gas Fee Attribution:</strong> Calculate gas cost in native token and record as separate operational expense.</li>
              <li><strong>Timestamp Harmonization:</strong> Normalize block timestamps to ISO-8601 UTC strings.</li>
              <li><strong>Currency Whitelisting:</strong> Validate token contract addresses against verified asset directories.</li>
            </ol>
          </section>
        </div>
      );

    // ==========================================
    // 10. Database & Storage
    // ==========================================
    case "supabase-schema":
      return (
        <div className="space-y-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#121212] bg-emerald-100 px-3 py-1 font-mono text-xs font-black uppercase text-emerald-800 shadow-[2px_2px_0_0_#121212]">
              <Database className="h-3.5 w-3.5" />
              <span>PostgreSQL & Storage</span>
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black font-sans tracking-tight text-[#121212]">
              Database & Storage Architecture
            </h1>
            <p className="mt-3 text-base text-slate-600 font-medium leading-relaxed max-w-3xl">
              PostgreSQL schema, Row Level Security (RLS) isolation, and private encrypted object storage buckets in Supabase.
            </p>
          </div>

          <section id="core-tables" className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Core Relational Tables
            </h2>
            <DocTable
              headers={["Table Name", "Primary Key", "Key Columns", "Description"]}
              rows={[
                ["profiles", "id (uuid)", "privy_did, wallet_address, wallet_nickname, active_mode", "User account profile & preferences"],
                ["transactions", "id (uuid)", "user_id, hash, chain_id, amount, currency, category, status", "Unified multi-chain financial records"],
                ["receipts", "id (uuid)", "user_id, transaction_id, image_url, merchant_name, total_amount, ocr_json", "Offchain receipt scans & OCR data"],
                ["saved_receipt_bundles", "id (uuid)", "bundle_hash, root_commitment, tx_hashes, monad_tx_hash, status", "Anchored receipt packages with Monad proofs"],
                ["budgets", "id (uuid)", "user_id, category, monthly_limit, spent_amount, mode", "Category budget thresholds"],
                ["subscriptions", "id (uuid)", "user_id, name, amount, billing_cycle, next_renewal_date", "Detected recurring software & bills"],
                ["clients", "id (uuid)", "user_id, name, email, billing_rate, currency", "Freelancer client directory"],
                ["invoices", "id (uuid)", "user_id, client_id, invoice_number, total, due_date, status", "Verifiable client invoices"],
              ]}
            />
          </section>

          <section id="rls-policies" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Row Level Security Policies
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              Every table enforces strict Row Level Security (RLS) bound to the authenticated user ID. Users can never query or mutate another user’s records directly:
            </p>
            <DocCodeBlock
              filename="PostgreSQL RLS Policy"
              language="sql"
              code={`-- Restrict access to authenticated profile owner
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own transactions"
ON transactions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);`}
            />
          </section>
        </div>
      );

    // ==========================================
    // 11. Security & Threat Model
    // ==========================================
    case "security":
      return (
        <div className="space-y-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#121212] bg-rose-100 px-3 py-1 font-mono text-xs font-black uppercase text-rose-800 shadow-[2px_2px_0_0_#121212]">
              <Lock className="h-3.5 w-3.5" />
              <span>Hardened Defense</span>
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black font-sans tracking-tight text-[#121212]">
              Security & Threat Model
            </h1>
            <p className="mt-3 text-base text-slate-600 font-medium leading-relaxed max-w-3xl">
              Cryptographic separation, zero private key custody, envelope encryption for evidence, and onchain double-reimbursement prevention.
            </p>
          </div>

          <section id="threat-model" className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Threat Model & Trust Boundaries
            </h2>
            <DocTable
              headers={["Threat Vector", "Risk", "Clario Countermeasure"]}
              rows={[
                ["Server Breach", "Exfiltration of user private keys", "Impossible: Clario servers never hold or generate private keys (Privy client-side enclave)."],
                ["Database Tampering", "Malicious modification of receipt amounts", "Impossible: Tampering breaks the Keccak-256 root anchored on Monad Testnet."],
                ["Public PII Leakage", "Tax numbers & itemized purchases leaked onchain", "Impossible: Only 32-byte commitment hashes touch Monad; evidence stays in private buckets."],
                ["Double Reimbursement", "Resubmitting identical receipt in two modes", "Impossible: Smart contract marks commitment hash as reimbursed; subsequent claims revert."],
              ]}
            />
          </section>

          <section id="envelope-encryption" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Envelope Encryption
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              Receipt documents are protected using envelope encryption. A unique Data Encryption Key (DEK) encrypts the file at rest, and the DEK is encrypted with a master Key Encryption Key (KEK) managed in secure key infrastructure.
            </p>
          </section>
        </div>
      );

    // ==========================================
    // 12. Environment Variables
    // ==========================================
    case "environment-variables":
      return (
        <div className="space-y-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#121212] bg-slate-100 px-3 py-1 font-mono text-xs font-black uppercase text-slate-800 shadow-[2px_2px_0_0_#121212]">
              <Code2 className="h-3.5 w-3.5" />
              <span>Configuration Matrix</span>
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black font-sans tracking-tight text-[#121212]">
              Environment Variables
            </h1>
            <p className="mt-3 text-base text-slate-600 font-medium leading-relaxed max-w-3xl">
              Complete catalog of public client variables vs server-only secrets with safe placeholders.
            </p>
          </div>

          <section id="public-vars" className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Public Client Variables (NEXT_PUBLIC_*)
            </h2>
            <DocTable
              headers={["Variable Name", "Required", "Example / Default", "Purpose"]}
              rows={[
                ["NEXT_PUBLIC_PRIVY_APP_ID", "Yes", "clx...", "Privy project ID for non-custodial auth"],
                ["NEXT_PUBLIC_SUPABASE_URL", "Yes", "https://xyz.supabase.co", "Supabase project REST & storage endpoint"],
                ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "Yes", "eyJhbGci...", "Supabase anonymous public key (protected by RLS)"],
                ["NEXT_PUBLIC_MONAD_CHAIN_ID", "Yes", "10143", "Monad Testnet Chain ID"],
                ["NEXT_PUBLIC_MONAD_RPC_URL", "Yes", "https://testnet-rpc.monad.xyz", "Official Monad Testnet EVM RPC"],
                ["NEXT_PUBLIC_MONAD_REGISTRY_ADDRESS", "Yes", "0x92f9B76673C1D88c9E3c490A88eB95b08823bA87", "ClarioRegistry Solidity contract address"],
              ]}
            />
          </section>

          <section id="server-secrets" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Server-Only Secrets
            </h2>
            <DocTable
              headers={["Variable Name", "Required", "Purpose"]}
              rows={[
                ["ALCHEMY_API_KEY", "Yes", "Alchemy API key for multi-chain transfer indexing (server-only secret)."],
                ["SUPABASE_SERVICE_ROLE_KEY", "Yes", "Bypasses RLS for secure backend administrative tasks and webhook processing."],
                ["GEMINI_API_KEY", "Yes", "Google AI API key for Gemini 2.5 Flash multimodal vision receipt OCR."],
              ]}
            />
          </section>
        </div>
      );

    // ==========================================
    // 13. Metropolis Hackathon
    // ==========================================
    case "metropolis-hackathon":
      return (
        <div className="space-y-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#121212] bg-[#836EF9]/10 px-3 py-1 font-mono text-xs font-black uppercase text-[#836EF9] shadow-[2px_2px_0_0_#121212]">
              <MonadLogo className="h-3.5 w-3.5" />
              <span>Submission Dossier</span>
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black font-sans tracking-tight text-[#121212]">
              Metropolis Hackathon Documentation
            </h1>
            <p className="mt-3 text-base text-slate-600 font-medium leading-relaxed max-w-3xl">
              Submission alignment, contract provenance, architecture verification, AI disclosure, and judge reproducibility instructions.
            </p>
          </div>

          <section id="track-problem-solution" className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Track, Problem & Solution
            </h2>
            <DocTable
              headers={["Item", "Submission Detail"]}
              rows={[
                ["Hackathon Track", "Fintech & Consumer / Infrastructure Track"],
                ["Core Problem", "Digital financial accounting tools fail to provide tamper-proof evidence provenance, while Web3 solutions lack offchain receipt privacy and cannot handle high transaction volumes without cost explosion."],
                ["Clario Solution", "A unified multi-mode financial platform combining AI-assisted OCR with RFC 8785 canonical hashing and high-speed cryptographic anchoring to the Monad network."],
              ]}
            />
          </section>

          <section id="monad-evaluation" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Why Monad is Essential
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              Clario cannot function as a consumer-scale receipt registry on standard EVM rollups. Anchoring every daily coffee receipt or grocery purchase on a network charging $0.50 gas makes cryptographic accounting economically impossible. Monad’s 10,000 TPS, 1-second single-slot finality, and sub-cent fees enable continuous, real-time proof anchoring at global consumer scale.
            </p>
          </section>

          <section id="ai-disclosure" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> AI Usage Disclosure
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              In compliance with Metropolis Hackathon guidelines, AI usage is transparently disclosed:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-700 font-medium">
              <li><strong>Google Gemini 2.5 Flash:</strong> Used exclusively for optical character recognition (OCR) of receipt images into draft JSON schemas.</li>
              <li><strong>Copilot Heuristics:</strong> Rule-based anomaly evaluation (Rule 40) for spending velocity and missing attachments.</li>
              <li><strong>Strict Limitation:</strong> AI has zero authorization privileges. It cannot sign transactions, execute transfers, or alter canonical ledger balances.</li>
            </ul>
          </section>

          <section id="open-source-license" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Open Source License & Attribution
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              Clario is open-source under the <strong>MIT License</strong>. Attribution is provided for open-source libraries including Viem, Privy SDK, Alchemy SDK, and Motion Primitives.
            </p>
          </section>

          <section id="reproducibility-guide" className="space-y-4 pt-4 border-t-2 border-[#121212]/10 scroll-mt-24">
            <h2 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wide text-[#121212] flex items-center gap-2">
              <span className="text-[#836EF9]">#</span> Judge Verification Guide
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              Judges can test the complete end-to-end receipt anchoring flow:
            </p>
            <ol className="list-decimal pl-5 space-y-2 text-xs text-slate-700 font-medium">
              <li>Launch Clario: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">pnpm dev</code> and open <code className="font-mono text-[#836EF9]">http://localhost:3000</code>.</li>
              <li>Connect with Privy (Embedded wallet or MetaMask).</li>
              <li>Switch to <strong>Business Mode</strong> or <strong>Personal Mode</strong>.</li>
              <li>Upload a sample receipt in the <strong>Receipts</strong> tab. Gemini 2.5 Flash extracts fields in real time.</li>
              <li>Confirm receipt: Clario canonicalizes the metadata via RFC 8785 and computes the Keccak-256 commitment.</li>
              <li>Anchor on Monad: Click "Anchor on Monad" to write the commitment to contract <code className="font-mono text-[#836EF9]">0x92f9B76673C1D88c9E3c490A88eB95b08823bA87</code>.</li>
              <li>Export package: Download <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">clario-export.zip</code>.</li>
              <li>Verify offline: Run <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">pnpm verify:package -- ./clario-export.zip --rpc https://testnet-rpc.monad.xyz</code> to confirm zero-knowledge offline validity.</li>
            </ol>
          </section>
        </div>
      );

    default:
      return (
        <div className="py-12 text-center">
          <p className="font-mono text-sm text-slate-500 font-bold">
            Select a topic from the sidebar navigation.
          </p>
        </div>
      );
  }
}
