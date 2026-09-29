# Clario Execution Tasks

**Status:** Active founding backlog  
**Version:** 1.0  
**Current phase:** Phase 6 — Intelligence, design, and resilience  
**Next task:** `DES-001 — Implement the design foundation`  
**Execution model:** One task, one verified outcome, one handoff  
**Source documents:** [Phases](./PHASES.md) · [PRD](./prd.md) · [Architecture](./architecture.md) · [Design](./DESIGN.md) · [Engineering rules](./RULES.md)

> Clario’s critical path is private evidence → immutable version → authorized exact-version decision → Monad reimbursement → independent verification. Tasks that do not strengthen this chain are secondary.

## 0. Source note

This checklist implements the stage gates in `PHASES.md`, derived from `prd.md` sections 20–21 and `architecture.md` section 20. Phase names, dependencies, acceptance gates, and task status must remain synchronized without rewriting completed history.

No implementation files exist at the time of this document. Every task is initially unchecked. A checkbox records verified repository state, never intention or partial progress.

## 1. How agents must use this file

### Status syntax

- `[ ]` — ready or not started.
- `[~]` — in progress; only one task may have this state.
- `[x]` — complete and verified.
- `[!]` — blocked; the blocker is written under the task.
- `[-]` — intentionally removed by a recorded founder decision.

Markdown renderers may not display `[~]` or `[!]` as checkboxes. They are deliberate machine-readable status markers.

### One-task protocol

1. Read `RULES.md` and the source sections named by the task.
2. Confirm every dependency is `[x]`.
3. Change the selected task from `[ ]` to `[~]` before implementation.
4. Inspect the current repository; do not assume a file, framework, dependency, route, address, or provider exists.
5. Implement only the task’s deliverables and the smallest required supporting change.
6. Run the listed verification plus any risk-appropriate tests required by `RULES.md`.
7. Review the diff for private data, fake data, unrelated edits, and architectural drift.
8. Record evidence in the task’s `Evidence` line.
9. Mark `[x]` only when every acceptance criterion passes.
10. Update `Next task` at the top to the first unblocked critical-path task.

An agent must not start the next task merely because time remains. Finish and hand off the current task first.

### Required completion note

Use this exact structure beneath a completed task:

```text
Evidence: <tests/commands/artifacts and concise result>
Completed: <YYYY-MM-DD> by <human or agent identifier>
Notes: <remaining non-blocking limitations, or “None”>
```

Do not paste secrets, private evidence, live personal data, or full noisy logs into this file.

## 2. Global definition of ready

A task is ready only when:

- Every declared dependency is `[x]`.
- Required product decisions are resolved or explicitly scoped out.
- Necessary source files, credentials, and provider access are available without exposing secrets.
- The target environment and chain are unambiguous for any network-related work.
- The work can be completed without weakening a rule in `RULES.md`.

If readiness fails, mark the task `[!]` and write one concrete blocker. Do not fabricate configuration or mock success to proceed.

## 3. Global definition of done

Every task must satisfy all applicable conditions:

- Requested behavior works at its real boundary.
- Tests cover success, absence, invalid input, unauthorized access, failure, retry, and stale state as relevant.
- No private data reaches public calldata, events, URLs, logs, analytics, fixtures, or snapshots.
- No fake address, hash, transaction, balance, metric, integration, or verification result is presented as real.
- Exact-version, authority, idempotency, and settlement invariants remain intact.
- UI work meets `DESIGN.md` accessibility and responsive gates.
- New dependencies are justified and locked.
- Documentation matches implemented behavior.
- The diff contains no unrelated change.
- External writes or deployments remain unexecuted unless explicitly authorized.

## 4. Critical path

```text
FND-001 → FND-002 → PRO-001 → PRO-002 → PRO-003
                                      ├→ APP-001 → APP-002 → APP-003 → APP-004
                                      └→ CHN-001 → CHN-002 → CHN-003 → CHN-004

APP-004 + CHN-004 → EXP-001 → EXP-002 → EXP-003
EXP-003 + CHN-004 → REV-001 → REV-002 → IDX-001 → IDX-002
REV-002 + IDX-002 → SET-001 → SET-002
PRO-002 + SET-002 → VER-001 → VER-002
VER-002 → E2E-001 → REL-001 → REL-002
```

AI, sponsorship, advanced reporting, and broad multichain support are not on the critical path.

---

## Phase 0 — Foundation

### [x] FND-001 — Scaffold the repository

**Priority:** P0  
**Dependencies:** None  
**Source:** Architecture sections 4–5 and 18; `RULES.md` sections 3, 4, and 18

**Outcome:** A minimal, documented workspace exists for the Next.js PWA, contracts, shared protocol code, and tests.

**Deliverables:**

- Choose and record the package manager and supported Node version.
- Create the smallest workspace structure that cleanly separates web, contracts, shared protocol/verifier code, and configuration.
- Add root scripts for lint, type-check, test, build, and format without placeholder success commands.
- Add `.gitignore`, `.env.example`, and a concise root README setup section.
- Keep provider SDKs out until the task that needs each one.

**Acceptance criteria:**

- A clean checkout can install dependencies and run every root quality command.
- No command silently skips a missing workspace.
- No secrets, live addresses, or fake production configuration exist.
- Existing founding documents remain at the project root and linked from the README.

**Verification:** Run install, lint, type-check, test, and build from the repository root.

**Evidence:** Verified 2026-09-15 with `pnpm install --frozen-lockfile --offline`, `pnpm peers check`, and `pnpm check`. The complete gate passed: ESLint, TypeScript, Vitest (2 tests), Forge (1 test), Next.js production build, protocol package build, Solidity build, Prettier, and Forge formatting.

### [!] FND-002 — Establish CI and repository quality gates

**Priority:** P0  
**Dependencies:** `FND-001`  
**Source:** `RULES.md` sections 18, 20, and 21

**Outcome:** Pull requests and release candidates cannot merge with broken foundational checks.

**Deliverables:**

- CI jobs for locked dependency install, lint, type-check, unit tests, contract tests, and build.
- Secret scanning and dependency audit with documented severity policy.
- Cache configuration that does not cache secrets or environment files.
- Branch-independent commands identical to local scripts.

**Acceptance criteria:**

- A known failing lint, type, unit, and contract fixture each fails the correct job during local validation, then is removed.
- CI requires no production credential.
- Logs contain no environment dump or secret values.

**Verification:** Validate the workflow syntax and run its underlying commands locally.

**Blocker:** Git metadata and a GitHub remote are unavailable in this workspace. The workflow cannot run remotely and its five checks cannot yet be selected in a protected-branch ruleset, so merge enforcement is not verified.

**Evidence:** Local implementation verified 2026-09-15. Actionlint `1.7.12` accepted `.github/workflows/ci.yml`; checksum-verified Gitleaks `8.30.1` scanned approximately 506 KB with no leaks; `pnpm audit:dependencies` reported no known production vulnerabilities; frozen install, peer check, and `pnpm check` passed. Temporary lint, type, unit, and Solidity fixtures each produced the expected non-zero gate result and were removed; the clean gate then passed.

### [x] FND-003 — Define configuration schema and environment boundaries

**Priority:** P0  
**Dependencies:** `FND-001`  
**Source:** Architecture section 18; `RULES.md` sections 14–15

**Outcome:** Local, preview, staging, and demo/production configuration fail closed and cannot mix networks.

**Deliverables:**

- Typed server and public configuration schemas.
- Explicit environment discriminator and chain configuration object.
- Startup validation for required variables and cross-field consistency.
- Safe `.env.example` placeholders.
- Deployment-manifest schema without any fabricated address.

**Acceptance criteria:**

- Missing, malformed, mixed-network, or secretly public variables fail startup with safe errors.
- Chain ID and addresses are read from one validated configuration path.
- No hostname inference or duplicated chain constants exist.

**Verification:** Unit-test valid and invalid configuration matrices.

**Evidence:** Verified 2026-09-15 with a 31-case configuration suite covering valid local/hosted inputs, missing and malformed values, HTTPS enforcement, public-variable disclosure, direct-address rejection, manifest shape, and environment/chain/source mismatches. Missing startup configuration failed closed with `MISSING_VALUE`; valid isolated local configuration started and returned HTTP 200. Frozen install, peer validation, 32 web tests, the protocol and Forge tests, lint, type-check, builds, formatting, Actionlint, and Gitleaks all passed.

**Completed:** 2026-09-15 by Codex  
**Notes:** No live network value, address, credential, deployment, or hostname inference was introduced.

### [x] SEC-001 — Commit the MVP threat model

**Priority:** P0  
**Dependencies:** `FND-001`  
**Source:** Architecture sections 3.1 and 16; PRD section 14

**Outcome:** Trust boundaries, protected assets, threats, and owners are reviewable before sensitive implementation begins.

**Deliverables:**

- Data-flow diagram covering browser, API, database, object storage, wallet, Monad, indexer, source-chain provider, and AI provider.
- Threat register for private leakage, broken object authorization, signature replay, stale approval, duplicate reimbursement, recipient substitution, prompt injection, reorganization, and dependency compromise.
- Mitigation, detection, owner, and validation method for each P0 threat.

**Acceptance criteria:**

- Every public/private boundary in the architecture is represented.
- Every founder-level invariant in `RULES.md` maps to at least one control and test.
- Unresolved high-severity risks are explicit blockers, not footnotes.

**Verification:** Founder/security review of the threat model against the architecture.

**Evidence:** Verified and approved 2026-09-15 by human founder Sythe following independent review against RULES.md, architecture.md, and PRD section 14. The threat model validates 12 trust boundaries, 18 P0 threats with mitigations/detection/owners/validation, R-001 through R-010 invariant crosswalk, release-blocking test suites, and 6 explicit unresolved high-severity blockers. Clean repository gate (`pnpm check`) passed, dependency audit reported 0 high/critical vulnerabilities, and checksum-verified Gitleaks 8.30.1 reported 0 leaks across ~570 KB.

**Completed:** 2026-09-15 by Sythe (Founder)  
**Notes:** None. Approval of the model does not resolve underlying blockers, which strictly constrain subsequent phases.

---

## Phase 1 — Protocol foundation

### [x] PRO-001 — Specify canonical expense schema v1

**Priority:** P0  
**Dependencies:** `FND-001`, `SEC-001`  
**Source:** Architecture section 7; PRD sections 9.4–9.7; `RULES.md` section 7

**Outcome:** One versioned, deterministic schema defines the exact private record and evidence manifest committed by Clario.

**Deliverables:**

- Field definitions, types, required/optional behavior, privacy class, and material-edit status.
- Canonical encoding rules for UTF-8, Unicode, addresses, integers, token base units, timestamps, nulls, arrays, and evidence ordering.
- Domain constants and commitment construction.
- Versioning and backward-compatibility policy.

**Acceptance criteria:**

- No runtime-dependent JSON serialization remains unspecified.
- Every field is classified public, confidential, evidence-confidential, or security-sensitive.
- Every approval-material field is explicit.
- The schema can be implemented independently from the prose.

**Verification:** Independent review using at least two language/runtime examples.

