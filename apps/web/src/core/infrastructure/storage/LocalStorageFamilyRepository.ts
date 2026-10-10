import type { IFamilyRepository } from "../../domain/family/ports/IFamilyRepository";
import { FamilyMemberEntity } from "../../domain/family/entities/FamilyMember";
import { FamilyBillEntity } from "../../domain/family/entities/FamilyBill";
import { FamilySettlementEntity } from "../../domain/family/entities/FamilySettlement";
import type {
  FamilyMember as FamilyMemberDTO,
  FamilyBill as FamilyBillDTO,
  FamilySettlement as FamilySettlementDTO,
} from "@/lib/supabase/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { IdentityScope } from "../../domain/common/IdentityScope";

export const STORAGE_KEY_FAMILY_MEMBERS = "clario_family_members";
export const STORAGE_KEY_FAMILY_BILLS = "clario_family_bills";
export const STORAGE_KEY_FAMILY_SETTLEMENTS = "clario_family_settlements";

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
 * LocalStorageFamilyRepository
 * Implements IFamilyRepository via Scoped LocalStorage + Supabase background synchronization.
 */
export class LocalStorageFamilyRepository implements IFamilyRepository {
  // Members
  public async getFamilyMembers(householdId: string): Promise<FamilyMemberEntity[]> {
    try {
      const supabase = getSupabaseClient(householdId);
      const { data, error } = await supabase
        .from("family_members")
        .select("*")
        .eq("household_id", householdId)
        .order("created_at", { ascending: true });

      if (!error && Array.isArray(data)) {
        writeScoped(STORAGE_KEY_FAMILY_MEMBERS, data as FamilyMemberDTO[], householdId);
        return (data as FamilyMemberDTO[]).map((dto) => FamilyMemberEntity.fromDTO(dto));
      }
    } catch {
      // offline
    }

    const local = readScoped<FamilyMemberDTO>(STORAGE_KEY_FAMILY_MEMBERS, householdId, []);
    return local.map((dto) => FamilyMemberEntity.fromDTO(dto));
  }

  public async saveFamilyMember(member: FamilyMemberEntity): Promise<FamilyMemberEntity> {
    const scopeId = member.householdId;
    const local = readScoped<FamilyMemberDTO>(STORAGE_KEY_FAMILY_MEMBERS, scopeId, []);
    const updated = [...local.filter((m) => m.id !== member.id), member.toDTO()];
    writeScoped(STORAGE_KEY_FAMILY_MEMBERS, updated, scopeId);

    try {
      const supabase = getSupabaseClient(scopeId);
      await supabase.from("family_members").upsert(member.toDTO());
    } catch {
      // offline
    }

    return member;
  }

  public async deleteFamilyMember(memberId: string, householdId?: string): Promise<void> {
    deleteFromAllScopes<FamilyMemberDTO>(STORAGE_KEY_FAMILY_MEMBERS, memberId, householdId);

    try {
      const supabase = getSupabaseClient(householdId);
      await supabase.from("family_members").delete().eq("id", memberId);
    } catch {
      // optional
    }
  }

  // Bills
  public async getFamilyBills(householdId: string): Promise<FamilyBillEntity[]> {
    try {
      const supabase = getSupabaseClient(householdId);
      const { data, error } = await supabase
        .from("family_bills")
        .select("*")
        .eq("household_id", householdId)
        .order("due_date", { ascending: true });

      if (!error && Array.isArray(data)) {
        writeScoped(STORAGE_KEY_FAMILY_BILLS, data as FamilyBillDTO[], householdId);
        return (data as FamilyBillDTO[]).map((dto) => FamilyBillEntity.fromDTO(dto));
      }
    } catch {
      // offline
    }

    const local = readScoped<FamilyBillDTO>(STORAGE_KEY_FAMILY_BILLS, householdId, []);
    return local.map((dto) => FamilyBillEntity.fromDTO(dto));
  }

