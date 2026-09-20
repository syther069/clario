# Clario Implementation Phases

**Status:** Active founding roadmap  
**Version:** 1.0  
**Current phase:** Phase 0 — Foundation  
**Execution checklist:** [TASKS.md](./TASKS.md)  
**Governing rules:** [RULES.md](./RULES.md)  
**Product source:** [PRD](./prd.md)  
**Technical source:** [Architecture](./architecture.md)  
**Design source:** [DESIGN.md](./DESIGN.md)

> Clario is complete only when a team can keep expense evidence private while a third party independently verifies the exact version, authorized human decision, correction history, and matching Monad reimbursement.

## 1. Purpose

This document defines the order in which Clario is built and the proof required to advance. It translates the PRD and architecture roadmaps into stage gates.

- `PHASES.md` owns sequencing, dependencies, outcomes, and phase acceptance.
- `TASKS.md` owns atomic implementation work and task status.
- `RULES.md` owns hard engineering and security constraints.
- `prd.md` owns product scope and success criteria.
- `architecture.md` owns system boundaries and protocol invariants.
- `DESIGN.md` owns UI, interaction, responsive, and accessibility standards.

A phase is not complete because its code exists. It is complete only when its acceptance criteria pass and its evidence is recorded.

## 2. Founder strategy

Clario’s product thesis is one connected proof chain:

```text
payment → private evidence → immutable version → authorized decision
        → correction history → reimbursement → independent verification
```

The implementation order protects that thesis:

1. Establish safe engineering boundaries.
2. Freeze the canonical protocol before building around it.
3. Protect private data before adding workflow convenience.
4. Make version submission real on Monad.
5. Prove approval integrity and history.
6. Close the loop with reimbursement and independent verification.
7. Add AI and polish only after the manual trusted path works.
8. Release only from reproducible evidence.

Independent verification, material-edit invalidation, private evidence, real Monad writes, and duplicate-settlement protection are never cut for schedule.

## 3. Phase status and governance

### Status values

| Status | Meaning |
|---|---|
| `NOT_STARTED` | Entry criteria are not yet met |
| `READY` | Dependencies and required decisions are satisfied |
| `ACTIVE` | At least one task in the phase is in progress |
| `BLOCKED` | A named external dependency or founder decision prevents progress |
| `GATE_REVIEW` | Required tasks are complete; evidence is under review |
| `COMPLETE` | Founder-approved exit criteria and evidence pass |

Only one phase is the primary active phase. Work explicitly identified as a parallel track may proceed when its own dependencies are complete, but it cannot bypass the active phase’s gate.

### Advancement rule

To mark a phase `COMPLETE`:

1. Every required P0 task is `[x]` in `TASKS.md`.
2. The phase acceptance scenario passes at the real boundary named by the phase.
3. Security, privacy, and no-fake-data checks pass.
4. Evidence artifacts are reproducible and linked in the phase record.
5. Known limitations are explicit and non-blocking.
6. A founder approves the gate.
7. `Current phase` is advanced in both this file and `TASKS.md`.

No agent may self-approve a founder gate merely because tests pass.

### Phase record template

Add this block beneath the relevant phase when it reaches gate review:

```text
Status: GATE_REVIEW | COMPLETE
Reviewed: YYYY-MM-DD
Reviewer: <founder/human>
Evidence: <test reports, manifests, screenshots, recordings, or reproducible commands>
Known limitations: <items or “None”>
Decision: <approved, rejected, or approved with named follow-up>
```

Never include credentials, private evidence, live personal information, salts, or noisy raw logs.

## 4. Roadmap at a glance

