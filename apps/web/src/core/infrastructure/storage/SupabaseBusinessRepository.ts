import type { IBusinessRepository } from "../../domain/business/ports/IBusinessRepository";
import { BusinessTeamMemberEntity } from "../../domain/business/entities/BusinessTeamMember";
import { BusinessReimbursementEntity } from "../../domain/business/entities/BusinessReimbursement";
import { ExpensePolicyEntity } from "../../domain/business/entities/ExpensePolicy";
import { BusinessAuditEventEntity } from "../../domain/business/entities/BusinessAuditEvent";
import type {
  BusinessTeamMember as BusinessTeamMemberDTO,
  BusinessReimbursement as BusinessReimbursementDTO,
  ExpensePolicy as ExpensePolicyDTO,
  BusinessAuditEvent as BusinessAuditEventDTO,
  ReimbursementStatus,
} from "@/lib/supabase/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  ClarioIndexedDB,
  indexedDBService,
  STORES,
} from "./indexeddb/ClarioIndexedDB";
import {
  SyncQueueManager,
  syncQueueManager,
} from "./indexeddb/SyncQueueManager";
import { LocalStorageBusinessRepository } from "./LocalStorageBusinessRepository";

/**
 * Clean Architecture - Infrastructure Layer
 * SupabaseBusinessRepository
 *
 * Implements IBusinessRepository backed by:
 * - L2 IndexedDB local persistent cache with hundred-MB capability (with LocalStorage fallback)
 * - L3 Supabase PostgreSQL cloud sync with Row-Level Security
 * - Offline-first SyncQueueManager for disconnected field and mobile operations
 */
export class SupabaseBusinessRepository implements IBusinessRepository {
  private readonly fallback = new LocalStorageBusinessRepository();

  constructor(
    private readonly idb: ClarioIndexedDB = indexedDBService,
    private readonly queue: SyncQueueManager = syncQueueManager,
  ) {}

  // -------------------------------------------------------------
  // TEAM MEMBERS
  // -------------------------------------------------------------
  public async getBusinessTeam(
    orgId: string,
  ): Promise<BusinessTeamMemberEntity[]> {
    if (!this.idb.isSupported()) {
      return this.fallback.getBusinessTeam(orgId);
    }

    try {
      const isOnline =
        typeof navigator !== "undefined" ? navigator.onLine : true;
      if (isOnline) {
        const supabase = getSupabaseClient(orgId);
        const { data, error } = await supabase
          .from("business_team_members")
          .select("*")
          .eq("org_id", orgId)
          .order("created_at", { ascending: true });

        if (!error && Array.isArray(data) && data.length > 0) {
          await this.idb.putBatch(STORES.BUSINESS_TEAM, data);
          return (data as BusinessTeamMemberDTO[]).map((dto) =>
            BusinessTeamMemberEntity.fromDTO(dto),
          );
        }
      }
    } catch {
      // offline fallback
    }

    // Read from IndexedDB cache
    const cached = await this.idb.getByIndex<BusinessTeamMemberDTO>(
      STORES.BUSINESS_TEAM,
      "org_id",
      orgId,
    );
    if (cached && cached.length > 0) {
      return cached.map((dto) => BusinessTeamMemberEntity.fromDTO(dto));
    }

    return this.fallback.getBusinessTeam(orgId);
  }

  public async saveBusinessTeamMember(
    member: BusinessTeamMemberEntity,
  ): Promise<BusinessTeamMemberEntity> {
    if (!this.idb.isSupported()) {
      return this.fallback.saveBusinessTeamMember(member);
    }

    const dto = member.toDTO();

    // 1. Optimistic write to IndexedDB
    await this.idb.put(STORES.BUSINESS_TEAM, dto);

    // 2. Sync to Supabase or queue
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (isOnline) {
      try {
        const supabase = getSupabaseClient(dto.org_id);
        const { error } = await supabase
          .from("business_team_members")
          .upsert(dto);
        if (error) throw error;
      } catch {
        await this.queue.enqueue({
          entityType: STORES.BUSINESS_TEAM,
          action: "upsert",
          payload: dto,
          scopeId: dto.org_id,
        });
      }
    } else {
      await this.queue.enqueue({
        entityType: STORES.BUSINESS_TEAM,
        action: "upsert",
        payload: dto,
        scopeId: dto.org_id,
      });
    }

    return member;
  }

