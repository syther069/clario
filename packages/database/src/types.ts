/**
 * Database entity types and interfaces for Clario PostgreSQL schema.
 * All amounts are stored as integer base units (numeric/bigint strings in JS).
 * All timestamps are stored as ISO 8601 UTC strings with timezone.
 */

export type HexString = `0x${string}`;

export type MembershipStatus = "active" | "suspended" | "revoked";

export type ExpenseVersionStatus =
  "draft" | "prepared" | "submitted" | "current" | "superseded";

export type DecisionType = "approve" | "reject" | "request_changes";

export type ReimbursementStatus =
  | "preparing"
  | "awaiting_signature"
  | "submitted"
  | "confirming"
  | "confirmed"
  | "failed"
  | "cancelled";

export type ChainTransactionStatus =
  | "preparing"
  | "awaiting_signature"
  | "submitted"
  | "confirming"
  | "confirmed"
  | "failed"
  | "reorged";

export type AiAnalysisDisposition =
  "pending" | "accepted" | "modified" | "rejected";

export type ReviewAssignmentStatus =
  "pending" | "completed" | "reassigned" | "cancelled";

export type JobStatus =
  "pending" | "running" | "completed" | "failed" | "cancelled";

export interface UserRow {
  user_id: string; // UUID
  primary_address: string; // 0x40
  created_at: Date | string;
  updated_at: Date | string;
}

export interface WalletIdentityRow {
  wallet_id: string; // UUID
  user_id: string; // UUID FK -> users
  chain_family: "evm" | "monad" | "local";
  address: string; // 0x40
  created_at: Date | string;
}

export interface WorkspaceRow {
  workspace_id: string; // 0x64 hex
  name: string;
  created_by: string; // 0x40
  created_at: Date | string;
  updated_at: Date | string;
}

export interface WorkspacePolicyRow {
  workspace_id: string; // 0x64 hex FK -> workspaces
  policy_version: number;
  policy_commitment: string; // 0x64 hex
  rules_ciphertext: string | null;
  created_by: string; // 0x40
  created_at: Date | string;
}