| Phase | Outcome | Required tasks | Depends on | Gate proof |
|---|---|---|---|---|
| 0. Foundation | Safe, testable repository and boundaries | `FND-001..003`, `SEC-001` | None | Clean setup and approved threat model |
| 1. Protocol foundation | Frozen canonical protocol and tested contracts | `PRO-001..003`, `CHN-001..005` | Phase 0 | Golden vectors and local invariant suite |
| 2. Private workflow | Authorized encrypted workspace foundation | `APP-001..004` | Phase 1 protocol types/roles | Cross-workspace and evidence-tamper tests |
| 3. Verifiable expense core | Real immutable expense version submission | `EXP-001..003` | Phases 1–2 | Submitted commitment matches private record |
| 4. Approval integrity | Exact-version decisions and authoritative timeline | `REV-001..002`, `IDX-001..002` | Phase 3 and contracts | Edit invalidates approval; history remains |
| 5. Settlement and verification | Approved version reimbursed and independently checked | `SET-001..002`, `VER-001..002` | Phase 4 | Valid export passes; tampered export fails |
| 6. Intelligence and resilience | Human-supervised AI, design, warnings, observability | `AI-001`, `INT-001`, `DES-001`, `OBS-001`; `GAS-001` optional | Trusted manual path | Provider failure preserves valid workflow |
| 7. Release and submission | Reproducible deployed product and honest submission | `E2E-001`, `REL-001..002`, `SUB-001` | Phases 0–6 P0 gates | Role-separated live demo and frozen manifest |

## 5. Cross-phase dependency map

```text
Phase 0: repository + configuration + threat model
   │
   ▼
Phase 1: schema + golden vectors + registries + deployment tooling
   │                         │
   ├──────────────┐          │
   ▼              ▼          │
Phase 2: private workflow    │
   │              │          │
   └──────┬───────┘          │
          ▼                  │
Phase 3: expense submission ◄┘
          │
          ▼
Phase 4: review + supersession + indexing
          │
          ▼
Phase 5: reimbursement + export + verifier
          │
          ├──────────────┐
          ▼              ▼
Phase 6: intelligence    Phase 7 preparation
          │              │
          └──────┬───────┘
                 ▼
          Phase 7 release
```

Design foundation work from `DES-001` may begin after `FND-001`, but product screens must follow the real state models produced by Phases 2–5. AI work must not lead the critical path.

---

## Phase 0 — Foundation

**Status:** `ACTIVE`  
**Goal:** Create a safe, reproducible engineering base before application or contract behavior grows around accidental choices.

### Entry criteria

- Founding PRD, architecture, design, rules, tasks, and phases are present.
- Product thesis and MVP boundary are understood.
- No live credential or deployment is required.

### Required tasks

- `FND-001` — Scaffold the repository.
- `FND-002` — Establish CI and repository quality gates.
- `FND-003` — Define configuration schema and environment boundaries.
- `SEC-001` — Commit the MVP threat model.

### Workstream outcomes

#### Repository

- Next.js PWA, contracts, shared protocol/verifier code, and tests have explicit boundaries.
- Root commands perform real install, lint, type-check, test, and build work.
- Dependency and runtime versions are recorded and locked.

#### Configuration

- Local, preview, staging, and demo/production are distinct.
- Chain, RPC, explorer, contract, token, provider, database, storage, key, and AI configuration are typed and fail closed.
- No address or chain value is inferred from hostname or embedded in UI logic.

#### Security

- The browser, API, wallet, database, object store, AI provider, source-chain provider, Monad, indexer, and verifier trust boundaries are documented.
- The initial threat register assigns controls and validation for private leakage, broken authorization, replay, stale approval, duplicate reimbursement, recipient substitution, prompt injection, and chain reorganization.

### Phase acceptance criteria

- A clean checkout installs and runs every root quality command.
- CI reproduces the same commands without production secrets.
- Invalid or mixed environment configuration fails safely.
- The threat model covers every public/private boundary and founder invariant.
- No fake production address, secret, user data, or placeholder-success command exists.
- `RULES.md` is referenced by contributor/agent entry documentation.

### Gate evidence

- Clean-setup transcript or CI run.
- Configuration validation test report.
- Threat model and data-flow diagram.
- Dependency inventory and license/security review baseline.

### Explicitly not in this phase

- Live deployment.
- Production credentials.
- Provider integration beyond typed boundaries.
- Feature UI or contract business logic.

---

## Phase 1 — Protocol Foundation

