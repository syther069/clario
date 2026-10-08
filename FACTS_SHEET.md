# Clario Codebase Facts Sheet (Audit Baseline)

**Document Type:** Internal Engineering Audit & Facts Baseline (Not published on website)  
**Date Generated:** 2026-10-07  
**Scope:** `apps/web`, `packages/protocol`, `packages/database`, `contracts`  
**Purpose:** Single source of truth for Clario's Privacy Policy, Terms of Service, Security Details, and Risk Disclosures.

---

## 1. Data Creation, Lifecycle & Storage

### 1.1 What Data Exists
- **Receipts & Invoices:** Receipt image files (JPEG, PNG, WEBP), extracted or manually entered metadata (vendor/merchant, date, currency, total amount, line items, taxes, notes, category).
- **Transactions:** Transaction hashes, block numbers, chain IDs, timestamps, sender/receiver addresses, token transfer amounts, fiat exchange estimates.
- **Ledger Records:** Budgets, subscriptions/recurring expenses, financial goals, invoices (Freelancer mode), shared household bills & split settlements (Family mode), departmental expense policies & claims (Business mode).
- **Identity & Membership:** Wallet addresses (EVM hexadecimal), custom local nicknames, workspace role grants (`OWNER_ROLE`, `ADMIN_ROLE`, `APPROVER_ROLE`, `TREASURY_ROLE`, `AUDITOR_ROLE`).
- **Cryptographic Artifacts:** Canonical RFC 8785 JSON digests, 32-byte SHA-256 commitment hashes, 32-byte salts, EIP-712 approval signatures, ZIP verification package manifests.

### 1.2 Where Data Lives
1. **Browser Local Storage (`localStorage`):**
   - Keys: `clario_active_mode`, `clario-theme`, `clario_wallet_nicknames`, `clario_user_nickname_*`, `clario_active_nickname`, `clario_freelancer_clients`, `clario_freelancer_invoices`, `clario_family_members`, `clario_family_bills`, `clario_family_settlements`, `clario_business_team`, `clario_business_reimbursements`, `clario_business_policies`, `clario_business_audit_events`, `clario_mode_data_*`.
   - Format: Plaintext JSON stored inside the browser's local sandbox for that domain.
   - Encryption: None in `localStorage`.
   - Persistence: Preserved until the user explicitly clears browser site data or uninstalls the browser.
2. **Browser Storage (IndexedDB):**
   - **Status:** NOT USED in `apps/web`.
3. **Server-Side Fallback Store:**
   - In local development or standalone mode without Supabase, saved receipts are cached in `.data/saved_receipts.json` via `saved-receipts-storage.ts`.
