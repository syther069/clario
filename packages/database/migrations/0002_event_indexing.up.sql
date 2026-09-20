-- Clario PostgreSQL Schema Migration (v2)
-- Event indexing, checkpoints, dead letters, and public projections.
-- Public projections are 100% rebuildable from onchain events and contain zero private Clario fields.

-- 1. Indexer Checkpoints
CREATE TABLE IF NOT EXISTS indexer_checkpoints (
  chain_id BIGINT NOT NULL,
  contract_address TEXT NOT NULL,
  last_indexed_block BIGINT NOT NULL,
  last_indexed_block_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain_id, contract_address)
);

-- 2. Indexer Dead Letters
CREATE TABLE IF NOT EXISTS indexer_dead_letters (
  dead_letter_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id BIGINT NOT NULL,
  block_number BIGINT NOT NULL,
  block_hash TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  event_name TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ NULL
);

-- 3. Enhance Indexed Events with block_hash and reorg status
ALTER TABLE indexed_events ADD COLUMN IF NOT EXISTS block_hash TEXT NOT NULL DEFAULT '0x0000000000000000000000000000000000000000000000000000000000000000';
ALTER TABLE indexed_events ADD COLUMN IF NOT EXISTS removed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE indexed_events ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed';

-- 4. Public Projection: Workspaces
CREATE TABLE IF NOT EXISTS projection_workspaces (
  workspace_id TEXT PRIMARY KEY,
  owner_address TEXT NOT NULL,
  policy_commitment TEXT NOT NULL,
  current_policy_version INTEGER NOT NULL DEFAULT 1,
  created_at_block BIGINT NOT NULL,
  created_at_tx TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Public Projection: Role Grants
CREATE TABLE IF NOT EXISTS projection_role_grants (
  grant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  account_address TEXT NOT NULL,
  role TEXT NOT NULL,
  scope TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  granted_at_block BIGINT NOT NULL,
  granted_at_tx TEXT NOT NULL,
  revoked_at_block BIGINT NULL,
  revoked_at_tx TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_projection_role_active ON projection_role_grants (workspace_id, account_address, role, scope) WHERE active = TRUE;

-- 6. Public Projection: Policy Versions
CREATE TABLE IF NOT EXISTS projection_policy_versions (
  workspace_id TEXT NOT NULL,
  policy_version INTEGER NOT NULL,
  policy_commitment TEXT NOT NULL,
  updated_at_block BIGINT NOT NULL,
  updated_at_tx TEXT NOT NULL,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, policy_version)
);

-- 7. Public Projection: Expenses
CREATE TABLE IF NOT EXISTS projection_expenses (
  workspace_id TEXT NOT NULL,
  expense_id TEXT NOT NULL,
  current_version INTEGER NOT NULL,
  current_commitment TEXT NOT NULL,
  latest_submitter TEXT NOT NULL,
  submitted_at_block BIGINT NOT NULL,
  submitted_at_tx TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, expense_id)
);

-- 8. Public Projection: Expense Versions
CREATE TABLE IF NOT EXISTS projection_expense_versions (
  workspace_id TEXT NOT NULL,
  expense_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  commitment TEXT NOT NULL,
  submitter TEXT NOT NULL,
  is_superseded BOOLEAN NOT NULL DEFAULT FALSE,
  superseded_by_version INTEGER NULL,
  submitted_at_block BIGINT NOT NULL,
  submitted_at_tx TEXT NOT NULL,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, expense_id, version)
);

-- 9. Public Projection: Decisions
CREATE TABLE IF NOT EXISTS projection_decisions (
  workspace_id TEXT NOT NULL,
  expense_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  commitment TEXT NOT NULL,
  reviewer TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approve', 'reject', 'request_changes')),
  reason_commitment TEXT NULL,
  recorded_at_block BIGINT NOT NULL,
  recorded_at_tx TEXT NOT NULL,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, expense_id, version)
);

-- 10. Public Projection: Settlements
CREATE TABLE IF NOT EXISTS projection_settlements (
  workspace_id TEXT NOT NULL,
  expense_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  commitment TEXT NOT NULL,
  token TEXT NOT NULL,
  recipient TEXT NOT NULL,
  amount NUMERIC(78, 0) NOT NULL,
  payment_reference TEXT NOT NULL,
  settled_at_block BIGINT NOT NULL,
  settled_at_tx TEXT NOT NULL,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, expense_id, version)
);