**Status:** `NOT_STARTED`  
**Goal:** Freeze the bytes, identifiers, events, authority, decisions, and settlement invariants that every later layer depends on.

### Entry criteria

- Phase 0 is complete.
- Threat-model controls affecting the protocol have owners.
- Monad environment remains configuration, not hardcoded product logic.

### Required tasks

- `PRO-001` — Specify canonical expense schema v1.
- `PRO-002` — Build cross-runtime golden commitment vectors.
- `PRO-003` — Publish public protocol types and error vocabulary.
- `CHN-001` — Implement workspace roles and policy history.
- `CHN-002` — Implement immutable expense-version registry.
- `CHN-003` — Implement exact-version decision registry.
- `CHN-004` — Implement settlement registry and duplicate guard.
- `CHN-005` — Create deployment and source-verification tooling.

### Workstream outcomes

#### Canonical protocol

- Expense record and evidence manifest schemas define exact encoding and privacy classification.
- Material fields are explicit.
- Domain-separated salted commitments reproduce across runtimes.
- Public types and errors distinguish exact claims instead of using vague booleans.

#### Contract authority

- Opaque workspaces and scoped role history are enforceable.
- Versions are immutable, ordered, and linked to their predecessors.
- Decisions bind to current exact commitments and authorized reviewers.
- Settlement binds token, recipient, amount, version, and commitment and rejects duplicates.

#### Deployment reproducibility

- Local deployment and manifest generation are deterministic and non-destructive.
- Source verification steps are documented but no live deployment is implied.

### Phase acceptance criteria

- Two independent implementations match every golden vector.
- One-byte material changes alter the commitment; different salts produce different commitments.
- Unauthorized role changes, decisions, and settlements fail.
- Wrong predecessor, reused version, stale commitment, replay, wrong domain, and duplicate settlement fail.
- Superseded approvals remain historical and cannot authorize payment.
- Contract events contain no private expense content.
- Fuzz and invariant suites pass, including settlement-implies-current-approval.
- Local deployment produces a schema-valid manifest without overwriting history.

### Gate demonstration

On a local EVM:

1. Create a workspace and roles.
2. Submit version 1.
3. Approve version 1.
4. Submit version 2 referencing version 1.
5. Prove version 1 cannot settle.
6. Approve and settle version 2 once.
7. Prove the second settlement fails.

### Gate evidence

- Canonical schema and golden vectors.
- Contract test and invariant reports.
- ABI/event definitions.
- Local deployment manifest and reproducible commands.

### Freeze point

After founder approval, changes to canonical bytes, public identifiers, event signatures, contract interfaces, or golden vectors require compatibility review and a versioned protocol decision.

---

## Phase 2 — Private Workflow

**Status:** `NOT_STARTED`  
**Goal:** Build the authenticated, workspace-isolated, encrypted foundation that keeps business evidence under team control.

### Entry criteria

- `PRO-001..003` and `CHN-001` are complete.
- Database, object storage, and key-management choices are explicitly configured for the target environment.
- Evidence retention and access policies are defined.

### Required tasks

- `APP-001` — Create PostgreSQL schema and migrations.
- `APP-002` — Implement authentication and workspace authorization.
- `APP-003` — Implement encrypted evidence storage.
- `APP-004` — Implement workspace and role management workflow.

### Workstream outcomes

- Database constraints enforce version, decision, source-transaction, idempotency, and settlement integrity.
- Wallet authentication creates a secure session; a client-supplied address grants nothing.
- Every private request checks workspace, role, scope, record, object, and action server-side.
- Evidence uses per-object/version authenticated encryption and private object storage.
- Role changes show exact intent and reconcile with authoritative onchain confirmation.

### Phase acceptance criteria

- Cross-workspace enumeration, record access, object guessing, and revoked-role access fail closed.
- Ciphertext, nonce/context, and evidence-manifest tampering are detected.
- Submitted evidence cannot be overwritten in place.
- Admin membership alone does not bypass evidence policy.
- Signed URLs are short-lived, object-specific, method-specific, and authorized.
- Logs, URLs, errors, analytics, snapshots, and fixtures contain no plaintext evidence or key material.
- Clean database migration and constraint suites pass.
- Workspace/role workflow passes keyboard, mobile, and transaction-state tests.

