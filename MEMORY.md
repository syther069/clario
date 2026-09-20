# Clario Project Memory

**Status:** Active persistent context  
**Memory version:** 1.0  
**Last verified:** 2026-09-19  
**Current phase:** Phase 5 — Reimbursement and verification (`ACTIVE`)  
**Next executable task:** `VER-001 — Define portable verification package v1` in [TASKS.md](./TASKS.md)

> Read this file at the start of every Clario task. It records verified project state, durable decisions, unresolved questions, and facts future agents must preserve. It is context, not a substitute for the governing documents.

## 1. Authority and document map

Use each document for its intended purpose:

| Document | Authority |
|---|---|
| [RULES.md](./RULES.md) | Binding engineering, security, deployment, naming, and agent constraints |
| [prd.md](./prd.md) | Product identity, users, scope, functional requirements, and acceptance behavior |
| [architecture.md](./architecture.md) | System boundaries, contracts, storage, APIs, workflows, security, and deployment architecture |
| [DESIGN.md](./DESIGN.md) | Visual system, UI behavior, accessibility, responsive design, and anti-slop rules |
| [THREAT_MODEL.md](./THREAT_MODEL.md) | MVP assets, trust boundaries, accountable threats, controls, tests, residual risks, and security blockers |
| [PHASES.md](./PHASES.md) | Stage-gate roadmap, phase dependencies, and founder acceptance gates |
| [TASKS.md](./TASKS.md) | Atomic execution queue, dependencies, task state, and completion evidence |
| `MEMORY.md` | Verified current state, durable decisions, known issues, and handoff context |

If memory conflicts with a governing document, the governing document wins. Correct this file in the same change. Do not use memory to override a rule, protocol invariant, or product decision.

## 2. Verified repository snapshot

As of 2026-09-17, the repository contains the founding documents plus an active pnpm workspace:

- `apps/web` — Next.js application shell with authentication routes and server authorization.
- `packages/protocol` — shared protocol boundary, canonical schema v1, golden vectors, types, errors.
- `packages/database` — PostgreSQL schema, migrator engine, relational tables and constraints.
- `contracts` — Foundry workspace with 5 verified registries and coordinator contract.
- Root manifests, pinned toolchain configuration, lockfile, quality scripts, README, and `AGENTS.md`.

### What is complete

The founding documentation set is established:

- Product requirements and hackathon scope.
- System architecture and six architecture decision records.
- Production-oriented UI/UX design system.
- Binding coding-agent and engineering rules.
- Atomic implementation checklist with dependency validation.
- Stage-gate implementation roadmap.
- This persistent memory file.
- `FND-001`: reproducible pnpm/Node workspace, Next.js shell, shared package, Foundry workspace, and passing root quality gate.
- `FND-002` local scope: GitHub Actions workflow, granular root gates, zero-warning lint enforcement, checksum-verified secret scanning, production dependency audit policy, cache boundaries, and remote activation instructions.
- `FND-003`: typed server/public configuration, startup validation, environment isolation, and strict deployment-manifest parsing with no live values.
- `SEC-001`: 12-boundary data-flow model, 18-threat P0 register, founder-invariant crosswalk, release tests, incident minimums, and explicit high-severity blockers. Approved by founder 2026-09-15.
- `PRO-001`: Canonical Expense Schema v1 and Evidence Manifest Schema v1 specified in `docs/CANONICAL_SCHEMA_V1.md`, with TypeScript types, privacy/materiality tables, RFC 8785 JCS canonicalization, and strict validation in `@clario/protocol` passing 15 tests.
- `PRO-002`: Cross-runtime golden commitment vectors (10 valid, 8 tampered, 11 malformed) in `packages/protocol/src/fixtures/golden_vectors_v1.json`, with TypeScript commitment hashing/verification in `@clario/protocol` and EVM commitment verification in `contracts/src/protocol/v1/ClarioCommitmentV1.sol`, passing all 48 protocol and 12 Foundry tests.
- `PRO-003`: Public protocol types (`identifiers.ts`), lifecycle states (`lifecycle.ts`), public event payloads (`events.ts`), EIP-712 approval typed data and domain validators (`approval.ts`), and stable error envelope and vocabulary (`errors.ts`) in `@clario/protocol` with exhaustive checking and zero private data leakage, passing all 105 protocol tests and root `pnpm check`.
- `CHN-001`: Workspace registry contract (`ClarioWorkspaceRegistryV1.sol`) and interface (`IClarioWorkspaceRegistryV1.sol`) implementing workspace creation with creator `OWNER_ROLE` and `policyVersion = 1`, scoped role management (`OWNER_ROLE`, `ADMIN_ROLE`, `APPROVER_ROLE`, `TREASURY_ROLE`, `AUDITOR_ROLE`), last-owner protection, policy version/commitment history, and historical authority queries (`wasRoleAuthorizedAtBlock`, `wasRoleAuthorizedAtPolicyVersion`), passing 24 Foundry tests (including 256 fuzz runs).
- `CHN-002`: Expense registry contract (`ClarioExpenseRegistryV1.sol`) and interface (`IClarioExpenseRegistryV1.sol`) implementing monotonic expense version progression (v1 requires previousCommitment == bytes32(0); v_n requires version == currentVersion + 1 and matching predecessor), supersession tracking, current-version and historical commitment/submitter lookups, and per-workspace pause controls that block new submissions while preserving historical reads, passing 19 Foundry tests (including 256 fuzz runs) and total 55 contract suite tests.
- `CHN-003`: Decision registry contract (`ClarioDecisionRegistryV1.sol`) and interface (`IClarioDecisionRegistryV1.sol`) supporting direct calls and relayed EIP-712 typed data signatures (`recordDecisionBySig`), enforcing `APPROVER_ROLE` authority, current version and exact commitment binding, mandatory reason commitment for `Reject` and `RequestChanges`, self-approval prevention, single-decision uniqueness per version, sequential nonce replay protection, deadline expiration, policy version verification, domain separation, and pause isolation. Implemented `isApprovalValid` verifying active unsuperseded approval, passing 20 Foundry tests (including 256 fuzz runs) and 75 contract suite tests.
- `CHN-004`: Settlement registry contract (`ClarioSettlementRegistryV1.sol`) and interface (`IClarioSettlementRegistryV1.sol`) implementing atomic ERC-20 reimbursement (`reimburse`) bound to workspace, expense ID, version, commitment, token, recipient, base-unit amount, and payment reference (both explicit and deterministic). Enforces `TREASURY_ROLE` authority via `IClarioWorkspaceRegistryV1`, active valid approval via `IClarioDecisionRegistryV1`, current unsuperseded version via `IClarioExpenseRegistryV1`, strict duplicate settlement prevention (`_isSettled`), native safe ERC-20 token transfer, and non-reentrant mutex protection, passing 15 Foundry tests (including 256 fuzz runs, reentrancy and token failure tests) and 90 contract suite tests.
- `CHN-005`: Central coordinator contract (`ClarioRegistry.sol`, `IClarioRegistry.sol`) binding modular registries into a unified deployment anchor, tested with 5 Foundry tests (`ClarioRegistry.t.sol`). Deterministic deployment engine and manifest generator in `packages/protocol/src/deploy/` (`manifest.ts`, `deploy.ts`) with `--dry-run` simulation mode, receipt extraction, RFC 8785 ABI hashing, and strict silent overwrite protection. CLI scripts `scripts/deploy.mjs` and `scripts/verify.mjs`, and authorative runbook `docs/DEPLOYMENT_AND_VERIFICATION.md`, passing 12 automated deployment and isolation tests in Vitest and 95 Foundry tests monorepo-wide.
- `APP-001`: PostgreSQL schema and migrations in `@clario/database` (`0001_initial_schema.up.sql`, `0001_initial_schema.down.sql`) provisioning 20 operational tables (`users`, `wallet_identities`, `workspaces`, `workspace_policies`, `memberships`, `role_grants`, `expenses`, `expense_versions`, `evidence_objects`, `source_transactions`, `ai_analyses`, `review_assignments`, `decisions`, `reimbursements`, `chain_transactions`, `indexed_events`, `audit_events`, `exports`, `jobs`, `idempotency_keys`). Strict constraints enforce workspace isolation, immutable version lineage, current version foreign key integrity (`fk_expenses_current_version`), predecessor checks, duplicate settlement prevention via partial unique index `idx_reimbursements_active_unique`, source transaction claim-slot uniqueness, idempotency keys, integer base units (`NUMERIC(78, 0)`), and UTC timestamps (`TIMESTAMPTZ`). Checksum-verified `Migrator` engine, CLI `scripts/migrate.mjs`, runbook `docs/DATABASE_MIGRATIONS.md`, and 15 tests in Vitest passing.
- `APP-002`: Nonce-based EIP-4361 wallet authentication (`challenge.ts`), HMAC-SHA256 sealed session management with rotation, cookie serialization, and CSRF defense (`session.ts`), server-side workspace authorization policy layer (`policy.ts`) enforcing scoped role authority, hierarchical scope matching, self-approval prevention (`SelfApprovalNotAllowed`), admin evidence isolation, recent confirmation assertion (15 min TTL), and safe 404/NOT_FOUND masking against object enumeration. Implemented request helpers (`context.ts`), db accessor (`db.ts`), 5 Next.js route handlers (`/api/auth/challenge`, `/api/auth/verify`, `/api/auth/confirm`, `/api/auth/logout`, `/api/auth/session`), and 39 Vitest unit and integration tests (71 total in `@clario/web`), passing all monorepo checks.
- `APP-003`: AES-256-GCM envelope encryption engine (`crypto.ts`) with unique 256-bit DEK generation, 96-bit random IVs, canonicalized JSON AAD binding, KEK wrapping/unwrapping, and SHA-256 integrity validation. Storage driver layer (`storage.ts`) supporting `MemoryStorageDriver` and `DiskStorageDriver` with strict directory traversal protection. `EvidenceService` coordinating upload, download, preview, deletion, and draft replacement with multi-tenant isolation, immutability enforcement on submitted versions, admin evidence isolation, and safe 404 masking. API routes (`/api/expenses/:expenseId/evidence` and `.../evidence/:evidenceId`), passing 45 tests.
- `APP-004`: Workspace and role management workflow with Viem calldata generation (`calldata.ts`), atomic `WorkspaceService` (`service.ts`), API routes (`/api/workspaces`, `/api/workspaces/[id]`, `/roles/prepare`, `/roles/reconcile`), and UI components (`IntentDialog`, `WorkspaceManager`), passing 27 tests.
- `EXP-001`: Manual expense drafts with integer base-unit parsing and asset metadata registry (`amount.ts`), Canonical Schema v1 draft validation (`validation.ts`), `ExpenseService` with AES-256-GCM envelope encryption, KEK wrapping, random salt encryption, workspace isolation, cascading draft deletion, and draft-only modification enforcement. API routes (`/api/workspaces/[workspaceId]/expenses` and `.../expenses/[expenseId]`), and Evidence Ledger UI (`ExpenseDraftEditor`, `ExpenseList`), passing 34 tests.
- `EXP-002`: Attributable transaction import with normalized transaction schema (`types.ts`), immutable non-authoritative provenance disclaimer (`IMPORTED_FACTS_DISCLAIMER`), supported multichain registry (`chains.ts` for Monad Testnet/Local, Ethereum, Sepolia, Base, Base Sepolia), provider-neutral adapter (`adapter.ts` with `RpcImportAdapter`, `MockImportAdapter`, `CompositeImportAdapter` with 60s TTL memory cache), and `TransactionImportService` (`service.ts`) with duplicate claim detection across workspace, chain, hash, and claim slot on database `source_transactions` table. API routes (`/import/transactions`, `/import/lookup`, `/import/claim`), and UI components (`TransactionImportDialog` and draft editor autofill integration), passing 31 tests.
- `EXP-003`: Canonical expense submission workflow with RFC 8785 evidence manifest and private record hashing, golden commitment verification, calldata privacy scanner, secure salt encryption, and Monad `submitVersion` preparation/reconciliation. Implemented `submission.ts`, API routes (`/submit/prepare`, `/submit/reconcile`), and `ExpenseSubmitDialog` UI component, passing 24 tests.
- `REV-001`: Authorized review queue and exact-version detail view with field-level material diff computation (`diff.ts`), role-based review authorization (`APPROVER_ROLE`, `OWNER_ROLE`, `ADMIN_ROLE`, `AUDITOR_ROLE`), self-approval blocking (`isSelfExpense`), stale/superseded version warnings, in-modal evidence preview preserving review state, 4-milestone Proof Spine rail, API routes (`/reviews`, `/expenses/[id]/review`), and UI components (`ReviewQueueView`, `ReviewDetailView`), passing 15 tests.
- `REV-002`: Exact-version decision recording and supersession engine with Viem function calldata encoding (`recordDecision`), EIP-712 typed data envelope construction (`buildClarioApprovalTypedData`), deterministic reason commitment hashing (`computeReasonCommitment`), `ReviewDecisionService` enforcing approver authority, self-approval prevention, current-version and single-decision invariants, mandatory reason commitments for rejections/changes, database decision recording, and `createSuccessorDraft` linking version $V+1$ to predecessor commitment and copying evidence. Protected API routes (`/decision/prepare`, `/decision/reconcile`, `/successor`) and Evidence Ledger UI (`DecisionDialog` and `ReviewDetailView` integration), passing 38 tests (277 web tests, 504 total monorepo tests).
- `IDX-001`: Idempotent event indexing engine (`apps/web/src/lib/indexer/`) with 8 public event handlers, unique `(chain_id, block_hash, tx_hash, log_index)` identity, checkpoint tracking, retry with exponential backoff, dead-letter recording, reorg rollback/retraction, CLI replay command (`scripts/replay-events.mjs`), API routes (`/api/workspaces/[id]/indexer/status` and `/replay`), database migration `0002_event_indexing` with 7 projection tables, and R-001 privacy validation guaranteeing zero private fields in public projections, passing 6 unit tests, 4 route tests, and monorepo check gate (514 tests).
- `IDX-002`: Authoritative Proof Spine timeline (`apps/web/src/lib/timeline/`) with 3-dimensional timestamp model (`applicationTime`, `blockTime`, `indexerTime`), indexer lag detection, reorg conflict indicators, authorized route `/api/workspaces/[id]/expenses/[id]/timeline`, and `ProofSpineTimeline` UI component, passing 10 tests (524 total monorepo tests).
- `SET-001`: Official Monad Testnet USDC provenance (`docs/MONAD_PROVENANCE.md`: Chain ID 10143, USDC token `0x754704Bc059F8C67012fEd69BC8A327a5aafb603`, 6 decimals). Hardened fail-closed configuration resolver (`config.ts`) requiring validated `DeploymentManifest` via `getServerConfiguration()`. Zero fallback to raw `NEXT_PUBLIC_*` or zero addresses. `SettlementService` enforcing pre-conditions (role, fresh 15-minute confirmation, current version, exact approval, token/registry non-zero addresses, network, asset symbol matching, duplicate prevention, balance check, allowance check, read-only simulation probe). Privacy-verified calldata generator (`calldata.ts`), authorized routes (`/settlement/queue`, `/settlement/prepare`, `/settlement/reconcile`), `TreasuryQueueView`, and `ReimbursementDialog` with browser wallet execution and labeled non-production demo simulation, passing 43 settlement tests (340 web tests, 567 total monorepo tests).
- `SET-002`: Comprehensive reimbursement lifecycle reconciliation and receipt verification engine (`apps/web/src/lib/settlement/receipt.ts` and `service.ts`). Decodes and validates `SettlementRecorded` and ERC-20 `Transfer` events using Viem, enforces exact parameter bindings (contract, event, token, recipient, amount, chain, version, commitment), treats reverted transactions as safe retriable failures without marking reimbursed, supports reorg retracting to `failed`, provides truthful settlement proof with block number and explorer URL, enforces that `SUBMITTED` state is never displayed as paid or final, unblocks retry for failed/cancelled attempts while rejecting retry on confirmed/active submissions (duplicate guard), adds API routes (`/settlement/confirm`, `/settlement/status`, `/settlement/retry`), and updates UI (`ReimbursementDialog`, `TreasuryQueueView`, `TimelineService`), passing 76 settlement tests (368 web tests, 595 total monorepo tests, clean `pnpm check`).

