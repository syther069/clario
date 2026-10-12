# Clario — System Architecture

**Status:** Production Architecture Specification  
**Version:** 1.0  
**Primary Execution Layer:** Monad Testnet (`chainId: 10143`)  
**Specification:** Canonical Protocol Schema v1  

---

## 1. System Overview

Clario is a verifiable financial operating system designed for crypto-native individuals, freelancers, households, and distributed organizations. It bridges offchain operational records (invoices, receipts, tax metadata, split ledgers) with onchain EVM consensus, anchored by parallel EVM execution and sub-second finality on Monad.

Traditional crypto workflows prove that funds moved, but cannot cryptographically verify why they moved, who authorized the payment, whether supporting receipts were modified, or whether an expense was settled multiple times. Clario unifies this lifecycle into an immutable verification chain:

```text
[Offchain Evidence] ──> [Canonical RFC 8785 Digest] ──> [Salted SHA-256 Commitment]
                                                                  │
                                                                  ▼
[Independent Verifier] <── [Monad Explorer] <── [Clario Registry on Monad]
```

### Core Architecture Pillars

1. **Strict Offchain Evidence Privacy**: Sensitive receipts, vendor data, notes, and employee identity remain encrypted offchain. Only deterministic 32-byte salted commitments touch public blockspace.
2. **Sub-Second Parallel EVM Anchoring**: Leverages Monad's 10,000 TPS parallel EVM execution for instantaneous expense version registration, receipt bundle commitments, and settlement verification.
3. **Multi-Chain Transaction Ingestion**: Ingests transactions across EVM networks (Ethereum, Base, Arbitrum, Optimism, Polygon) via Alchemy Transfers API with spam filtering and historical USD pricing, complemented by direct Monad RPC scanners.
4. **Non-Custodial Identity & 1-Click Signing**: Powered by Privy with Shamir Secret Sharing, FIDO2 Passkeys, and 1-Click Delegated Session Signing (`useDelegatedActions`) for frictionless onchain anchoring without popup fatigue.
5. **Progressive Proof**: High-density consumer interfaces abstract complexity, while the cryptographic Proof Center (`/proof`) and CLI verifier expose tamper-evident cryptographic proofs on demand.

---

## 2. Multi-Tier System Topology

Clario is organized into three distinct tiers:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        TIER 1: PRESENTATION & CLIENT                  │
│  Next.js 15 App Router • React 19 • Tailwind CSS • Neo-Brutalist UI    │
│  Privy Embedded Wallet • Client-Side PII Scrubbing                     │
│  L1 In-Memory Fast Cache • L2 Offline IndexedDB (clario_db)            │
│  SyncQueueManager (Offline Background Replay Engine)                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS / RPC / WSS
┌───────────────────────────────────▼────────────────────────────────────┐
│                  TIER 2: PRIVATE COORDINATION & CLOUD STORAGE          │
│  PostgreSQL (Supabase RLS) • AES-256-GCM Envelope Encryption (KMS)     │
│  Alchemy Multi-Chain Ingestion • Gemini 2.5 Flash OCR • Groq Copilot   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ EVM JSON-RPC (viem / Foundry)
┌───────────────────────────────────▼────────────────────────────────────┐
│                    TIER 3: ONCHAIN VERIFICATION LAYER                  │
│                     Monad Testnet (Chain ID 10143)                     │
│  ClarioTransactionRegistry • ClarioRegistry Coordinator               │
│  WorkspaceRegistry • ExpenseRegistry • DecisionRegistry • Settlement   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Smart Contract Protocol Architecture

Clario's smart contracts are compiled with Solidity `0.8.30` using Foundry, deployed on Monad Testnet. The protocol operates two complementary architectures:

### 3.1 Live Anchor: `ClarioTransactionRegistry`

Deployed at `0x92f9B76673C1D88c9E3c490A88eB95b08823bA87` on Monad Testnet:

- **`saveTransaction(bytes32 txHash, bytes32 metadataCommitment)`**: Anchors an individual transaction's contextual hash and metadata digest.
- **`saveReceipt(bytes32 receiptId, bytes32 receiptHash, uint256 transactionCount)`**: Anchors canonical multi-transaction receipt bundles. Emits indexed events captured by real-time Alchemy WebSockets and the Proof Center.

### 3.2 Modular Governance Suite (`contracts/src/protocol/v1/`)

For enterprise and corporate workspace operations, Clario provides a modular suite governed by a coordinator:

