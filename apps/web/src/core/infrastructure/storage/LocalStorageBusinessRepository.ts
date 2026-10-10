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
import { redactSensitiveString } from "@/lib/security/audit-logger";
import { IdentityScope } from "../../domain/common/IdentityScope";

export const STORAGE_KEY_BUSINESS_TEAM = "clario_business_team";
export const STORAGE_KEY_BUSINESS_REIMBURSEMENTS = "clario_business_reimbursements";
export const STORAGE_KEY_BUSINESS_POLICIES = "clario_business_policies";
export const STORAGE_KEY_BUSINESS_AUDIT = "clario_business_audit_events";

function readScoped<T>(baseKey: string, scopeId?: string, fallback: T[] = []): T[] {
  if (typeof window === "undefined" || !window.localStorage) return fallback;
  if (scopeId) IdentityScope.register(scopeId);
  const scopedKey = IdentityScope.getScopedKey(baseKey, scopeId);

  try {
    const rawScoped = localStorage.getItem(scopedKey);
    if (rawScoped) {
      return JSON.parse(rawScoped) as T[];
    }
    if (scopedKey !== baseKey) {
      const rawLegacy = localStorage.getItem(baseKey);
      if (rawLegacy) {
        return JSON.parse(rawLegacy) as T[];
      }
    }
  } catch {
    // fallback
  }
  return fallback;
}

function writeScoped<T>(baseKey: string, data: T[], scopeId?: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  if (scopeId) IdentityScope.register(scopeId);
  const scopedKey = IdentityScope.getScopedKey(baseKey, scopeId);

  try {
    localStorage.setItem(scopedKey, JSON.stringify(data));
  } catch (err) {
    console.warn(`Error writing to localStorage [${scopedKey}]:`, err);
  }
}