### What is not complete

The repository is scaffolded, but product behavior is not implemented. Specifically, there is no verified:

- Product route tree beyond the truthful foundation page and authentication endpoints.
- UI component, stylesheet, or token implementation.
- Product smart contract, canonical protocol, or invariant suite beyond pure commitment verification.
- Object storage or encryption implementation.
- Provider integration.
- Deployed contract or application.
- Contract, token, RPC, or explorer address.
- Remotely executed and branch-protected CI, demo, or release artifact.

Do not describe any planned capability as implemented. `FND-001` is complete; `FND-002` is locally implemented but blocked on remote activation; Phase 0 is active and its gate remains incomplete.

## 3. Product memory

### One-line product

Clario is a verifiable expense workflow for crypto-native teams that keeps business evidence private while making version integrity, reviewer authority, corrections, and reimbursement independently verifiable on Monad.

### Core proof chain

```text
payment → private evidence → immutable version → human review
        → exact-version approval → correction history
        → Monad reimbursement → independent verification
```

### Target MVP user

Small crypto teams paying contractors and contributors across chains. The product must work for distinct submitter, approver, treasury, owner/admin, and external-verifier responsibilities.

### User roles

- **Owner:** Workspace ownership, policy, membership, and roles.
- **Admin:** Administrative actions within granted scope; not automatic evidence access.
- **Submitter:** Creates/imports expenses and attaches private evidence.
- **Approver:** Reviews and decides on one exact version.
- **Treasury:** Executes or records reimbursement for an approved current version.
- **Auditor/verifier:** Inspects exports and public proof under authorized disclosure.

