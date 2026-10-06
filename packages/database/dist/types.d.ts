/**
 * Database entity types and interfaces for Clario PostgreSQL schema.
 * All amounts are stored as integer base units (numeric/bigint strings in JS).
 * All timestamps are stored as ISO 8601 UTC strings with timezone.
 */
export type HexString = `0x${string}`;
export type MembershipStatus = "active" | "suspended" | "revoked";
export type ExpenseVersionStatus = "draft" | "prepared" | "submitted" | "current" | "superseded";
export type DecisionType = "approve" | "reject" | "request_changes";
export type ReimbursementStatus = "preparing" | "awaiting_signature" | "submitted" | "confirming" | "confirmed" | "failed" | "cancelled";
export type ChainTransactionStatus = "preparing" | "awaiting_signature" | "submitted" | "confirming" | "confirmed" | "failed" | "reorged";
export type AiAnalysisDisposition = "pending" | "accepted" | "modified" | "rejected";
export type ReviewAssignmentStatus = "pending" | "completed" | "reassigned" | "cancelled";
export type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export interface UserRow {
    user_id: string;
    primary_address: string;
    created_at: Date | string;
    updated_at: Date | string;
}
export interface WalletIdentityRow {
    wallet_id: string;
    user_id: string;
    chain_family: "evm" | "monad" | "local";
    address: string;
    created_at: Date | string;
}
export interface WorkspaceRow {
    workspace_id: string;
    name: string;
    created_by: string;
    created_at: Date | string;
    updated_at: Date | string;
}
export interface WorkspacePolicyRow {
    workspace_id: string;
    policy_version: number;
    policy_commitment: string;
    rules_ciphertext: string | null;
    created_by: string;
    created_at: Date | string;
}
export interface MembershipRow {
    membership_id: string;
    workspace_id: string;
    user_id: string;
    address: string;
    status: MembershipStatus;
    created_at: Date | string;
    updated_at: Date | string;
}
export interface RoleGrantRow {
    grant_id: string;
    workspace_id: string;
    address: string;
    role: string;
    scope: string;
    policy_version: number;
    granted_by: string;
    granted_at: Date | string;
    revoked_at: Date | string | null;
}
export interface ExpenseRow {
    workspace_id: string;
    expense_id: string;
    created_by: string;
    current_version: number | null;
    created_at: Date | string;
    updated_at: Date | string;
}
export interface ExpenseVersionRow {
    workspace_id: string;
    expense_id: string;
    version: number;
    commitment: string;
    previous_commitment: string | null;
    salt_ciphertext: string;
    salt_key_reference: string;
    record_ciphertext: string;
    record_key_reference: string;
    amount: string;
    currency: string;
    recipient: string;
    status: ExpenseVersionStatus;
    submitted_at: Date | string | null;
    submitted_by: string | null;
    submitted_transaction_hash: string | null;
    created_at: Date | string;
}
export interface EvidenceObjectRow {
    evidence_id: string;
    workspace_id: string;
    expense_id: string;
    version: number;
    storage_key: string;
    sha256_hash: string;
    byte_length: string | number;
    mime_type: string;
    encryption_metadata: Record<string, unknown>;
    created_at: Date | string;
}
export interface SourceTransactionRow {
    id: string;
    workspace_id: string;
    expense_id: string;
    source_chain_id: string | number;
    source_transaction_hash: string;
    claim_slot: number;
    provider: string;
    status: string;
    imported_at: Date | string;
}
export interface AiAnalysisRow {
    id: string;
    workspace_id: string;
    expense_id: string;
    evidence_id: string;
    provider: string;
    model_id: string;
    prompt_version: string;
    suggested_fields_ciphertext: string;
    confidence: string | number;
    warnings: Array<Record<string, unknown>>;
    disposition: AiAnalysisDisposition;
    created_at: Date | string;
}
export interface ReviewAssignmentRow {
    assignment_id: string;
    workspace_id: string;
    expense_id: string;
    version: number;
    assigned_to: string;
    assigned_at: Date | string;
    status: ReviewAssignmentStatus;
}
export interface DecisionRow {
    decision_id: string;
    workspace_id: string;
    expense_id: string;
    version: number;
    commitment: string;
    decision_type: DecisionType;
    reviewer_address: string;
    reason_commitment: string | null;
    policy_version: number;
    nonce: string | number;
    signature: string | null;
    transaction_hash: string | null;
    recorded_at: Date | string;
}
export interface ReimbursementRow {
    reimbursement_id: string;
    workspace_id: string;
    expense_id: string;
    version: number;
    token_address: string;
    recipient_address: string;
    amount: string;
    payment_reference: string;
    transaction_hash: string | null;
    status: ReimbursementStatus;
    settled_at: Date | string | null;
    created_at: Date | string;
    updated_at: Date | string;
}
export interface ChainTransactionRow {
    transaction_id: string;
    workspace_id: string;
    chain_id: string | number;
    transaction_hash: string;
    action: string;
    status: ChainTransactionStatus;
    submitted_at: Date | string;
    confirmed_at: Date | string | null;
    block_number: string | number | null;
}
export interface IndexedEventRow {
    event_id: string;
    chain_id: string | number;
    block_number: string | number;
    block_hash?: string;
    transaction_hash: string;
    log_index: number;
    event_name: string;
    contract_address: string;
    workspace_id: string | null;
    payload: Record<string, unknown>;
    removed?: boolean;
    status?: string;
    indexed_at: Date | string;
}
export interface IndexerCheckpointRow {
    chain_id: string | number;
    contract_address: string;
    last_indexed_block: string | number;
    last_indexed_block_hash: string;
    updated_at: Date | string;
}
export interface IndexerDeadLetterRow {
    dead_letter_id: string;
    chain_id: string | number;
    block_number: string | number;
    block_hash: string;
    transaction_hash: string;
    log_index: number;
    event_name: string;
    contract_address: string;
    payload: Record<string, unknown>;
    error_message: string;
    attempts: number;
    created_at: Date | string;
    resolved_at: Date | string | null;
}
export interface ProjectionWorkspaceRow {
    workspace_id: string;
    owner_address: string;
    policy_commitment: string;
    current_policy_version: number;
    created_at_block: string | number;
    created_at_tx: string;
    updated_at: Date | string;
}
export interface ProjectionRoleGrantRow {
    grant_id: string;
    workspace_id: string;
    account_address: string;
    role: string;
    scope: string;
    active: boolean;
    granted_at_block: string | number;
    granted_at_tx: string;
    revoked_at_block: string | number | null;
    revoked_at_tx: string | null;
    updated_at: Date | string;
}
export interface ProjectionPolicyVersionRow {
    workspace_id: string;
    policy_version: number;
    policy_commitment: string;
    updated_at_block: string | number;
    updated_at_tx: string;
    indexed_at: Date | string;
}
export interface ProjectionExpenseRow {
    workspace_id: string;
    expense_id: string;
    current_version: number;
    current_commitment: string;
    latest_submitter: string;
    submitted_at_block: string | number;
    submitted_at_tx: string;
    updated_at: Date | string;
}
export interface ProjectionExpenseVersionRow {
    workspace_id: string;
    expense_id: string;
    version: number;
    commitment: string;
    submitter: string;
    is_superseded: boolean;
    superseded_by_version: number | null;
    submitted_at_block: string | number;
    submitted_at_tx: string;
    indexed_at: Date | string;
}
export interface ProjectionDecisionRow {
    workspace_id: string;
    expense_id: string;
    version: number;
    commitment: string;
    reviewer: string;
    decision: DecisionType;
    reason_commitment: string | null;
    recorded_at_block: string | number;
    recorded_at_tx: string;
    indexed_at: Date | string;
}
export interface ProjectionSettlementRow {
    workspace_id: string;
    expense_id: string;
    version: number;
    commitment: string;
    token: string;
    recipient: string;
    amount: string;
    payment_reference: string;
    settled_at_block: string | number;
    settled_at_tx: string;
    indexed_at: Date | string;
}
export interface AuditEventRow {
    audit_id: string;
    workspace_id: string;
    actor_address: string;
    event_type: string;
    entity_type: string;
    entity_id: string;
    metadata: Record<string, unknown>;
    occurred_at: Date | string;
}
export interface ExportRow {
    export_id: string;
    workspace_id: string;
    requested_by: string;
    filter_criteria: Record<string, unknown>;
    package_hash: string;
    storage_key: string;
    created_at: Date | string;
    expires_at: Date | string;
}
export interface JobRow {
    job_id: string;
    workspace_id: string | null;
    job_type: string;
    payload: Record<string, unknown>;
    status: JobStatus;
    attempts: number;
    max_attempts: number;
    error_message: string | null;
    created_at: Date | string;
    updated_at: Date | string;
}
export interface IdempotencyKeyRow {
    key: string;
    workspace_id: string;
    actor_address: string;
    action: string;
    response_code: number;
    response_body: Record<string, unknown>;
    created_at: Date | string;
    expires_at: Date | string;
}
export interface SchemaMigrationRow {
    version: number;
    name: string;
    checksum: string;
    applied_at: Date | string;
}
//# sourceMappingURL=types.d.ts.map