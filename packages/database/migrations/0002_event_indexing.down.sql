-- Clario PostgreSQL Schema Migration Rollback (v2)
-- Rollback for event indexing, checkpoints, dead letters, and public projections.

DROP TABLE IF EXISTS projection_settlements CASCADE;
DROP TABLE IF EXISTS projection_decisions CASCADE;
DROP TABLE IF EXISTS projection_expense_versions CASCADE;
DROP TABLE IF EXISTS projection_expenses CASCADE;
DROP TABLE IF EXISTS projection_policy_versions CASCADE;
DROP TABLE IF EXISTS projection_role_grants CASCADE;
DROP TABLE IF EXISTS projection_workspaces CASCADE;
DROP TABLE IF EXISTS indexer_dead_letters CASCADE;
DROP TABLE IF EXISTS indexer_checkpoints CASCADE;

ALTER TABLE indexed_events DROP COLUMN IF EXISTS status;
ALTER TABLE indexed_events DROP COLUMN IF EXISTS removed;
ALTER TABLE indexed_events DROP COLUMN IF EXISTS block_hash;
