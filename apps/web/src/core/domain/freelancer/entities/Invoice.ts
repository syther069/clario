import type {
  Invoice as InvoiceDTO,
  InvoiceItem,
  InvoiceStatus,
} from "@/lib/supabase/types";

/**
 * Clean Architecture - Domain Layer
 * Entity: InvoiceEntity
 * Encapsulates sequential invoicing, tax computations, and status transitions.
 */
export class InvoiceEntity {
  public readonly id: string;
  public readonly userId: string;
  public readonly invoiceNumber: string;
  public readonly clientId: string | null;
  public readonly clientName: string;
  public readonly status: InvoiceStatus;
  public readonly issueDate: string;
  public readonly dueDate: string;
  public readonly items: InvoiceItem[];
  public readonly subtotal: number;
  public readonly taxRate: number;
  public readonly taxAmount: number;
  public readonly totalAmount: number;
  public readonly currency: string;
  public readonly notes: string | null;
  public readonly paymentReceivedDate: string | null;
  public readonly transactionId: string | null;
  public readonly createdAt: string;
  public readonly updatedAt: string;

  public constructor(props: {
    id: string;
    userId: string;
    invoiceNumber: string;
    clientId?: string | null | undefined;
    clientName?: string | undefined;
    status?: InvoiceStatus | undefined;
    issueDate?: string | undefined;
    dueDate?: string | undefined;
    items?: InvoiceItem[] | undefined;
    subtotal?: number | undefined;
    taxRate?: number | undefined;
    taxAmount?: number | undefined;
    totalAmount?: number | undefined;
    currency?: string | undefined;
    notes?: string | null | undefined;
    paymentReceivedDate?: string | null | undefined;
    transactionId?: string | null | undefined;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
  }) {
    if (!props.id || !props.id.trim()) {
      throw new Error("InvoiceEntity requires a valid non-empty id");
    }
    if (!props.invoiceNumber || !props.invoiceNumber.trim()) {
      throw new Error("InvoiceEntity requires an invoiceNumber");
    }

    this.id = props.id.trim();
    this.userId = props.userId.trim().toLowerCase();
    this.invoiceNumber = props.invoiceNumber.trim();
    this.clientId = props.clientId ?? null;
    this.clientName = props.clientName || "Client";
    this.status = props.status || "draft";
    this.issueDate = props.issueDate || new Date().toISOString().slice(0, 10);
    this.dueDate = props.dueDate || this.issueDate;
    this.items = props.items || [];
    this.currency = props.currency || "USD";
    this.notes = props.notes ?? null;
    this.paymentReceivedDate = props.paymentReceivedDate ?? null;
    this.transactionId = props.transactionId ?? null;
    this.createdAt = props.createdAt || new Date().toISOString();
    this.updatedAt = props.updatedAt || this.createdAt;

    const computedSubtotal =
      props.subtotal !== undefined
        ? props.subtotal
        : this.items.reduce((acc, it) => acc + (it.amount || it.quantity * it.rate || 0), 0);
    this.subtotal = computedSubtotal;

    this.taxRate = props.taxRate ?? 0;
    this.taxAmount = props.taxAmount ?? Math.round(this.subtotal * (this.taxRate / 100) * 100) / 100;
    this.totalAmount = props.totalAmount ?? this.subtotal + this.taxAmount;
  }

  public isPaid(): boolean {
    return this.status === "paid";
  }

  public isOverdue(): boolean {
    if (this.status === "paid" || this.status === "cancelled") return false;
    return new Date(this.dueDate).getTime() < Date.now();
  }

  public toDTO(): InvoiceDTO {
    const dto: InvoiceDTO = {
      id: this.id,
      user_id: this.userId,
      invoice_number: this.invoiceNumber,
      client_name: this.clientName,
      status: this.status,
      issue_date: this.issueDate,
      due_date: this.dueDate,
      items: this.items,
      subtotal: this.subtotal,
      tax_rate: this.taxRate,
      tax_amount: this.taxAmount,
      total_amount: this.totalAmount,
      currency: this.currency,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    };
    if (this.clientId !== null) dto.client_id = this.clientId;
    if (this.notes !== null) dto.notes = this.notes;
    if (this.paymentReceivedDate !== null) dto.payment_received_date = this.paymentReceivedDate;
    if (this.transactionId !== null) dto.transaction_id = this.transactionId;
    return dto;
  }

  public static fromDTO(dto: InvoiceDTO): InvoiceEntity {
    return new InvoiceEntity({
      id: dto.id,
      userId: dto.user_id,
      invoiceNumber: dto.invoice_number,
      clientId: dto.client_id ?? null,
      clientName: dto.client_name,
      status: dto.status,
      issueDate: dto.issue_date,
      dueDate: dto.due_date,
      items: dto.items,
      subtotal: dto.subtotal,
      taxRate: dto.tax_rate ?? 0,
      taxAmount: dto.tax_amount ?? 0,
      totalAmount: dto.total_amount,
      currency: dto.currency,
      notes: dto.notes ?? null,
      paymentReceivedDate: dto.payment_received_date ?? null,
      transactionId: dto.transaction_id ?? null,
      createdAt: dto.created_at,
      updatedAt: dto.updated_at,
    });
  }
}