**Evidence:** Verified 2026-09-15. Authoritative specification committed to `docs/CANONICAL_SCHEMA_V1.md`. Types, field privacy/materiality tables, RFC 8785 JCS canonicalization, and strict schema validation implemented in `@clario/protocol` with 15 passing tests across two independent serialization routines. Full gate (`pnpm check`) passed with 0 lint warnings, clean formatting, passing builds, 0 dependency vulnerabilities, and 0 secrets detected across ~613 KB.

**Completed:** 2026-09-15 by Codex  
**Notes:** Golden vectors suite is tracked in `PRO-002`.

### [x] PRO-002 — Build cross-runtime golden commitment vectors

**Priority:** P0  
**Dependencies:** `PRO-001`  
**Source:** Architecture sections 7.1 and 19.2

**Outcome:** Server, browser, contract-facing library, and verifier produce identical hashes for edge cases.

**Deliverables:**

- Versioned golden-vector fixture format.
- Cases for Unicode normalization, absent optionals, decimals/base units, address case, timestamp precision, evidence order, empty arrays, and different salts.
- Valid expected canonical bytes, intermediate hashes, and final commitment.
- Tampered and malformed negative cases.

**Acceptance criteria:**

- At least two independent implementations match every valid vector.
- A one-byte material change changes the final commitment.
- Same record with different 32-byte salts produces different commitments.
- Fixtures contain no real private or production data.

**Verification:** Run golden-vector suites in every implemented runtime.

**Evidence:** Verified 2026-09-16. Fixture `packages/protocol/src/fixtures/golden_vectors_v1.json` committed with 10 valid vectors, 8 tampered vectors, and 11 malformed vectors. Implemented `computeExpenseCommitmentV1` and `verifyExpenseCommitmentV1` in `@clario/protocol` (passing 33 test cases, including secondary independent serializer parity). Implemented pure Solidity library `ClarioCommitmentV1.sol` and test suite `ClarioCommitmentV1.t.sol` in `contracts` (passing all 11 vector and tamper tests in Forge). Complete repository gate (`pnpm check`) passed with 48 protocol unit tests, 32 web tests, 12 forge tests, zero lint warnings, clean builds, and zero production dependency vulnerabilities.

**Completed:** 2026-09-16 by Codex  
**Notes:** None. No live deployment or credentials introduced. All fixtures use synthetic test data.

### [x] PRO-003 — Publish public protocol types and error vocabulary

**Priority:** P0  
**Dependencies:** `PRO-001`, `PRO-002`  
**Source:** Architecture sections 6 and 10.7

**Outcome:** Shared identifiers, state enums, event payloads, typed data, and errors have one authoritative definition.

**Deliverables:**

- Types for workspace, expense version, evidence manifest, decision, settlement, transaction lifecycle, and verification result.
- Stable error codes including authorization, version mismatch, stale approval, duplicate settlement, unsupported chain/token, and unverifiable evidence.
- Serialization tests and exhaustive enum handling.

**Acceptance criteria:**

- Public/private fields cannot be confused by structurally identical loose objects.
- Unknown enum values fail safely.
- Human messages do not expose secrets or private cross-workspace data.

**Verification:** Type-level tests plus serialization and unknown-value tests.

**Evidence:** Verified 2026-09-16. Implemented branded nominal public identifiers (`WorkspaceId`, `ExpenseId`, `ExpenseVersion`, `CommitmentHash`, `DecisionId`, `PolicyVersion`, `PolicyCommitment`, `PaymentReference`, `EvmAddress`, `Bytes32`, `ChainId`, `RequestId`) in `packages/protocol/src/identifiers.ts`. Defined complete state enums and lifecycles in `packages/protocol/src/lifecycle.ts` (`ExpenseLifecycleState`, `DecisionLifecycleState`, `SettlementLifecycleState`, `TransactionLifecycleState` with 7 distinct uncollapsed stages, `VerificationResult`, `WorkspaceRole`, role keccak hashes, `OnchainDecision`, and `assertNever` compile-time exhaustiveness). Implemented all 8 public event payloads in `packages/protocol/src/events.ts` free of private evidence/merchant data. Implemented EIP-712 approval domain, message types, and validators in `packages/protocol/src/approval.ts`. Implemented architecture §10.7 error envelope, codes, and safe parsers in `packages/protocol/src/errors.ts`. Exported all modules from root `index.ts`. All 105 tests across 8 test files in `@clario/protocol` pass, and monorepo checks (`pnpm check` including 32 web tests, 105 protocol tests, 12 forge tests, zero lint warnings, formatting, and builds) and `pnpm audit:dependencies` pass cleanly. Git metadata was unavailable in the workspace environment so diff/clean-checkout validation could not be performed.

**Completed:** 2026-09-16 by Antigravity  
**Notes:** Git metadata unavailable in environment. No private data or fake addresses/providers introduced. Direct typed-data definition and runtime validation only; no wallet signing or contract execution added.

### [x] CHN-001 — Implement workspace roles and policy history

**Priority:** P0  
**Dependencies:** `PRO-003`  
**Source:** Architecture section 6.1; PRD section 9.2

**Outcome:** Workspace ownership, scoped grants, revocations, and historical authority are enforced onchain.

**Deliverables:**

- Workspace creation and role grant/revoke behavior.
- `OWNER_ROLE`, `ADMIN_ROLE`, `APPROVER_ROLE`, `TREASURY_ROLE`, and `AUDITOR_ROLE`.
- Policy version/commitment support and queryable authority history.
- Events containing only approved public fields.

**Acceptance criteria:**

- Unauthorized grants/revocations fail.
- Revocation blocks new privileged action while historical authority remains reconstructable.
- Cross-workspace role reuse fails.
- Events contain no private identifiers or labels.

**Verification:** Unit, fuzz, permission, and event-decoding tests.

**Evidence:** Verified 2026-09-16. Implemented `IClarioWorkspaceRegistryV1` and `ClarioWorkspaceRegistryV1` in `contracts/src/protocol/v1/`. Built workspace creation with creator granted `OWNER_ROLE` and initial `policyVersion = 1`. Implemented scoped role authority with hierarchical fallback (`bytes32(0)` global scope), owner/admin permission boundaries, last-owner revocation guard, policy version history, and historical authority queries (`wasRoleAuthorizedAtBlock`, `wasRoleAuthorizedAtPolicyVersion`). Created test suite `ClarioWorkspaceRegistryV1.t.sol` with 24 tests (including 256 fuzz runs for workspace isolation and authority), passing all tests. Emitted events match architecture §6.4 (`WorkspaceCreated`, `RoleGranted`, `RoleRevoked`, `PolicyUpdated`) containing zero private labels or fields. Full monorepo check (`pnpm check`) and production audit (`pnpm audit:dependencies`) passed with 36 Foundry tests, 32 web tests, 105 protocol tests, and 0 vulnerabilities.

**Completed:** 2026-09-16 by Antigravity  
**Notes:** Git metadata unavailable in environment. No live contract deployment, external wallet signing, or RPC transactions performed.

### [x] CHN-002 — Implement immutable expense-version registry

**Priority:** P0  
**Dependencies:** `CHN-001`, `PRO-002`  
**Source:** Architecture sections 6.1 and 6.5

**Outcome:** Contracts register an ordered, immutable commitment chain and expose the current version.

**Deliverables:**

- Submit-version function and submitted/superseded events.
- Monotonic version and predecessor commitment checks.
- Current-version lookup.
- Pause behavior that preserves historical reads.

**Acceptance criteria:**

- Version reuse, skipped predecessor, wrong prior commitment, and cross-workspace collision fail.
- Submission marks exactly one current version.
- Superseded history remains unchanged and queryable.

**Verification:** Unit, fuzz, invariant, pause, and event tests.

**Evidence:** Verified 2026-09-16. Implemented `IClarioExpenseRegistryV1` and `ClarioExpenseRegistryV1` in `contracts/src/protocol/v1/`. Built monotonic versioning (`submitVersion`) requiring `previousCommitment == bytes32(0)` for version 1 and `version == currentVersion + 1` with matching `previousCommitment == currentCommitment` for successor versions. Implemented automatic supersession marking previous version superseded and maintaining exactly one active current version, emitting `ExpenseVersionSubmitted` and `ExpenseVersionSuperseded`. Built workspace pause controls restricted to `OWNER_ROLE` via `IClarioWorkspaceRegistryV1`, preserving historical reads (`getCommitment`, `getSubmitter`, `getSubmittedAtBlock`, `isVersionSuperseded`, `isCurrentVersion`) while halted. Created test suite `ClarioExpenseRegistryV1.t.sol` with 19 tests (including 256 fuzz runs), all passing. Full repository gate (`pnpm check`) and production dependency audit (`pnpm audit:dependencies`) passed cleanly with 55 Forge tests, 32 web tests, 105 protocol tests, 0 lint warnings, and 0 vulnerabilities.

**Completed:** 2026-09-16 by Antigravity  
**Notes:** Git metadata unavailable in environment. No live contract deployment, external wallet signing, or RPC transactions performed.

### [x] CHN-003 — Implement exact-version decision registry

**Priority:** P0  
**Dependencies:** `CHN-001`, `CHN-002`  
**Source:** Architecture sections 6.1 and 7.3; PRD section 9.8

**Outcome:** Authorized reviewers record approve, reject, or request-changes decisions for one exact current commitment.

**Deliverables:**

- Decision enum, record operation, event, and validity lookup.
- Authority and current-version checks.
- Reason commitment support.
- Nonce/domain/expiry validation for relayed typed signatures if included in MVP.

**Acceptance criteria:**

- Unauthorized, stale, wrong-commitment, replayed, wrong-chain, wrong-contract, and expired decisions fail.
- Supersession invalidates settlement authority without deleting historical approval.
- Direct calls and relayed signatures share equivalent authorization outcomes.

**Verification:** Unit, fuzz, replay, domain-separation, and invariant tests.

**Evidence:** Verified 2026-09-16. Implemented `IClarioDecisionRegistryV1` and `ClarioDecisionRegistryV1` in `contracts/src/protocol/v1/`. Supported both direct calls (`recordDecision`) and relayed EIP-712 typed data signatures (`recordDecisionBySig` using `ApprovalAuthorization` matching `@clario/protocol`). Enforced: role authority (`APPROVER_ROLE`), current active version binding, exact commitment matching, mandatory reason commitment for `Reject` and `RequestChanges`, self-approval prohibition (`SelfApprovalNotAllowed`), single-decision per version, replay protection via sequential nonces, deadline expiration checks, policy version matching, domain separation, and pause protection. Implemented `isApprovalValid` verifying `Approve` decision, unsuperseded state, and current version/commitment match. Supersession immediately invalidates settlement validity while preserving historical records. Test suite `ClarioDecisionRegistryV1.t.sol` passed all 20 tests (including 256 fuzz runs). Full repository check (`pnpm check`) and production audit (`pnpm audit:dependencies`) passed cleanly across 75 Forge tests, 32 web tests, 105 protocol tests, 0 lint warnings, and 0 vulnerabilities.

**Completed:** 2026-09-16 by Antigravity  
**Notes:** Git metadata unavailable in environment. No live contract deployment, external wallet signing, or RPC transactions performed.

### [x] CHN-004 — Implement settlement registry and duplicate guard

