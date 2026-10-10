import type { FamilySettlement as FamilySettlementDTO } from "@/lib/supabase/types";

/**
 * Clean Architecture - Domain Layer
 * Entity: FamilySettlementEntity
 * Encapsulates peer-to-peer household IOUs, debt clearance, and settlement records.
 */
export class FamilySettlementEntity {
  public readonly id: string;
  public readonly householdId: string;
  public readonly fromMemberId: string;
  public readonly fromMemberName: string;
  public readonly toMemberId: string;
  public readonly toMemberName: string;
  public readonly amount: number;
  public readonly currency: string;
  public readonly status: "pending" | "settled";
  public readonly settledAt: string | null;
  public readonly createdAt: string;

  public constructor(props: {
    id: string;
    householdId: string;
    fromMemberId?: string | undefined;
    from_member_id?: string | undefined;
    fromMemberName?: string | undefined;
    from_member_name?: string | undefined;
    toMemberId?: string | undefined;
    to_member_id?: string | undefined;
    toMemberName?: string | undefined;
    to_member_name?: string | undefined;
    amount: number;
    currency?: string | undefined;
    status?: ("pending" | "settled") | undefined;
    settledAt?: string | null | undefined;
    settled_at?: string | null | undefined;
    createdAt?: string | undefined;
    created_at?: string | undefined;
  }) {
    if (!props.id || !props.id.trim()) {
      throw new Error("FamilySettlementEntity requires a valid non-empty id");
    }

    this.id = props.id.trim();
    this.householdId = props.householdId.trim().toLowerCase();
    this.fromMemberId = props.fromMemberId || props.from_member_id || "";
    this.fromMemberName = props.fromMemberName || props.from_member_name || "";
    this.toMemberId = props.toMemberId || props.to_member_id || "";
    this.toMemberName = props.toMemberName || props.to_member_name || "";
    this.amount = Math.max(0, props.amount);
    this.currency = props.currency || "USD";
    this.status = props.status || "pending";
    this.settledAt = props.settledAt ?? props.settled_at ?? null;
    this.createdAt = props.createdAt || props.created_at || new Date().toISOString();
  }

  public toDTO(): FamilySettlementDTO {
    const dto: FamilySettlementDTO = {
      id: this.id,
      household_id: this.householdId,
      from_member_id: this.fromMemberId,
      from_member_name: this.fromMemberName,
      to_member_id: this.toMemberId,
      to_member_name: this.toMemberName,
      amount: this.amount,
      currency: this.currency,
      status: this.status,
      created_at: this.createdAt,
    };
    if (this.settledAt !== null) {
      dto.settled_at = this.settledAt;
    }
    return dto;
  }

  public static fromDTO(dto: FamilySettlementDTO): FamilySettlementEntity {
    return new FamilySettlementEntity({
      id: dto.id,
      householdId: dto.household_id,
      fromMemberId: dto.from_member_id,
      fromMemberName: dto.from_member_name,
      toMemberId: dto.to_member_id,
      toMemberName: dto.to_member_name,
      amount: dto.amount,
      currency: dto.currency,
      status: dto.status,
      settledAt: dto.settled_at ?? null,
      createdAt: dto.created_at,
    });
  }
}
