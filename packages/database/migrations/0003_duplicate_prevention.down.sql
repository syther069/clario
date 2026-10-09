-- Rollback migration 0003: Duplicate Reimbursement Prevention

DROP INDEX IF EXISTS idx_evidence_objects_workspace_hash;
DROP INDEX IF EXISTS idx_reimbursements_active_unique;

CREATE UNIQUE INDEX idx_reimbursements_active_unique ON reimbursements (workspace_id, expense_id, version) WHERE status NOT IN ('failed', 'cancelled');