One person may hold multiple roles, but the release demonstration should use separate identities so authority boundaries are visible.

### Required MVP outcome

A submitter can create or import an expense, attach encrypted evidence, and commit an immutable salted version. An authorized reviewer approves that exact version. A material edit creates a successor and invalidates the old approval for settlement. Treasury reimburses the approved current version in supported USDC on Monad. A third party verifies the exported package without trusting Clario’s private database and detects tampering.

## 4. Founder-level invariants to preserve

These are product identity, not negotiable implementation details:

1. Private receipts, invoices, notes, personal data, and salts never appear onchain.
2. Public identifiers are opaque and contain no guessable private values.
3. Submitted expense versions and evidence are immutable.
4. Every material edit creates a new version linked to its predecessor.
5. Approval binds to the exact workspace, expense, version, commitment, reviewer authority, policy/domain, chain, and contract.
6. A superseded approval remains historical but cannot authorize settlement.
7. Only the approved current version may enter the normal reimbursement path.
8. Normal duplicate reimbursement fails at application and contract layers.
9. Submitted transaction state is never presented as confirmed, final, paid, or indexed.
10. AI may suggest; it never approves, rejects, signs, grants roles, reveals evidence, or moves funds.
11. The verifier is deterministic and independent of authenticated production database state.
12. Clario proves integrity, authority, ordering, and matching settlement—not receipt truth, business legitimacy, tax status, or AI correctness.
13. Missing information becomes unknown or unverifiable, never fabricated.
14. Deployments, live transactions, external mutations, and fund movement require explicit human authorization.

If a proposed change violates an invariant, stop. It requires a founder-level product decision, not a local workaround.

## 5. Durable architecture decisions

The architecture records six accepted ADRs. Preserve their intent.

### ADR-001 — Monad stores commitments, not private expense data

- Private records and evidence remain encrypted offchain.
- Monad stores opaque identifiers, hashes/commitments, authority, decisions, supersession, and settlement references.
- Availability, encryption, access control, retention, and key management remain Clario responsibilities.

### ADR-002 — Approval binds to an immutable version

- Material edits never occur in place after commitment.
- Historical decisions remain visible.
- The current version requires a current exact-version decision.

### ADR-003 — Human approval remains authoritative

- AI is advisory and replaceable.
- AI failure degrades to manual entry.
- No model or agent receives treasury or reviewer authority.

### ADR-004 — Independent verifier is a separate trust surface

- Verification consumes disclosed package data, public schemas/ABIs/manifests, and compatible Monad RPC.
- Verification must not ask Clario’s private database whether Clario is correct.
- Core verification logic is public, versioned, and deterministic.

### ADR-005 — One provider per primary capability

- MVP chooses one wallet architecture and one primary event indexer.
- Provider-neutral boundaries preserve future portability.
- Do not ship parallel providers merely to collect integrations or bounties.

### ADR-006 — Monad reimbursement is part of the core proof

- A real supported-USDC reimbursement or rigorously verified payment reference closes the workflow.
- Token address, decimals, recipient, amount, allowance, simulation, receipt, event, and duplicate protection are P0 concerns.

## 6. Architecture baseline, not installed state

The current architecture names these MVP defaults. They are decisions on paper, not installed or verified integrations:

| Capability | Baseline choice | Important caveat |
|---|---|---|
| Web | Next.js PWA with TypeScript | Foundation shell exists; product routes do not |
| Wallet | Privy smart-wallet path | Alchemy or Circle are approved alternatives only after a deliberate single-stack choice |
| EVM client | Viem | Dependency not installed |
| Contracts | Solidity + OpenZeppelin | Only a dependency-free build probe exists; product contracts and OpenZeppelin are not installed |
| Contract tooling | Foundry | Selected and verified by `FND-001` |
| RPC | QuickNode Monad endpoint | No credential or endpoint is configured |
| Indexing | Envio HyperIndex | GhostGraph/QuickNode alternatives remain fallbacks |
| Transaction import | Zerion API plus RPC/manual fallback | Provider data remains attributable, not trustless |
| Simulation | Tenderly | Integration not configured |
| Database | PostgreSQL | No schema or instance exists |
| Evidence storage | Private S3-compatible object storage | Provider not selected/configured |
| Evidence encryption | AES-256-GCM envelope encryption | Key service and recovery policy remain open |
| AI | Provider abstraction | Provider/model not selected; human confirmation required |
| Settlement | Supported USDC on Monad | Exact network/token address must be verified later |