```text
ClarioWorkspaceRegistryV1 (Role Grants & Policy History)
         │
         ├─── ClarioExpenseRegistryV1 (Immutable Versions & Predecessors)
         │           │
         │           ├─── ClarioDecisionRegistryV1 (EIP-712 Exact-Version Approvals)
         │           │           │
         └───────────┴───────────┴─── ClarioSettlementRegistryV1 (USDC Settlement)
                                                 │
                                                 ▼
                                        ClarioRegistry (Coordinator)
```

1. **`ClarioWorkspaceRegistryV1`**: Manages workspace membership and role grants (`OWNER`, `ADMIN`, `APPROVER`, `TREASURY`, `AUDITOR`) with policy digest history.
2. **`ClarioExpenseRegistryV1`**: Enforces strictly monotonic versioning (`v1`, `v2`, ...). Each version records a 32-byte salted commitment and a link to its predecessor commitment.
3. **`ClarioDecisionRegistryV1`**: Collects EIP-712 human reviewer approval signatures. Approvals bind to `(workspaceId, expenseId, version, commitment)`. Any material edit creates a new version, automatically invalidating stale approvals.
4. **`ClarioSettlementRegistryV1`**: Executes Monad Testnet USDC disbursement via ERC-20 `safeTransferFrom`. Guarantees exactly one active settlement per expense version, with checks against duplicate reimbursement.
5. **`ClarioCommitmentV1`**: Reusable cryptographic library computing canonical commitments matching the offchain RFC 8785 canonicalization standard.

---

## 4. Multi-Chain Transaction Ingestion

Clario provides comprehensive ledger sync across EVM ecosystems:

```text
                        ┌─────────────────────────────────────┐
                        │      Transaction Import Service     │
                        └──────────────────┬──────────────────┘
                                           │
                 ┌─────────────────────────┴─────────────────────────┐
                 ▼                                                   ▼
┌─────────────────────────────────┐                 ┌─────────────────────────────────┐
│     Alchemy Asset Transfers     │                 │   Monad Fallback Event Scanner  │
│  Ethereum, Base, Arbitrum, etc. │                 │    Direct Viem Monad Testnet    │
│  • alchemy_getAssetTransfers    │                 │    RPC + MonadExplorer API      │
│  • Alchemy Prices API (USD)     │                 │    Block timestamp valuation    │
│  • Spam & zero-value filtering  │                 │    Real-time status updates     │
└─────────────────────────────────┘                 └─────────────────────────────────┘
```

- **Historical Price Resolution**: Uses Alchemy Prices API and DeFiLlama historical valuation endpoints to peg asset values at exact transaction block timestamps.
- **Pre-Flight Simulation**: Prior to signing contract interactions on Monad Testnet, transactions are simulated via `eth_call` and `eth_estimateGas` over Alchemy Monad RPC, ensuring validity before prompting the user.

---

## 5. Five Purpose-Built Operating Modes

Clario provides five dedicated interfaces sharing the unified financial engine:

1. **Personal Mode**: High-density cash flow analytics, 7-dimensional transaction filter engine, category budgets with variance warnings, recurring subscription auditor, and confirmed receipt vault.
2. **Freelancer Mode**: Client CRM, sequential invoice generator with printable Neo-Brutalist invoice documents, tax write-off ledger, and Schedule C quarterly tax organizer.
3. **Family Mode**: Multi-member household split engine (equal, custom percentage, exact amounts), shared budget alerts, recurring utilities tracker, and non-custodial IOU settlements.
4. **Business Mode**: Role-separated team roster, corporate spend policy engine, receipt-attached reimbursement queue, manager approvals with reason commitments, and immutable audit logs.
5. **Crypto / Monad Mode**: Multi-tier Monad RPC health monitoring, historical USD block valuation, and direct onchain registry explorer.

---

## 6. Verification and Export Pipeline

To verify Clario expense records without trusting hosted infrastructure:

1. **Export Package**: Generates an RFC 8785 compliant canonical ZIP archive containing the manifest, salted commitments, and public event hashes.
2. **Independent Verifier CLI**: The standalone tool (`@clario/protocol`) verifies:
   - Package manifest checksums (SHA-256).
   - Salted commitment reconstruction.
   - Onchain registration on Monad Testnet via standard JSON-RPC.
   - EIP-712 reviewer signatures.
   - Settlement transaction status and duplicate prevention guards.