**Priority:** P0  
**Dependencies:** `CHN-003`  
**Source:** Architecture sections 6.1 and 6.5; PRD section 9.9

**Outcome:** A supported token reimbursement is atomically or verifiably tied to the approved current version.

**Deliverables:**

- Settlement operation/event and settled-state lookup.
- Exact token, recipient, amount, version, and commitment binding.
- One active standard settlement per version.
- Safe token handling and reentrancy protection where transfer occurs in-contract.

**Acceptance criteria:**

- Unapproved, superseded, mismatched, unauthorized, duplicate, failed-transfer, and malicious-token cases fail safely.
- A failed attempt does not mark settlement complete.
- The emitted event is sufficient for independent matching.

**Verification:** Unit, fuzz, invariant, reentrancy, malicious-token, and duplicate tests.

**Evidence:** Verified 2026-09-16. Implemented `IClarioSettlementRegistryV1` and `ClarioSettlementRegistryV1` in `contracts/src/protocol/v1/`. Built atomic ERC-20 reimbursement (`reimburse`) bound to workspace, expense ID, current version, exact commitment, recipient address, base-unit amount, and payment reference (both explicit and deterministic fallback). Enforced `TREASURY_ROLE` authority via `IClarioWorkspaceRegistryV1`, active valid approval via `IClarioDecisionRegistryV1.isApprovalValid`, and current unsuperseded version via `IClarioExpenseRegistryV1`. Enforced strict duplicate settlement prevention (`_isSettled` mapping reverting with `DuplicateSettlement`), native safe ERC-20 transfer handling non-standard returns, and custom non-reentrant mutex (`ReentrancyGuardReentrantCall`). Verified in `ClarioSettlementRegistryV1.t.sol` (15 tests passing, including 256 fuzz runs and reentrancy/failed transfer tests). Full repository gate (`pnpm check`) and production audit (`pnpm audit:dependencies`) passed cleanly with 90 Forge tests across 6 suites, 32 web tests, 105 protocol tests, 0 lint warnings, and 0 vulnerabilities.

**Completed:** 2026-09-16 by Antigravity  
**Notes:** Git metadata unavailable in environment. No live contract deployment, external wallet signing, or RPC transactions performed.

### [x] CHN-005 — Create deployment and source-verification tooling

**Priority:** P0  
**Dependencies:** `CHN-004`, `FND-003`  
**Source:** Architecture section 18; `RULES.md` section 15

**Outcome:** Contracts can be reproducibly deployed and verified without hardcoded live addresses.

**Deliverables:**

- Deterministic deployment script/configuration.
- Dry-run/simulation mode.
- Deployment-manifest generation from actual receipts.
- Source-verification command and runbook.

**Acceptance criteria:**

- Local deployment completes and produces a schema-valid manifest.
- Re-running does not overwrite an existing manifest silently.
- No live deployment or transaction is executed by this task.

**Verification:** Deploy to local EVM twice under isolated output paths; verify manifest contents.

**Evidence:** Verified 2026-09-16. Implemented coordinator contract `IClarioRegistry` and `ClarioRegistry` in `contracts/src/protocol/v1/` binding modular registries (`ClarioWorkspaceRegistryV1`, `ClarioExpenseRegistryV1`, `ClarioDecisionRegistryV1`, `ClarioSettlementRegistryV1`), tested with 5 Foundry tests (`ClarioRegistry.t.sol`). Created deployment and manifest engine in `packages/protocol/src/deploy/` (`manifest.ts`, `deploy.ts`) supporting dry-run simulation mode, receipt extraction, RFC 8785 ABI hashing, schema version 1 validation, and silent overwrite protection. Created CLI entrypoints `scripts/deploy.mjs` and `scripts/verify.mjs`, and authorative runbook `docs/DEPLOYMENT_AND_VERIFICATION.md`. Verified via automated Vitest suite (`deploy.test.ts`) spawning local Anvil, testing dry-run mode, deploying twice to isolated output paths, verifying schema validity against `parseDeploymentManifest` from `apps/web/src/config/schema.ts`, and proving silent overwrite refusal unless `--force` is supplied. Complete monorepo quality gate (`pnpm check`) and audit (`pnpm audit:dependencies`) passed cleanly with 95 Forge tests, 117 protocol tests, 32 web tests, 0 lint warnings, and 0 vulnerabilities.

**Completed:** 2026-09-16 by Antigravity  
**Notes:** Git metadata unavailable in environment. No live contract deployment, external wallet signing, RPC transactions, or live funds used.

---

## Phase 2 — Private workflow

### [x] APP-001 — Create PostgreSQL schema and migrations

**Priority:** P0  
**Dependencies:** `PRO-003`, `FND-003`  
**Source:** Architecture section 9

**Outcome:** Operational data supports workspaces, immutable versions, evidence, decisions, reimbursements, projections, jobs, and idempotency.

**Deliverables:**

- Append-only migrations for required entities and relationships.
- Workspace isolation, unique version, source-transaction, decision, and active-settlement constraints.
- Integer base-unit amounts and UTC timestamps.
- Migration test fixtures containing no personal data.

**Acceptance criteria:**

- Constraints reject duplicate and orphaned state.
- Current expense version must reference an existing version.
- Clean database migrates from zero; representative rollback/recovery is documented.

**Verification:** Migration, constraint, isolation, and representative-data tests.

**Evidence:** Verified 2026-09-16. Implemented append-only PostgreSQL schema and migrations in `@clario/database` (`packages/database/migrations/0001_initial_schema.up.sql` and `0001_initial_schema.down.sql`) defining 20 operational tables: `users`, `wallet_identities`, `workspaces`, `workspace_policies`, `memberships`, `role_grants`, `expenses`, `expense_versions`, `evidence_objects`, `source_transactions`, `ai_analyses`, `review_assignments`, `decisions`, `reimbursements`, `chain_transactions`, `indexed_events`, `audit_events`, `exports`, `jobs`, `idempotency_keys`, and `schema_migrations`. Enforced strict database constraints: workspace isolation, unique version `(workspace_id, expense_id, version)`, current version referential integrity (`fk_expenses_current_version`), predecessor commitment rules, duplicate settlement guard via partial unique index `idx_reimbursements_active_unique` on active reimbursements, source transaction uniqueness `(workspace_id, source_chain_id, source_transaction_hash, claim_slot)`, decision reason commitment check for rejections, idempotency key uniqueness, integer base-unit amounts (`NUMERIC(78, 0)`), UTC timestamps (`TIMESTAMPTZ`), and orphan rejection via `ON DELETE RESTRICT`. Created checksum-verified `Migrator` engine with forward migration, single-step rollback, status, and tampering detection. Created synthetic test fixtures with strictly zero personal data (`fixtures/index.ts`). Created CLI tool `scripts/migrate.mjs` and runbook `docs/DATABASE_MIGRATIONS.md`. Verified with 15 Vitest tests across migration lifecycle, constraint enforcement, and multi-tenant isolation suites. Monorepo quality gate `pnpm check` passed cleanly with 259 tests (95 Foundry, 117 protocol, 32 web, 15 database), 0 lint warnings, clean builds, and 0 vulnerabilities in `pnpm audit:dependencies`.

**Completed:** 2026-09-16 by Antigravity  
**Notes:** Tests run offline in-memory using `pg-mem` emulator; no live PostgreSQL instance or credentials required.

### [x] APP-002 — Implement authentication and workspace authorization

**Priority:** P0  
**Dependencies:** `APP-001`, `CHN-001`, `SEC-001`  
**Source:** Architecture sections 8.3 and 16.2

**Outcome:** Sessions bind to verified identity and every private request enforces workspace, role, scope, record, and action.

**Deliverables:**

- Nonce-based wallet authentication and secure session handling.
- Server-side authorization policy layer.
- Recent-wallet-confirmation requirement for sensitive actions.
- Safe not-found/unauthorized error behavior.

**Acceptance criteria:**

- Client-supplied address alone grants nothing.
- Cross-workspace, revoked-role, stale-session, replay, and object-guessing tests fail closed.
- Authorization decisions are consistent across API and server-rendered routes.

**Verification:** Authentication, CSRF/origin, replay, session, and authorization matrix tests.

**Evidence:** Verified 2026-09-17. Implemented nonce-based EIP-4361 wallet authentication (`challenge.ts`), HMAC-SHA256 sealed session management with rotation, cookie serialization, and CSRF defense (`session.ts`), server-side workspace authorization policy layer (`policy.ts`) enforcing scoped role authority, hierarchical scope matching, self-approval prevention (`SelfApprovalNotAllowed`), admin evidence isolation, recent confirmation assertion, and safe 404/NOT_FOUND masking against object enumeration. Implemented request helpers (`context.ts`), db accessor (`db.ts`), and 5 Next.js route handlers (`/api/auth/challenge`, `/api/auth/verify`, `/api/auth/confirm`, `/api/auth/logout`, `/api/auth/session`). Verified with 39 new Vitest unit and integration tests (71 total in `@clario/web`). Monorepo quality gate `pnpm check` passed cleanly across 203 unit tests, 95 contract tests, 0 lint warnings, clean builds, and 0 vulnerabilities in `pnpm audit:dependencies`.

**Completed:** 2026-09-17 by Antigravity  
**Notes:** None. Offline deterministic testing with no live secrets or real user data.

### [x] APP-003 — Implement encrypted evidence storage

**Priority:** P0  
**Dependencies:** `APP-001`, `APP-002`, `SEC-001`  
**Source:** Architecture section 8; `RULES.md` sections 6–7

**Outcome:** Evidence is envelope-encrypted, authorized per object, integrity-checked, and never publicly addressable.

**Deliverables:**

- Per-object/version data key and unique nonce.
- AES-256-GCM encryption with authenticated workspace/expense/version/evidence context.
- Wrapped-key reference storage and private object naming.
- Authorized upload, download, preview, replacement, and deletion paths.

**Acceptance criteria:**

- Cross-workspace/object guessing fails without revealing existence.
- Ciphertext or authenticated-context tampering fails decryption.
- Replacement creates new evidence/version state instead of overwrite.
- Logs, errors, URLs, and test snapshots contain no plaintext or key material.

**Verification:** Crypto vectors, authorization, tamper, URL-expiry, deletion, and leakage tests.

**Evidence:** Verified 2026-09-17. Implemented AES-256-GCM envelope encryption engine (`crypto.ts`) with unique 256-bit DEK generation, 96-bit random IVs, canonicalized JSON AAD binding (`{ workspaceId, expenseId, version, evidenceId }`), KEK wrapping/unwrapping, and SHA-256 integrity validation. Implemented storage driver layer (`storage.ts`) supporting `MemoryStorageDriver` and `DiskStorageDriver` with strict directory traversal protection and opaque storage key naming (`evidence/<workspaceId>/<evidenceId>.enc`). Implemented `EvidenceService` (`service.ts`) coordinating upload, download, preview, deletion, and draft replacement with multi-tenant isolation, immutability enforcement on submitted versions (`INVALID_LIFECYCLE_TRANSITION`), admin evidence isolation (denying admin access to evidence payloads without operational approver/auditor/treasury/owner role), and safe 404/NOT_FOUND masking against object enumeration. Implemented API route handlers for uploads (`/api/expenses/:expenseId/evidence`) and download/preview/delete (`/api/expenses/:expenseId/evidence/:evidenceId`) with CSRF defense and security headers (`X-Content-Type-Options: nosniff`, `Cache-Control: private, no-cache`). Verified with 45 unit, crypto vector, tamper, storage, service, and route integration tests (116 total tests in `@clario/web`). Full quality gate `pnpm check` passed (248 unit tests, 95 contract tests, clean Turbopack build with 0 warnings, 0 lint warnings) and `pnpm audit:dependencies` reported zero high-severity vulnerabilities.