4. **Database (Supabase / PostgreSQL):**
   - When configured with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`:
     - Relational tables: `profiles`, `categories`, `financial_accounts`, `receipts`, `transactions`, `subscriptions`, `budgets`, `financial_goals`, `record_versions`, `proof_commitments`, `clients`, `invoices`, `family_members`, `family_bills`, `family_settlements`, `business_team_members`, `business_reimbursements`, `expense_policies`.
     - In B2B protocol backend: 20 operational tables in `@clario/database` (`users`, `wallet_identities`, `workspaces`, `workspace_policies`, `memberships`, `role_grants`, `expenses`, `expense_versions`, `evidence_objects`, `source_transactions`, `ai_analyses`, `review_assignments`, `decisions`, `reimbursements`, `chain_transactions`, `indexed_events`, `audit_events`, `exports`, `jobs`, `idempotency_keys`).
5. **Private Evidence Object Storage:**
   - For corporate/workspace evidence files: Encrypted with **AES-256-GCM** envelope encryption (unique 256-bit DEK, 96-bit random IV, canonicalized AAD). DEK is wrapped using a 256-bit KEK loaded from server environment variable `CLARIO_EVIDENCE_KEK`.
   - Storage drivers: Filesystem driver (`DiskStorageDriver`, default directory `.clario-storage`) or `MemoryStorageDriver` (tests).
   - IPFS / Decentralized Storage: **NOT USED**. Evidence files are never published to IPFS, Filecoin, or Arweave.

---

## 2. External Data Egress & Third-Party Processors

### 2.1 Third-Party APIs in Active Code
- **Google Gemini API (`generativelanguage.googleapis.com`):**
  - Used for: Receipt OCR when a user uploads an image in the receipt modal.
  - Model: `gemini-2.5-flash`.
  - Data transmitted: Base64-encoded receipt image binary.
  - Data returned: Extracted merchant, date, amount, currency, items, and tax.
  - Requirement: Requires `GEMINI_API_KEY`.
- **Groq API (`api.groq.com`):**
  - Used for: Conversational Financial Copilot (optional).
  - Model: `llama-3.3-70b-versatile`.
  - Data transmitted: Redacted financial summary context (anonymized via `anonymizeCopilotContext()` where wallet addresses and personal names are masked).
  - Requirement: Requires `GROQ_API_KEY`. If neither Groq nor Gemini keys are configured, Copilot runs **locally** using rule-based deterministic heuristics; zero data leaves the browser.
- **Alchemy API (`alchemy.com`):**
  - Used for: Multi-chain historical asset transfer ingestion (`alchemy_getAssetTransfers`) across Ethereum, Sepolia, Base, and Base Sepolia; Monad Testnet RPC endpoint.
  - Data transmitted: Connected wallet address and query parameters.
- **DeFiLlama API (`coins.llama.fi`):**
  - Used for: Historical token price lookups at transaction block timestamps.
  - Data transmitted: Contract address and block timestamp (no personal user data).
- **Monad RPC & Explorer:**
  - RPC: `https://testnet-rpc.monad.xyz` or Alchemy Monad RPC.
  - Explorer: `https://testnet.monadexplorer.com`.
  - Fallback Explorer API: Etherscan v2 API (`api.etherscan.io/v2/api?chainid=10143`).
- **Privy (`privy.io`):**
  - Used for: Embedded wallet connection provider (`@privy-io/react-auth`).
- **Supabase (`supabase.com`):**
  - Used for: Cloud relational database and authentication when configured.

### 2.2 Third Parties NOT Used
- **Analytics & Tracking:** Zero analytics scripts. No Google Analytics, no PostHog, no Mixpanel, no Segment, no Amplitude, no tracking cookies, no advertising pixels.
- **Error Reporting:** No Sentry, LogRocket, or Datadog scripts configured in active frontend code.
- **Fonts & CDNs:** All fonts and stylesheets are bundled locally via Tailwind CSS and system fonts. No Google Fonts or Adobe Fonts CDN requests at runtime.

---

## 3. Onchain Footprint & Protocol Contracts

### 3.1 Network
- **Monad Testnet** (Chain ID: `10143`).
- Native Currency: `MON` (18 decimals, testnet only).
- Testnet Settlement Token: Monad Testnet USDC (`0x754704Bc059F8C67012fEd69BC8A327a5aafb603`, 6 decimals).

### 3.2 Smart Contracts
- **Coordinator Registry:** `ClarioRegistry` at `0x92f9B76673C1D88c9E3c490A88eB95b08823bA87` on Monad Testnet.
- **Core Registries (Foundry):**
  - `ClarioWorkspaceRegistryV1`: Workspace creation, policy commitments, role grants/revocations.
  - `ClarioExpenseRegistryV1`: Monotonic expense versions ($V_1, V_2, \dots$), 32-byte commitments, supersession lineage.
  - `ClarioDecisionRegistryV1`: Approval and rejection records, reason commitments, EIP-712 relay signatures.
  - `ClarioSettlementRegistryV1`: Atomic ERC-20 reimbursement, payment references, duplicate settlement prevention.