  public async saveFamilyBill(bill: FamilyBillEntity): Promise<FamilyBillEntity> {
    const scopeId = bill.householdId;
    const local = readScoped<FamilyBillDTO>(STORAGE_KEY_FAMILY_BILLS, scopeId, []);
    const updated = [bill.toDTO(), ...local.filter((b) => b.id !== bill.id)];
    writeScoped(STORAGE_KEY_FAMILY_BILLS, updated, scopeId);

    try {
      const supabase = getSupabaseClient(scopeId);
      await supabase.from("family_bills").upsert(bill.toDTO());
    } catch {
      // offline
    }

    return bill;
  }

  public async deleteFamilyBill(billId: string, householdId?: string): Promise<void> {
    deleteFromAllScopes<FamilyBillDTO>(STORAGE_KEY_FAMILY_BILLS, billId, householdId);

    try {
      const supabase = getSupabaseClient(householdId);
      await supabase.from("family_bills").delete().eq("id", billId);
    } catch {
      // optional
    }
  }

  public async updateFamilyBillStatus(
    billId: string,
    status: "unpaid" | "paid" | "overdue",
    paidByName?: string,
    householdId?: string,
  ): Promise<void> {
    const scopesToUpdate = householdId ? [householdId] : [undefined, ...IdentityScope.getKnownScopes()];

    for (const scope of scopesToUpdate) {
      const local = readScoped<FamilyBillDTO>(STORAGE_KEY_FAMILY_BILLS, scope, []);
      const target = local.find((b) => b.id === billId);
      if (target) {
        target.status = status;
        if (paidByName) target.paid_by_name = paidByName;
        writeScoped(STORAGE_KEY_FAMILY_BILLS, local, scope);
      }
    }

    try {
      const supabase = getSupabaseClient(householdId);
      await supabase
        .from("family_bills")
        .update({ status, paid_by_name: paidByName || null })
        .eq("id", billId);
    } catch {
      // optional
    }
  }

  // Settlements
  public async getFamilySettlements(householdId: string): Promise<FamilySettlementEntity[]> {
    try {
      const supabase = getSupabaseClient(householdId);
      const { data, error } = await supabase
        .from("family_settlements")
        .select("*")
        .eq("household_id", householdId)
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        writeScoped(STORAGE_KEY_FAMILY_SETTLEMENTS, data as FamilySettlementDTO[], householdId);
        return (data as FamilySettlementDTO[]).map((dto) => FamilySettlementEntity.fromDTO(dto));
      }
    } catch {
      // offline
    }

    const local = readScoped<FamilySettlementDTO>(STORAGE_KEY_FAMILY_SETTLEMENTS, householdId, []);
    return local.map((dto) => FamilySettlementEntity.fromDTO(dto));
  }

  public async saveFamilySettlement(settlement: FamilySettlementEntity): Promise<FamilySettlementEntity> {
    const scopeId = settlement.householdId;
    const local = readScoped<FamilySettlementDTO>(STORAGE_KEY_FAMILY_SETTLEMENTS, scopeId, []);
    const updated = [settlement.toDTO(), ...local.filter((s) => s.id !== settlement.id)];
    writeScoped(STORAGE_KEY_FAMILY_SETTLEMENTS, updated, scopeId);

    try {
      const supabase = getSupabaseClient(scopeId);
      await supabase.from("family_settlements").upsert(settlement.toDTO());
    } catch {
      // offline
    }

    return settlement;
  }

  public async deleteFamilySettlement(settlementId: string, householdId?: string): Promise<void> {
    deleteFromAllScopes<FamilySettlementDTO>(STORAGE_KEY_FAMILY_SETTLEMENTS, settlementId, householdId);

    try {
      const supabase = getSupabaseClient(householdId);
      await supabase.from("family_settlements").delete().eq("id", settlementId);
    } catch {
      // optional
    }
  }
}