### Gate demonstration

1. Create two isolated workspaces.
2. Upload evidence in workspace A.
3. Prove workspace B and an unauthorized admin cannot discover or read it.
4. Tamper with ciphertext or authenticated context and prove decryption fails.
5. Grant and revoke a role through the prepared wallet flow.
6. Prove revocation blocks new authority while history remains visible.

### Gate evidence

- Migration and constraint report.
- Authentication/authorization matrix.
- Evidence cryptography vectors and object-access tests.
- Automated private-data leakage scan.

---

## Phase 3 — Verifiable Expense Core

**Status:** `NOT_STARTED`  
**Goal:** Let a submitter create a private expense and anchor one deterministic immutable version on Monad with truthful lifecycle feedback.

### Entry criteria

- Phases 1 and 2 gates are complete.
- Canonicalization library and encrypted evidence storage are available.
- Expense-version contract behavior is frozen for the MVP.

### Required tasks

- `EXP-001` — Implement manual expense drafts.
- `EXP-002` — Implement attributable transaction import. P1; manual entry remains the P0 fallback.
- `EXP-003` — Commit and submit expense version.

### Workstream outcomes

- Submitters can create, validate, autosave, recover, and attach evidence to private drafts.
- Source transactions may be imported with explicit provider provenance and manual/RPC fallback.
- Server canonicalization and secure salt generation produce the expected commitment.
- The user sees exact transaction intent before signing.
- Submission persists safely across refresh, wallet rejection, replacement, timeout, failure, confirmation, and indexing.

### Phase acceptance criteria

- Draft and evidence access is workspace-isolated.
- Amounts use integer base units and validated asset metadata.
- Imported facts retain chain, provider, hash, fetch time, and source attribution.
- Prepared calldata contains only approved public fields.
- Commitment matches the frozen golden vectors.
- Wrong network, stale draft, rejected signature, reverted transaction, replacement, and refresh behave safely.
- `SUBMITTED` is never displayed as confirmed or final.
- A confirmed event maps to the exact local expense version.

### Gate demonstration

1. Create a manual private expense with evidence.
2. Inspect the public/private preview.
3. Submit version 1 through the wallet.
4. Refresh while pending and recover state.
5. Confirm the event and explorer reference.
6. Recompute the commitment from authorized private data and salt.
7. Show that no private field appears in calldata or events.

### Gate evidence

- Draft/API and object-access tests.
- Golden-vector result for the submitted fixture.
- Calldata/event privacy report.
- Transaction-lifecycle integration report.
- Responsive/accessibility screenshots or test output.

---

## Phase 4 — Approval Integrity and Indexing

**Status:** `NOT_STARTED`  
**Goal:** Make exact-version human authority, correction history, and public workflow ordering independently inspectable.

### Entry criteria

- Phase 3 is complete.
- Decision registry and indexer endpoint/configuration are available.
- Reviewer authorization policy is unambiguous.

### Required tasks

- `REV-001` — Build authorized review queue and detail view.
- `REV-002` — Record exact-version decisions and supersession.
- `IDX-001` — Implement idempotent event indexing.
- `IDX-002` — Build activity timeline from authoritative events.

### Workstream outcomes

- Authorized reviewers see source facts, private record, evidence, exact commitment, policy status, and material diff.
- Approve/reject/request-changes actions bind to the reviewed current version.
- Material edits create a successor version and historical branch.
- Public events produce rebuildable projections with reorganization handling.
- The Proof Spine distinguishes local, submitted, confirmed, replaced, failed, and indexed state.

### Phase acceptance criteria

