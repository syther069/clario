import type { Subscription as SubscriptionDTO } from "@/lib/supabase/types";

/**
 * Clean Architecture - Domain Layer
 * Entity: SubscriptionEntity
 * Encapsulates recurring SaaS and infrastructure subscriptions, annualized run-rates, and renewal cycles.
 */
export class SubscriptionEntity {
  public readonly id: string;
  public readonly userId: string;
  public readonly name: string;
  public readonly merchant: string | null;
  public readonly amount: number;
  public readonly currency: string;
  public readonly frequency: "weekly" | "monthly" | "yearly";
  public readonly categoryId: string | null;
  public readonly lastPaymentDate: string | null;
  public readonly nextBillingDate: string | null;
  public readonly status: "active" | "paused" | "cancelled";
  public readonly autoDetected: boolean;
  public readonly createdAt: string;
  public readonly updatedAt: string | null;

  public constructor(props: {
    id: string;
    userId?: string | undefined;
    user_id?: string | undefined;
    name: string;
    merchant?: string | null | undefined;
    amount: number;
    currency?: string | undefined;
    frequency?: ("weekly" | "monthly" | "yearly") | undefined;
    categoryId?: string | null | undefined;
    category_id?: string | null | undefined;
    lastPaymentDate?: string | null | undefined;
    last_payment_date?: string | null | undefined;
    nextBillingDate?: string | null | undefined;
    next_billing_date?: string | null | undefined;
    status?: ("active" | "paused" | "cancelled") | undefined;
    autoDetected?: boolean | undefined;
    auto_detected?: boolean | undefined;
    createdAt?: string | undefined;
    created_at?: string | undefined;
    updatedAt?: string | null | undefined;
    updated_at?: string | null | undefined;
  }) {
    if (!props.id || !props.id.trim()) {
      throw new Error("SubscriptionEntity requires a valid non-empty id");
    }

    this.id = props.id.trim();
    this.userId = (props.userId || props.user_id || "").trim().toLowerCase();
    this.name = props.name || "Subscription";
    this.merchant = props.merchant ?? null;
    this.amount = Math.max(0, props.amount);
    this.currency = props.currency || "USD";
    this.frequency = props.frequency || "monthly";
    this.categoryId = props.categoryId ?? props.category_id ?? null;
    this.lastPaymentDate = props.lastPaymentDate ?? props.last_payment_date ?? null;
    this.nextBillingDate = props.nextBillingDate ?? props.next_billing_date ?? null;
    this.status = props.status || "active";
    this.autoDetected = props.autoDetected ?? props.auto_detected ?? false;
    this.createdAt = props.createdAt || props.created_at || new Date().toISOString();
    this.updatedAt = props.updatedAt ?? props.updated_at ?? null;
  }

  public toDTO(): SubscriptionDTO {
    const dto: SubscriptionDTO = {
      id: this.id,
      user_id: this.userId,
      name: this.name,
      amount: this.amount,
      currency: this.currency,
      frequency: this.frequency,
      status: this.status,
      created_at: this.createdAt,
    };
    if (this.merchant !== null) dto.merchant = this.merchant;
    if (this.categoryId !== null) dto.category_id = this.categoryId;
    if (this.lastPaymentDate !== null) dto.last_payment_date = this.lastPaymentDate;
    if (this.nextBillingDate !== null) dto.next_billing_date = this.nextBillingDate;
    if (this.autoDetected) dto.auto_detected = this.autoDetected;
    if (this.updatedAt !== null) dto.updated_at = this.updatedAt;
    return dto;
  }

  public static fromDTO(dto: SubscriptionDTO): SubscriptionEntity {
    return new SubscriptionEntity({
      id: dto.id,
      userId: dto.user_id,
      name: dto.name,
      merchant: dto.merchant ?? null,
      amount: dto.amount,
      currency: dto.currency,
      frequency: dto.frequency,
      categoryId: dto.category_id ?? null,
      lastPaymentDate: dto.last_payment_date ?? null,
      nextBillingDate: dto.next_billing_date ?? null,
      status: dto.status,
      autoDetected: dto.auto_detected ?? false,
      createdAt: dto.created_at,
      updatedAt: dto.updated_at ?? null,
    });
  }
}
