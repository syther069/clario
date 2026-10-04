export type PlatformMode =
  "personal" | "power_user" | "freelancer" | "family" | "business" | "crypto";

export type PersonalView =
  "overview" | "expenses" | "income" | "budgets" | "recurring" | "receipts";

export type FreelancerView =
  "overview" | "clients" | "invoices" | "expenses" | "receipts" | "tax";

export type FamilyView =
  | "overview"
  | "members"
  | "expenses"
  | "budgets"
  | "bills"
  | "goals"
  | "settlements";

export type BusinessView =
  | "overview"
  | "team"
  | "expenses"
  | "reimbursements"
  | "approvals"
  | "policies"
  | "audit"
  | "reports"
  | "governance";

export type PlatformView =
  PersonalView | FreelancerView | FamilyView | BusinessView | "proof_center";

export type AccountType =
  "checking" | "savings" | "credit_card" | "cash" | "crypto_wallet";

export type TransactionType = "income" | "expense" | "transfer";

export type TransactionSource =
  "manual" | "receipt_ocr" | "bank_import" | "onchain_monad" | "onchain_other";

export type VerificationState =
  | "unverified"
  | "pending_anchor"
  | "anchored_onchain"
  | "verified"
  | "mismatch";

export interface Profile {
  id: string; // privy user id or wallet address
  email?: string | null;
  display_name?: string | null;
  active_mode: PlatformMode;
  primary_currency: string;
  created_at: string;
  updated_at: string;
}

export interface FinancialAccount {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  currency: string;
  balance: number;
  institution_name?: string | null;
  wallet_address?: string | null;
  chain_id?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  color?: string | null;
  is_system: boolean;
  parent_id?: string | null;
}

