# Clario PostgreSQL Database Architecture and Migration Runbook

**Status:** Authoritative database specification  
**Owner:** Core Engineering  
**Applies to:** API, workers, background jobs, database administrators, and CI  
**Companion documents:** [architecture.md](../architecture.md) (Section 9) · [RULES.md](../RULES.md) (Section 13) · [THREAT_MODEL.md](../THREAT_MODEL.md)

---

## 1. Overview and Trust Boundaries

Clario uses PostgreSQL 16+ as its primary relational store for private workflow coordination. In accordance with **ADR-001** and founder invariant **R-001 (Private by default)**, private business evidence, notes, and unredacted values are **never published onchain**. The PostgreSQL database stores the operational state and encrypted ciphertext pointers required to produce public commitments on Monad.

### 1.1 Data Classification Map

| Classification | Fields / Entities | Storage & Encryption Rule |
|---|---|---|
| **Public-Verifiable** | `workspace_id`, `expense_id`, `version`, `commitment`, `policy_commitment`, `payment_reference`, `recipient`, `reviewer_address`, `transaction_hash` | Stored in plain text in database; matches public Monad registries and Envio indexer projections. |
| **Workspace-Confidential** | `name`, `record_ciphertext`, `salt_ciphertext`, `rules_ciphertext`, `suggested_fields_ciphertext` | Encrypted using AES-256-GCM envelope encryption. Plaintext is never stored in unencrypted columns. |
| **Evidence-Confidential** | Receipts, invoices, PDFs, PNGs | Raw bytes reside in private encrypted object storage. Database stores `evidence_objects` containing storage key, SHA-256 hash, byte length, and wrapped key references. |
| **Security-Sensitive** | `salt_key_reference`, `record_key_reference`, session tokens, idempotency payloads | Key references point to external KMS; plaintext keys never reside in the database or logs. |

---

## 2. Core Constraints and Invariants

The database schema enforces workflow integrity at the database engine level via strict foreign keys, check constraints, and partial unique indexes:

### 2.1 Integer Base-Unit Monetary Amounts
Floating-point arithmetic for currency is strictly prohibited (**RULES.md Section 13**). All monetary values (e.g. USDC, native assets) are stored as `NUMERIC(78, 0)` base units:
```sql
amount NUMERIC(78, 0) NOT NULL CHECK (amount >= 0)
```
78 decimal digits accommodate integers up to $2^{256} - 1$, preventing any overflow, rounding drift, or precision loss across all token decimal standards.

### 2.2 Strict UTC Timestamps
Every timestamp is declared as `TIMESTAMPTZ` with `DEFAULT NOW()`:
```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```
Application layers MUST supply and parse timestamps formatted as ISO 8601 UTC (`YYYY-MM-DDTHH:MM:SSZ`).

### 2.3 Immutable Expense Versioning
A material edit creates a new immutable version and never overwrites an existing record (**R-003**).
- `expense_versions` primary key is composite: `(workspace_id, expense_id, version)`.
- Predecessor check constraint:
  ```sql
  CONSTRAINT chk_expense_versions_predecessor
    CHECK ((version = 1 AND previous_commitment IS NULL) OR (version > 1 AND previous_commitment IS NOT NULL))
  ```
- Current version reference on `expenses`:
  ```sql
  ALTER TABLE expenses
    ADD CONSTRAINT fk_expenses_current_version
    FOREIGN KEY (workspace_id, expense_id, current_version)
    REFERENCES expense_versions (workspace_id, expense_id, version)
    ON DELETE RESTRICT;
  ```
  This constraint guarantees that `expenses.current_version` can never point to a nonexistent or orphaned version.

### 2.4 Duplicate Settlement Guard
Normal duplicate reimbursement is blocked at both the contract layer (`ClarioSettlementRegistryV1`) and the database layer (**R-006**).
A partial unique index enforces that at most **one active standard reimbursement** can exist for a given `(workspace_id, expense_id, version)`:
```sql
CREATE UNIQUE INDEX idx_reimbursements_active_unique
  ON reimbursements (workspace_id, expense_id, version)
  WHERE status NOT IN ('failed', 'cancelled');
```
If an onchain transaction fails or is cancelled, its status is updated to `'failed'` or `'cancelled'`, which frees the index slot and allows an authorized retry.

### 2.5 Decision Reasoning and Uniqueness
- Each immutable expense version can have at most one recorded decision:
  ```sql
  CONSTRAINT uq_decisions_version UNIQUE (workspace_id, expense_id, version)
  ```
- Reject and RequestChanges decisions strictly require an explanatory reason commitment:
  ```sql
  CONSTRAINT chk_decisions_reason
    CHECK (decision_type = 'approve' OR reason_commitment IS NOT NULL)
  ```

### 2.6 Source Transaction & Claim Slot Uniqueness
To prevent double-claiming of cross-chain imported transactions:
```sql
CONSTRAINT uq_source_transactions
  UNIQUE (workspace_id, source_chain_id, source_transaction_hash, claim_slot)
```

### 2.7 Actor-Scoped Idempotency
Mutating API operations require an idempotency key scoped to workspace, actor address, and action:
```sql
PRIMARY KEY (key, workspace_id, actor_address, action)
```
An index on `expires_at` facilitates automated garbage collection of expired idempotency records.

