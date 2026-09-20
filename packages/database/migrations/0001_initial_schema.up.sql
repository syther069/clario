-- Clario PostgreSQL Initial Schema Migration (v1)
-- Append-only schema supporting multi-tenant workspaces, immutable expense versions,
-- envelope-encrypted evidence references, human decisions, Monad reimbursements,
-- event projections, background jobs, and actor-scoped idempotency.

-- Enable pgcrypto for gen_random_uuid() if available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Migration Tracking Table
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_address TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Wallet Identities
CREATE TABLE wallet_identities (
  wallet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  chain_family TEXT NOT NULL CHECK (chain_family IN ('evm', 'monad', 'local')),
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_wallet_identities UNIQUE (chain_family, address)
);

-- Workspaces
CREATE TABLE workspaces (
  workspace_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workspace Policies
CREATE TABLE workspace_policies (
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id) ON DELETE RESTRICT,
  policy_version INTEGER NOT NULL CHECK (policy_version >= 1),
  policy_commitment TEXT NOT NULL,
  rules_ciphertext TEXT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, policy_version)
);

-- Workspace Memberships
CREATE TABLE memberships (
  membership_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  address TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_memberships_user UNIQUE (workspace_id, user_id),
  CONSTRAINT uq_memberships_address UNIQUE (workspace_id, address)
);

-- Role Grants
CREATE TABLE role_grants (
  grant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id) ON DELETE RESTRICT,
  address TEXT NOT NULL,
  role TEXT NOT NULL,
  scope TEXT NOT NULL,
  policy_version INTEGER NOT NULL CHECK (policy_version >= 1),
  granted_by TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX idx_role_grants_active ON role_grants (workspace_id, address, role, scope) WHERE revoked_at IS NULL;

-- Expenses (Anchor header for immutable version lineage)
CREATE TABLE expenses (
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id) ON DELETE RESTRICT,
  expense_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  current_version INTEGER NULL CHECK (current_version IS NULL OR current_version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, expense_id)
);

-- Expense Versions (Immutable, append-only records)
CREATE TABLE expense_versions (
  workspace_id TEXT NOT NULL,
  expense_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  commitment TEXT NOT NULL,
  previous_commitment TEXT NULL,
  salt_ciphertext TEXT NOT NULL,
  salt_key_reference TEXT NOT NULL,
  record_ciphertext TEXT NOT NULL,
  record_key_reference TEXT NOT NULL,
  amount NUMERIC(78, 0) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'prepared', 'submitted', 'current', 'superseded')),
  submitted_at TIMESTAMPTZ NULL,
  submitted_by TEXT NULL,
  submitted_transaction_hash TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, expense_id, version),
  CONSTRAINT fk_expense_versions_expense FOREIGN KEY (workspace_id, expense_id) REFERENCES expenses(workspace_id, expense_id) ON DELETE RESTRICT,
  CONSTRAINT uq_expense_versions_commitment UNIQUE (workspace_id, expense_id, commitment),
  CONSTRAINT chk_expense_versions_predecessor CHECK ((version = 1 AND previous_commitment IS NULL) OR (version > 1 AND previous_commitment IS NOT NULL))
);

-- Enforce that current_version on expenses references an existing immutable version
ALTER TABLE expenses
  ADD CONSTRAINT fk_expenses_current_version
  FOREIGN KEY (workspace_id, expense_id, current_version)
  REFERENCES expense_versions (workspace_id, expense_id, version)
  ON DELETE RESTRICT;

-- Evidence Objects (Envelope-encrypted offchain attachments bound to immutable versions)
CREATE TABLE evidence_objects (
  evidence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  expense_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  sha256_hash TEXT NOT NULL,
  byte_length BIGINT NOT NULL CHECK (byte_length > 0),
  mime_type TEXT NOT NULL,
  encryption_metadata JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_evidence_objects_version FOREIGN KEY (workspace_id, expense_id, version) REFERENCES expense_versions (workspace_id, expense_id, version) ON DELETE RESTRICT
);

-- Source Transactions (Imported cross-chain provenance and claim-slot uniqueness)
CREATE TABLE source_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id) ON DELETE RESTRICT,
  expense_id TEXT NOT NULL,
  source_chain_id BIGINT NOT NULL,
  source_transaction_hash TEXT NOT NULL,
  claim_slot INTEGER NOT NULL DEFAULT 0 CHECK (claim_slot >= 0),
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_source_transactions_expense FOREIGN KEY (workspace_id, expense_id) REFERENCES expenses(workspace_id, expense_id) ON DELETE RESTRICT,
  CONSTRAINT uq_source_transactions UNIQUE (workspace_id, source_chain_id, source_transaction_hash, claim_slot)
);

