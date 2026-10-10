import type { FamilyMember as FamilyMemberDTO, FamilyRole } from "@/lib/supabase/types";

/**
 * Clean Architecture - Domain Layer
 * Entity: FamilyMemberEntity
 * Encapsulates household member profiles and authority roles.
 */
export class FamilyMemberEntity {
  public readonly id: string;
  public readonly householdId: string;
  public readonly userId: string | null;
  public readonly name: string;
  public readonly email: string | null;
  public readonly role: FamilyRole;
  public readonly avatarColor: string | null;
  public readonly createdAt: string;

  public constructor(props: {
    id: string;
    householdId: string;
    userId?: string | null | undefined;
    user_id?: string | null | undefined;
    name: string;
    email?: string | null | undefined;
    role?: FamilyRole | undefined;
    avatarColor?: string | null | undefined;
    avatar_color?: string | null | undefined;
    createdAt?: string | undefined;
    created_at?: string | undefined;
  }) {
    if (!props.id || !props.id.trim()) {
      throw new Error("FamilyMemberEntity requires a valid non-empty id");
    }
    if (!props.name || !props.name.trim()) {
      throw new Error("FamilyMemberEntity requires a valid name");
    }

    this.id = props.id.trim();
    this.householdId = props.householdId.trim().toLowerCase();
    this.userId = props.userId ?? props.user_id ?? null;
    this.name = props.name.trim();
    this.email = props.email ?? null;
    this.role = props.role || "member";
    this.avatarColor = props.avatarColor ?? props.avatar_color ?? null;
    this.createdAt = props.createdAt || props.created_at || new Date().toISOString();
  }

  public toDTO(): FamilyMemberDTO {
    const dto: FamilyMemberDTO = {
      id: this.id,
      household_id: this.householdId,
      name: this.name,
      role: this.role,
      created_at: this.createdAt,
    };
    if (this.userId !== null) dto.user_id = this.userId;
    if (this.email !== null) dto.email = this.email;
    if (this.avatarColor !== null) dto.avatar_color = this.avatarColor;
    return dto;
  }

  public static fromDTO(dto: FamilyMemberDTO): FamilyMemberEntity {
    return new FamilyMemberEntity({
      id: dto.id,
      householdId: dto.household_id,
      userId: dto.user_id ?? null,
      name: dto.name,
      email: dto.email ?? null,
      role: dto.role,
      avatarColor: dto.avatar_color ?? null,
      createdAt: dto.created_at,
    });
  }
}
