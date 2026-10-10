import type {
  BusinessReimbursement as BusinessReimbursementDTO,
  ReimbursementStatus,
} from "@/lib/supabase/types";

/**
 * Clean Architecture - Domain Layer
 * Entity: BusinessReimbursementEntity
 * Encapsulates employee expense claims, review workflows, and Monad Testnet USDC settlement hashes.
 */
export class BusinessReimbursementEntity {
  public readonly id: string;
  public readonly orgId: string;
  public readonly employeeId: string;
  public readonly employeeName: string;
  public readonly title: string;
  public readonly amount: number;
  public readonly currency: string;
  public readonly category: string;
  public readonly department: string;
  public readonly expenseDate: string;
  public readonly status: ReimbursementStatus;
  public readonly receiptUrl: string | null;
  public readonly receiptHash: string | null;
  public readonly notes: string | null;
  public readonly reviewedBy: string | null;
  public readonly reviewNotes: string | null;
  public readonly approvedAt: string | null;
  public readonly paidAt: string | null;
  public readonly monadTxHash: string | null;
  public readonly createdAt: string;

  public constructor(props: {
    id: string;
    orgId?: string | undefined;
    org_id?: string | undefined;
    employeeId?: string | undefined;
    employee_id?: string | undefined;
    employeeName?: string | undefined;
    employee_name?: string | undefined;
    title?: string | undefined;
    description?: string | undefined;
    amount: number;
    currency?: string | undefined;
    category?: string | undefined;
    department?: string | undefined;
    expenseDate?: string | undefined;
    expense_date?: string | undefined;
    status?: ReimbursementStatus | undefined;
    receiptUrl?: string | null | undefined;
    receipt_url?: string | null | undefined;
    receiptHash?: string | null | undefined;
    receipt_hash?: string | null | undefined;
    notes?: string | null | undefined;
    reviewedBy?: string | null | undefined;
    reviewed_by?: string | null | undefined;
    reviewNotes?: string | null | undefined;
    review_notes?: string | null | undefined;
    approvedAt?: string | null | undefined;
    approved_at?: string | null | undefined;
    paidAt?: string | null | undefined;
    paid_at?: string | null | undefined;
    monadTxHash?: string | null | undefined;
    monad_tx_hash?: string | null | undefined;
    createdAt?: string | undefined;
    created_at?: string | undefined;
  }) {
    if (!props.id || !props.id.trim()) {
      throw new Error("BusinessReimbursementEntity requires a valid non-empty id");
    }

    this.id = props.id.trim();
    this.orgId = (props.orgId || props.org_id || "").trim().toLowerCase();
    this.employeeId = props.employeeId || props.employee_id || "";
    this.employeeName = props.employeeName || props.employee_name || "";
    this.title = props.title || props.description || "Expense Claim";
    this.amount = Math.max(0, props.amount);
    this.currency = props.currency || "USD";
    this.category = props.category || "General";
    this.department = props.department || "General";
    this.expenseDate = props.expenseDate || props.expense_date || new Date().toISOString().slice(0, 10);
    this.status = props.status || "submitted";
    this.receiptUrl = props.receiptUrl ?? props.receipt_url ?? null;
    this.receiptHash = props.receiptHash ?? props.receipt_hash ?? null;
    this.notes = props.notes ?? null;
    this.reviewedBy = props.reviewedBy ?? props.reviewed_by ?? null;
    this.reviewNotes = props.reviewNotes ?? props.review_notes ?? null;
    this.approvedAt = props.approvedAt ?? props.approved_at ?? null;
    this.paidAt = props.paidAt ?? props.paid_at ?? null;
    this.monadTxHash = props.monadTxHash ?? props.monad_tx_hash ?? null;
    this.createdAt = props.createdAt || props.created_at || new Date().toISOString();
  }

  public toDTO(): BusinessReimbursementDTO {
    const dto: BusinessReimbursementDTO = {
      id: this.id,
      org_id: this.orgId,
      employee_id: this.employeeId,
      employee_name: this.employeeName,
      title: this.title,
      amount: this.amount,
      currency: this.currency,
      category: this.category,
      department: this.department,
      expense_date: this.expenseDate,
      status: this.status,
      created_at: this.createdAt,
    };
    if (this.receiptUrl !== null) dto.receipt_url = this.receiptUrl;
    if (this.receiptHash !== null) dto.receipt_hash = this.receiptHash;
    if (this.notes !== null) dto.notes = this.notes;
    if (this.reviewedBy !== null) dto.reviewed_by = this.reviewedBy;
    if (this.reviewNotes !== null) dto.review_notes = this.reviewNotes;
    if (this.approvedAt !== null) dto.approved_at = this.approvedAt;
    if (this.paidAt !== null) dto.paid_at = this.paidAt;
    if (this.monadTxHash !== null) dto.monad_tx_hash = this.monadTxHash;
    return dto;
  }

  public static fromDTO(dto: BusinessReimbursementDTO): BusinessReimbursementEntity {
    return new BusinessReimbursementEntity({
      id: dto.id,
      orgId: dto.org_id,
      employeeId: dto.employee_id,
      employeeName: dto.employee_name,
      title: dto.title,
      amount: dto.amount,
      currency: dto.currency,
      category: dto.category,
      department: dto.department,
      expenseDate: dto.expense_date,
      status: dto.status,
      receiptUrl: dto.receipt_url ?? null,
      receiptHash: dto.receipt_hash ?? null,
      notes: dto.notes ?? null,
      reviewedBy: dto.reviewed_by ?? null,
      reviewNotes: dto.review_notes ?? null,
      approvedAt: dto.approved_at ?? null,
      paidAt: dto.paid_at ?? null,
      monadTxHash: dto.monad_tx_hash ?? null,
      createdAt: dto.created_at,
    });
  }
}