-- AI Analyses (Advisory, non-authoritative machine extractions)
CREATE TABLE ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  expense_id TEXT NOT NULL,
  evidence_id UUID NOT NULL REFERENCES evidence_objects(evidence_id) ON DELETE RESTRICT,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  suggested_fields_ciphertext TEXT NOT NULL,
  confidence NUMERIC(4, 3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  disposition TEXT NOT NULL DEFAULT 'pending' CHECK (disposition IN ('pending', 'accepted', 'modified', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_ai_analyses_expense FOREIGN KEY (workspace_id, expense_id) REFERENCES expenses(workspace_id, expense_id) ON DELETE RESTRICT
);

-- Review Assignments
CREATE TABLE review_assignments (
  assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  expense_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  assigned_to TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'reassigned', 'cancelled')),
  CONSTRAINT fk_review_assignments_version FOREIGN KEY (workspace_id, expense_id, version) REFERENCES expense_versions (workspace_id, expense_id, version) ON DELETE RESTRICT
);

-- Decisions (Authorized exact-version human approvals, rejections, and changes requested)
CREATE TABLE decisions (
  decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  expense_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  commitment TEXT NOT NULL,
  decision_type TEXT NOT NULL CHECK (decision_type IN ('approve', 'reject', 'request_changes')),
  reviewer_address TEXT NOT NULL,
  reason_commitment TEXT NULL,
  policy_version INTEGER NOT NULL CHECK (policy_version >= 1),
  nonce BIGINT NOT NULL CHECK (nonce >= 0),
  signature TEXT NULL,
  transaction_hash TEXT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_decisions_version FOREIGN KEY (workspace_id, expense_id, version) REFERENCES expense_versions (workspace_id, expense_id, version) ON DELETE RESTRICT,
  CONSTRAINT uq_decisions_version UNIQUE (workspace_id, expense_id, version),
  CONSTRAINT chk_decisions_reason CHECK (decision_type = 'approve' OR reason_commitment IS NOT NULL)
);

-- Reimbursements (Settlement operations bound to approved current versions)
CREATE TABLE reimbursements (
  reimbursement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  expense_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  token_address TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  amount NUMERIC(78, 0) NOT NULL CHECK (amount > 0),
  payment_reference TEXT NOT NULL,
  transaction_hash TEXT NULL,
  status TEXT NOT NULL CHECK (status IN ('preparing', 'awaiting_signature', 'submitted', 'confirming', 'confirmed', 'failed', 'cancelled')),
  settled_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_reimbursements_version FOREIGN KEY (workspace_id, expense_id, version) REFERENCES expense_versions (workspace_id, expense_id, version) ON DELETE RESTRICT
);

-- Enforce at most one active standard reimbursement attempt per version
CREATE UNIQUE INDEX idx_reimbursements_active_unique ON reimbursements (workspace_id, expense_id, version) WHERE status NOT IN ('failed', 'cancelled');

-- Chain Transactions (Tracked submissions and confirmations)
CREATE TABLE chain_transactions (
  transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id) ON DELETE RESTRICT,
  chain_id BIGINT NOT NULL,
  transaction_hash TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('preparing', 'awaiting_signature', 'submitted', 'confirming', 'confirmed', 'failed', 'reorged')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ NULL,
  block_number BIGINT NULL,
  CONSTRAINT uq_chain_transactions UNIQUE (chain_id, transaction_hash)
);

-- Indexed Events (Public onchain projections, rebuildable from node/indexer)
CREATE TABLE indexed_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id BIGINT NOT NULL,
  block_number BIGINT NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  event_name TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  workspace_id TEXT NULL REFERENCES workspaces(workspace_id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_indexed_events UNIQUE (chain_id, transaction_hash, log_index)
);

-- Audit Events (Immutable security and operational event trail)
CREATE TABLE audit_events (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id) ON DELETE RESTRICT,
  actor_address TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Exports (Authorized disclosed audit packages)
CREATE TABLE exports (
  export_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id) ON DELETE RESTRICT,
  requested_by TEXT NOT NULL,
  filter_criteria JSONB NOT NULL,
  package_hash TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Jobs (Asynchronous queue for AI extraction, indexer consumption, and export packaging)
CREATE TABLE jobs (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NULL REFERENCES workspaces(workspace_id) ON DELETE SET NULL,
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency Keys (Scoped to key, workspace, actor address, and action)
CREATE TABLE idempotency_keys (
  key TEXT NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id) ON DELETE RESTRICT,
  actor_address TEXT NOT NULL,
  action TEXT NOT NULL,
  response_code INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (key, workspace_id, actor_address, action)
);

CREATE INDEX idx_idempotency_keys_expires_at ON idempotency_keys (expires_at);