Do not turn an approved alternative into an additional runtime dependency. Replace the selected path only through an explicit decision.

## 7. Protocol memory

### Core identifiers

- `workspaceId`: opaque `bytes32` derived from an application UUID plus domain.
- `expenseId`: random opaque `bytes32`, never derived from private content.
- `version`: monotonic `uint32`, starting at 1.
- `commitment`: `bytes32` derived from canonical record, evidence manifest, domain data, and secure random salt.
- `policyVersion`: monotonic identifier for the applicable authorization policy.
- `decisionId`: domain-bound identity including workspace, expense, version, signer, nonce, and decision context.

Identifiers must not contain email, name, merchant, purpose, invoice number, filename, or another private/guessable value.

### Canonicalization requirements

The v1 schema is specified and frozen in `docs/CANONICAL_SCHEMA_V1.md`. It explicitly defines:

- UTF-8 and Unicode normalization (NFC).
- Stable field ordering via RFC 8785 (JSON Canonicalization Scheme - JCS).
- Lowercase 0x-prefixed addresses and bytes32 digests.
- Integer chain IDs.
- Token values in integer base units as unsigned decimal strings.
- UTC timestamps in ISO 8601 extended format (`YYYY-MM-DDTHH:MM:SSZ`) and calendar dates (`YYYY-MM-DD`).
- Strict null encoding for optional fields.
- Lexicographically sorted tags and strictly sorted evidence manifest entries.
- Schema version 1, `CLARIO_EXPENSE_V1_DOMAIN`, and `CLARIO_EVIDENCE_V1_DOMAIN`.

Never hash arbitrary `JSON.stringify` output. `PRO-002` builds cross-runtime golden vectors from this specification.

### Salt and commitment

- Use a cryptographically secure unique 32-byte salt per private version commitment.
- Never derive a salt from time, record values, user input, workspace, or another predictable source.
- Keep salts offchain and separate from public commitments.
- Authorized exports may disclose a salt only when required to recompute a commitment.

### Onchain modules

The preferred production boundary has workspace, expense, approval, and settlement registries. A hackathon contract may combine them if public interfaces, events, permissions, and invariants remain separated and clear.

The MVP prefers non-upgradeable versioned deployments. Upgradeable proxies are not approved MVP scope.

## 8. Data and trust boundaries

### Public-verifiable

Opaque IDs, versions, commitments, public role addresses/scopes, decisions, supersession, settlement token/recipient/amount/reference, deployment addresses, ABI hashes, blocks, transactions, and verifier code may be public when allowed by the protocol schema.

### Workspace-confidential

Purpose, merchant, project, category, internal report data, private amount context, and AI results remain in authorized encrypted database fields.

### Evidence-confidential

Receipts, invoices, contracts, attachments, and their private metadata remain envelope-encrypted in private object storage.

### Security-sensitive

Sessions, provider keys, encryption keys, wrapped-key plaintext, salts, auth challenges, private prompts, and infrastructure credentials belong in appropriate secret/key systems and never in repository or telemetry.

### Trust boundaries to remember

- Browser state is untrusted.
- A connected wallet address is not authenticated identity by itself.
- Provider API output is attributable external data and must be validated.
- Receipt/OCR content is untrusted data and never instructions.
- The indexer is a rebuildable projection, not final authority.
- A transaction hash proves submission, not success.
- An onchain commitment proves a match only when authorized private data and salt are disclosed and recomputed.

## 9. Critical state machines

### Expense/version

```text
DRAFT → PREPARED → SUBMITTED → CURRENT
                            └→ SUPERSEDED
```

A material change from `CURRENT` creates a new draft/version. It does not mutate the current record.

### Decision

```text
NONE → APPROVED | REJECTED | CHANGES_REQUESTED
APPROVED + material successor → HISTORICAL_APPROVAL + REAPPROVAL_REQUIRED
```

### Transaction

```text
PREPARING → AWAITING_SIGNATURE → SUBMITTED → CONFIRMING → CONFIRMED → INDEXED
              ↓ CANCELLED          ↓ FAILED / REPLACED / REORGED
```

Names may evolve in shared types, but meaning must remain precise. Never collapse submitted, confirmed, and indexed into one “success” state.

### Verification

Each check and the overall result use:

- `VERIFIED`
- `VERIFIED_WITH_WARNINGS`
- `FAILED`
- `UNVERIFIABLE`

Absence and mismatch are different. Missing permitted input is generally unverifiable; a provided value that contradicts the commitment is failed.

## 10. Design memory

Clario’s design direction is **Evidence Ledger**.

- Cool graphite/white foundations.
- Cobalt is the primary proof/action accent.
- Muted iris is analytical and AI-associated, not proof.
- Semantic green/amber/red always pair icon shape and text because hue alone fails color-vision differentiation.
- Core contrast pairs are numerically documented in `DESIGN.md`.
- **Proof Spine:** a visual chain of version, decision, and settlement events.
- **Commitment Stamp:** compact grouped hash disclosure with copy/details.
- Typography baseline: Manrope display, Geist Sans body, Geist Mono technical values.
- Product screens favor rules, whitespace, and flat ledger rows over card grids.
- Motion explains continuity and stays below 520ms in authenticated flows.
- WCAG 2.2 AA, keyboard operation, reduced motion, forced colors, 320px width, and 200% zoom are P0 design constraints.

Do not use generic crypto dashboards, casino visuals, AI chat-page templates, glassmorphism, random gradients, glowing cards, fake 3D blobs, decorative charts, or fake metrics.

Dark mode is specified but not confirmed as MVP scope. It may be deferred; if shipped, it must pass independently rather than inheriting assumed parity.

