import type { ExpensePolicy as ExpensePolicyDTO } from "@/lib/supabase/types";

/**
 * Clean Architecture - Domain Layer
 * Entity: ExpensePolicyEntity
 * Encapsulates corporate spend guardrails, auto-approval thresholds, and receipt requirements.
 */
export class ExpensePolicyEntity {
  public readonly id: string;
  public readonly orgId: string;
  public readonly name: string;
  public readonly category: string;
  public readonly maxSingleAmount: number;
  public readonly monthlyBudget: number;
  public readonly requiresReceiptAbove: number;
  public readonly requiresApprovalAbove: number;
  public readonly isActive: boolean;
  public readonly createdAt: string;

  public constructor(props: {
    id: string;
    orgId?: string;
    org_id?: string;
    name?: string;
    category?: string;
    maxSingleAmount?: number;
    max_single_amount?: number;
    monthlyBudget?: number;
    monthly_budget?: number;
    requiresReceiptAbove?: number;
    requires_receipt_above?: number;
    requiresApprovalAbove?: number;
    requires_approval_above?: number;
    isActive?: boolean;
    is_active?: boolean;
    createdAt?: string;
    created_at?: string;
  }) {
    if (!props.id || !props.id.trim()) {
      throw new Error("ExpensePolicyEntity requires a valid non-empty id");
    }

    this.id = props.id.trim();
    this.orgId = (props.orgId || props.org_id || "").trim().toLowerCase();
    this.name = props.name || "Standard Policy";
    this.category = props.category || "General";
    this.maxSingleAmount = props.maxSingleAmount ?? props.max_single_amount ?? 1000;
    this.monthlyBudget = props.monthlyBudget ?? props.monthly_budget ?? 10000;
    this.requiresReceiptAbove = props.requiresReceiptAbove ?? props.requires_receipt_above ?? 50;
    this.requiresApprovalAbove = props.requiresApprovalAbove ?? props.requires_approval_above ?? 300;
    this.isActive = props.isActive ?? props.is_active ?? true;
    this.createdAt = props.createdAt || props.created_at || new Date().toISOString();
  }

  public toDTO(): ExpensePolicyDTO {
    return {
      id: this.id,
      org_id: this.orgId,
      name: this.name,
      category: this.category,
      max_single_amount: this.maxSingleAmount,
      monthly_budget: this.monthlyBudget,
      requires_receipt_above: this.requiresReceiptAbove,
      requires_approval_above: this.requiresApprovalAbove,
      is_active: this.isActive,
      created_at: this.createdAt,
    };
  }

  public static fromDTO(dto: ExpensePolicyDTO): ExpensePolicyEntity {
    return new ExpensePolicyEntity({
      id: dto.id,
      orgId: dto.org_id,
      name: dto.name,
      category: dto.category,
      maxSingleAmount: dto.max_single_amount,
      monthlyBudget: dto.monthly_budget,
      requiresReceiptAbove: dto.requires_receipt_above,
      requiresApprovalAbove: dto.requires_approval_above,
      isActive: dto.is_active,
      createdAt: dto.created_at,
    });
  }
}