  public async deleteBusinessTeamMember(
    memberId: string,
    orgId?: string,
  ): Promise<void> {
    if (!this.idb.isSupported()) {
      return this.fallback.deleteBusinessTeamMember(memberId, orgId);
    }

    await this.idb.delete(STORES.BUSINESS_TEAM, memberId);

    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (isOnline) {
      try {
        const supabase = getSupabaseClient(orgId);
        const { error } = await supabase
          .from("business_team_members")
          .delete()
          .eq("id", memberId);
        if (error) throw error;
      } catch {
        await this.queue.enqueue({
          entityType: STORES.BUSINESS_TEAM,
          action: "delete",
          payload: { id: memberId },
          scopeId: orgId,
        });
      }
    } else {
      await this.queue.enqueue({
        entityType: STORES.BUSINESS_TEAM,
        action: "delete",
        payload: { id: memberId },
        scopeId: orgId,
      });
    }
  }

  // -------------------------------------------------------------
  // REIMBURSEMENTS
  // -------------------------------------------------------------
  public async getBusinessReimbursements(
    orgId: string,
  ): Promise<BusinessReimbursementEntity[]> {
    if (!this.idb.isSupported()) {
      return this.fallback.getBusinessReimbursements(orgId);
    }

    try {
      const isOnline =
        typeof navigator !== "undefined" ? navigator.onLine : true;
      if (isOnline) {
        const supabase = getSupabaseClient(orgId);
        const { data, error } = await supabase
          .from("business_reimbursements")
          .select("*")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          await this.idb.putBatch(STORES.BUSINESS_REIMBURSEMENTS, data);
          return (data as BusinessReimbursementDTO[]).map((dto) =>
            BusinessReimbursementEntity.fromDTO(dto),
          );
        }
      }
    } catch {
      // offline fallback
    }

    const cached = await this.idb.getByIndex<BusinessReimbursementDTO>(
      STORES.BUSINESS_REIMBURSEMENTS,
      "org_id",
      orgId,
    );
    if (cached && cached.length > 0) {
      return cached.map((dto) => BusinessReimbursementEntity.fromDTO(dto));
    }