### 3.3 What is Published Onchain (Public & Permanent)
- User wallet addresses (caller `msg.sender` and recipient addresses).
- 32-byte cryptographic commitments (`bytes32 commitment` = SHA-256 hash of canonical RFC 8785 JSON record + 32-byte salt).
- Version numbers and previous commitment hashes.
- 32-byte reason commitments for rejected expenses.
- Reimbursement amounts in token base units and ERC-20 token contract addresses.
- Transaction hashes, gas fees, block numbers, and block timestamps.

### 3.4 What is NEVER Published Onchain
- Raw receipt image files, PDFs, or invoice scans.
- Cleartext vendor/merchant names, flight itineraries, passenger names, hotel bookings, or item descriptions.
- Cleartext notes or rejection reasons.
- Encryption keys, salts, or master passwords.

---

## 4. Wallet, Custody & Authority Invariants

- **Non-Custodial:** Clario NEVER holds private keys, seed phrases, or user funds.
- **Connection Method:** Injected browser EVM wallet (`window.ethereum` via Viem / Wagmi / Privy).
- **What Clario Can Sign:**
  - EIP-4361 Sign-In with Ethereum (SIWE) nonces for local session authentication.
  - Transactions explicitly approved by the user inside their wallet modal.
  - Clario CANNOT execute transactions, sign messages, or transfer funds without user confirmation in their wallet interface.
- **AI Authority Boundary:** AI models (Gemini 2.5 Flash, Groq) operate strictly in advisory mode. AI has **zero** authority: it cannot sign transactions, call smart contracts, hold keys, or modify approved records.

---

## 5. Security Controls & Mechanisms Implemented

- **Commitment Hashing:** SHA-256 over RFC 8785 Canonical JSON (JCS) with random 32-byte salts preventing rainbow-table enumeration.
- **Envelope Encryption:** AES-256-GCM encryption with per-object 256-bit DEK, 96-bit random IV, canonicalized AAD context, wrapped by 256-bit KEK (`CLARIO_EVIDENCE_KEK`).
- **Duplicate Protection:**
  - Onchain: `ClarioSettlementRegistryV1` enforces `_isSettled[workspaceId][expenseId]` mapping; duplicate reimbursement calls revert.
  - Database: `idx_reimbursements_active_unique` constraint and source transaction claim-slot uniqueness.
  - Local Receipts: `getReceiptUniqueKey(wallet, chain, hash)` prevents duplicate ingestion.
- **Role-Based Access Control:** Onchain roles (`OWNER_ROLE`, `APPROVER_ROLE`, `TREASURY_ROLE`, `AUDITOR_ROLE`) and server-side authorization policies in `policy.ts`.
- **Self-Approval Prevention:** `SelfApprovalNotAllowed` enforced onchain and in server policy (users cannot approve their own expense submissions).
- **Rate Limiting:** Sliding-window in-memory rate limiter on `/api/auth/challenge` (20 req/min) and `/api/auth/verify` (10 req/min).
- **Safe Error Sanitization:** `safe-error.ts` prevents database schema and internal path leakage.
- **Fresh Wallet Confirmation:** Sensitive actions (settlement, export) require fresh wallet confirmation within a 15-minute TTL.

---

## 6. Known Gaps, Limitations & Disclosures

- **Unaudited Software:** The smart contracts and application codebase have **not** undergone a third-party security audit.
- **Testnet Preview Only:** Deployed exclusively on Monad Testnet (`10143`). Tokens have zero financial value; no real money should be used.
- **No Cloud Recovery for Local Vault:** If a user loses their computer or clears browser data without downloading a ZIP export, locally stored receipts and data cannot be recovered by Clario.
- **No Account Recovery:** Because Clario is non-custodial, lost wallet private keys cannot be recovered or reset by Clario.
- **No Native Mobile App:** Clario is a responsive web application only.
- **Onchain Data is Permanent:** Hashes and addresses written to Monad Testnet cannot be edited, rolled back, or deleted.
- **Third-Party Uptime Dependencies:** Dependent on external availability of Monad Testnet RPC, Alchemy API, DeFiLlama, and Google Gemini API.