- Unauthorized users cannot enumerate or open review work.
- A record changed after opening cannot be approved.
- Wrong signer, version, commitment, chain, contract, nonce, expiry, or role fails.
- Version 1 approval remains visible after version 2 but cannot authorize settlement.
- Event replay is idempotent and rebuild produces equivalent projections.
- Reorganization retracts/replaces affected state without rewriting stable history.
- Public projections contain no private fields; joins happen only after authorization.
- Timeline ordering and timestamp sources remain accurate after refresh.

### Gate demonstration

1. Review and approve version 1 as an authorized reviewer.
2. Edit an approval-material field and create version 2.
3. Prove version 1 approval is historical and current state requires reapproval.
4. Attempt a stale version 1 decision and prove it fails.
5. Approve version 2.
6. Rebuild the timeline from indexed events and compare it with chain receipts.

### Gate evidence

- Authorization and stale-review test matrix.
- Signature replay/domain tests.
- Supersession and version-diff recording.
- Indexer replay/reorganization report.
- Public/private projection review.

---

## Phase 5 — Settlement and Independent Verification

**Status:** `NOT_STARTED`  
**Goal:** Close the expense lifecycle by reimbursing the approved current version and proving the complete chain outside Clario’s private database.

### Entry criteria

- Phase 4 is complete.
- Target Monad environment and supported USDC contract are confirmed from current official sources.
- Treasury authority and settlement method are approved.
- Contract and application duplicate guards pass locally.

### Required tasks

- `SET-001` — Integrate supported Monad reimbursement asset.
- `SET-002` — Execute and reconcile reimbursement lifecycle.
- `VER-001` — Define portable verification package v1.
- `VER-002` — Build independent verifier.

### Workstream outcomes

- Treasury sees approved versus prepared token, recipient, amount, chain, version, and commitment.
- Settlement preparation rechecks authority, current approval, balance, allowance, simulation, and prior settlement.
- Confirmation validates the expected receipt, event, and token transfer.
- Exports disclose included private material deliberately and support redaction.
- Verifier recomputes hashes, checks authority/version history, and matches settlement using public inputs and compatible Monad RPC.

### Phase acceptance criteria

- Unsupported token/network, stale approval, mismatch, insufficient balance/allowance, failed simulation, and duplicate attempt block safely.
- A transaction hash alone never marks reimbursement complete.
- Failed/reverted/replaced/reorganized transactions reconcile correctly.
- Valid package returns the expected verified result.
- Tampered record/evidence, wrong salt, wrong chain/contract, unauthorized/revoked signer, superseded approval, and unmatched settlement fail correctly.
- Missing redacted input is `UNVERIFIABLE`, never passed.
- Verifier has no authenticated Clario database dependency.
- Results state that integrity does not prove truth or tax eligibility.

### Gate demonstration

1. Open approved current version 2 as treasury.
2. Compare approved and prepared settlement fields.
3. Simulate and submit reimbursement in configured supported USDC.
4. Validate receipt/event/transfer and mark confirmed.
5. Attempt a duplicate and prove it fails.
6. Export and verify the package independently.
7. Alter one disclosed field/file and prove verification fails.

### Gate evidence

- Official configuration provenance for chain/token.
- Settlement simulation and receipt reconciliation.
- Duplicate-protection tests at application and contract layers.
- Versioned package schema.
- Valid/tampered verifier test matrix.

### Non-negotiable milestone

At the end of Phase 5, Clario’s narrow product promise must work without AI, gas sponsorship, advanced reporting, or decorative integrations.

---

## Phase 6 — Intelligence, Design, and Resilience

**Status:** `NOT_STARTED`  
**Goal:** Reduce effort and improve confidence without weakening the trusted manual workflow.

### Entry criteria

- The relevant manual path exists and passes its prior gate.
- AI/provider data policy is approved before sending evidence.
- Design work uses real state models rather than invented dashboards.

### Required tasks

- `AI-001` — Add human-supervised receipt extraction.
- `INT-001` — Add duplicate and mismatch warnings.
- `DES-001` — Implement the design foundation.
- `OBS-001` — Add privacy-safe observability and recovery.

### Optional task

- `GAS-001` — Evaluate and add gas sponsorship only if eligible and meaningful.

### Workstream outcomes

