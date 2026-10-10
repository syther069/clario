import type { BusinessAuditEvent as BusinessAuditEventDTO } from "@/lib/supabase/types";

/**
 * Clean Architecture - Domain Layer
 * Entity: BusinessAuditEventEntity
 * Encapsulates immutable corporate audit trail events with Actor, Action, Entity, and Details bindings.
 */
export class BusinessAuditEventEntity {
  public readonly id: string;
  public readonly orgId: string;
  public readonly actorName: string;
  public readonly action: string;
  public readonly entityType: string;
  public readonly entityId: string;
  public readonly details: string;
  public readonly severity: "info" | "warning" | "alert";
  public readonly timestamp: string;

  public constructor(props: {
    id: string;
    orgId?: string;
    org_id?: string;
    actorName?: string;
    actor_name?: string;
    action: string;
    entityType?: string;
    entity_type?: string;
    entityId?: string;
    entity_id?: string;
    target?: string;
    details?: string;
    severity?: "info" | "warning" | "alert";
    timestamp?: string;
  }) {
    if (!props.id || !props.id.trim()) {
      throw new Error("BusinessAuditEventEntity requires a valid non-empty id");
    }

    this.id = props.id.trim();
    this.orgId = (props.orgId || props.org_id || "").trim().toLowerCase();
    this.actorName = props.actorName || props.actor_name || "System";
    this.action = props.action;
    this.entityType = props.entityType || props.entity_type || props.target || "General";
    this.entityId = props.entityId || props.entity_id || props.id;
    this.details = props.details || "";
    this.severity = props.severity || "info";
    this.timestamp = props.timestamp || new Date().toISOString();
  }

  public toDTO(): BusinessAuditEventDTO {
    return {
      id: this.id,
      org_id: this.orgId,
      actor_name: this.actorName,
      action: this.action,
      entity_type: this.entityType,
      entity_id: this.entityId,
      details: this.details,
      severity: this.severity,
      timestamp: this.timestamp,
    };
  }

  public static fromDTO(dto: BusinessAuditEventDTO): BusinessAuditEventEntity {
    return new BusinessAuditEventEntity({
      id: dto.id,
      orgId: dto.org_id,
      actorName: dto.actor_name,
      action: dto.action,
      entityType: dto.entity_type,
      entityId: dto.entity_id,
      details: dto.details,
      severity: dto.severity,
      timestamp: dto.timestamp,
    });
  }
}
