import type { FamilyBill as FamilyBillDTO } from "@/lib/supabase/types";

/**
 * Clean Architecture - Domain Layer
 * Entity: FamilyBillEntity
 * Encapsulates recurring utility bills, expense splits, due dates, and settlement status.
 */
export class FamilyBillEntity {
  public readonly id: string;
  public readonly householdId: string;
  public readonly name: string;
  public readonly amount: number;
  public readonly currency: string;
  public readonly dueDate: string;
  public readonly category: string;
  public readonly paidByMemberId: string | null;
  public readonly paidByName: string | null;
  public readonly isRecurring: boolean;
  public readonly frequency?: "monthly" | "quarterly" | "yearly" | undefined;
  public readonly status: "unpaid" | "paid" | "overdue";
  public readonly createdAt: string;

  public constructor(props: {
    id: string;
    householdId: string;
    name?: string | undefined;
    title?: string | undefined;
    amount: number;
    currency?: string | undefined;
    dueDate?: string | undefined;
    due_date?: string | undefined;
    category?: string | undefined;
    paidByMemberId?: string | null | undefined;
    paid_by_member_id?: string | null | undefined;
    paidByName?: string | null | undefined;
    paid_by_name?: string | null | undefined;
    isRecurring?: boolean | undefined;
    is_recurring?: boolean | undefined;
    frequency?: ("monthly" | "quarterly" | "yearly") | undefined;
    status?: ("unpaid" | "paid" | "overdue") | undefined;
    createdAt?: string | undefined;
    created_at?: string | undefined;
  }) {
    if (!props.id || !props.id.trim()) {
      throw new Error("FamilyBillEntity requires a valid non-empty id");
    }

    const billName = (props.name || props.title || "").trim();
    if (!billName) {
      throw new Error("FamilyBillEntity requires a valid name or title");
    }

    this.id = props.id.trim();
    this.householdId = props.householdId.trim().toLowerCase();
    this.name = billName;
    this.amount = Math.max(0, props.amount);
    this.currency = props.currency || "USD";
    this.dueDate = props.dueDate || props.due_date || new Date().toISOString().slice(0, 10);
    this.category = props.category || "utilities";
    this.paidByMemberId = props.paidByMemberId ?? props.paid_by_member_id ?? null;
    this.paidByName = props.paidByName ?? props.paid_by_name ?? null;
    this.isRecurring = props.isRecurring ?? props.is_recurring ?? true;
    this.frequency = props.frequency;
    this.status = props.status || "unpaid";
    this.createdAt = props.createdAt || props.created_at || new Date().toISOString();
  }

  public toDTO(): FamilyBillDTO {
    const dto: FamilyBillDTO = {
      id: this.id,
      household_id: this.householdId,
      name: this.name,
      amount: this.amount,
      currency: this.currency,
      due_date: this.dueDate,
      category: this.category,
      is_recurring: this.isRecurring,
      status: this.status,
      created_at: this.createdAt,
    };
    if (this.paidByMemberId !== null) dto.paid_by_member_id = this.paidByMemberId;
    if (this.paidByName !== null) dto.paid_by_name = this.paidByName;
    if (this.frequency !== undefined) dto.frequency = this.frequency;
    return dto;
  }

  public static fromDTO(dto: FamilyBillDTO): FamilyBillEntity {
    return new FamilyBillEntity({
      id: dto.id,
      householdId: dto.household_id,
      name: dto.name,
      amount: dto.amount,
      currency: dto.currency,
      dueDate: dto.due_date,
      category: dto.category,
      paidByMemberId: dto.paid_by_member_id ?? null,
      paidByName: dto.paid_by_name ?? null,
      isRecurring: dto.is_recurring,
      frequency: dto.frequency,
      status: dto.status,
      createdAt: dto.created_at,
    });
  }
}