- AI extraction returns structured suggestions with source, confidence, uncertainty, and human disposition.
- Deterministic duplicate/mismatch checks precede probabilistic warnings.
- Evidence Ledger tokens, primitives, responsive shell, accessibility, and restrained motion are consistent.
- Operators can diagnose API, job, RPC, indexer, evidence, AI, and settlement failure without private telemetry.
- Optional sponsorship preserves intent, authority, calldata, and manual fallback.

### Phase acceptance criteria

- Prompt-injection content cannot direct tools or privileged actions.
- Low-confidence/malformed output is never silently committed.
- AI outage leaves manual submission fully valid.
- Warnings never autonomously approve or reject.
- Core screens pass WCAG 2.2 AA, keyboard-only use, 320px, 200% zoom, forced colors, and reduced motion.
- Light/dark contrast and color-vision state checks pass if dark mode ships.
- Telemetry leakage tests find no private purpose, merchant, email, evidence, salt, key, session, or full prompt.
- Provider outages have tested fallback/recovery paths.
- Sponsorship, if present, cannot modify transaction intent or add a second wallet stack.

### Gate demonstration

1. Extract suggestions from safe synthetic evidence.
2. Correct one field and preserve AI/human provenance.
3. Run a prompt-injection fixture and show no privileged effect.
4. Disable the AI/provider and complete manual submission.
5. Exercise one RPC/indexer/job failure and recover safely.
6. Complete core UI flow on desktop, mobile, keyboard, and reduced-motion modes.

### Gate evidence

- AI schema/injection/fallback tests.
- Warning rule matrix.
- Accessibility and Playwright visual reports.
- Synthetic failure drill and telemetry leakage scan.
- Sponsorship eligibility/abuse report if included.

### Cut policy

Under schedule pressure, cut gas sponsorship, advanced warnings, optional dark-mode polish, and nonessential animation before any Phase 0–5 invariant or verifier behavior.

---

## Phase 7 — Release and Submission

**Status:** `NOT_STARTED`  
**Goal:** Produce a reproducible deployed product and an honest submission backed by inspectable evidence.

### Entry criteria

- All P0 tasks from Phases 0–6 are complete.
- Target network, deployer, contract ownership, token, provider set, cost, and release commit are confirmed.
- Explicit human authorization exists before any live write or deployment.

### Required tasks

- `E2E-001` — Pass the role-separated release scenario.
- `REL-001` — Prepare authorized deployment release candidate.
- `REL-002` — Deploy, verify, and freeze manifest.
- `SUB-001` — Produce honest submission package.

### Workstream outcomes

- Distinct owner/submitter, approver, treasury, and verifier identities complete the real workflow.
- Deployment is reproducible, verified, and captured in an immutable manifest.
- Runtime configuration matches actual receipts, chain, ABIs, owners, and token.
- README, setup, architecture, verifier, limitations, demo, and bounty claims match reality.

### Phase acceptance criteria

- Role-separated end-to-end scenario passes on the authorized environment.
- One material edit invalidates prior approval and requires valid reapproval.
- One real supported-USDC settlement is matched to the approved current version.
- Valid export passes and tampered export fails independently.
- Private-data leakage scan passes across calldata, events, URLs, logs, analytics, exports, and demo assets.
- Verified source, explorer links, deployment blocks, transaction hashes, source commit, and ABI hashes match the frozen manifest.
- Fresh-machine setup and verifier reproduction succeed.
- Every track, sponsor, provider, and product claim has current evidence.
- No fake metric, integration, address, transaction, logo, testimonial, or capability appears.

### Release scenario

1. Create workspace and roles.
2. Create or import an attributable expense.
3. Upload private evidence and confirm fields.
4. Submit version 1 on Monad.
5. Approve version 1.
6. Make a material edit and create version 2.
7. Show version 1 approval is superseded.
8. Approve version 2.
9. Reimburse version 2 in supported USDC.
10. Export and independently verify.
11. Tamper a copy and show deterministic failure.
12. Demonstrate one safe provider fallback.

### Gate evidence