**Completed:** 2026-09-17 by Antigravity  
**Notes:** None. Fully offline and deterministic. No plaintext or keys logged or exposed in URLs.

### [x] APP-004 — Implement workspace and role management workflow

**Priority:** P0  
**Dependencies:** `APP-002`, `CHN-001`  
**Source:** PRD sections 9.1–9.2; `DESIGN.md` sections 6–8

**Outcome:** An owner can create a workspace and prepare/track scoped role changes through the real wallet flow.

**Deliverables:**

- Workspace creation and member/role interfaces.
- Prepare endpoint returning calldata/typed data without signing.
- Transaction intent review and lifecycle UI.
- Indexed/confirmed role state reconciliation.

**Acceptance criteria:**

- Unsupported network, wallet rejection, failed transaction, revocation, and stale policy states are explicit.
- UI does not display a role as active before authoritative confirmation.
- Keyboard/mobile/accessibility requirements pass.

**Verification:** API integration, contract integration, UI state, and accessibility tests.

**Evidence:** Verified 2026-09-17 with 27 workspace and role management tests in `@clario/web` (calldata encoding, atomic WorkspaceService, API route handlers, and intent lifecycle UI state, bringing web test suite to 143 passing tests), Next.js Turbopack production build with 13 routes, and full quality gate `pnpm check` (95 Foundry tests, 117 protocol tests, 15 database tests, zero ESLint warnings, code style verified) and `pnpm audit:dependencies` passing with 0 vulnerabilities.
**Completed:** 2026-09-17 by Antigravity  
**Notes:** None. Calldata preparation without private key handling. Roles strictly pending until authoritative Monad block confirmation.

---

## Phase 3 — Verifiable expense core

### [x] EXP-001 — Implement manual expense drafts

**Priority:** P0  
**Dependencies:** `APP-001`, `APP-002`, `APP-003`, `PRO-001`  
**Source:** PRD sections 9.3–9.5

**Outcome:** A submitter can create, edit, autosave, validate, and recover an unsubmitted private draft with evidence.

**Deliverables:**

- Draft API and form for required expense fields.
- Base-unit amount parsing and asset metadata.
- Evidence upload/preview integration.
- Autosave, retry, validation, and unsaved-change behavior.

**Acceptance criteria:**

- Drafts are workspace-isolated and recover after refresh.
- Decimal, timestamp, address, file type/size, and missing-field cases are validated.
- No draft write publishes private data or creates an onchain version.

**Verification:** API, form, object authorization, autosave, and responsive accessibility tests.

**Evidence:** Verified 2026-09-17 with 34 automated unit and integration tests across base-unit amount parsing, Canonical Schema v1 draft validation, AES-256-GCM envelope-encrypted draft storage, workspace isolation, cascading draft deletion, and API routes (`/api/workspaces/[workspaceId]/expenses` and `/api/workspaces/[workspaceId]/expenses/[expenseId]`), bringing web test suite to 177 passing tests (404 tests monorepo-wide). Full quality gate `pnpm check` and `pnpm audit:dependencies` cleanly passed with zero warnings, zero errors, and zero vulnerabilities.
**Completed:** 2026-09-17 by Antigravity  
**Notes:** None. Unsubmitted drafts remain strictly offchain and envelope-encrypted. No onchain transactions or public commitments emitted.

### [x] EXP-002 — Implement attributable transaction import

**Priority:** P1  
**Dependencies:** `EXP-001`, `FND-003`  
**Source:** PRD section 9.3; Architecture section 4

**Outcome:** A user can select a real provider-returned transaction and retain its provenance without overstating trust.

**Deliverables:**

- Provider-neutral import adapter and normalized transaction schema.
- Pagination, caching, timeout, validation, attribution, and RPC/manual fallback.
- Duplicate candidate detection by workspace, source chain, hash, and claim slot.

**Acceptance criteria:**

- Provider, chain, hash, fetch time, and raw reference are retained.
- Malformed, stale, unsupported, failed, duplicate, and unavailable-provider cases are safe.
- UI states that imported facts are provider/source-chain data, not Monad-verified truth.

**Verification:** Adapter contract tests, normalization fixtures, timeout/fallback, and duplicate tests.

**Evidence:** Verified 2026-09-17. Implemented normalized transaction schema (`NormalizedTransaction`, `TransactionImportCandidate`, `TransactionFilter`) with mandatory immutable provenance disclaimer (`IMPORTED_FACTS_DISCLAIMER = "Imported facts are provider/source-chain records, not Monad-verified truth."`). Created supported source chain registry (`chains.ts`) covering Monad Testnet (10143), Monad Local (1337), Anvil (31337), Ethereum Mainnet (1), Sepolia (11155111), Base (8453), and Base Sepolia (84532) with explorer link generators. Implemented provider-neutral adapter architecture (`adapter.ts`): `RpcImportAdapter` (Viem public client EVM queries, block timestamps, ERC-20 transfer log decoding, timeout protection), `MockImportAdapter` (deterministic multichain test fixtures with failed transaction cases and cursor pagination), and `CompositeImportAdapter` (60s TTL memory cache and clean fallback). Implemented `TransactionImportService` (`service.ts`) coordinating candidate queries, duplicate detection against database `source_transactions` table with multi-tenant isolation, single hash lookup, and claim registration enforcing `uq_source_transactions` uniqueness on `(workspace_id, source_chain_id, source_transaction_hash, claim_slot)`. Implemented Next.js route handlers (`/api/workspaces/[workspaceId]/import/transactions`, `/api/workspaces/[workspaceId]/import/lookup`, `/api/workspaces/[workspaceId]/import/claim`) with session auth and CSRF defense. Built accessible Evidence Ledger UI components: `TransactionImportDialog` (wallet transaction browser, direct hash lookup, status badges, duplicate warnings, explorer links, and prominent disclaimer) and integrated into `ExpenseDraftEditor` with autofill. Verified with 31 automated tests across `chains.test.ts` (5), `adapter.test.ts` (6), `service.test.ts` (12), and `route.test.ts` (8), bringing web suite to 208 passing tests (435 total monorepo tests). Full quality gate `pnpm check` and `pnpm audit:dependencies` passed cleanly with zero warnings, zero errors, and zero vulnerabilities.
**Completed:** 2026-09-17 by Antigravity  
**Notes:** None. Imported facts retain full provider attribution and explicit non-authoritative disclaimers. Onchain anchoring proves private review ordering, not source-chain legitimacy.

### [x] EXP-003 — Commit and submit expense version

**Priority:** P0  
**Dependencies:** `EXP-001`, `PRO-002`, `CHN-002`, `APP-004`  
**Source:** Architecture workflow 11.1

**Outcome:** A submitter reviews canonical private data, generates a salted commitment, signs the exact intent, and tracks authoritative submission.

**Deliverables:**

- Server canonicalization and secure salt generation/storage.
- Submission preview and `/submit/prepare` behavior.
- Wallet lifecycle from preparing through confirmed/indexed.
- Persisted transaction attempt and safe refresh recovery.

**Acceptance criteria:**

- Commitment matches golden vectors.
- Prepared calldata contains only approved public fields.
- Wrong network, stale draft, wallet rejection, replacement, failure, and refresh are handled.
- UI never calls submitted state confirmed.

**Verification:** Golden vectors, calldata privacy scan, API/contract integration, transaction lifecycle, and UI tests.

**Evidence:** Verified 2026-09-17. Implemented canonical expense submission engine in `@clario/web`:

- `apps/web/src/lib/expense/submission.ts`: RFC 8785 canonical evidence manifest sorting and hashing, canonical expense record creation with normalized addresses, integer base units, ISO 8601 UTC timestamps, Viem calldata encoding for `ClarioExpenseRegistryV1.submitVersion` (`0x06377857`), and automated privacy leakage scanner (`assertCalldataPrivacy`) guaranteeing confidential fields (title, merchant, purpose, notes) never leak into calldata.
- `apps/web/src/lib/expense/service.ts`: Secure 32-byte random salt envelope-encryption and decryption with AAD context binding, `prepareSubmission` generating golden commitments via `@clario/protocol` `computeExpenseCommitmentV1`, resolving Monad chain and registry address, asserting privacy, and `reconcileSubmission` updating `expense_versions.status = 'submitted'`, `expenses.current_version`, recording in `chain_transactions`, and logging audit events.
- Next.js Route Handlers: `POST /api/workspaces/[workspaceId]/expenses/[expenseId]/submit/prepare` and `POST /api/workspaces/[workspaceId]/expenses/[expenseId]/submit/reconcile` with session authentication and CSRF defense.
- Evidence Ledger UI: `ExpenseSubmitDialog` displaying public Monad commitment vs confidential offchain ledger, network verification, raw calldata inspector, and truthful lifecycle (`preparing` -> `preview` -> `awaiting_signature` -> `submitted` [pending confirmation] -> `confirming` -> `confirmed` -> `failed`), wired into `ExpenseDraftEditor`.
- Verified with 16 automated tests across `submission.test.ts` (8) and `submission-route.test.ts` (8), bringing `@clario/web` suite to 224 passing tests (451 total tests monorepo-wide). Full quality gate `pnpm check` (95 Foundry tests, 224 web tests, Next.js Turbopack build, ESLint with 0 warnings, and Prettier) and `pnpm audit:dependencies` passed cleanly with zero vulnerabilities.
  **Completed:** 2026-09-17 by Antigravity  
  **Notes:** Calldata contains strictly public fields (`workspaceId`, `expenseId`, `version`, `commitment`, `previousCommitment`). Submitted state is never presented as confirmed until authoritative onchain receipt.

---

## Phase 4 — Approval integrity and indexing

### [x] REV-001 — Build the authorized review queue and detail view

**Priority:** P0  
**Dependencies:** `EXP-003`, `APP-002`, `APP-003`  
**Source:** PRD section 9.8; `DESIGN.md` sections 7, 10, and 18

**Outcome:** An authorized reviewer can find assigned work and inspect source facts, private evidence, exact version, policy, and material changes.

**Deliverables:**

- Authorized review-queue API and UI.
- Exact-version review detail with evidence preview.
- Current/stale state detection and policy/role display.
- Loading, empty, evidence-unavailable, unauthorized, and changed-record states.

**Acceptance criteria:**

- Non-reviewers and cross-workspace users cannot enumerate or inspect reviews.
- Exact version and commitment stay visible.
- Opening evidence does not lose queue position or review state.
- Mobile, keyboard, focus, and 200% zoom gates pass.

**Verification:** Authorization matrix, pagination, stale state, evidence access, and accessibility tests.

**Evidence:** Verified 2026-09-17. Built the authorized review system end-to-end:

1. `apps/web/src/lib/review/types.ts`: Defined `ReviewQueueItem`, `ReviewQueueFilter`, `ReviewQueueResponse`, `ReviewDetail`, `ReviewEvidenceItem`, `MaterialDiff`, `ProofSpineStep`, `ReviewerAuthorityInfo`.
2. `apps/web/src/lib/review/diff.ts`: Implemented `computeMaterialDiff` using `EXPENSE_FIELD_DEFINITIONS_V1` from `@clario/protocol` to compute field-level diffs between versions $V$ and $V-1$ and classify materiality (`MATERIAL` vs `NON_MATERIAL`).
3. `apps/web/src/lib/review/service.ts`: Implemented `ReviewService`:
   - `assertReviewQueueAccess`: validates caller holds `APPROVER_ROLE`, `OWNER_ROLE`, `ADMIN_ROLE`, or `AUDITOR_ROLE` in the target workspace.
   - `getReviewQueue`: queries workspace expenses with submitted versions, decrypts record envelopes, blocks self-approval (`isSelfExpense` enforces `canApprove = false`), joins evidence counts and source transactions.
   - `getReviewDetail`: verifies read permission, decodes `CanonicalExpenseV1`, lists attached evidence objects with preview endpoints, computes material diff for $V > 1$, builds 4-stage `ProofSpineStep` milestones (`draft_created`, `version_submitted`, `human_review`, `settlement`), and flags superseded versions (`isSuperseded = true`, `canApprove = false`).
4. Route handlers:
   - `GET /api/workspaces/[workspaceId]/reviews`: protected review queue endpoint.
   - `GET /api/workspaces/[workspaceId]/expenses/[expenseId]/review`: exact-version review detail endpoint.
5. Evidence Ledger UI components:
   - `ReviewQueueView` (`apps/web/src/components/review-queue-view.tsx`): Authority badge, status filter tabs, search filter, responsive items table with version, amount, self-approval notice, and direct navigation.
   - `ReviewDetailView` (`apps/web/src/components/review-detail-view.tsx`): 7/5 layout, exact version banner, stale version warning, self-approval notice, canonical terms card, evidence manifest card with in-modal preview dialog (preserving review state), material diff table, source chain provenance card, commitment stamp with copy button, Proof Spine visual rail, and decision action card.
   - Main navigation: Wired `ReviewQueueView` into `apps/web/src/app/page.tsx` on the Review route.
6. Verification & Quality Gate:
   - 10 unit/integration tests in `apps/web/src/lib/review/service.test.ts` passing.
   - 5 route handler tests in `apps/web/src/lib/review/route.test.ts` passing.
   - All 27 test files and 239 tests in `@clario/web` passing.
   - Monorepo `pnpm check` passed cleanly (95 Foundry tests passing, all TypeScript packages typechecked, zero ESLint warnings, Next.js production build succeeded, Prettier formatting verified).
   - Production dependency audit (`pnpm audit:dependencies`) passed with zero vulnerabilities.

**Completed:** 2026-09-17 by Antigravity  
**Notes:** Founder invariants strictly preserved: evidence remains envelope-encrypted offchain; submitter cannot approve own expense; superseded versions cannot authorize settlement; AI has no reviewer authority. Direct typed-data review only; decision transaction recording continues in `REV-002`.

### [x] REV-002 — Record exact-version decisions and supersession

**Priority:** P0  
**Dependencies:** `REV-001`, `CHN-003`  
**Source:** Architecture workflow 11.2

**Outcome:** Reviewers approve, reject, or request changes for one exact version, and material edits visibly invalidate prior approval.

**Deliverables:**

- Decision preparation, intent preview, wallet flow, and receipt validation.
- Version diff and approval-impacting field grouping.
- New-version creation after material edit.
- Historical approval display and `REAPPROVAL_REQUIRED` state.

**Acceptance criteria:**

- A record changed after opening cannot be approved.
- Unauthorized, replayed, wrong-domain, rejected-wallet, failed, and replaced transactions are handled.
- Version 1 approval remains historical after version 2 but cannot authorize payment.

**Verification:** Contract/API/UI integration plus stale, replay, material-edit, and accessibility tests.

**Evidence:** Verified 2026-09-17. Built exact-version decision recording and supersession engine end-to-end:

1. `apps/web/src/lib/review/decision.ts`: Viem function calldata encoding for direct onchain calls (`recordDecision`), EIP-712 typed data envelope construction (`buildClarioApprovalTypedData`), deterministic reason commitment hashing (`computeReasonCommitment`), and identifier normalizers.
2. `apps/web/src/lib/review/decision-service.ts`: `ReviewDecisionService` enforcing:
   - `prepareDecision`: caller holds `APPROVER_ROLE` or `OWNER_ROLE`; self-approval prevention (submitter cannot approve own expense); target version must be current version and unsuperseded; single decision per version; mandatory reason commitment for reject / request_changes; returns calldata and JSON-safe EIP-712 envelope.
   - `reconcileDecision`: updates database `decisions` table, marks `expense_versions.status = 'current'` (for approve) or `status = 'changes_requested'` / `'rejected'`, logs audit event, and tracks `chain_transactions`.
   - `createSuccessorDraft`: creates successor version $V+1$ draft referencing predecessor commitment (`currentVer.commitment`), marks prior versions superseded, copies evidence objects, updates `expenses.current_version = $V+1$`, and logs audit event.
3. Route Handlers:
   - `POST /api/workspaces/[workspaceId]/expenses/[expenseId]/decision/prepare`: protected decision preparation endpoint.
   - `POST /api/workspaces/[workspaceId]/expenses/[expenseId]/decision/reconcile`: protected decision reconciliation endpoint.
   - `POST /api/workspaces/[workspaceId]/expenses/[expenseId]/successor`: protected successor draft creation endpoint.
4. UI Components:
   - `DecisionDialog` (`apps/web/src/components/decision-dialog.tsx`): Human reason input for reject / request_changes, exact version banner, commitment stamp with copy button, target chain display, raw calldata preview, browser wallet transaction submission (`wallet_switchEthereumChain`, `eth_sendTransaction`), reconciliation, and explorer links.
   - `ReviewDetailView` (`apps/web/src/components/review-detail-view.tsx`): Integrates `DecisionDialog` for Approve, Request Changes, and Reject actions; successor draft creation button with automatic navigation to draft editor.
5. Verification & Quality Gates:
   - 14 tests in `src/lib/review/decision.test.ts` passing.
   - 14 tests in `src/lib/review/decision-service.test.ts` passing.
   - 10 tests in `src/lib/review/decision-route.test.ts` passing.
   - 277 total tests in `@clario/web` passing.
   - Full monorepo `pnpm check` passed cleanly (95 Foundry tests, 117 protocol tests, 15 database tests, 277 web tests, Next.js build with 25 routes, ESLint with 0 warnings, Prettier verified).
   - Production dependency audit (`pnpm audit:dependencies`) reported 0 vulnerabilities.

**Completed:** 2026-09-17 by Antigravity  
**Notes:** None. Founder invariants strictly preserved: private evidence remains offchain; material edits create immutable versions linked to predecessors; approval binds to exact current commitment; self-approval prohibited.

### [x] IDX-001 — Implement idempotent event indexing

**Priority:** P0  
**Dependencies:** `CHN-004`, `FND-003`  
**Source:** Architecture section 12

**Outcome:** Public contract events become rebuildable provider-neutral projections.

**Deliverables:**

- Handlers for workspace, roles, policy, versions, decisions, supersession, and settlement.
- Unique event identity by chain ID, block hash, transaction hash, and log index.
- Checkpoints, retries, dead-letter handling, and replay command.
- Reorganization and removed-log handling.

**Acceptance criteria:**

- Reprocessing the same event changes nothing.
- Rebuilding from genesis/checkpoint produces equivalent projections.
- Reorg tests retract and replace affected public state correctly.
- Public entities contain no private Clario fields.

**Verification:** Replay, duplicate, ordering, reorg, provider-failure, and privacy tests.

**Evidence:** Verified 2026-09-17 with 6 unit tests in `service.test.ts`, 4 route tests in `route.test.ts`, 15 database tests in `packages/database`, and full monorepo gate passing via `pnpm check` (514 tests across web, protocol, database, and contracts; Turbopack production build). Database migration v2 adds indexer checkpoints, dead letters, and 7 public projection tables with R-001 privacy validation.

### [x] IDX-002 — Build activity timeline from authoritative events

**Priority:** P0  
**Dependencies:** `IDX-001`, `REV-002`  
**Source:** PRD section 9.10; `DESIGN.md` Proof Spine rules

**Outcome:** The application accurately reconstructs local, submitted, confirmed, replaced, failed, and indexed workflow events.

**Deliverables:**

- Timeline query/API joining public projections with authorized private events.
- Proof Spine UI with actor, version, source, and timestamp type.
- Indexer-lag and RPC-conflict states.

**Acceptance criteria:**

- Public/private join occurs only after authorization.
- Application, block, and indexer times are distinguishable.
- Historical supersession and replacement branches remain visible.
- Refresh does not duplicate or reorder stable events.

**Verification:** Authorization, ordering, reorg, lag, refresh, mobile, and screen-reader tests.

**Evidence:** Verified 2026-09-17. Implemented authoritative activity timeline:

- `apps/web/src/lib/timeline/types.ts`: `TimelineEvent`, `TimestampDetail` (with `applicationTime`, `blockTime`, `indexerTime` taxonomy), `ConfirmationState`, `IndexerLagStatus`, `RpcConflictStatus`, and `ExpenseTimelineResponse`.
- `apps/web/src/lib/timeline/service.ts`: `TimelineService.getExpenseTimeline` joining 12 database tables in a single parallel fetch — operational tables (expense_versions, evidence_objects, decisions, reimbursements, source_transactions) and public projection tables (projection_expense_versions, projection_decisions, projection_settlements, indexer_checkpoints, indexed_events). Emits 15 typed events across the full lifecycle; detects indexer lag by comparing `chain_transactions` block numbers to `indexer_checkpoints`; surfaces reorg/conflict via removed `indexed_events` and `chain_transactions` status; sorts deterministically by timestamp → version → event-type rank → ID.
- `apps/web/src/app/api/workspaces/[workspaceId]/expenses/[expenseId]/timeline/route.ts`: authorized GET handler returning `ExpenseTimelineResponse`.
- `apps/web/src/components/proof-spine-timeline.tsx`: interactive Proof Spine UI rendering all event types with actor, version badge, source tag, three-dimensional timestamp disclosure, commitment stamp, explorer links, indexer lag indicator, and reorg/conflict warning.
- `apps/web/src/components/review-detail-view.tsx`: integrated timeline toggle rendering `ProofSpineTimeline` alongside review actions.
- All 6 service tests, 4 route tests (297 total web tests), TypeScript typecheck (0 errors), ESLint (0 warnings) passing.

**Completed:** 2026-09-17 by Antigravity  
**Notes:** All data-privacy invariants preserved: private evidence fields never cross the public/private join boundary before authorization check.

---

## Phase 5 — Reimbursement and verification

### [x] SET-001 — Integrate supported Monad reimbursement asset