export interface Receipt {
  id: string;
  user_id: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  sha256_hash: string;
  ocr_status: "pending" | "processing" | "completed" | "failed";
  extracted_data?: {
    merchant?: string | null;
    amount?: number | null;
    currency?: string | null;
    date?: string | null;
    tax?: number | null;
    category?: string | null;
    reference_number?: string | null;
    confidence?: number | null;
  } | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id?: string | null;
  amount: number;
  currency: string;
  type: TransactionType;
  merchant: string;
  description?: string;
  category_id?: string | null;
  category?: Category | string | null;
  timestamp: string;
  date?: string;
  status: "pending" | "cleared" | "reconciled" | "disputed";
  source: TransactionSource;
  receipt_id?: string | null;
  receipt?: Receipt | null;
  receipt_bundle_id?: string | null;
  payment_method?: string | null;
  notes?: string | null;
  mode?: PlatformMode | null;
  client_id?: string | null;
  client_name?: string | null;
  project_name?: string | null;
  employee_name?: string | null;
  department?: string | null;
  is_shared?: boolean | null;
  tax_deductible?: boolean | null;
  tax_category?: string | null;
  version: number;
  commitment_hash?: string | null;
  proof_hash?: string | null;
  verification_state: VerificationState;
  verification_status?: string;
  monad_tx_hash?: string | null;
  monad_block?: number | null;
  blockchain_network?: string | null;
  blockchain_status?: "unverified" | "pending" | "confirmed" | "failed" | null;
  blockchain_tx_hash?: string | null;
  blockchain_contract_address?: string | null;
  blockchain_chain_id?: number | null;
  blockchain_data_hash?: string | null;
  blockchain_timestamp?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CanonicalReceiptTransaction {
  id: string;
  amount: number;
  currency: string;
  merchant: string;
  category: string;
  date: string;
  type: string;
}

export interface CanonicalReceiptBundle {
  receiptId: string;
  receiptNumber: string;
  receiptName: string;
  createdAt: string;
  owner: string;
  transactionCount: number;
  totalAmount: number;
  currency: string;
  transactionIds: string[];
  transactions: CanonicalReceiptTransaction[];
  version: number;
}

export interface ReceiptBundle {
  id: string;
  user_id: string;
  wallet_address?: string | null | undefined;
  name: string;
  receipt_name?: string | null | undefined;
  receipt_number: string;
  storage_path?: string | null | undefined;
  file_hash: string;
  receipt_hash: string;
  transaction_count: number;
  total_amount: number;
  currency: string;
  transaction_ids: string[];
  receipt_data: CanonicalReceiptBundle;
  blockchain_network?: string | null | undefined;
  blockchain_status:
    "draft" | "uploading" | "hashing" | "pending" | "confirmed" | "failed";
  blockchain_tx_hash?: string | null | undefined;
  blockchain_contract_address?: string | null | undefined;
  blockchain_chain_id?: number | null | undefined;
  monad_block?: number | null | undefined;
  verification_status?: "unverified" | "verified" | "failed" | undefined;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  name: string;
  merchant?: string | undefined;
  amount: number;
  currency: string;
  frequency: "weekly" | "monthly" | "yearly";
  category_id?: string | null | undefined;
  last_payment_date?: string | null | undefined;
  next_billing_date?: string | null | undefined;
  status: "active" | "paused" | "cancelled";
  auto_detected?: boolean | undefined;
  created_at: string;
  updated_at?: string | undefined;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  category?: Category | null;
  amount_limit: number;
  spent_amount?: number;
  period: "weekly" | "monthly" | "yearly";
  start_date?: string;
  created_at: string;
}

export interface FinancialGoal {
  id: string;
  user_id: string;
  title: string;
  name?: string;
  target_amount: number;
  current_amount: number;
  currency: string;
  deadline?: string | null;
  target_date?: string | null;
  is_completed?: boolean;
  status: "in_progress" | "reached" | "abandoned";
  created_at: string;
}

export interface RecordVersion {
  id: string;
  record_type: "transaction" | "expense" | "invoice";
  record_id: string;
  version: number;
  previous_hash?: string | null;
  new_hash: string;
  modified_by: string;
  reason?: string | null;
  diff: Record<string, unknown>;
  timestamp: string;
}

export interface ProofCommitment {
  id: string;
  record_id: string;
  record_type: string;
  version: number;
  canonical_hash: string;
  salt: string;
  commitment_hash: string;
  monad_tx_hash?: string | null;
  monad_block?: number | null;
  verified_at?: string | null;
  created_at: string;
}

// ==========================================
// FREELANCER MODE MODELS
// ==========================================

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email?: string | null;
  company?: string | null;
  rate_currency: string;
  hourly_rate?: number | null;
  status: "active" | "inactive" | "lead";
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface Invoice {
  id: string;
  user_id: string;
  client_id?: string | null;
  client_name: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  currency: string;
  subtotal: number;
  tax_rate?: number;
  tax_amount?: number;
  total_amount: number;
  status: InvoiceStatus;
  notes?: string | null;
  items: InvoiceItem[];
  payment_received_date?: string | null;
  transaction_id?: string | null;
  created_at: string;
  updated_at: string;
}

// ==========================================
// FAMILY MODE MODELS
// ==========================================

export type FamilyRole = "owner" | "member" | "viewer";

export interface FamilyMember {
  id: string;
  household_id: string;
  user_id?: string | null;
  name: string;
  email?: string | null;
  role: FamilyRole;
  avatar_color?: string | null;
  created_at: string;
}

export interface SharedExpenseSplit {
  member_id: string;
  member_name: string;
  percentage: number;
  amount: number;
  is_paid?: boolean;
}

export interface FamilyBill {
  id: string;
  household_id: string;
  name: string;
  amount: number;
  currency: string;
  due_date: string;
  category: string;
  paid_by_member_id?: string | null;
  paid_by_name?: string | null;
  is_recurring: boolean;
  frequency?: "monthly" | "quarterly" | "yearly";
  status: "unpaid" | "paid" | "overdue";
  created_at: string;
}

export interface FamilySettlement {
  id: string;
  household_id: string;
  from_member_id: string;
  from_member_name: string;
  to_member_id: string;
  to_member_name: string;
  amount: number;
  currency: string;
  status: "pending" | "settled";
  settled_at?: string | null;
  created_at: string;
}

// ==========================================
// BUSINESS MODE MODELS
// ==========================================

export type BusinessRole =
  "admin" | "finance" | "manager" | "employee" | "viewer";

export interface BusinessTeamMember {
  id: string;
  org_id: string;
  user_id?: string | null;
  name: string;
  email: string;
  role: BusinessRole;
  department: string;
  spending_limit_monthly: number;
  created_at: string;
}

export type ReimbursementStatus =
  "draft" | "submitted" | "under_review" | "approved" | "rejected" | "paid";

export interface BusinessReimbursement {
  id: string;
  org_id: string;
  employee_id: string;
  employee_name: string;
  title: string;
  amount: number;
  currency: string;
  category: string;
  department: string;
  expense_date: string;
  status: ReimbursementStatus;
  receipt_url?: string | null;
  receipt_hash?: string | null;
  notes?: string | null;
  reviewed_by?: string | null;
  review_notes?: string | null;
  approved_at?: string | null;
  paid_at?: string | null;
  monad_tx_hash?: string | null;
  created_at: string;
}

export interface ExpensePolicy {
  id: string;
  org_id: string;
  name: string;
  category: string;
  max_single_amount: number;
  monthly_budget: number;
  requires_receipt_above: number;
  requires_approval_above: number;
  is_active: boolean;
  created_at: string;
}

export interface BusinessAuditEvent {
  id: string;
  org_id: string;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  severity: "info" | "warning" | "alert";
  timestamp: string;
}
