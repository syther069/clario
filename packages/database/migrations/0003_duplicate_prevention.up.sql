-- Migration 0003: Duplicate Reimbursement Prevention
-- Enforces that an expense can have at most ONE active or confirmed reimbursement across all versions.
-- Also optimizes lookups on evidence objects by sha256_hash.

DROP INDEX IF EXISTS idx_reimbursements_active_unique;

-- Enforce at most one active standard reimbursement attempt per expense (across ANY version)
CREATE UNIQUE INDEX idx_reimbursements_active_unique ON reimbursements (workspace_id, expense_id) WHERE status NOT IN ('failed', 'cancelled');

-- Index on evidence objects for fast duplicate receipt detection
CREATE INDEX IF NOT EXISTS idx_evidence_objects_workspace_hash ON evidence_objects (workspace_id, sha256_hash);