**Priority:** P0  
**Dependencies:** `REV-002`, `CHN-004`, `IDX-002`, `FND-003`  
**Source:** Architecture sections 11.3 and 18; PRD section 9.9

**Outcome:** Treasury can prepare a real supported-USDC reimbursement for the approved current version with verified configuration.

**Deliverables:**

- Runtime token configuration sourced from current official documentation and deployment manifest.
- Treasury queue and authorized preparation endpoint.
- Immediate rechecks for role, current version, approval, token, recipient, amount, prior settlement, balance, allowance, and simulation.
- Human-readable transaction intent.

**Acceptance criteria:**

- No token address or decimals are hardcoded outside validated configuration.
- Mismatch, unsupported asset/network, stale approval, duplicate, insufficient balance/allowance, and failed simulation block preparation.
- This task does not broadcast a live transaction without explicit authorization.

**Verification:** Configuration provenance review, API/contract integration, mismatch matrix, and simulation tests.

**Evidence:** Verified 2026-09-19. Integrated supported Monad reimbursement asset and hardened settlement preparation end-to-end:

1. `docs/MONAD_PROVENANCE.md`: Official Monad Testnet USDC provenance verified against primary documentation (`docs.monad.xyz`): Chain ID 10143, USDC token `0x754704Bc059F8C67012fEd69BC8A327a5aafb603`, decimals 6. Deployment manifests configure token address and standard decimals without hardcoding values in application code.
2. `apps/web/src/lib/settlement/config.ts`: Fail-closed configuration resolver requiring validated deployment manifest (`DeploymentManifest`) via `getServerConfiguration()`. Direct hardcoding, raw `NEXT_PUBLIC_*` reads, and fallback zero addresses are eliminated. Throws `SettlementConfigError` (`UNCONFIGURED_SETTLEMENT_ASSET`, HTTP 422). Added `tryGetSettlementConfig()` for safe queue queries and `setSettlementConfigForTesting(...)` for isolated unit/integration tests (RULES §5.1, §5.2, §10.4, §14).
3. `apps/web/src/lib/settlement/service.ts`: `SettlementService` enforcing all immediate pre-condition checks during `prepareSettlement`:
   - Authorization: caller must possess `TREASURY_ROLE` or `OWNER_ROLE` in the workspace.
   - Freshness: caller must have confirmed wallet within the 15-minute window (`requireRecentWalletConfirmation`).
   - Version validity: target version must match `expenses.current_version` and remain unsuperseded.
   - Approval integrity: version must have a valid `approve` decision on the exact version commitment.
   - Token & Registry configuration: validates non-zero checksummed token and registry contract addresses, decimals in 0..18 range.
   - Network support: validates chainId > 0 matching configured network.
   - Asset support: verifies version currency matches configured token symbol (`UNSUPPORTED_ASSET`).
   - Duplicate prevention: blocks if reimbursement record already exists with `submitted` or `confirmed` status (`DUPLICATE_SETTLEMENT`).
   - Balance check: verifies treasury wallet holds sufficient token balance (`INSUFFICIENT_BALANCE`).
   - Allowance check: computes required allowance and flags `needsApproval` / generates `approveCalldata` (or blocks if `requireSufficientAllowance: true` and allowance is insufficient).
   - Simulation probe: executes read-only eth_call simulation to catch revert conditions prior to wallet signing (`SIMULATION_FAILED`).
4. `apps/web/src/lib/settlement/calldata.ts`: `encodeReimburseCalldata`, `encodeApproveCalldata`, and `buildSettlementPrepareResult` generate human-readable intent summaries and raw calldata. Includes strict privacy assertion (`assertSettlementCalldataPrivacy`) ensuring zero private metadata (merchant, purpose, notes, line items, evidence) is exposed in onchain calldata.
5. Route Handlers:
   - `GET /api/workspaces/[workspaceId]/settlement/queue`: returns approved current expenses awaiting settlement.
   - `POST /api/workspaces/[workspaceId]/expenses/[expenseId]/settlement/prepare`: prepares intent and calldata, catching `SettlementConfigError` and returning 422.
   - `POST /api/workspaces/[workspaceId]/expenses/[expenseId]/settlement/reconcile`: records submitted transaction hash in `submitted` state, catching `SettlementConfigError` and returning 422.
6. UI Components:
   - `TreasuryQueueView` (`apps/web/src/components/treasury-queue-view.tsx`): Displays pending expenses, current version, commitment snippet, recipient, and amount. Clearly displays submitted status as `⏳ Submitted (Pending)`, never as paid or confirmed.
   - `ReimbursementDialog` (`apps/web/src/components/reimbursement-dialog.tsx`): Full 2-step approval and reimbursement flow. Uses injected `window.ethereum` (`eth_requestAccounts`, `wallet_switchEthereumChain`, `eth_sendTransaction`). If running in non-production environments without a wallet, simulates execution with explicit labeling: `Simulated Demonstration Data — Explorer link disabled for simulation` (RULES §14).
7. Verification & Quality Gates:
   - Settlement suite (`pnpm --filter @clario/web test -- settlement`): 43 tests passing across 2 test files (29 in `service.test.ts`, 14 in `route.test.ts`).
   - Full monorepo check (`pnpm check`):
     - ESLint (web, protocol, database): 0 errors, 0 warnings.
     - Contracts lint (`pnpm lint:contracts`): 0 errors.
     - TypeScript typecheck: 0 errors across all workspaces.
     - 117 protocol tests passed.
     - 15 database tests passed.
     - 340 web tests passed.
     - 95 Foundry contract tests passed.
     - Next.js 16.3.5 Turbopack production build succeeded (26 routes).
     - Prettier code style check: all matched files clean.

**Completed:** 2026-09-19 by Antigravity  
**Notes:** Founder invariants preserved: private evidence remains offchain; approval binds to exact current commitment and authorized human; duplicate reimbursement fails closed; AI has no authority; zero live transactions broadcast; SUBMITTED status is never displayed as paid, confirmed, or final. Sourced token configuration strictly from deployment manifest and official Monad provenance.

### [x] SET-002 — Execute and reconcile reimbursement lifecycle

**Priority:** P0  
**Dependencies:** `SET-001`  
**Source:** Architecture sections 11.3 and 13

**Outcome:** An explicitly authorized treasury operator can submit payment and Clario marks reimbursement only after validated confirmation.

**Deliverables:**

- Wallet submission and persisted transaction attempts.
- Receipt/event/token-transfer validation.
- Replacement, reorganization, failure, timeout, and safe-retry handling.
- Settlement receipt with explorer proof.

**Acceptance criteria:**

- `SUBMITTED` never appears as paid.
- Expected contract, event, token, recipient, amount, chain, and version must match.
- Failed or reverted transactions never mark reimbursed.
- Standard duplicate execution fails in application and contract.

**Verification:** Local/fork integration as supported, receipt-decoding, replacement/reorg, duplicate, refresh, and UI tests.

**Evidence:** Verified 2026-09-19 with comprehensive receipt validation, lifecycle service, API routes, UI, and test suites.

1. `receipt.ts` (`apps/web/src/lib/settlement/receipt.ts`):
   - `validateSettlementReceipt` validates onchain receipt status (`success` vs `reverted`), checks destination contract matches registry, decodes and verifies `SettlementRecorded` event against expected workspaceId, expenseId, version, commitment, token, recipient, and amount.
   - Decodes ERC-20 `Transfer` event to ensure expected recipient and amount were transferred.
   - Reverted transactions return `valid: false` with `isReverted: true` and failure reason.
   - Supports both 32-byte hex strings and UTF-8 string identifiers via `normalizeHex32`.
   - `fetchAndValidateSettlementReceipt` fetches receipts via JSON-RPC.
   - 11 unit tests in `receipt.test.ts`.
2. Settlement reconciliation & lifecycle service (`apps/web/src/lib/settlement/service.ts`):
   - `confirmSettlement`: requires `TREASURY_ROLE` + recent confirmation; validates receipt against onchain logs; handles onchain reverts by updating status to `'failed'` in `reimbursements` and `chain_transactions` without unhandled errors to allow safe retry; atomically updates `reimbursements`, `chain_transactions`, `projection_settlements`, and `audit_events` on successful confirmation; provides idempotent returns on repeat confirmations.
   - `getSettlementStatus`: returns current lifecycle state, attempt history with submitted/confirmed timestamps and block numbers, truthful proof with explorer URLs, and `canRetry` status.
   - `retryFailedReimbursement`: enforces `TREASURY_ROLE` + confirmation; marks failed attempts as `'cancelled'` and unblocks active unique constraints for a fresh attempt; strictly rejects retrying already confirmed or actively submitted reimbursements (duplicate guard).
   - `handleReorgRetraction`: marks `chain_transactions` as `'reorged'`, reverts `reimbursements` to `'failed'`, and deletes `projection_settlements` record.
   - 16 lifecycle integration tests in `lifecycle.test.ts`.
3. Route handlers:
   - `POST /api/workspaces/[workspaceId]/expenses/[expenseId]/settlement/confirm`: receipt-validated confirmation endpoint.
   - `GET /api/workspaces/[workspaceId]/expenses/[expenseId]/settlement/status`: status and proof query endpoint.
   - `POST /api/workspaces/[workspaceId]/expenses/[expenseId]/settlement/retry`: failed reimbursement reset endpoint.
   - 20 route integration tests in `route.test.ts`.
4. UI & Timeline updates:
   - `ReimbursementDialog`: handles `confirming` and `confirmed` states; provides onchain receipt confirmation trigger; displays confirmed proof (block number, payment reference, settled at, amount, explorer URL); displays revert/failure messages and provides an immediate `Retry Payment` action; never displays `SUBMITTED` as paid or final.
   - `TreasuryQueueView`: adds `⚠️ Failed (Retryable)` badge and `Retry Payment →` action.
   - `TimelineService`: maps `submitted`, `confirming`, `confirmed`, `settled`, `failed`.
5. Quality Gates & Test Suites:
   - Settlement suite (`pnpm --filter @clario/web test -- settlement`): 76 tests passing across 4 test suites (`receipt.test.ts`, `lifecycle.test.ts`, `service.test.ts`, `route.test.ts`).
   - Monorepo quality gate (`pnpm check`):
     - ESLint (web, protocol, database): 0 errors, 0 warnings across all workspaces.
     - Contracts lint (`pnpm lint:contracts`): 0 errors.
     - TypeScript typecheck: 0 errors monorepo-wide.
     - All 95 Foundry contract tests passed.
     - All 368 web tests, 117 protocol tests, and 15 database tests passed.
     - Next.js 16.3.5 Turbopack production build succeeded (34 routes compiled).
     - Prettier code style check: all matched files clean.

**Completed:** 2026-09-19 by Antigravity  
**Notes:** Founder invariants preserved: private evidence remains offchain; material edits create immutable versions; approval binds to exact current commitment and authorized human; duplicate reimbursement fails in application and contract; AI has no authority; verification remains independent; SUBMITTED state is never labeled confirmed, paid, or final. No real transactions broadcast or live funds moved.

### [x] VER-001 — Define portable verification package v1

**Priority:** P0  
**Dependencies:** `PRO-002`, `IDX-002`, `SET-002`  
**Source:** Architecture section 15

