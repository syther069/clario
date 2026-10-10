import type { Client as ClientDTO } from "@/lib/supabase/types";

/**
 * Clean Architecture - Domain Layer
 * Entity: ClientEntity
 * Encapsulates client profile invariants, status validation, and hourly rates.
 */
export class ClientEntity {
  public readonly id: string;
  public readonly userId: string;
  public readonly name: string;
  public readonly company: string | null;
  public readonly email: string | null;
  public readonly rateCurrency: string;
  public readonly hourlyRate: number;
  public readonly status: "active" | "lead" | "inactive";
  public readonly notes: string | null;
  public readonly createdAt: string;
  public readonly updatedAt: string;

  public constructor(props: {
    id: string;
    userId: string;
    name: string;
    company?: string | null | undefined;
    email?: string | null | undefined;
    rateCurrency?: string | undefined;
    hourlyRate?: number | null | undefined;
    status?: ("active" | "lead" | "inactive") | undefined;
    notes?: string | null | undefined;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
  }) {
    if (!props.id || !props.id.trim()) {
      throw new Error("ClientEntity requires a valid non-empty id");
    }
    if (!props.name || !props.name.trim()) {
      throw new Error("ClientEntity requires a valid name");
    }

    this.id = props.id.trim();
    this.userId = props.userId.trim().toLowerCase();
    this.name = props.name.trim();
    this.company = props.company ?? null;
    this.email = props.email ?? null;
    this.rateCurrency = props.rateCurrency || "USD";
    this.hourlyRate = Math.max(0, props.hourlyRate ?? 0);
    this.status = props.status || "active";
    this.notes = props.notes ?? null;
    this.createdAt = props.createdAt || new Date().toISOString();
    this.updatedAt = props.updatedAt || this.createdAt;
  }

  public toDTO(): ClientDTO {
    const dto: ClientDTO = {
      id: this.id,
      user_id: this.userId,
      name: this.name,
      rate_currency: this.rateCurrency,
      hourly_rate: this.hourlyRate,
      status: this.status,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    };
    if (this.company !== null) dto.company = this.company;
    if (this.email !== null) dto.email = this.email;
    if (this.notes !== null) dto.notes = this.notes;
    return dto;
  }

  public static fromDTO(dto: ClientDTO): ClientEntity {
    return new ClientEntity({
      id: dto.id,
      userId: dto.user_id,
      name: dto.name,
      company: dto.company ?? null,
      email: dto.email ?? null,
      rateCurrency: dto.rate_currency,
      hourlyRate: dto.hourly_rate ?? 0,
      status: dto.status,
      notes: dto.notes ?? null,
      createdAt: dto.created_at,
      updatedAt: dto.updated_at,
    });
  }
}
