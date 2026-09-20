-- Rollback Migration for Clario Initial Schema (v1)
-- Drops constraints, indexes, and tables in reverse dependency order.

-- Drop circular current-version foreign key constraint on expenses first
ALTER TABLE IF EXISTS expenses DROP CONSTRAINT IF EXISTS fk_expenses_current_version;

-- Drop explicit indexes
DROP INDEX IF EXISTS idx_reimbursements_active_unique;
DROP INDEX IF EXISTS idx_role_grants_active;
DROP INDEX IF EXISTS idx_idempotency_keys_expires_at;

-- Drop dependent workflow and operational tables
DROP TABLE IF EXISTS idempotency_keys CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS exports CASCADE;
DROP TABLE IF EXISTS audit_events CASCADE;
DROP TABLE IF EXISTS indexed_events CASCADE;
DROP TABLE IF EXISTS chain_transactions CASCADE;
DROP TABLE IF EXISTS reimbursements CASCADE;
DROP TABLE IF EXISTS decisions CASCADE;
DROP TABLE IF EXISTS review_assignments CASCADE;
DROP TABLE IF EXISTS ai_analyses CASCADE;
DROP TABLE IF EXISTS source_transactions CASCADE;
DROP TABLE IF EXISTS evidence_objects CASCADE;
DROP TABLE IF EXISTS expense_versions CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS role_grants CASCADE;
DROP TABLE IF EXISTS memberships CASCADE;
DROP TABLE IF EXISTS workspace_policies CASCADE;
DROP TABLE IF EXISTS workspaces CASCADE;
DROP TABLE IF EXISTS wallet_identities CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Cleanup primary key and unique indices
DROP INDEX IF EXISTS idempotency_keys_pkey;
DROP INDEX IF EXISTS jobs_pkey;
DROP INDEX IF EXISTS exports_pkey;
DROP INDEX IF EXISTS audit_events_pkey;
DROP INDEX IF EXISTS indexed_events_pkey;
DROP INDEX IF EXISTS chain_transactions_pkey;
DROP INDEX IF EXISTS reimbursements_pkey;
DROP INDEX IF EXISTS decisions_pkey;
DROP INDEX IF EXISTS review_assignments_pkey;
DROP INDEX IF EXISTS ai_analyses_pkey;
DROP INDEX IF EXISTS source_transactions_pkey;
DROP INDEX IF EXISTS evidence_objects_pkey;
DROP INDEX IF EXISTS expense_versions_pkey;
DROP INDEX IF EXISTS expenses_pkey;
DROP INDEX IF EXISTS role_grants_pkey;
DROP INDEX IF EXISTS memberships_pkey;
DROP INDEX IF EXISTS workspace_policies_pkey;
DROP INDEX IF EXISTS workspaces_pkey;
DROP INDEX IF EXISTS wallet_identities_pkey;
DROP INDEX IF EXISTS users_pkey;
DROP INDEX IF EXISTS uq_wallet_identities;
DROP INDEX IF EXISTS uq_memberships_user;
DROP INDEX IF EXISTS uq_memberships_address;
DROP INDEX IF EXISTS uq_expense_versions_commitment;
DROP INDEX IF EXISTS uq_source_transactions;
DROP INDEX IF EXISTS uq_decisions_version;
DROP INDEX IF EXISTS uq_chain_transactions;
DROP INDEX IF EXISTS uq_indexed_events;