    return this.fallback.getBusinessReimbursements(orgId);
  }

  public async saveBusinessReimbursement(
    claim: BusinessReimbursementEntity,
  ): Promise<BusinessReimbursementEntity> {
    if (!this.idb.isSupported()) {
      return this.fallback.saveBusinessReimbursement(claim);
    }

    const dto = claim.toDTO();

    await this.idb.put(STORES.BUSINESS_REIMBURSEMENTS, dto);

    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (isOnline) {
      try {
        const supabase = getSupabaseClient(dto.org_id);
        const { error } = await supabase
          .from("business_reimbursements")
          .upsert(dto);
        if (error) throw error;
      } catch {
        await this.queue.enqueue({
          entityType: STORES.BUSINESS_REIMBURSEMENTS,
          action: "upsert",
          payload: dto,
          scopeId: dto.org_id,
        });
      }
    } else {
      await this.queue.enqueue({
        entityType: STORES.BUSINESS_REIMBURSEMENTS,
        action: "upsert",
        payload: dto,
        scopeId: dto.org_id,
      });
    }

    return claim;
  }

  public async updateReimbursementStatus(
    claimId: string,
    status: ReimbursementStatus,
    reviewerName?: string,
    reviewNotes?: string,
    monadTxHash?: string,
    orgId?: string,
  ): Promise<void> {
    if (!this.idb.isSupported()) {
      return this.fallback.updateReimbursementStatus(
        claimId,
        status,
        reviewerName,
        reviewNotes,
        monadTxHash,
        orgId,
      );
    }

    const updates: Partial<BusinessReimbursementDTO> = {
      status,
      reviewed_by: reviewerName || null,
      review_notes: reviewNotes || null,
      approved_at: status === "approved" ? new Date().toISOString() : null,
    };
    if (monadTxHash) {
      updates.monad_tx_hash = monadTxHash;
    }

    const existing = await this.idb.getById<BusinessReimbursementDTO>(
      STORES.BUSINESS_REIMBURSEMENTS,
      claimId,
    );
    if (existing) {
      await this.idb.put(STORES.BUSINESS_REIMBURSEMENTS, {
        ...existing,
        ...updates,
      });
    }

    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (isOnline) {
      try {
        const supabase = getSupabaseClient(orgId);
        const { error } = await supabase
          .from("business_reimbursements")
          .update(updates)
          .eq("id", claimId);
        if (error) throw error;
      } catch {
        await this.queue.enqueue({
          entityType: STORES.BUSINESS_REIMBURSEMENTS,
          action: "upsert",
          payload: { id: claimId, ...updates },
          scopeId: orgId,
        });
      }
    } else {
      await this.queue.enqueue({
        entityType: STORES.BUSINESS_REIMBURSEMENTS,
        action: "upsert",
        payload: { id: claimId, ...updates },
        scopeId: orgId,
      });
    }
  }

  public async deleteBusinessReimbursement(
    claimId: string,
    orgId?: string,
  ): Promise<void> {
    if (!this.idb.isSupported()) {
      return this.fallback.deleteBusinessReimbursement(claimId, orgId);
    }

    await this.idb.delete(STORES.BUSINESS_REIMBURSEMENTS, claimId);

    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (isOnline) {
      try {
        const supabase = getSupabaseClient(orgId);
        const { error } = await supabase
          .from("business_reimbursements")
          .delete()
          .eq("id", claimId);
        if (error) throw error;
      } catch {
        await this.queue.enqueue({
          entityType: STORES.BUSINESS_REIMBURSEMENTS,
          action: "delete",
          payload: { id: claimId },
          scopeId: orgId,
        });
      }
    } else {
      await this.queue.enqueue({
        entityType: STORES.BUSINESS_REIMBURSEMENTS,
        action: "delete",
        payload: { id: claimId },
        scopeId: orgId,
      });
    }
  }

  // -------------------------------------------------------------
  // EXPENSE POLICIES
  // -------------------------------------------------------------
  public async getExpensePolicies(
    orgId: string,
  ): Promise<ExpensePolicyEntity[]> {
    if (!this.idb.isSupported()) {
      return this.fallback.getExpensePolicies(orgId);
    }

    try {
      const isOnline =
        typeof navigator !== "undefined" ? navigator.onLine : true;
      if (isOnline) {
        const supabase = getSupabaseClient(orgId);
        const { data, error } = await supabase
          .from("business_policies")
          .select("*")
          .eq("org_id", orgId)
          .order("created_at", { ascending: true });

        if (!error && Array.isArray(data) && data.length > 0) {
          await this.idb.putBatch(STORES.BUSINESS_POLICIES, data);
          return (data as ExpensePolicyDTO[]).map((dto) =>
            ExpensePolicyEntity.fromDTO(dto),
          );
        }
      }
    } catch {
      // offline fallback
    }

    const cached = await this.idb.getByIndex<ExpensePolicyDTO>(
      STORES.BUSINESS_POLICIES,
      "org_id",
      orgId,
    );
    if (cached && cached.length > 0) {
      return cached.map((dto) => ExpensePolicyEntity.fromDTO(dto));
    }

    return this.fallback.getExpensePolicies(orgId);
  }

  public async saveExpensePolicy(
    policy: ExpensePolicyEntity,
  ): Promise<ExpensePolicyEntity> {
    if (!this.idb.isSupported()) {
      return this.fallback.saveExpensePolicy(policy);
    }

    const dto = policy.toDTO();

    await this.idb.put(STORES.BUSINESS_POLICIES, dto);

    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (isOnline) {
      try {
        const supabase = getSupabaseClient(dto.org_id);
        const { error } = await supabase.from("business_policies").upsert(dto);
        if (error) throw error;
      } catch {
        await this.queue.enqueue({
          entityType: STORES.BUSINESS_POLICIES,
          action: "upsert",
          payload: dto,
          scopeId: dto.org_id,
        });
      }
    } else {
      await this.queue.enqueue({
        entityType: STORES.BUSINESS_POLICIES,
        action: "upsert",
        payload: dto,
        scopeId: dto.org_id,
      });
    }

    return policy;
  }

  public async deleteExpensePolicy(
    policyId: string,
    orgId?: string,
  ): Promise<void> {
    if (!this.idb.isSupported()) {
      return this.fallback.deleteExpensePolicy(policyId, orgId);
    }

    await this.idb.delete(STORES.BUSINESS_POLICIES, policyId);

    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (isOnline) {
      try {
        const supabase = getSupabaseClient(orgId);
        const { error } = await supabase
          .from("business_policies")
          .delete()
          .eq("id", policyId);
        if (error) throw error;
      } catch {
        await this.queue.enqueue({
          entityType: STORES.BUSINESS_POLICIES,
          action: "delete",
          payload: { id: policyId },
          scopeId: orgId,
        });
      }
    } else {
      await this.queue.enqueue({
        entityType: STORES.BUSINESS_POLICIES,
        action: "delete",
        payload: { id: policyId },
        scopeId: orgId,
      });
    }
  }

  // -------------------------------------------------------------
  // AUDIT EVENTS
  // -------------------------------------------------------------
  public async getBusinessAuditEvents(
    orgId: string,
  ): Promise<BusinessAuditEventEntity[]> {
    if (!this.idb.isSupported()) {
      return this.fallback.getBusinessAuditEvents(orgId);
    }

    try {
      const isOnline =
        typeof navigator !== "undefined" ? navigator.onLine : true;
      if (isOnline) {
        const supabase = getSupabaseClient(orgId);
        const { data, error } = await supabase
          .from("business_audit_events")
          .select("*")
          .eq("org_id", orgId)
          .order("timestamp", { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          await this.idb.putBatch(STORES.BUSINESS_AUDIT, data);
          return (data as BusinessAuditEventDTO[]).map((dto) =>
            BusinessAuditEventEntity.fromDTO(dto),
          );
        }
      }
    } catch {
      // offline fallback
    }

    const cached = await this.idb.getByIndex<BusinessAuditEventDTO>(
      STORES.BUSINESS_AUDIT,
      "org_id",
      orgId,
    );
    if (cached && cached.length > 0) {
      return cached.map((dto) => BusinessAuditEventEntity.fromDTO(dto));
    }

    return this.fallback.getBusinessAuditEvents(orgId);
  }

  public async recordBusinessAuditEvent(
    event: BusinessAuditEventEntity,
  ): Promise<BusinessAuditEventEntity> {
    if (!this.idb.isSupported()) {
      return this.fallback.recordBusinessAuditEvent(event);
    }

    const dto = event.toDTO();

    await this.idb.put(STORES.BUSINESS_AUDIT, dto);

    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (isOnline) {
      try {
        const supabase = getSupabaseClient(dto.org_id);
        const { error } = await supabase
          .from("business_audit_events")
          .insert(dto);
        if (error) throw error;
      } catch {
        await this.queue.enqueue({
          entityType: STORES.BUSINESS_AUDIT,
          action: "upsert",
          payload: dto,
          scopeId: dto.org_id,
        });
      }
    } else {
      await this.queue.enqueue({
        entityType: STORES.BUSINESS_AUDIT,
        action: "upsert",
        payload: dto,
        scopeId: dto.org_id,
      });
    }

    return event;
  }
}