## 11. Current execution state

### Roadmap

- Phase 0 — Foundation: `ACTIVE` (`FND-001` complete).
- Phases 1–7: `NOT_STARTED`.
- No phase gate has been reviewed or completed.

### Task queue

- `TASKS.md` contains 35 unique atomic tasks.
- Its phase/task dependency references were validated when created.
- `FND-001 — Scaffold the repository` is `[x]` with passing evidence.
- `FND-002 — Establish CI and repository quality gates` is `[!]`: local checks pass, but no GitHub remote exists to run and require them.
- `FND-003 — Define configuration schema and environment boundaries` is `[x]` with startup and 31-case matrix evidence.
- `SEC-001 — Commit the MVP threat model` is `[x]` with human founder approval and complete test/scan evidence.
- `PRO-001 — Specify canonical expense schema v1` is `[x]` with specification, package implementation, and test evidence.
- `PRO-002 — Build cross-runtime golden commitment vectors` is `[x]` with cross-runtime TypeScript and Foundry test evidence.
- `PRO-003 — Publish public protocol types and error vocabulary` is `[x]` with exhaustive types, errors, event schemas, and 105 tests.
- `CHN-001 — Implement workspace roles and policy history` is `[x]` with role authority, policy version history, and 24 Foundry tests.
- `CHN-002 — Implement immutable expense-version registry` is `[x]` with monotonic progression, supersession, pause isolation, and 19 Foundry tests.
- `CHN-003 — Implement exact-version decision registry` is `[x]` with direct and relayed signature authority, supersession invalidation, and 20 Foundry tests.
- `CHN-004 — Implement settlement registry and duplicate guard` is `[x]` with atomic token transfers, TREASURY_ROLE authority, duplicate protection, and 15 Foundry tests.
- `CHN-005 — Create deployment and source-verification tooling` is `[x]` with ClarioRegistry coordinator, deployment and manifest engine with silent overwrite protection, verify script, runbook, and 12 Vitest deployment tests.
- `APP-001 — Create PostgreSQL schema and migrations` is `[x]` with 20 relational tables, strict version/settlement/idempotency constraints, checksummed migrator, CLI runner, runbook, and 15 tests.
- `APP-002 — Implement authentication and workspace authorization` is `[x]` with EIP-4361 SIWE challenge/verification, HMAC-SHA256 sessions, CSRF defense, scoped authorization policy, and 39 Vitest tests.
- `APP-003 — Implement encrypted evidence storage` is `[x]` with AES-256-GCM envelope encryption, canonicalized JSON AAD context binding, KEK wrapping, memory/disk storage drivers with path traversal defense, opaque storage keys (`evidence/<ws>/<ev>.enc`), immutability enforcement on submitted versions, admin evidence isolation, safe 404/NOT_FOUND masking, Next.js upload/download/preview/delete route handlers, and 45 tests.
- No task is currently `[~]` or `[-]`; `APP-004 — Implement workspace and role management workflow` is the next permitted critical-path task.

### Critical path

```text
foundation → canonical protocol → private workflow → expense submission
           → approval/supersession → indexing/timeline
           → settlement → export/verifier → role-separated release
```

AI, gas sponsorship, advanced reporting, broad multichain support, and optional integrations are not on the critical path.

## 12. Known issues and unresolved decisions

These are open. Do not silently resolve them while implementing an adjacent task.

### Repository and tooling

- pnpm `11.19.x`, Node.js `24.15.x`, pnpm workspaces, and Foundry `1.7.x` are selected and verified.
- ESLint is pinned to `9.39.x` because the React lint plugin bundled with the current Next.js config fails under ESLint 10; revisit when that upstream stack supports ESLint 10.
- GitHub Actions is the selected CI provider; hosting remains unselected.
- The CI workflow is not remotely active and no branch ruleset requires its checks.
- Git metadata is unavailable in the current workspace, so repository diff and clean-checkout validation could not be performed here.

### Threat-model review

- `THREAT_MODEL.md` version 1.0 approved 2026-09-15 by human founder Sythe following independent review against `RULES.md`, `architecture.md`, and PRD section 14.
- Its six explicit high-severity blockers constrain downstream implementation; approval of the model establishes them as binding gates and does not resolve the underlying risks.

### Wallet and identity

- Privy is the preferred architecture baseline, but the final single wallet stack is not installed or confirmed.
- Whether roles are fully onchain or partly represented by a committed policy needs final schema-level resolution.
- Account recovery, key rotation, and wallet-confirmation UX remain to be specified.

### Evidence and encryption

- Client-side versus trusted-backend encryption split is not finalized.
- Managed key service, workspace key recovery, and rotation policy are unresolved.
- Retention defaults and deletion timing need product/legal input.

### Protocol and policy

- Canonical expense schema v1 and golden vectors are implemented and verified cross-runtime (`PRO-001`, `PRO-002`).
- Approval-material categories and fields are frozen in `docs/CANONICAL_SCHEMA_V1.md` and `packages/protocol/src/schema/v1/types.ts`.
- Combined `ClarioRegistry` versus four deployed contracts remains an MVP implementation choice subject to invariant clarity.

### Settlement

- In-contract `safeTransferFrom` is the safest baseline; external treasury transfer plus verified receipt remains an allowed alternative.
- Supported USDC contract and selected Monad environment are unresolved and time-sensitive.
- Allowance policy and sponsorship policy are not finalized.

### Providers

- Wallet, RPC, indexer, source-chain import, AI, price/risk, storage, key-management, and observability providers are not configured.
- Sponsor/bounty eligibility can change and must be rechecked near execution/submission.
- Source chains included in the demo are not chosen.

