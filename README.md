# Clario

**Verifiable Financial Operating System & Cryptographic Expense Intelligence on Monad**

[![Monad Testnet](https://img.shields.io/badge/Monad-Testnet%20(10143)-836EF9?style=flat-square&logo=ethereum)](https://testnet.monadexplorer.com/address/0x92f9B76673C1D88c9E3c490A88eB95b08823bA87)
[![Foundry Tests](https://img.shields.io/badge/Foundry-115%2F115%20Tests%20Passing-black?style=flat-square&logo=solidity)](./contracts)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8%20Strict-blue?style=flat-square&logo=typescript)](./tsconfig.base.json)
[![Next.js](https://img.shields.io/badge/Next.js-15%20App%20Router-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![License](https://img.shields.io/badge/License-Apache%202.0-green?style=flat-square)](./LICENSE)

Clario is an open financial operating system engineered for crypto-native individuals, freelancers, households, and distributed organizations. It unifies offchain financial records (receipts, tax invoices, split ledgers, corporate reimbursement queues) with onchain EVM consensus, anchored by parallel EVM execution and sub-second finality on **Monad**.

---

## ⚡ Key Links & Live Deployments

| Resource | Link / Destination | Description |
|---|---|---|
| 🌐 **Live Web Application** | [www.useclario.xyz](https://www.useclario.xyz) | Production PWA connected to Monad Testnet and live indexers |
| 🎥 **Technical Demo Video** | [youtu.be/-A8oSLmlqxQ](https://youtu.be/-A8oSLmlqxQ) | End-to-end technical walkthrough of architecture, signing, and verification |
| 🔍 **Interactive Proof Center** | [useclario.xyz/proof](https://www.useclario.xyz/proof) | Live cryptographic verifier for onchain RFC 8785 hash commitments |
| 📜 **Monad Contract Explorer** | [`0x92f9...bA87` on MonadExplorer](https://testnet.monadexplorer.com/address/0x92f9B76673C1D88c9E3c490A88eB95b08823bA87) | Deployed `ClarioTransactionRegistry` on Monad Testnet (`chainId: 10143`) |
| 👁️ **MonadVision Explorer** | [`0x92f9...bA87` on MonadVision](https://testnet.monadvision.com/address/0x92f9B76673C1D88c9E3c490A88eB95b08823bA87) | Block inspector and state viewer on MonadVision |
| 📖 **Documentation Portal** | [useclario.xyz/docs](https://www.useclario.xyz/docs) · [Repo Docs](./docs) | Comprehensive technical architecture, API schemas, and security model |

---

## Executive Overview

Crypto transactions prove that tokens moved, but they cannot cryptographically explain **why** they moved, who authorized the payment, whether supporting invoices were altered after the fact, or whether an expense was reimbursed multiple times.

Clario resolves this fragmentation through an immutable, progressive verification pipeline:

```text
[Private Invoice / Receipt]
             │
             ▼
[Canonical RFC 8785 Digest] ──> [Salted SHA-256 Commitment (bytes32)]
                                                  │
                                                  ▼
                        [Monad Testnet Parallel EVM Consensus]
                        (ClarioTransactionRegistry • 0x92f9...bA87)
                                                  │
                    ┌─────────────────────────────┴─────────────────────────────┐
                    ▼                                                           ▼
         [Interactive Proof Center]                                 [Independent Verifier CLI]
             (/proof visualizer)                                     (Zero Backend Trust)
```

---

## Key Highlights

- **Parallel EVM Anchoring**: Transaction commitments and receipt bundles are anchored directly to `ClarioTransactionRegistry` on Monad Testnet (`chainId: 10143`) with sub-second finality.
- **Cryptographic Proof Center (`/proof`)**: Live onchain verification engine validates state integrity against Monad consensus without trusting intermediaries.
- **Four Purpose-Built Operating Modes**:
  - **Personal**: Real-time cash flow analytics, 7-dimensional expense filtering, category budgets with variance warnings, subscription auditor, confirmed receipt vault, and integrated Monad onchain transaction ledger with live RPC health monitoring.
  - **Freelancer**: Client CRM, sequential invoice generator with printable Neo-Brutalist invoice documents, tax write-off ledger, and Schedule C quarterly tax organizer.
  - **Family**: Multi-member household split engine (equal, custom %, exact amounts), shared budget alerts, recurring utilities tracker, and non-custodial IOU settlements.
  - **Business**: Role-separated team roster, corporate spend policy engine, receipt-attached reimbursement queue, manager approvals with reason commitments, and immutable audit logs.
- **Alchemy Multi-Chain Ingestion Engine**: Automated multi-chain ingestion across Ethereum, Base, Polygon, Arbitrum, and Optimism via Alchemy Transfers API with spam token filtering and historical price resolution. Monad activity is ingested via direct Monad RPC and explorer adapters.
- **Privy 1-Click Fast Signing & Embedded Wallets**: Seedless non-custodial EVM onboarding via Shamir Secret Sharing, 1-Click Session Signing (Privy Delegated Actions via `useDelegatedActions`) for zero-popup instantaneous onchain anchoring to Monad Testnet, native in-app wallet funding modal (`useFundWallet`), FIDO2 Passkeys, and multi-account linking.
- **Client-Side Privacy Engine**: Sensitive metadata is protected with client-side sanitization (`anonymizeCopilotContext`), scrubbing names, emails, phones, and wallet addresses before external transmission.
- **Clario Neo-Brutalist Design System**: High-contrast `border-2 border-black` borders, hard 2D offset box-shadows (`shadow-[4px_4px_0px_#000]`), monospace tracking badges, `.bg-grid` canvas, and Monad electric purple accent (`#836EF9`).

---

## Live Monad Testnet Deployments

Clario is deployed and active on **Monad Testnet**:

| Parameter | Value |
|---|---|
| **Network** | Monad Testnet |
| **Chain ID** | `10143` |
| **RPC Endpoint (Primary)** | `https://monad-testnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}` |
| **RPC Endpoint (Fallback)** | `https://testnet-rpc.monad.xyz` |
| **Native Asset** | `MON` |
| **Contract Address** | [`0x92f9B76673C1D88c9E3c490A88eB95b08823bA87`](https://testnet.monadexplorer.com/address/0x92f9B76673C1D88c9E3c490A88eB95b08823bA87) |
| **Monad Explorer** | [View on MonadExplorer](https://testnet.monadexplorer.com/address/0x92f9B76673C1D88c9E3c490A88eB95b08823bA87) |
| **MonadVision** | [View on MonadVision](https://testnet.monadvision.com/address/0x92f9B76673C1D88c9E3c490A88eB95b08823bA87) |
| **Deployment Tx** | [`0xd5643d9e4f468274fafe025ce9c1faa99aaf1e99ef5e94af52f72615346679f3`](https://testnet.monadexplorer.com/tx/0xd5643d9e4f468274fafe025ce9c1faa99aaf1e99ef5e94af52f72615346679f3) |
| **Deployer** | `0x678A34EE5138803549c3ea1E9a946AE9176A6f31` |
| **Block Number** | `67304188` |

### Smart Contract Architecture Tracks

1. **`ClarioTransactionRegistry` (Live on Monad Testnet)**:
   - Deployed at [`0x92f9B76673C1D88c9E3c490A88eB95b08823bA87`](https://testnet.monadexplorer.com/address/0x92f9B76673C1D88c9E3c490A88eB95b08823bA87).
   - Powers personal and universal expense commitments, cryptographic transaction hashes (`saveTransaction`), and canonical multi-transaction receipt bundles (`saveReceipt`).
   - Directly verified by the cryptographic Proof Center (`/proof`) and user receipt vaults.
2. **`protocol/v1` Modular Governance Suite**:
   - Located in `contracts/src/protocol/v1/` (`ClarioWorkspaceRegistryV1`, `ClarioExpenseRegistryV1`, `ClarioDecisionRegistryV1`, `ClarioSettlementRegistryV1`, `ClarioCommitmentV1`).
   - Implements multi-role corporate workspace governance (Submitter, Approver, Treasury), EIP-712 human reviewer approval signatures, and onchain USDC treasury settlement with reentrancy protection and duplicate settlement prevention.

---

## Architectural Principles & Security Invariants

Clario is architected around five strict security and privacy invariants:

1. **Private Evidence Stays Offchain**: Receipts, invoices, notes, and employee data remain encrypted offchain with AES-256-GCM envelope encryption and PostgreSQL Row Level Security (RLS). Only deterministic 32-byte cryptographic commitments touch Monad.
2. **Material Edits Create Immutable Versions**: Modifying an expense or invoice never overwrites historical records; each change creates a monotonic successor version bound to its predecessor.
3. **Approval Binds to Exact Version & Identity**: Reviewer approval binds cryptographically to the exact canonical hash and authorized human reviewer via EIP-712 typed data signatures.
4. **Duplicate Reimbursement Fails**: Reimbursement records enforce one active settlement per version with partial unique database constraints and onchain idempotency guards.
5. **AI Has No Authority**: AI extractions and copilot suggestions are strictly advisory and non-blocking. AI cannot sign, submit, approve, or disburse funds.

---

## Monorepo Structure

```text
clario/
├── apps/
│   └── web/              Next.js 15 App Router web application (PWA)
│                         ├── src/app/             Routes (dashboard, proof, receipts, budgets, subscriptions, settings)
│                         ├── src/components/      Neo-Brutalist UI components & mode dashboards
│                         └── src/lib/             Blockchain client, AI copilot, Alchemy import, Supabase client
├── packages/
│   ├── protocol/         Canonical schema v1, RFC 8785 canonicalization, golden vectors, export verifier
│   └── database/         PostgreSQL migrations, relational schema, RLS policies, in-memory test harness
├── contracts/            Foundry smart contract workspace
│   ├── src/              ClarioTransactionRegistry.sol and protocol v1 modular governance suite
│   └── test/             Foundry unit, fuzz, and integration test suites (102 tests)
├── docs/                 Technical specifications, system architecture, security model, and runbooks
│   ├── ARCHITECTURE.md   Comprehensive system design and topology
│   ├── SECURITY.md       Threat model, encryption boundaries, and invariants
│   ├── CANONICAL_SCHEMA_V1.md  Byte-level schema and commitment specification
│   ├── DEPLOYMENT_AND_VERIFICATION.md  Foundry and Monad deployment runbook
│   └── INDEPENDENT_VERIFIER.md         Standalone verifier usage and guarantees
└── scripts/              Deployment, database migration, verification, and end-to-end rehearsal scripts
```

---

## Technology Stack

- **Blockchain**: Monad Testnet (Parallel EVM, Chain ID `10143`), Foundry, Viem
- **Onchain Data Ingestion**: Alchemy Asset Transfers API (`alchemy_getAssetTransfers`), Alchemy Prices API, Monad Fallback RPC Scanner
- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS v4, Lucide Icons
- **Identity & Wallets**: Privy (Embedded Wallets, Shamir Secret Sharing, 1-Click Delegated Session Signing via `useDelegatedActions`, Native `useFundWallet` Modal, FIDO2 Passkeys, Multi-Account Linking, External EVM Connectors)
- **Database & Storage**: Supabase (PostgreSQL with Row Level Security, Storage Buckets)
- **AI & Copilot**: Groq, Google Gemini 2.5 Flash, Client-Side PII Redaction Engine
- **Quality Toolchain**: TypeScript (strict, `exactOptionalPropertyTypes`), Vitest, Forge, ESLint, Prettier

---

## Quickstart & Local Development

### 1. Prerequisites

- **Node.js**: `24.15.x` or later
- **pnpm**: `11.19.x`
- **Foundry**: Forge `1.7.x` or later

### 2. Install Dependencies

```bash
pnpm install --frozen-lockfile
```

### 3. Environment Configuration

Copy `.env.example` to `.env.local` in the project root:

```bash
cp .env.example .env.local
```

Configure your environment variables:

```env
# Monad Testnet Configuration
APP_ENV=local
CHAIN_FAMILY=monad
MONAD_CHAIN_ID=10143
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
NEXT_PUBLIC_CLARIO_REGISTRY_ADDRESS=0x92f9B76673C1D88c9E3c490A88eB95b08823bA87

# Alchemy API (Onchain Ingestion & Pricing)
ALCHEMY_API_KEY=your_alchemy_api_key

# Privy Non-Custodial Authentication
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
PRIVY_WEBHOOK_SECRET=your_privy_webhook_secret

# Supabase (PostgreSQL & Storage)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Optional Advisory AI Copilot
GEMINI_API_KEY=your_gemini_api_key
```

### 4. Run Test Suites & Quality Gates

```bash
# Typecheck all workspaces
pnpm typecheck

# Run unit tests (Vitest)
pnpm test:unit

# Run smart contract tests (Forge)
pnpm test:contracts

# Full monorepo check (lint, typecheck, test, build, format)
pnpm check
```

### 5. Start Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Smart Contract Testing & Deployment

### Run Foundry Tests

Execute the 102 smart contract tests with fuzzing:

```bash
forge test --root contracts -vvv
```

Test specifically the `ClarioTransactionRegistry` test suite:

```bash
forge test --root contracts --match-contract ClarioTransactionRegistryTest -vvv
```

### Deploy to Monad Testnet

```bash
# Using the deployment script
node scripts/deploy-registry.mjs --pk <DEPLOYER_PRIVATE_KEY>
```

---

## Independent Verifier CLI

Clario includes an independent verifier capable of validating exported proof packages offline or against public Monad consensus without needing an authenticated backend account:

```bash
# Verify export package against Monad Testnet
pnpm verify:package -- ./clario-export.zip --rpc https://testnet-rpc.monad.xyz
```

The verifier executes deterministic checks:
1. Reconstructs the canonical RFC 8785 JSON representation.
2. Computes the salted SHA-256 commitment hash.
3. Queries Monad Testnet RPC to confirm onchain commitment registration.
4. Confirms EIP-712 reviewer signature validity and absence of duplicate settlement.

---

## Alchemy Integration Architecture

Clario leverages Alchemy for high-performance RPC and multi-chain data synchronization:

1. **Alchemy Monad Testnet RPC**: High-throughput JSON-RPC transport (`https://monad-testnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`) for contract reads, gas estimation, and transaction submission, with automated zero-downtime fallback to public Monad endpoints.
2. **Pre-Flight Simulation**: Prior to prompting wallet signatures (`saveReceipt`, `saveTransaction`), Clario dry-runs `eth_call` and `eth_estimateGas` over Alchemy RPC to prevent failed or reverted transactions.
3. **Real-Time WebSockets**: Live event stream listening to `ReceiptSaved` and `TransactionSaved` emitted by `ClarioTransactionRegistry` (`0x92f9B76673C1D88c9E3c490A88eB95b08823bA87`), providing instant feedback matching Monad's 1-second block times.
4. **Multi-Chain Transfers & Historical Pricing**: Ingests multi-chain asset transfers across Ethereum, Base, Polygon, Arbitrum, and Optimism via `alchemy_getAssetTransfers`, coupled with exact USD price resolution at transaction block timestamps.

---

## Project Originality & Development Disclosure

In adherence to hackathon integrity, open-source transparency, and rigorous evaluation criteria:

### Inception & Development Timeline
- **Project Genesis**: Clario was initiated on **September 20, 2026** (initial commit [`7e76520`](https://github.com/syther069/clario/commit/7e76520)) and actively engineered and finalized through **October 11, 2026**.
- **Hackathon Status**: All application workflows, custom smart contracts, cryptographic verification pipelines, domain models, and user interfaces were conceived, designed, and built during this development window.

### Pre-Existing Components & Upstream Foundations
Clario builds on industry-standard open-source primitives and developer platforms rather than reinventing standard commodity infrastructure:
- **Frameworks & Libraries**: Next.js 15 (App Router), React 19, Tailwind CSS v4, Viem, Foundry (Forge), Lucide Icons, and Zod.
- **Embedded Wallets & Non-Custodial Auth**: Privy (`@privy-io/react-auth`) for Shamir Secret Sharing, FIDO2 Passkeys, and 1-Click Delegated Session Signing (`useDelegatedActions`).
- **Data Ingestion & RPC Infrastructure**: Alchemy Asset Transfers API (`alchemy_getAssetTransfers`), Alchemy Prices API, and Monad Testnet JSON-RPC (`https://monad-testnet.g.alchemy.com/v2/`).
- **Database & Blob Storage**: Supabase (PostgreSQL with Row Level Security and Encrypted Buckets).
- **Standards & Specifications**: RFC 8785 (JSON Canonicalization Scheme), EIP-712 (Typed Structured Data Hashing and Signing), and SHA-256 (FIPS 180-4).
- **Advisory AI APIs**: Google Gemini 2.5 Flash and Groq for multimodal receipt OCR and advisory copilot analysis.

### Original Works Engineered for Clario
The following core subsystems represent novel code and architectures created specifically for Clario:
1. **Parallel EVM Smart Contract Architecture**:
   - `ClarioTransactionRegistry.sol` (deployed on Monad Testnet at `0x92f9B76673C1D88c9E3c490A88eB95b08823bA87`): Custom onchain registry powering gas-efficient salted commitments for individual transactions (`saveTransaction`) and multi-transaction receipt bundles (`saveReceipt`).
   - `protocol/v1` Governance Suite: Complete modular enterprise suite (`ClarioWorkspaceRegistryV1`, `ClarioExpenseRegistryV1`, `ClarioDecisionRegistryV1`, `ClarioSettlementRegistryV1`, `ClarioCommitmentV1`) with 115 automated unit, fuzz, and invariant tests.
2. **Canonical RFC 8785 Verification Engine (`@clario/protocol`)**:
   - Deterministic schema serialization, golden vector test suites, and independent package verifier validating proof archives offline or against live Monad RPC without backend reliance.
3. **Domain-Driven Clean Architecture (`apps/web/src/core`)**:
   - Strict separation of Domain Entities, Use Cases, Repository Ports, and Infrastructure Storage Adapters for Personal, Freelancer, Family, and Business domains.
4. **Client-Side Privacy & Security Hardening**:
   - Zero-trust PII redaction pipeline (`anonymizeCopilotContext`), envelope encryption, sliding-window rate limiting, SSRF URL guards, and Svix-verified Privy webhook auditing.
5. **Progressive Proof Center & Neo-Brutalist UI**:
   - Interactive onchain proof verification explorer (`/proof`), high-contrast design system with Monad electric purple accent (`#836EF9`), and responsive tactile interactions.

### AI Assistance Disclosure
- **Coding Assistance**: AI coding assistants (Google Antigravity, Claude Code, Gemini 2.5 Flash, Groq) were leveraged as pair programming tools for test fixture generation, boilerplate drafting, and TypeScript type checking.
- **Human Technical Ownership**: System architecture, cryptographic proof schema, EIP-712 invariant guarantees, security boundary design, smart contract development, and final code reviews were designed, authored, and verified by human engineering leadership.
- **Strict Non-Custodial Invariant**: AI models maintain **zero** signing or fund execution authority in the running application. AI cannot sign, approve, execute, broadcast transactions, or move funds onchain.

---

## License

This project is licensed under the **Apache License, Version 2.0**. See the [LICENSE](./LICENSE) file for details.
