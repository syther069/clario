import type { Budget as BudgetDTO, Category } from "@/lib/supabase/types";

/**
 * Clean Architecture - Domain Layer
 * Entity: BudgetEntity
 * Encapsulates personal expense budget ceilings, warning thresholds, and period definitions.
 */
export class BudgetEntity {
  public readonly id: string;
  public readonly userId: string;
  public readonly categoryId: string;
  public readonly category: Category | null;
  public readonly amountLimit: number;
  public readonly spentAmount: number;
  public readonly period: "weekly" | "monthly" | "yearly";
  public readonly startDate: string | null;
  public readonly createdAt: string;

  public constructor(props: {
    id: string;
    userId?: string | undefined;
    user_id?: string | undefined;
    categoryId?: string | undefined;
    category_id?: string | undefined;
    category?: Category | null | undefined;
    amountLimit?: number | undefined;
    amount_limit?: number | undefined;
    amount?: number | undefined;
    spentAmount?: number | undefined;
    spent_amount?: number | undefined;
    period?: ("weekly" | "monthly" | "yearly") | undefined;
    startDate?: string | null | undefined;
    start_date?: string | null | undefined;
    createdAt?: string | undefined;
    created_at?: string | undefined;
  }) {
    if (!props.id || !props.id.trim()) {
      throw new Error("BudgetEntity requires a valid non-empty id");
    }

    this.id = props.id.trim();
    this.userId = (props.userId || props.user_id || "").trim().toLowerCase();
    this.categoryId = props.categoryId || props.category_id || "general";
    this.category = props.category ?? null;
    this.amountLimit = Math.max(0, props.amountLimit ?? props.amount_limit ?? props.amount ?? 0);
    this.spentAmount = props.spentAmount ?? props.spent_amount ?? 0;
    this.period = props.period || "monthly";
    this.startDate = props.startDate ?? props.start_date ?? null;
    this.createdAt = props.createdAt || props.created_at || new Date().toISOString();
  }

  public toDTO(): BudgetDTO {
    const dto: BudgetDTO = {
      id: this.id,
      user_id: this.userId,
      category_id: this.categoryId,
      amount_limit: this.amountLimit,
      spent_amount: this.spentAmount,
      period: this.period,
      created_at: this.createdAt,
    };
    if (this.category !== null) {
      dto.category = this.category;
    }
    if (this.startDate !== null) {
      dto.start_date = this.startDate;
    }
    return dto;
  }

  public static fromDTO(dto: BudgetDTO): BudgetEntity {
    return new BudgetEntity({
      id: dto.id,
      userId: dto.user_id,
      categoryId: dto.category_id,
      category: dto.category ?? null,
      amountLimit: dto.amount_limit,
      spentAmount: dto.spent_amount,
      period: dto.period,
      startDate: dto.start_date ?? null,
      createdAt: dto.created_at,
    });
  }
}