export interface MembershipRow {
  membership_id: string; // UUID
  workspace_id: string; // 0x64 hex FK -> workspaces
  user_id: string; // UUID FK -> users
  address: string; // 0x40
  status: MembershipStatus;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface RoleGrantRow {
  grant_id: string; // UUID
  workspace_id: string; // 0x64 hex FK -> workspaces
  address: string; // 0x40
  role: string; // 0x64 hex
  scope: string; // 0x64 hex
  policy_version: number;
  granted_by: string; // 0x40
  granted_at: Date | string;
  revoked_at: Date | string | null;
}

export interface ExpenseRow {
  workspace_id: string; // 0x64 hex FK -> workspaces
  expense_id: string; // 0x64 hex
  created_by: string; // 0x40
  current_version: number | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface ExpenseVersionRow {
  workspace_id: string;
  expense_id: string;
  version: number;
  commitment: string; // 0x64 hex
  previous_commitment: string | null; // 0x64 hex null for v1
  salt_ciphertext: string;
  salt_key_reference: string;
  record_ciphertext: string;
  record_key_reference: string;
  amount: string; // NUMERIC(78, 0) base units
  currency: string;
  recipient: string; // 0x40
  status: ExpenseVersionStatus;
  submitted_at: Date | string | null;
  submitted_by: string | null; // 0x40
  submitted_transaction_hash: string | null; // 0x64
  created_at: Date | string;
}

export interface EvidenceObjectRow {
  evidence_id: string; // UUID
  workspace_id: string;
  expense_id: string;
  version: number;
  storage_key: string;
  sha256_hash: string; // 0x64 hex
  byte_length: string | number; // BIGINT
  mime_type: string;
  encryption_metadata: Record<string, unknown>; // JSONB
  created_at: Date | string;
}

export interface SourceTransactionRow {
  id: string; // UUID
  workspace_id: string;
  expense_id: string;
  source_chain_id: string | number; // BIGINT
  source_transaction_hash: string; // 0x64 hex
  claim_slot: number;
  provider: string;
  status: string;
  imported_at: Date | string;
}

export interface AiAnalysisRow {
  id: string; // UUID
  workspace_id: string;
  expense_id: string;
  evidence_id: string; // UUID FK -> evidence_objects
  provider: string;
  model_id: string;
  prompt_version: string;
  suggested_fields_ciphertext: string;
  confidence: string | number; // NUMERIC(4, 3)
  warnings: Array<Record<string, unknown>>; // JSONB
  disposition: AiAnalysisDisposition;
  created_at: Date | string;
}

export interface ReviewAssignmentRow {
  assignment_id: string; // UUID
  workspace_id: string;
  expense_id: string;
  version: number;
  assigned_to: string; // 0x40
  assigned_at: Date | string;
  status: ReviewAssignmentStatus;
}

export interface DecisionRow {
  decision_id: string; // UUID
  workspace_id: string;
  expense_id: string;
  version: number;
  commitment: string; // 0x64 hex
  decision_type: DecisionType;
  reviewer_address: string; // 0x40
  reason_commitment: string | null; // 0x64 hex
  policy_version: number;
  nonce: string | number; // BIGINT
  signature: string | null;
  transaction_hash: string | null; // 0x64 hex
  recorded_at: Date | string;
}

export interface ReimbursementRow {
  reimbursement_id: string; // UUID
  workspace_id: string;
  expense_id: string;
  version: number;
  token_address: string; // 0x40
  recipient_address: string; // 0x40
  amount: string; // NUMERIC(78, 0)
  payment_reference: string; // 0x64 hex
  transaction_hash: string | null; // 0x64 hex
  status: ReimbursementStatus;
  settled_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface ChainTransactionRow {
  transaction_id: string; // UUID
  workspace_id: string;
  chain_id: string | number; // BIGINT
  transaction_hash: string; // 0x64 hex
  action: string;
  status: ChainTransactionStatus;
  submitted_at: Date | string;
  confirmed_at: Date | string | null;
  block_number: string | number | null; // BIGINT
}

export interface IndexedEventRow {
  event_id: string; // UUID
  chain_id: string | number; // BIGINT
  block_number: string | number; // BIGINT
  block_hash?: string; // 0x64 hex
  transaction_hash: string; // 0x64 hex
  log_index: number;
  event_name: string;
  contract_address: string; // 0x40
  workspace_id: string | null;
  payload: Record<string, unknown>; // JSONB
  removed?: boolean;
  status?: string;
  indexed_at: Date | string;
}

export interface IndexerCheckpointRow {
  chain_id: string | number; // BIGINT
  contract_address: string; // 0x40
  last_indexed_block: string | number; // BIGINT
  last_indexed_block_hash: string; // 0x64 hex
  updated_at: Date | string;
}

export interface IndexerDeadLetterRow {
  dead_letter_id: string; // UUID
  chain_id: string | number; // BIGINT
  block_number: string | number; // BIGINT
  block_hash: string; // 0x64 hex
  transaction_hash: string; // 0x64 hex
  log_index: number;
  event_name: string;
  contract_address: string; // 0x40
  payload: Record<string, unknown>; // JSONB
  error_message: string;
  attempts: number;
  created_at: Date | string;
  resolved_at: Date | string | null;
}

export interface ProjectionWorkspaceRow {
  workspace_id: string; // 0x64 hex
  owner_address: string; // 0x40
  policy_commitment: string; // 0x64 hex
  current_policy_version: number;
  created_at_block: string | number; // BIGINT
  created_at_tx: string; // 0x64 hex
  updated_at: Date | string;
}

export interface ProjectionRoleGrantRow {
  grant_id: string; // UUID
  workspace_id: string; // 0x64 hex
  account_address: string; // 0x40
  role: string; // 0x64 hex
  scope: string; // 0x64 hex
  active: boolean;
  granted_at_block: string | number; // BIGINT
  granted_at_tx: string; // 0x64 hex
  revoked_at_block: string | number | null;
  revoked_at_tx: string | null;
  updated_at: Date | string;
}

export interface ProjectionPolicyVersionRow {
  workspace_id: string; // 0x64 hex
  policy_version: number;
  policy_commitment: string; // 0x64 hex
  updated_at_block: string | number; // BIGINT
  updated_at_tx: string; // 0x64 hex
  indexed_at: Date | string;
}

export interface ProjectionExpenseRow {
  workspace_id: string; // 0x64 hex
  expense_id: string; // 0x64 hex
  current_version: number;
  current_commitment: string; // 0x64 hex
  latest_submitter: string; // 0x40
  submitted_at_block: string | number; // BIGINT
  submitted_at_tx: string; // 0x64 hex
  updated_at: Date | string;
}

export interface ProjectionExpenseVersionRow {
  workspace_id: string; // 0x64 hex
  expense_id: string; // 0x64 hex
  version: number;
  commitment: string; // 0x64 hex
  submitter: string; // 0x40
  is_superseded: boolean;
  superseded_by_version: number | null;
  submitted_at_block: string | number; // BIGINT
  submitted_at_tx: string; // 0x64 hex
  indexed_at: Date | string;
}

export interface ProjectionDecisionRow {
  workspace_id: string; // 0x64 hex
  expense_id: string; // 0x64 hex
  version: number;
  commitment: string; // 0x64 hex
  reviewer: string; // 0x40
  decision: DecisionType;
  reason_commitment: string | null; // 0x64 hex
  recorded_at_block: string | number; // BIGINT
  recorded_at_tx: string; // 0x64 hex
  indexed_at: Date | string;
}

export interface ProjectionSettlementRow {
  workspace_id: string; // 0x64 hex
  expense_id: string; // 0x64 hex
  version: number;
  commitment: string; // 0x64 hex
  token: string; // 0x40
  recipient: string; // 0x40
  amount: string; // NUMERIC(78, 0)
  payment_reference: string; // 0x64 hex
  settled_at_block: string | number; // BIGINT
  settled_at_tx: string; // 0x64 hex
  indexed_at: Date | string;
}

export interface AuditEventRow {
  audit_id: string; // UUID
  workspace_id: string;
  actor_address: string; // 0x40
  event_type: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>; // JSONB
  occurred_at: Date | string;
}

export interface ExportRow {
  export_id: string; // UUID
  workspace_id: string;
  requested_by: string; // 0x40
  filter_criteria: Record<string, unknown>; // JSONB
  package_hash: string; // 0x64 hex
  storage_key: string;
  created_at: Date | string;
  expires_at: Date | string;
}

export interface JobRow {
  job_id: string; // UUID
  workspace_id: string | null;
  job_type: string;
  payload: Record<string, unknown>; // JSONB
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
  response_body: Record<string, unknown>; // JSONB
  created_at: Date | string;
  expires_at: Date | string;
}

export interface SchemaMigrationRow {
  version: number;
  name: string;
  checksum: string;
  applied_at: Date | string;
}