function deleteFromAllScopes<T extends { id: string }>(baseKey: string, itemId: string, scopeId?: string): void {
  if (scopeId) {
    const list = readScoped<T>(baseKey, scopeId, []);
    writeScoped(baseKey, list.filter((it) => it.id !== itemId), scopeId);
    return;
  }

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const unscoped = readScoped<T>(baseKey, undefined, []);
      if (unscoped.length > 0) {
        localStorage.setItem(baseKey, JSON.stringify(unscoped.filter((it) => it.id !== itemId)));
      }

      for (const scope of IdentityScope.getKnownScopes()) {
        const list = readScoped<T>(baseKey, scope, []);
        if (list.some((it) => it.id === itemId)) {
          writeScoped(baseKey, list.filter((it) => it.id !== itemId), scope);
        }
      }

      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k === baseKey || k.endsWith(`_${baseKey}`))) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw) as T[];
            if (Array.isArray(parsed) && parsed.some((it) => it.id === itemId)) {
              localStorage.setItem(k, JSON.stringify(parsed.filter((it) => it.id !== itemId)));
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Clean Architecture - Infrastructure Layer
 * LocalStorageBusinessRepository
 * Implements IBusinessRepository via Scoped LocalStorage + Supabase background synchronization.
 */
export class LocalStorageBusinessRepository implements IBusinessRepository {
  // Team
  public async getBusinessTeam(orgId: string): Promise<BusinessTeamMemberEntity[]> {
    try {
      const supabase = getSupabaseClient(orgId);
      const { data, error } = await supabase
        .from("business_team_members")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: true });

      if (!error && Array.isArray(data)) {
        writeScoped(STORAGE_KEY_BUSINESS_TEAM, data as BusinessTeamMemberDTO[], orgId);
        return (data as BusinessTeamMemberDTO[]).map((dto) => BusinessTeamMemberEntity.fromDTO(dto));
      }
    } catch {
      // offline
    }

    const local = readScoped<BusinessTeamMemberDTO>(STORAGE_KEY_BUSINESS_TEAM, orgId, []);
    return local.map((dto) => BusinessTeamMemberEntity.fromDTO(dto));
  }

  public async saveBusinessTeamMember(member: BusinessTeamMemberEntity): Promise<BusinessTeamMemberEntity> {
    const scopeId = member.orgId;
    const local = readScoped<BusinessTeamMemberDTO>(STORAGE_KEY_BUSINESS_TEAM, scopeId, []);
    const updated = [...local.filter((m) => m.id !== member.id), member.toDTO()];
    writeScoped(STORAGE_KEY_BUSINESS_TEAM, updated, scopeId);

    try {
      const supabase = getSupabaseClient(scopeId);
      await supabase.from("business_team_members").upsert(member.toDTO());
    } catch {
      // offline
    }

    return member;
  }

  public async deleteBusinessTeamMember(memberId: string, orgId?: string): Promise<void> {
    deleteFromAllScopes<BusinessTeamMemberDTO>(STORAGE_KEY_BUSINESS_TEAM, memberId, orgId);

    try {
      const supabase = getSupabaseClient(orgId);
      await supabase.from("business_team_members").delete().eq("id", memberId);
    } catch {
      // optional
    }
  }

  // Reimbursements
  public async getBusinessReimbursements(orgId: string): Promise<BusinessReimbursementEntity[]> {
    try {
      const supabase = getSupabaseClient(orgId);
      const { data, error } = await supabase
        .from("business_reimbursements")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        writeScoped(STORAGE_KEY_BUSINESS_REIMBURSEMENTS, data as BusinessReimbursementDTO[], orgId);
        return (data as BusinessReimbursementDTO[]).map((dto) => BusinessReimbursementEntity.fromDTO(dto));
      }
    } catch {
      // offline
    }

    const local = readScoped<BusinessReimbursementDTO>(STORAGE_KEY_BUSINESS_REIMBURSEMENTS, orgId, []);
    return local.map((dto) => BusinessReimbursementEntity.fromDTO(dto));
  }

  public async saveBusinessReimbursement(claim: BusinessReimbursementEntity): Promise<BusinessReimbursementEntity> {
    const scopeId = claim.orgId;
    const local = readScoped<BusinessReimbursementDTO>(STORAGE_KEY_BUSINESS_REIMBURSEMENTS, scopeId, []);
    const updated = [claim.toDTO(), ...local.filter((c) => c.id !== claim.id)];
    writeScoped(STORAGE_KEY_BUSINESS_REIMBURSEMENTS, updated, scopeId);

    try {
      const supabase = getSupabaseClient(scopeId);
      await supabase.from("business_reimbursements").upsert(claim.toDTO());
    } catch {
      // offline
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
    const scopesToUpdate = orgId ? [orgId] : [undefined, ...IdentityScope.getKnownScopes()];

    for (const scope of scopesToUpdate) {
      const local = readScoped<BusinessReimbursementDTO>(STORAGE_KEY_BUSINESS_REIMBURSEMENTS, scope, []);
      const target = local.find((c) => c.id === claimId);
      if (target) {
        target.status = status;
        if (reviewerName) target.reviewed_by = reviewerName;
        if (reviewNotes) target.review_notes = reviewNotes;
        if (monadTxHash) target.monad_tx_hash = monadTxHash;
        if (status === "approved") target.approved_at = new Date().toISOString();
        if (status === "paid") target.paid_at = new Date().toISOString();
        writeScoped(STORAGE_KEY_BUSINESS_REIMBURSEMENTS, local, scope);
      }
    }

    try {
      const supabase = getSupabaseClient(orgId);
      await supabase
        .from("business_reimbursements")
        .update({
          status,
          reviewed_by: reviewerName || null,
          review_notes: reviewNotes || null,
          monad_tx_hash: monadTxHash || null,
          approved_at: status === "approved" ? new Date().toISOString() : undefined,
          paid_at: status === "paid" ? new Date().toISOString() : undefined,
        })
        .eq("id", claimId);
    } catch {
      // optional
    }
  }

  public async deleteBusinessReimbursement(claimId: string, orgId?: string): Promise<void> {
    deleteFromAllScopes<BusinessReimbursementDTO>(STORAGE_KEY_BUSINESS_REIMBURSEMENTS, claimId, orgId);

    try {
      const supabase = getSupabaseClient(orgId);
      await supabase.from("business_reimbursements").delete().eq("id", claimId);
    } catch {
      // optional
    }
  }

  // Policies
  public async getExpensePolicies(orgId: string): Promise<ExpensePolicyEntity[]> {
    try {
      const supabase = getSupabaseClient(orgId);
      const { data, error } = await supabase
        .from("expense_policies")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        writeScoped(STORAGE_KEY_BUSINESS_POLICIES, data as ExpensePolicyDTO[], orgId);
        return (data as ExpensePolicyDTO[]).map((dto) => ExpensePolicyEntity.fromDTO(dto));
      }
    } catch {
      // offline
    }

    const local = readScoped<ExpensePolicyDTO>(STORAGE_KEY_BUSINESS_POLICIES, orgId, []);
    return local.map((dto) => ExpensePolicyEntity.fromDTO(dto));
  }

  public async saveExpensePolicy(policy: ExpensePolicyEntity): Promise<ExpensePolicyEntity> {
    const scopeId = policy.orgId;
    const local = readScoped<ExpensePolicyDTO>(STORAGE_KEY_BUSINESS_POLICIES, scopeId, []);
    const updated = [policy.toDTO(), ...local.filter((p) => p.id !== policy.id)];
    writeScoped(STORAGE_KEY_BUSINESS_POLICIES, updated, scopeId);

    try {
      const supabase = getSupabaseClient(scopeId);
      await supabase.from("expense_policies").upsert(policy.toDTO());
    } catch {
      // offline
    }

    return policy;
  }

  public async deleteExpensePolicy(policyId: string, orgId?: string): Promise<void> {
    deleteFromAllScopes<ExpensePolicyDTO>(STORAGE_KEY_BUSINESS_POLICIES, policyId, orgId);

    try {
      const supabase = getSupabaseClient(orgId);
      await supabase.from("expense_policies").delete().eq("id", policyId);
    } catch {
      // optional
    }
  }

  // Audit Events
  public async getBusinessAuditEvents(orgId: string): Promise<BusinessAuditEventEntity[]> {
    try {
      const supabase = getSupabaseClient(orgId);
      const { data, error } = await supabase
        .from("business_audit_events")
        .select("*")
        .eq("org_id", orgId)
        .order("timestamp", { ascending: false });

      if (!error && Array.isArray(data)) {
        writeScoped(STORAGE_KEY_BUSINESS_AUDIT, data as BusinessAuditEventDTO[], orgId);
        return (data as BusinessAuditEventDTO[]).map((dto) => BusinessAuditEventEntity.fromDTO(dto));
      }
    } catch {
      // offline
    }

    const local = readScoped<BusinessAuditEventDTO>(STORAGE_KEY_BUSINESS_AUDIT, orgId, []);
    return local.map((dto) => BusinessAuditEventEntity.fromDTO(dto));
  }

  public async recordBusinessAuditEvent(event: BusinessAuditEventEntity): Promise<BusinessAuditEventEntity> {
    const sanitizedDTO: BusinessAuditEventDTO = {
      ...event.toDTO(),
      details: redactSensitiveString(event.details || ""),
    };
    const sanitizedEntity = BusinessAuditEventEntity.fromDTO(sanitizedDTO);

    const scopeId = sanitizedEntity.orgId;
    const local = readScoped<BusinessAuditEventDTO>(STORAGE_KEY_BUSINESS_AUDIT, scopeId, []);
    const updated = [sanitizedDTO, ...local];
    writeScoped(STORAGE_KEY_BUSINESS_AUDIT, updated, scopeId);

    try {
      const supabase = getSupabaseClient(scopeId);
      await supabase.from("business_audit_events").upsert(sanitizedDTO);
    } catch {
      // offline
    }

    return sanitizedEntity;
  }
}