- Full release command/test bundle.
- Deployed and verified source links.
- Frozen deployment manifest and ABI hashes.
- Role-separated E2E recording using safe demo data.
- Valid and tampered sample packages.
- Fresh-machine reproduction notes.
- Current track/bounty eligibility review.

### Deployment boundary

Code completion does not authorize deployment. `REL-002` requires explicit human confirmation of the exact target environment, chain, addresses, owners, token, and expected cost immediately before execution.

---

## 6. Release-critical invariants across every phase

These must remain true from first implementation through release:

1. No private expense content appears in public calldata or events.
2. Public identifiers contain no guessable private values.
3. Canonicalization is versioned and deterministic.
4. Commitments use secure unique 32-byte salts.
5. Material edits create new immutable versions.
6. Approval binds to one exact current commitment and authorized reviewer.
7. Superseded approval cannot authorize settlement.
8. AI has no approval, role, signing, evidence-disclosure, or treasury authority.
9. Settlement matches approved token, recipient, amount, version, and commitment.
10. Normal duplicate settlement fails.
11. Submitted state is never presented as confirmed.
12. Public projections are rebuildable and idempotent.
13. Verifier does not trust Clario’s private database.
14. Missing data is unknown/unverifiable, never fabricated or silently passed.
15. Deployments and external writes require explicit authorization.

Any violation blocks phase advancement and release.

## 7. Parallel work policy

Parallel work is allowed only when file ownership and dependencies do not create protocol ambiguity.

Safe examples:

- Threat modeling alongside repository scaffolding.
- Design tokens and accessible primitives after the base frontend exists.
- Verifier UI exploration after package schema is stable.
- Documentation and safe synthetic fixtures alongside tested implementation.

Unsafe examples:

- Building contract and verifier canonicalization from different unfrozen schemas.
- Building reimbursement before current-version approval rules are complete.
- Building AI automation before the manual workflow exists.
- Building dashboard metrics before source ownership and definitions are fixed.
- Integrating multiple wallet/indexer providers simultaneously for bounty coverage.

When two workstreams touch canonical bytes, public interfaces, migrations, authorization, or deployment configuration, serialize the work.

## 8. Phase-level cut order

If delivery pressure rises:

1. Reduce Phase 6 optional scope.
2. Reduce broad transaction import to one demonstrated source plus manual fallback.
3. Reduce dashboard/report customization.
4. Reduce animation and nonessential dark-mode polish.
5. Reduce additional providers and bounty integrations.

Do not remove a whole link from the proof chain. A narrower end-to-end product is preferable to a broad incomplete platform.

## 9. Post-MVP boundary

The following remain outside these implementation phases unless the founding documents are deliberately revised:

- Advanced approval policy language.
- Batch payments and payroll-like flows.
- Accounting-system integrations.
- Smart-account treasury control.
- Contributor/vendor attestations or public reputation.
- Budgets and forecasting.
- Cross-chain reimbursement.
- Paid verifier API or verifier-agent market.
- Generic swaps, trading, prediction markets, lending, yield, staking, collectibles, or token launch features.

New scope must answer:

1. Which required user outcome improves?
2. What private data and authority does it receive?
3. What happens when it fails?
4. Does it duplicate an existing provider or capability?
5. Can it be demonstrated with real, verifiable evidence?
6. Which current task and phase gate owns it?

## 10. Definition of roadmap complete

This roadmap is complete when Phase 7 is founder-approved and:

- A team can create a workspace with distinct roles.
- A submitter can create/import an expense and attach encrypted evidence.
- Clario commits a deterministic immutable expense version on Monad.
- An authorized human approves that exact version.
- A material correction produces a new version and invalidates stale approval.
- Treasury reimburses the approved current version in supported USDC.
- Timeline state matches authoritative events.
- A third party verifies a valid export and rejects a tampered copy without production database access.
- Provider failure preserves a safe manual path.
- Public claims, addresses, transactions, manifests, and integrations are real and inspectable.

Clario ships when its narrow promise is defensible—not when the interface merely looks complete.