### Verifier

- Standalone static web app, main-app route with independent worker, CLI/library, or combined delivery is not finalized.
- Public hosting and version-discovery behavior are unresolved.

### Design

- No logo or brand asset exists.
- Dark mode is designed but not prioritized.
- No component primitive library or icon package is installed.

## 13. Time-sensitive facts that must be reverified

Do not persist these as eternal truth:

- Monad chain IDs, RPC endpoints, explorer URLs, gas behavior, reserve requirements, and deployment guidance.
- Canonical USDC address and supported settlement tooling.
- Hackathon target network, deadline, tracks, resources, and bounty requirements.
- Sponsor perks and required SDK/integration evidence.
- Provider capabilities, pricing, quotas, privacy terms, and SDK versions.

At execution time, use current official primary sources. Store verified values in validated configuration and an actual deployment manifest, not in business logic or this memory file.

## 14. Explicit scope exclusions

The current MVP is not:

- A generic wallet dashboard.
- A prediction market or wagering product.
- A token-trading terminal.
- A lending, yield, staking, derivative, launchpad, or collectibles product.
- A contributor reputation network.
- A broad accounting suite.
- An autonomous AI treasury agent.

Markets, portfolio positions, wager inputs, oracle disputes, claims, swaps, and treasury conversion patterns appear in `DESIGN.md` only as conditional future guidance. They are not authorization to build those features.

Do not add a sponsor integration because it is available. It must strengthen a required user outcome and be demonstrable.

## 15. What future agents must never assume

- Do not assume planned technology is installed.
- Do not assume a provider account or credential exists.
- Do not assume any address, chain, token, explorer, contract, or deployment is valid.
- Do not assume mainnet or testnet is the target.
- Do not assume a database, bucket, secret manager, or hosted environment exists.
- Do not assume a UI state is authoritative without contract/receipt rules.
- Do not assume an admin may read all evidence.
- Do not assume an imported transaction is independently verified.
- Do not assume AI confidence means truth.
- Do not assume “verified” applies to more than the named check.
- Do not assume documentation completion means implementation completion.
- Do not mark tasks or phases complete without recorded verification evidence.

## 16. Handoff protocol

At the end of an implementation task, update memory only if durable project state changed.

### Required handoff actions

1. Update the task status and evidence in `TASKS.md`.
2. Update the phase status/evidence in `PHASES.md` only when a gate changes.
3. Update this file’s repository snapshot, current execution state, decisions, issues, and last-verified date when affected.
4. Link any new ADR, schema version, manifest, migration, security report, or test artifact.
5. State what was verified and what remains assumed.
6. Never store secret or private values in the handoff.

### Good memory entry

```text
2026-09-20 — PRO-002 complete. Canonical schema v1 vectors pass in TypeScript
and Solidity-facing encoder. Schema hash: <public artifact reference>. Founder
gate pending. No deployment performed.
```

### Bad memory entry

```text
Contracts basically done. RPC and token should be correct. Continue with UI.
```

Memory must be factual, attributable, concise, and useful to the next agent.

## 17. Decision log

Record only accepted durable decisions. Proposals stay in “Known issues and unresolved decisions.”

