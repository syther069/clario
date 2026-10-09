# Clario

**Verifiable Financial Operating System on Monad**

Clario is a verifiable financial intelligence and expense management platform built for crypto-native individuals, freelancers, households, and enterprises. Private evidence stays encrypted and offchain while immutable state commitments, authorized decisions, receipt bundles, and settlement references are anchored and independently verifiable on **Monad**.

Built and verified for the **Monad Metropolis Hackathon**, Clario combines Monad's 10,000 TPS parallel EVM execution and sub-second finality with zero-leak cryptographic privacy, multi-chain transaction ingestion via Alchemy, and five purpose-built operating modes.

---

## Key Highlights

- **Parallel EVM Anchoring**: Transaction commitments and receipt bundles are anchored directly to `ClarioTransactionRegistry` on Monad Testnet (Chain ID `10143`).
- **Cryptographic Proof Center (`/proof`)**: Live onchain verification engine validates state integrity against Monad Testnet consensus without trusting intermediaries.
- **Five Dedicated Operating Modes**:
  - **Personal**: High-density cash flow analytics, 7-dimensional expense filters, category budgets with variance warnings, recurring subscription auditor, and confirmed receipt vault.
  - **Freelancer**: Client CRM, sequential invoice generator with printable Neo-Brutalist invoice documents, tax write-off ledger, and Schedule C quarterly tax organizer.
  - **Family**: Multi-member household split engine (equal, custom %, exact amounts), shared budget alerts, recurring utilities tracker, and non-custodial IOU settlements.
  - **Business**: Role-separated team roster, corporate spend policy engine, receipt-attached reimbursement queue, manager approvals with reason commitments, and immutable audit logs.
  - **Crypto / Monad**: Onchain transaction ingestion via Alchemy (`alchemy_getAssetTransfers`), multi-tier Monad RPC fallback, historical USD block valuation via DeFiLlama & Alchemy Prices, and onchain transaction registry.
- **Alchemy Multi-Chain Ingestion Engine**: Bidirectional transfer queries across Monad Testnet (`10143`), Monad Mainnet (`143`), Ethereum (`1`), and Base (`8453`) with spam token filtering and historical price resolution.
- **Advisory Grounded AI Financial Copilot**: Context-aware financial copilot powered by Groq and Gemini with automatic PII anonymization (`anonymizeCopilotContext`), scrubbing names, emails, phones, and wallet addresses before external transmission.
- **Montally Neo-Brutalist Design System**: High-contrast `border-2 border-black` borders, hard 2D offset box-shadows (`shadow-[4px_4px_0px_#000]`), monospace tracking badges, `.bg-grid` canvas, and Monad electric purple accent (`#836EF9`).

---

## Monad Testnet Deployments

Clario is deployed and active on **Monad Testnet**:

| Parameter | Value |
|---|---|
| **Network** | Monad Testnet |
| **Chain ID** | `10143` |
| **RPC Endpoint** | `https://testnet-rpc.monad.xyz` |
| **Currency** | `MON` |
| **Contract Address** | [`0x92f9B76673C1D88c9E3c490A88eB95b08823bA87`](https://testnet.monadexplorer.com/address/0x92f9B76673C1D88c9E3c490A88eB95b08823bA87) |
| **Monad Explorer** | [View on MonadExplorer](https://testnet.monadexplorer.com/address/0x92f9B76673C1D88c9E3c490A88eB95b08823bA87) |
| **MonadVision** | [View on MonadVision](https://testnet.monadvision.com/address/0x92f9B76673C1D88c9E3c490A88eB95b08823bA87) |
| **Deployment Tx** | [`0xd5643d9e4f468274fafe025ce9c1faa99aaf1e99ef5e94af52f72615346679f3`](https://testnet.monadexplorer.com/tx/0xd5643d9e4f468274fafe025ce9c1faa99aaf1e99ef5e94af52f72615346679f3) |
| **Deployer** | `0x678A34EE5138803549c3ea1E9a946AE9176A6f31` |
| **Block Number** | `67304188` |

### Smart Contract Architecture Tracks

Clario's onchain infrastructure operates across two purposeful tracks:

- **`ClarioTransactionRegistry` (Live on Monad Testnet)**:
  - Deployed at [`0x92f9B76673C1D88c9E3c490A88eB95b08823bA87`](https://testnet.monadexplorer.com/address/0x92f9B76673C1D88c9E3c490A88eB95b08823bA87).
  - Powers personal and universal expense commitments, cryptographic transaction hashes (`saveTransaction`), and canonical multi-transaction receipt bundles (`saveReceipt`).
  - Directly verified by the cryptographic Proof Center (`/proof`) and user receipt vaults.
- **`protocol/v1` Modular Governance Suite**:
  - Located in `contracts/src/protocol/v1/` (`ClarioWorkspaceRegistryV1`, `ClarioExpenseRegistryV1`, `ClarioDecisionRegistryV1`, `ClarioSettlementRegistryV1`, `ClarioCommitmentV1`).
  - Implements multi-role corporate workspace governance (Submitter, Approver, Treasury), EIP-712 human reviewer approval signatures, and onchain USDC treasury settlement with reentrancy protection and duplicate settlement prevention.

---

## Architectural Principles & Founder Invariants

Clario is architected around five strict security and privacy invariants:

1. **Private Evidence Stays Offchain**: Receipts, invoices, notes, and employee data remain encrypted in Supabase with Row Level Security (RLS) policies. Only deterministic cryptographic commitments (`bytes32` hashes) touch Monad.
2. **Material Edits Create Immutable Versions**: Modifying an expense or invoice never overwrites historical records; each change creates a monotonic successor version bound to its predecessor.
3. **Approval Binds to Exact Version & Identity**: Reviewer approval binds cryptographically to the exact canonical hash and authorized human reviewer via EIP-712 typed data signatures.
4. **Duplicate Reimbursement Fails**: Reimbursement records enforce one active settlement per version with partial unique database constraints and onchain idempotency guards.
5. **AI Has No Authority**: AI extractions and copilot suggestions are strictly advisory and non-blocking. AI cannot sign, submit, approve, or disburse funds.

---

## Monorepo Workspace

```text
clario/
├── apps/
│   └── web/              Next.js 15 App Router web application (PWA)
│                         ├── src/app/             Routes (dashboard, proof, receipts, budgets, subscriptions)
│                         ├── src/components/      Montally Neo-Brutalist UI components & mode dashboards
│                         └── src/lib/             Blockchain client, AI copilot, Alchemy import, Supabase client
├── packages/
│   ├── protocol/         Shared canonical schema v1, RFC 8785 canonicalization, golden vectors, export verification
│   └── database/         PostgreSQL migrations, relational schema, RLS security policies, event indexing projections
├── contracts/            Foundry smart contract workspace
│   ├── src/              ClarioTransactionRegistry.sol and protocol v1 modular registries
│   └── test/             Foundry unit, fuzz, and integration test suites
└── scripts/              Deployment, database migration, verification, and end-to-end rehearsal scripts
```

---

## Technology Stack

- **Blockchain**: Monad Testnet (Parallel EVM, Chain ID `10143`), Foundry, Viem
- **Onchain Data Ingestion**: Alchemy Asset Transfers API (`alchemy_getAssetTransfers`), Alchemy Prices API, Monad Fallback RPC Scanner
- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS v4, Lucide Icons
- **Identity & Wallets**: Privy (Embedded Wallets, External EVM Wallets, Linked Accounts)
- **Database & Storage**: Supabase (PostgreSQL with Row Level Security, Storage Buckets)
- **AI & Copilot**: Groq, Google Gemini 2.5 Flash, Client-Side PII Redaction Engine
- **Quality Toolchain**: TypeScript (strict, `exactOptionalPropertyTypes`), Vitest, Forge, ESLint, Prettier

---

## Requirements

- Node.js `24.15.x`
- pnpm `11.19.x`
- Foundry with Forge `1.7.x`

---

## Setup & Local Development

### 1. Install Dependencies

```bash
pnpm install --frozen-lockfile
```

### 2. Configure Environment

Copy `.env.example` to `.env.local` in `apps/web/`:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Configure your environment variables:

```env
# Monad Testnet Configuration
NEXT_PUBLIC_MONAD_TESTNET_RPC=https://testnet-rpc.monad.xyz
NEXT_PUBLIC_MONAD_CHAIN_ID=10143
NEXT_PUBLIC_CLARIO_REGISTRY_ADDRESS=0x92f9B76673C1D88c9E3c490A88eB95b08823bA87

# Alchemy API (Onchain Ingestion & Pricing)
ALCHEMY_API_KEY=your_alchemy_api_key

# Privy Authentication
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret

# Supabase (PostgreSQL & Storage)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Advisory AI
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key
```

### 3. Run Quality Gate & Tests

```bash
# Typecheck all workspaces
pnpm typecheck

# Run all unit tests (Vitest)
pnpm test:unit

# Run all smart contract tests (Forge)
pnpm test:contracts

# Full monorepo check (lint, typecheck, test, build, format)
pnpm check
```

### 4. Start Local Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Smart Contracts

### Foundry Suite

Run all 102 smart contract tests with fuzzing:

```bash
forge test --root contracts -vvv
```

Run specifically the `ClarioTransactionRegistry` test suite:

```bash
forge test --root contracts --match-contract ClarioTransactionRegistryTest -vvv
```

### Deploy to Monad Testnet

```bash
# Using Foundry keystore
forge create src/ClarioTransactionRegistry.sol:ClarioTransactionRegistry \
  --rpc-url https://testnet-rpc.monad.xyz \
  --account monad-deployer \
  --broadcast

# Or using the Clario deployment script
node scripts/deploy-registry.mjs --pk <YOUR_PRIVATE_KEY>
```

---

## Alchemy Integration (Metropolis Bounty)

Clario integrates Alchemy as its primary **Onchain Transaction Ingestion & Historical Valuation Engine**:

1. **Alchemy Asset Transfers API (`alchemy_getAssetTransfers`)**:
   - Performs bidirectional transfer queries (`fromAddress` and `toAddress`) for connected EVM wallets.
   - Operates across **Monad Testnet (`10143`)**, Monad Mainnet (`143`), Ethereum (`1`), and Base (`8453`).
   - Automatically filters failed transactions, zero-value contract interactions, and spam tokens.
2. **Alchemy Token Prices API**:
   - Resolves exact historical USD valuations at historical block timestamps (`pricing.ts`), ensuring ledger entries are never recorded with $0 or guessed figures.
3. **Alchemy Monad Testnet RPC**:
   - High-throughput RPC connectivity (`eth_getTransactionByHash`, `eth_getTransactionReceipt`, `eth_blockNumber`) over `https://monad-testnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`.

---

## Monad Metropolis Hackathon Compliance & AI Coding Disclosure

In adherence to the Monad Metropolis Hackathon submission rules:

- **AI Tools Disclosed**: AI coding assistants (Google Antigravity, Claude Code, Gemini 2.5 Flash, Groq) were used for pair programming, test generation, TypeScript typing, and architectural consistency audits.
- **Human Authority & Verification**: All domain architecture, core invariants, smart contract specifications, cryptographic verification algorithms, threat modeling, and code approvals were directed, audited, and verified by human engineering leadership.
- **Founder Invariants**: AI has zero authority to sign, execute, broadcast transactions, or modify financial commitments.

---

## License

This project is licensed under the **Apache License, Version 2.0**. See the [LICENSE](./LICENSE) file for details.