**Outcome:** An authorized user can export a versioned package with explicit disclosure and deterministic inputs.

**Deliverables:**

- Package manifest/schema, deployment manifest, workspace policy, version records, decisions, settlement, evidence manifests, and optional disclosed evidence/salts.
- Full and redacted export modes.
- Per-file hashes and schema versions.
- Export authorization and retention behavior.

**Acceptance criteria:**

- User sees exactly what private material will be disclosed.
- Redacted missing inputs become unavailable checks, never passes.
- Export can be generated without logging or retaining plaintext beyond policy.
- Package contains no hidden dependency on production database state.

**Verification:** Schema, authorization, redaction, deterministic archive, leakage, and large-package tests.

**Evidence:** Verified 2026-09-20. Implemented portable verification package v1 across `@clario/protocol` and `apps/web`:

1. Protocol schema and validation:
   - `packages/protocol/src/package/types.ts` defines `VerificationPackageManifestV1`, disclosure levels (`FULL`, `REDACTED`), package file entries, workspace policy export, expected event export, and package bundle types.
   - `packages/protocol/src/package/validate.ts` validates schema version, disclosure level, chain ID, registry/exporter addresses, safe relative paths, duplicate paths, per-file SHA-256 hashes, and privacy classes; computes deterministic file hashes and canonical manifest hash with RFC 8785 canonical JSON.
   - Protocol package tests pass (`pnpm --filter @clario/protocol test -- package`, 126 protocol tests total).
2. Export service and deterministic archive:
   - `apps/web/src/lib/export/service.ts` provides disclosure preview, FULL/REDACTED package generation, package retrieval, explicit retention expiry, audit event recording, and deterministic ZIP creation through `zip.ts`.
   - Export requires authenticated workspace exporter authority (`OWNER_ROLE`, `ADMIN_ROLE`, or `AUDITOR_ROLE`) and recent 15-minute wallet confirmation.
   - FULL mode includes decrypted canonical records, evidence manifests, disclosed salts, and evidence bytes only inside the generated archive; plaintext is not written to disk or audit metadata.
   - REDACTED mode omits private records, salts, and evidence binaries while marking those manifest entries as redacted, so dependent verifier checks become unavailable/unverifiable rather than passed.
   - Deployment data is sourced from a validated deployment manifest; placeholder fallback manifests and fake addresses were removed.
3. API boundary:
   - `GET /api/workspaces/[workspaceId]/exports/preview` returns explicit disclosure impact before export.
   - `POST /api/workspaces/[workspaceId]/exports` generates a package only after explicit `FULL` or `REDACTED` selection.
   - `GET /api/workspaces/[workspaceId]/exports/[exportId]` downloads an authorized unexpired ZIP with no-store cache headers and package hash header.
4. Verification:
   - `pnpm --filter @clario/web test -- export`: 40 web test files, 389 tests passing.
   - `pnpm --filter @clario/web typecheck`: passed.

**Completed:** 2026-09-20 by Codex  
**Notes:** No live deployment, signing, broadcast, provider mutation, or evidence disclosure occurred. Package generation still depends on a valid configured deployment manifest for non-test use; independent verifier execution is tracked by `VER-002`.

### [x] VER-002 — Build independent verifier

**Priority:** P0  
**Dependencies:** `VER-001`  
**Source:** Architecture sections 11.4 and 15.3; PRD section 9.12

**Outcome:** A standalone browser worker or CLI/library verifies a package using public schema, ABI, and compatible Monad RPC.

**Deliverables:**

- Deterministic checks for package schema, record/evidence hashes, commitments, version chain, reviewer authority, current approval, and settlement.
- Results: `VERIFIED`, `VERIFIED_WITH_WARNINGS`, `FAILED`, and `UNVERIFIABLE` per check and overall.
- Plain-language limitations and observed/expected details.
- No authenticated Clario API dependency.

**Acceptance criteria:**

- Valid package passes expected checks.
- Changed field/evidence, wrong salt, wrong chain/contract, revoked/unauthorized role, superseded approval, and unmatched payment fail correctly.
- Missing allowed input is unverifiable rather than failed/passed as defined by schema.
- The verifier never claims factual truth or tax compliance.

**Verification:** Golden vectors and complete valid/tampered package matrix in offline-capable tests.

**Evidence:** Verified 2026-09-22. Implemented an independent package verifier in `@clario/protocol`:

1. Deterministic verifier core:
   - `packages/protocol/src/verifier/verify.ts` returns `VERIFIED`, `VERIFIED_WITH_WARNINGS`, `FAILED`, or `UNVERIFIABLE` for each check and overall.
   - Checks package schema, declared/undeclared files, SHA-256 digests, deployment and policy snapshots, canonical record/evidence hashes, salted commitments, version ordering/supersession, exact current approval, historical reviewer authority, self-approval, configured token, settlement terms, ERC-20 transfer, and conflicting settlement indicators.
   - Redacted or omitted allowed inputs are `UNVERIFIABLE`, never passed.
2. Independent public-chain boundary:
   - `packages/protocol/src/verifier/rpc.ts` reads a compatible Monad RPC directly with Viem, discovers modular registries through `ClarioRegistry`, reconstructs historical authority, and validates decision/settlement receipts without an authenticated Clario API.
   - Wrong chain and incompatible/wrong registry contract are explicit failures.
3. Portable archive and CLI:
   - `archive.ts` loads bounded ZIP packages in memory with root/path/size/entry-count defenses.
   - `pnpm verify:package -- <package.zip> [--rpc <MONAD_RPC_URL>]` runs the standalone CLI and emits a JSON report.
   - `docs/INDEPENDENT_VERIFIER.md` documents result semantics, trust boundaries, privacy handling, checked claims, and limitations.
4. Export/verifier compatibility hardening:
   - FULL exports now disclose the canonical record and canonical evidence manifest used by the commitment; submission preparation persists the exact canonical timestamp needed for deterministic reconstruction.
   - Exported event provenance uses persisted block hashes; synthetic zero hashes and fallback policy snapshots are rejected.
   - REDACTED exports explicitly declare the evidence manifest as redacted.
5. Verification evidence:
   - Valid, changed-field, changed-evidence, wrong-salt, wrong-chain, wrong-contract, unauthorized/revoked reviewer, stale/superseded version, unmatched settlement, redacted input, missing RPC, archive traversal, and bounded archive cases pass in 133 protocol tests.
   - Export-to-verifier integration passes in the 389-test web suite.
   - Root `pnpm check` passed: lint, typecheck, 15 database tests, 133 protocol tests, 389 web tests, 95 Foundry tests, package/contracts builds, Next production build, and formatting.

**Completed:** 2026-09-22 by Codex  
**Notes:** No package was uploaded, no live RPC was called, and no deployment, signature, broadcast, provider mutation, or fund movement occurred. Phase 5 technical tasks are complete and require the documented founder gate review before phase advancement.

---

## Phase 6 — Intelligence, design, and resilience

### [x] AI-001 — Add human-supervised receipt extraction

**Priority:** P1  
**Dependencies:** `EXP-001`, `APP-003`, `SEC-001`  
**Source:** Architecture section 14; PRD section 9.6

**Outcome:** A configured provider returns validated suggestions without gaining workflow authority.

**Deliverables:**

- Provider-neutral extraction interface and versioned output schema.
- Data-minimized prompt/input construction treating receipt text as untrusted.
- Async job, timeout, retry, quota, malformed-output, and manual fallback.
- Suggestion UI with source, confidence, uncertainty, and confirm/correct history.

**Acceptance criteria:**

- Prompt injection cannot invoke tools or privileged actions.
- Low-confidence or malformed output is never committed silently.
- Secrets and unrelated workspace history never enter requests/logs.
- AI outage does not block manual submission.

**Verification:** Prompt-injection fixtures, schema fuzzing, privacy assertions, timeout/fallback, and confirmation UI tests.

**Evidence:** Verified 2026-09-22. Added a provider-neutral, tool-free receipt extraction contract with versioned strict output validation; fixed untrusted-document instructions; explicit per-request evidence consent; authorized draft/evidence access; MIME, file-count, and total-size limits; durable `jobs` lifecycle with bounded timeout and retry; safe error-code persistence; AES-256-GCM encrypted suggestion and correction history; and a disabled-by-default runtime provider until provider/privacy terms receive founder approval. Added authenticated extraction and disposition routes plus an editable “AI suggested” draft panel that exposes source, confidence, uncertainty, warnings, manual fallback, and explicit apply/reject actions. Applying selected values updates only the human-controlled draft and records accepted/modified provenance; AI has no submission, approval, signing, role, or settlement capability. Prompt-injection, privacy, malformed-schema, source-binding, quota retry, timeout fallback, encryption context, confidence labeling, and explicit-selection tests pass. Full `pnpm check` passed with 15 database tests, 133 protocol tests, 408 web tests, 95 Foundry tests, production build, lint, typecheck, and formatting.

**Completed:** 2026-09-22 by Codex  
**Notes:** Phase 5 advancement was explicitly approved by the founder before this task. No evidence was sent to an external provider. Runtime provider activation remains blocked on explicit provider, region, retention, privacy, and consent-policy approval; manual entry remains fully operational.

### [x] INT-001 — Add duplicate and mismatch warnings

**Priority:** P1  
**Dependencies:** `EXP-002`, `AI-001`, `SET-002`  
**Source:** PRD sections 9.6 and 9.9

**Outcome:** Clario warns about attributable duplicate claims, evidence mismatches, and settlement mismatch without autonomous rejection.

**Deliverables:**

- Deterministic duplicate rules before probabilistic warnings.
- Explainable warning source and affected fields.
- Human disposition and audit history.

**Acceptance criteria:**

- Warnings never become approvals/rejections automatically.
- False-positive recovery is available and recorded.
- Blocking settlement mismatches remain deterministic and server-enforced.

**Verification:** Duplicate/mismatch fixture matrix and authorization/UI tests.

**Evidence:** Verified 2026-09-22. Added a deterministic-first warning engine in `apps/web/src/lib/warnings/` with stable warning identifiers, affected-field attribution, source labels, severity, and explicit separation between exact local rules and AI-assisted review signals. Exact rules cover missing/reused evidence, duplicate or failed source claims, multiple active reimbursements, stale-version reimbursement attempts, and persisted amount/recipient mismatch. AI comparisons run afterward, ignore rejected or low-confidence analysis, honor human corrections, remain non-blocking, and are omitted for callers without evidence access. Added authenticated, CSRF-protected warning read/disposition API, immutable privacy-safe audit events for acknowledge/confirm/false-positive dispositions, and a review-signal panel on current draft and review screens. Deterministic financial blocks cannot be dismissed and do not replace the existing database, service, or contract settlement guards. Fixture matrices, authorization, privacy, audit-history, stable-ID, UI action, low-confidence, stale/duplicate settlement, and false-positive recovery tests pass. Full `pnpm check` passed with 15 database tests, 133 protocol tests, 423 web tests, 95 Foundry tests, production build, lint, typecheck, and formatting.

**Completed:** 2026-09-22 by Codex  
**Notes:** No warning approves, rejects, submits, signs, or settles anything. No private values are stored in warning audit metadata or exposed to callers lacking evidence access. Existing deterministic settlement preparation and contract duplicate guards remain authoritative.

