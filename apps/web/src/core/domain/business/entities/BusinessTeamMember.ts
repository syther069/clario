import type { BusinessTeamMember as BusinessTeamMemberDTO, BusinessRole } from "@/lib/supabase/types";

/**
 * Clean Architecture - Domain Layer
 * Entity: BusinessTeamMemberEntity
 * Encapsulates organizational team roster, departmental budgeting, and approval limits.
 */
export class BusinessTeamMemberEntity {
  public readonly id: string;
  public readonly orgId: string;
  public readonly userId: string | null;
  public readonly name: string;
  public readonly email: string;
  public readonly role: BusinessRole;
  public readonly department: string;
  public readonly spendingLimitMonthly: number;
  public readonly createdAt: string;

  public constructor(props: {
    id: string;
    orgId?: string | undefined;
    org_id?: string | undefined;
    userId?: string | null | undefined;
    user_id?: string | null | undefined;
    name: string;
    email: string;
    role?: BusinessRole | undefined;
    department?: string | undefined;
    spendingLimitMonthly?: number | undefined;
    spending_limit_monthly?: number | undefined;
    createdAt?: string | undefined;
    created_at?: string | undefined;
  }) {
    if (!props.id || !props.id.trim()) {
      throw new Error("BusinessTeamMemberEntity requires a valid non-empty id");
    }
    if (!props.name || !props.name.trim()) {
      throw new Error("BusinessTeamMemberEntity requires a valid name");
    }

    this.id = props.id.trim();
    this.orgId = (props.orgId || props.org_id || "").trim().toLowerCase();
    this.userId = props.userId ?? props.user_id ?? null;
    this.name = props.name.trim();
    this.email = props.email.trim();
    this.role = props.role || "employee";
    this.department = props.department || "General";
    this.spendingLimitMonthly = Math.max(
      0,
      props.spendingLimitMonthly ?? props.spending_limit_monthly ?? 0,
    );
    this.createdAt = props.createdAt || props.created_at || new Date().toISOString();
  }

  public toDTO(): BusinessTeamMemberDTO {
    const dto: BusinessTeamMemberDTO = {
      id: this.id,
      org_id: this.orgId,
      name: this.name,
      email: this.email,
      role: this.role,
      department: this.department,
      spending_limit_monthly: this.spendingLimitMonthly,
      created_at: this.createdAt,
    };
    if (this.userId !== null) dto.user_id = this.userId;
    return dto;
  }

  public static fromDTO(dto: BusinessTeamMemberDTO): BusinessTeamMemberEntity {
    return new BusinessTeamMemberEntity({
      id: dto.id,
      orgId: dto.org_id,
      userId: dto.user_id ?? null,
      name: dto.name,
      email: dto.email,
      role: dto.role,
      department: dto.department,
      spendingLimitMonthly: dto.spending_limit_monthly,
      createdAt: dto.created_at,
    });
  }
}