### 2.8 Orphan Prevention via ON DELETE RESTRICT
All foreign keys use `ON DELETE RESTRICT` rather than `CASCADE` to ensure that historical audit logs, decisions, versions, and evidence can never be accidentally erased by deleting parent entities.

---

## 3. Entity Catalog

The initial schema (`0001_initial_schema`) provisions 20 operational tables:

1. **`schema_migrations`**: Tracks applied migration versions, filenames, SHA-256 checksums, and execution timestamps.
2. **`users`**: Platform user accounts keyed by UUID and primary wallet address.
3. **`wallet_identities`**: Linked wallets per user, scoped by chain family (`evm`, `monad`, `local`).
4. **`workspaces`**: Multi-tenant workspace entities identified by opaque 32-byte hex identifiers.
5. **`workspace_policies`**: Monotonic policy versions, rule ciphertexts, and policy commitments.
6. **`memberships`**: Workspace user membership and participation status (`active`, `suspended`, `revoked`).
7. **`role_grants`**: Role grants matching protocol hashes (`OWNER_ROLE`, `APPROVER_ROLE`, `TREASURY_ROLE`, etc.) with active partial unique index.
8. **`expenses`**: Header record tracking workspace ownership and pointer to `current_version`.
9. **`expense_versions`**: Immutable append-only version snapshots storing ciphertexts, amounts, currency, and commitments.
10. **`evidence_objects`**: Envelope-encrypted receipt and invoice metadata attached to specific versions.
11. **`source_transactions`**: Cross-chain imported source transactions with claim-slot collision guards.
12. **`ai_analyses`**: Advisory, non-authoritative machine extractions and confidence scores.
13. **`review_assignments`**: Approver queue assignments for specific expense versions.
14. **`decisions`**: Exact-version human review decisions (`approve`, `reject`, `request_changes`).
15. **`reimbursements`**: Settlement execution records bound to approved versions with active uniqueness guard.
16. **`chain_transactions`**: Outbound onchain transaction lifecycle (`preparing`, `submitted`, `confirmed`, `failed`).
17. **`indexed_events`**: Rebuildable projection of Monad registry contract logs.
18. **`audit_events`**: Immutable operational and security event log.
19. **`exports`**: Authorized, time-limited audit package export records.
20. **`jobs`**: Background worker queue for async ingestion, document processing, and AI extraction.
21. **`idempotency_keys`**: Request deduplication and replay protection cache.

---

## 4. Migration Tooling and CLI

The `@clario/database` package includes an append-only, checksum-verified migration engine (`Migrator`).

### 4.1 Migration File Convention
Migrations reside in `packages/database/migrations/` and follow the strict paired naming convention:
- `<version>_<name>.up.sql`: Forward DDL script.
- `<version>_<name>.down.sql`: Exact rollback script.

Example:
- `0001_initial_schema.up.sql`
- `0001_initial_schema.down.sql`

### 4.2 Append-Only and Checksum Verification
When `migrator.up()` runs:
1. It reads `schema_migrations` to retrieve all previously applied versions.
2. It re-computes the SHA-256 checksum of every applied script on disk and compares it with the recorded checksum.
3. If an applied migration file was modified in place, the runner immediately halts with `CHECKSUM_MISMATCH`.
4. Pending migrations are executed sequentially within atomic transactions (`BEGIN ... COMMIT`).

### 4.3 Programmatic Usage
```typescript
import { Migrator, createPool } from "@clario/database";

const pool = createPool(process.env.DATABASE_URL);
const migrator = new Migrator(pool);

// Check status
const { applied, pending } = await migrator.status();

// Apply all pending migrations
const executed = await migrator.up();

// Rollback latest migration
const rolledBack = await migrator.down();
```

---

## 5. Rollback and Disaster Recovery Runbook

### 5.1 Pre-Migration Safety Checklist
1. **Never perform destructive migrations without a validated backup.**
2. Confirm the target database environment (`local`, `preview`, `staging`, `production`).
3. Verify that the application version deployed is compatible with the target schema state.
4. Run `migrator.status()` to inspect pending changes before execution.

### 5.2 Rollback Procedure
If a migration fails or must be reverted during staging or release rehearsal:
1. Execute `migrator.down()`.
2. The down migration drops tables and constraints in reverse dependency order.
3. The entry is removed from `schema_migrations`.
4. Run `migrator.status()` to confirm the database returned to the previous known-good version.

### 5.3 Disaster Recovery: Re-Migrating from Zero
In local, test, or isolated preview environments:
1. Run `migrator.down()` until all versions are reverted.
2. Verify all custom tables are removed.
3. Run `migrator.up()` to rebuild the full schema from clean zero state.
4. Run automated test suite: `pnpm --filter @clario/database test`.

---

## 6. Test Fixture Guidelines

In compliance with **RULES.md Section 5.2**:
- Test fixtures MUST contain **zero real personal data**, customer emails, live merchant invoices, or active production addresses.
- All fixtures in `packages/database/src/fixtures/` use RFC 2606 example names and deterministic 0x test hashes.
- Tests execute offline in memory via `pg-mem` without requiring live network access or external credentials.
