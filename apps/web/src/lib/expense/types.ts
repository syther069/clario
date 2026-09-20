/**
 * Clario Expense Types
 */

import type { PaymentSourceV1 } from "@clario/protocol";

export interface ExpenseDraftPayload {
  title: string;
  businessPurpose: string;
  category: string;
  project: string;
  merchant: string;
  expenseDate: string; // YYYY-MM-DD
  claimAmount: string; // Human decimal string e.g. "150.00"
  claimAsset: `0x${string}`;
  recipient: `0x${string}`;
  paymentSource: PaymentSourceV1;
  sourceChainId?: number | null | undefined;
  sourceTransactionHash?: `0x${string}` | null | undefined;
  client?: string | null | undefined;
  invoiceNumber?: string | null | undefined;
  location?: string | null | undefined;
  notes?: string | null | undefined;
  tags?: string[] | undefined;
}

export interface EvidenceAttachmentSummary {
  evidenceId: string;
  mimeType: string;
  byteLength: number;
  sha256Hash: string;
  originalFilename?: string | undefined;
  createdAt: string;
}

export interface ExpenseDraftRecord {
  workspaceId: string;
  expenseId: string;
  version: number;
  createdBy: string;
  status: "draft";
  amount: string; // Base units as decimal string
  currency: string;
  recipient: string;
  payload: ExpenseDraftPayload;
  evidence: EvidenceAttachmentSummary[];
  createdAt: string;
  updatedAt: string;
  previousCommitment?: string | null | undefined;
}

export interface ExpenseSummary {
  expenseId: string;
  workspaceId: string;
  title: string;
  category: string;
  merchant: string;
  expenseDate: string;
  claimAmount: string;
  currency: string;
  recipient: string;
  status: string;
  version: number;
  evidenceCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseValidationIssue {
  field: string;
  message: string;
}

export interface ExpenseValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}