| Date | Decision | Status | Source |
|---|---|---|---|
| 2026-09-15 | Clario’s product is a private-evidence, exact-version expense workflow anchored on Monad | Accepted | `prd.md` |
| 2026-09-15 | Monad stores commitments and public workflow facts, not private expense content | Accepted | ADR-001 |
| 2026-09-15 | Material edits create immutable successor versions and invalidate settlement authority of stale approval | Accepted | ADR-002 |
| 2026-09-15 | AI remains advisory; human approval and treasury authority remain authoritative | Accepted | ADR-003 |
| 2026-09-15 | Independent verification is separate from Clario’s authenticated database | Accepted | ADR-004 |
| 2026-09-15 | MVP uses one primary provider per capability | Accepted | ADR-005 |
| 2026-09-15 | A real supported-USDC reimbursement on Monad is part of the core proof | Accepted | ADR-006 |
| 2026-09-15 | UI direction is Evidence Ledger with Proof Spine and Commitment Stamp | Accepted | `DESIGN.md` |
| 2026-09-15 | Implementation follows gated phases and atomic one-task execution | Accepted | `PHASES.md`, `TASKS.md` |
| 2026-09-15 | Foundation uses pnpm workspaces on Node.js 24.15.x, Next.js 16.3.x, and Foundry 1.7.x | Accepted and verified | `FND-001` |
| 2026-09-15 | CI uses GitHub Actions with immutable action SHAs, credential-free quality gates, Gitleaks, and a high/critical production-audit blocking policy | Accepted locally; remote activation pending | `FND-002`, `docs/CI.md` |
| 2026-09-15 | Runtime addresses come only from a strict deployment manifest matching environment, chain family, chain ID, and source commit; raw `NEXT_PUBLIC_*` configuration is prohibited | Accepted and verified | `FND-003`, architecture section 18 |
| 2026-09-15 | MVP threat model approved; 12 trust boundaries, 18 P0 threats, R-001..R-010 mapping, and 6 explicit release blockers established | Accepted and verified | `SEC-001`, `THREAT_MODEL.md` |
| 2026-09-15 | Canonical Expense Schema v1, Evidence Manifest Schema v1, RFC 8785 canonicalization, and commitment pipeline frozen | Accepted and verified | `PRO-001`, `docs/CANONICAL_SCHEMA_V1.md` |
| 2026-09-16 | Cross-runtime golden commitment vectors frozen across TypeScript and Solidity runtimes | Accepted and verified | `PRO-002`, `golden_vectors_v1.json` |
| 2026-09-16 | Public identifiers nominally branded; lifecycles define distinct transaction stages; approval typed data binds exact domain, chain, contract, version, nonce, expiry; errors fail closed on unknown codes | Accepted and verified | `PRO-003`, `@clario/protocol` |
| 2026-09-16 | Workspace registry onchain with creator OWNER_ROLE, scoped permissions (OWNER, ADMIN, APPROVER, TREASURY, AUDITOR), policy version/commitment history, and historical authority queries | Accepted and verified | `CHN-001`, `contracts` |
| 2026-09-16 | Expense registry onchain with monotonic version progression, predecessor validation, and supersession tracking | Accepted and verified | `CHN-002`, `contracts` |
| 2026-09-16 | Decision registry onchain with direct/relayed EIP-712 exact-version approval, self-approval prevention, and supersession invalidation | Accepted and verified | `CHN-003`, `contracts` |
| 2026-09-16 | Settlement registry onchain with atomic ERC-20 reimbursement, TREASURY_ROLE authority, and duplicate settlement guards | Accepted and verified | `CHN-004`, `contracts` |
| 2026-09-16 | ClarioRegistry coordinator contract, deterministic deployment engine, schema-valid manifest generator with silent overwrite protection, and verification runbook | Accepted and verified | `CHN-005`, `contracts`, `packages/protocol` |
| 2026-09-16 | Append-only PostgreSQL schema with 20 tables, integer base units NUMERIC(78,0), TIMESTAMPTZ, active settlement partial unique index, current-version FK, and checksummed migrator | Accepted and verified | `APP-001`, `packages/database`, `docs/DATABASE_MIGRATIONS.md` |
| 2026-09-17 | Nonce-based EIP-4361 authentication, HMAC-SHA256 session management with rotation/CSRF, server-side scoped authorization policy, self-approval prevention, admin evidence isolation, and recent confirmation | Accepted and verified | `APP-002`, `apps/web` |
| 2026-09-17 | AES-256-GCM envelope encryption with unique DEKs/IVs, canonical JSON AAD context binding, KEK wrapping, opaque storage keys (`evidence/<ws>/<ev>.enc`), path traversal defense, and admin evidence isolation | Accepted and verified | `APP-003`, `apps/web` |
| 2026-09-17 | Workspace creation and role management workflow with viem calldata generation, intent review dialog, lifecycle state tracking, last-owner protection, and Monad role reconciliation | Accepted and verified | `APP-004`, `apps/web` |
| 2026-09-17 | Manual expense drafts with integer base-unit parsing, envelope-encrypted offchain storage, evidence attachment integration, autosave, and workspace isolation | Accepted and verified | `EXP-001`, `apps/web` |
| 2026-09-17 | Attributable transaction import with normalized transaction schema, provider-neutral adapter, memory caching, candidate deduplication, and immutable provenance disclaimers | Accepted and verified | `EXP-002`, `apps/web` |
| 2026-09-17 | Canonical expense submission with RFC 8785 manifest/record hashing, golden commitment verification, calldata privacy scanner, secure salt encryption, and Monad submitVersion preparation/reconciliation | Accepted and verified | `EXP-003`, `apps/web` |
| 2026-09-17 | Authorized review queue and exact-version detail view with field-level material diff computation, APPROVER_ROLE enforcement, self-approval blocking, stale/superseded version warnings, in-modal evidence preview preserving review state, and 4-milestone Proof Spine rail | Accepted and verified | `REV-001`, `apps/web` |
| 2026-09-17 | Exact-version decision recording and supersession engine with direct/relayed EIP-712 support, self-approval prevention, mandatory reason commitments, and successor draft creation with predecessor binding | Accepted and verified | `REV-002`, `apps/web` |

## 18. Memory maintenance rules

- Update `Last verified` whenever repository state or durable decisions change.
- Distinguish `Verified`, `Accepted`, `Planned`, `Open`, `Blocked`, and `Deprecated`.
- Never record a proposal as a decision before approval.
- Never mark a provider, integration, deployment, address, or test as working without evidence.
- Keep historical decisions; mark superseded entries rather than deleting context needed to understand compatibility.
- Remove stale operational detail that is already authoritative elsewhere, but retain a link and the decision’s consequence.
- Do not copy full logs, source files, schemas, or task checklists into memory.
- Do not store secrets, private evidence, personal data, salts, credentials, or live sensitive endpoints.
- When compaction is necessary, preserve product invariants, accepted ADRs, current phase/task, deployments/manifests, schema versions, unresolved blockers, and security incidents first.

## 19. Founder’s continuation brief

With `SEC-001`, `PRO-001`..`PRO-003`, `CHN-001`..`CHN-005`, `APP-001`..`APP-004`, `EXP-001`..`EXP-003`, `REV-001`, and `REV-002` complete, Phase 1 (Protocol foundation), Phase 2 (Private workspace and evidence foundation), and Phase 3 (Verifiable expense core) are fully implemented, and Phase 4 (Approval integrity and indexing) is actively in progress with 95 passing Forge tests, 117 passing protocol tests, 15 passing database tests, and 277 passing web tests (504 total tests monorepo-wide). The next safe move on the critical path is `IDX-001 — Implement idempotent event indexing` (Phase 4 — Approval integrity and indexing) following the one-task execution protocol.

Build the narrow proof chain before adding polish. Keep private data offchain. Freeze canonical bytes before dependent layers. Make every approval and reimbursement refer to the exact current version. Treat AI and providers as fallible. Make failures recoverable and idempotent. Show only real state. Leave the product independently verifiable.

If forced to choose between a wider demo and a defensible proof, choose the defensible proof.