### [~] DES-001 — Implement the design foundation

**Priority:** P1  
**Dependencies:** `FND-001`  
**Source:** `DESIGN.md` sections 1–8 and 12–16

**Outcome:** Semantic tokens, typography, themes, focus, motion preferences, primitives, and app shell match the founding design system.

**Deliverables:**

- Light/dark semantic tokens with no scattered raw colors.
- Font loading, base typography, spacing, radius, and elevation.
- Accessible buttons, forms, overlays, tabs, badges, status sentence, skeleton, and toast.
- Responsive app shell/navigation.

**Acceptance criteria:**

- Measured contrast matches or exceeds documented pairs.
- Keyboard, forced-colors, reduced-motion, 320px, and 200% zoom behavior passes.
- No copied demo styling, fake data, glassmorphism, decorative gradient, or generic crypto visual exists.

**Verification:** Component tests, automated accessibility, Lighthouse, and Playwright visual baselines.

**Evidence:** In progress. The full root `pnpm check` passed on 2026-09-29, including lint, Solidity formatting, typecheck, 15 database tests, 133 protocol tests, 429 web tests, 95 Foundry tests, package/contracts builds, Next.js production build, and Prettier. The local preview was inspected at the available 498px browser viewport for navigation, theme, and truthful local-chain labeling. Full task acceptance is still open.

**Progress:** 2026-09-23 by Codex. Added the first production design-foundation slice: semantic token aliases for legacy component usage, gradient/font/motion variables, reduced-motion and forced-colors handling, mobile shell/table behavior, skeleton/callout/mono-badge primitives, explicit root theme marker, typed design-token exports, reusable native UI primitives, and numeric WCAG contrast tests for documented semantic pairs. Verified with full `pnpm check`: lint, contract formatting, typecheck, 15 database tests, 133 protocol tests, 429 web tests, 95 Foundry tests, package builds, Next production build, contract build, and Prettier check. Remaining before completion: broader screen refactor away from ad hoc inline styles, automated accessibility pass, Lighthouse, and Playwright visual baselines.

**Progress:** 2026-09-29 by Codex. Rebuilt the shared navigation shell with semantic labeled navigation, compact responsive disclosure, persistent light/dark theme control, and accurate “Local development” labeling for chain 31337. Added theme-aware primary-action foreground tokens with numeric contrast coverage and a navigation regression test. Verified the full root `pnpm check` and a browser preview at the available 498px viewport. Updated stale design-spec audit text and added the supplied Monad resource catalog as `MONAD_HACKATHON_RESOURCES.md`, referenced by `AGENTS.md` for future build tasks. Remaining: load approved/self-hosted fonts, refactor the many remaining inline screen styles, test at 320px/desktop/200% zoom/forced colors, and produce automated accessibility, Lighthouse, and Playwright visual evidence. Do not mark DES-001 complete until those checks are recorded.

### [ ] OBS-001 — Add privacy-safe observability and recovery

**Priority:** P1  
**Dependencies:** `APP-003`, `EXP-003`, `IDX-001`, `SET-002`  
**Source:** Architecture section 17; `RULES.md` section 19

**Outcome:** Operators can diagnose API, job, RPC, indexer, evidence, AI, and settlement failure without collecting private content.

**Deliverables:**

- Structured event schema and centralized redaction.
- Correlation across request, job, transaction, and indexed event using safe identifiers.
- Health/lag metrics, retry/dead-letter visibility, and documented recovery actions.
- Leakage tests for logs and error tracking.

**Acceptance criteria:**

- Logs contain no purpose, merchant, email, evidence, salt, keys, sessions, or full prompts.
- Provider outages degrade to documented manual/fallback paths.
- Projection rebuild and dead-letter replay are tested.

**Verification:** Synthetic failure drill and automated telemetry leakage scan.

**Evidence:** Pending.

### [ ] GAS-001 — Evaluate and add gas sponsorship

**Priority:** P1, cuttable  
**Dependencies:** `EXP-003`, `REV-002`, `FND-003`  
**Source:** PRD section 15

**Outcome:** Low-risk submission/approval actions may be sponsored without adding a second wallet architecture or weakening intent review.

**Deliverables:**

- Current provider/bounty eligibility verification.
- Threat, abuse, quota, fallback, and cost analysis.
- Sponsorship policy limited by action, chain, actor, and rate.

**Acceptance criteria:**

- Manual user-paid flow remains available.
- Sponsorship cannot change calldata, recipient, token, amount, or authority.
- No duplicate wallet stack is introduced.

**Verification:** Sponsored and fallback integration tests plus abuse/rate-limit tests.

**Evidence:** Pending.

---

## Phase 7 — End-to-end release and submission

### [ ] E2E-001 — Pass the role-separated release scenario

**Priority:** P0  
**Dependencies:** `VER-002`, `DES-001`, `OBS-001`  
**Source:** Architecture section 19.4; PRD section 18

**Outcome:** Distinct owner/submitter, approver, treasury, and verifier identities complete the full workflow.

**Scenario:**

1. Create workspace and assign roles.
2. Create/import an attributable source payment.
3. Upload private evidence and confirm fields.
4. Submit version 1 on the configured Monad environment.
5. Approve version 1.
6. Change material amount/evidence to create version 2.
7. Prove version 1 approval is historical and cannot pay.
8. Approve version 2.
9. Reimburse version 2 in configured supported USDC.
10. Export and independently verify the package.
11. Tamper one field/file and prove verification fails.
12. Exercise one provider outage and complete the supported fallback.

**Acceptance criteria:**

- All actions use real application boundaries and configured test/demo services.
- Private-data leakage scan passes.
- Timeline and verifier agree with authoritative onchain state.
- No actor performs a role they were not granted.
- Desktop and mobile P0 paths pass.

**Verification:** Automated Playwright path where safe plus recorded manual wallet/chain evidence.

**Evidence:** Pending.

### [ ] REL-001 — Prepare authorized deployment release candidate

**Priority:** P0  
**Dependencies:** `E2E-001`, `CHN-005`  
**Source:** Architecture section 18.4; `RULES.md` section 15

**Outcome:** A reproducible release candidate is ready for deployment, but no live deployment occurs without explicit authorization.

**Deliverables:**

- Frozen source commit candidate and clean/known diff.
- Passing release command bundle and reports.
- Target environment/chain, deployer, owners/admins, token, constructor arguments, and estimated cost prepared for human confirmation.
- Roll-forward/recovery plan and manifest output path.

**Acceptance criteria:**

- Every P0 task is `[x]`.
- Known limitations and cut features are documented.
- No placeholder address remains in runtime configuration.
- Deployment action is clearly separated from preparation.

**Verification:** Full release gate in a non-production rehearsal environment.

**Evidence:** Pending.

### [ ] REL-002 — Deploy, verify, and freeze manifest

**Priority:** P0  
**Dependencies:** `REL-001`  
**Authorization:** Explicit human authorization required at execution time  
**Source:** Architecture section 18; PRD section 20 Phase 5

**Outcome:** Authorized contracts and application are deployed to the confirmed environment with immutable evidence.

**Deliverables:**

- Actual deployment receipts and verified source links.
- Frozen deployment manifest containing chain ID, addresses, deployer, blocks, transactions, source commit, and ABI hashes.
- Runtime configuration matched to manifest.
- Post-deployment smoke and role-separated critical-path test.

**Acceptance criteria:**

- Human confirms target chain and cost before writes.
- Explorer, bytecode/source verification, ABI hash, owner/admin, and runtime configuration match.
- Previous manifests are preserved.
- No private data appears in deployment inputs or public output.

**Verification:** Independent manifest-to-chain reconciliation and production/demo smoke test.

**Evidence:** Pending.

### [ ] SUB-001 — Produce honest submission package

**Priority:** P0  
**Dependencies:** `REL-002`  
**Source:** PRD sections 15, 20, and 24

**Outcome:** Judges can reproduce, inspect, and understand Clario’s real differentiation and limitations.

**Deliverables:**

- README setup, architecture diagram, contract/explorer links, deployment manifest, ABIs, schemas, verifier instructions, and security/privacy notes.
- Concise demo video using real implemented state.
- Valid and tampered sample verification packages containing safe synthetic data.
- Track/bounty mapping verified against current published rules.

**Acceptance criteria:**

- Every product, provider, network, and bounty claim has inspectable evidence.
- Demo distinguishes integrity from truth and submitted from confirmed.
- No fake metrics, logos, integrations, addresses, or unsupported capabilities appear.
- Only meaningful demonstrable bounties are selected.

**Verification:** Fresh-machine reproduction plus founder review of every external claim.

**Evidence:** Pending.

---

## 5. Deferred backlog — do not start before P0 completion

These items require a new task specification and founder approval:

- `[ ] FUT-001` Advanced approval thresholds, scopes, and policy language.
- `[ ] FUT-002` Batch reimbursements and payroll-like payouts.
- `[ ] FUT-003` Accounting integrations and configurable exports.
- `[ ] FUT-004` Smart-account treasury controls.
- `[ ] FUT-005` Vendor or contributor attestations.
- `[ ] FUT-006` Budgets, forecasting, and historical reporting.
- `[ ] FUT-007` Public grant reporting with privacy review.
- `[ ] FUT-008` Cross-chain reimbursement through a supported canonical route.
- `[ ] FUT-009` Paid verifier API and verifier-agent identity.
- `[ ] FUT-010` Treasury conversion only when it serves an approved reimbursement need.

The following are not backlog items unless the product strategy changes: generic trading, prediction markets, lending, yield, staking, collectibles, social reputation, token launch, or decorative protocol integrations.

## 6. Cut order under time pressure

Cut in this order, while preserving a coherent end-to-end product:

1. Broad multichain import beyond the demonstrated source.
2. Gas sponsorship.
3. Advanced dashboard/reporting polish.
4. AI anomaly detection beyond basic extraction.
5. Multiple AI/source providers.
6. Historical pricing beyond the required attributable value.
7. Nonessential dark-mode or marketing animation polish.

Never cut:

- Private evidence protection.
- Canonical salted commitments.
- Exact-version approval.
- Approval invalidation after material edits.
- Real Monad submission, decision, and settlement evidence.
- Duplicate reimbursement protection.
- Activity timeline.
- Independent verifier and tamper demonstration.

## 7. Founder review checkpoints

Founder review is required after:

- `PRO-002`: canonical protocol and golden vectors are frozen.
- `CHN-004`: public contract behavior and invariants are frozen for audit.
- `APP-003`: evidence privacy boundary is tested.
- `REV-002`: stale approval and supersession behavior is demonstrated.
- `SET-002`: payment safety and duplicate protection are demonstrated.
- `VER-002`: independent verification and limitations are demonstrated.
- `E2E-001`: the full story works without fake state.
- `REL-001`: target chain, addresses, cost, and release evidence are approved.

At each checkpoint ask:

1. Is the user outcome real?
2. Is private context still controlled?
3. Is authority bound to the exact version?
4. Can the claim be independently checked?
5. Does failure recover without duplicate action or rewritten history?

If any answer is unclear, the next phase stays blocked.
