import { getSupabaseClient } from "@/lib/supabase/client";
import { redactSensitiveString } from "@/lib/security/audit-logger";
import type {
  Client,
  Invoice,
  FamilyMember,
  FamilyBill,
  FamilySettlement,
  BusinessTeamMember,
  BusinessReimbursement,
  ExpensePolicy,
  BusinessAuditEvent,
  InvoiceStatus,
  ReimbursementStatus,
  Budget,
  Subscription,
} from "@/lib/supabase/types";

// ============================================================================
// LOCAL STORAGE KEYS
// ============================================================================
// ============================================================================
// LOCAL STORAGE KEYS & SCOPING
// ============================================================================
export const STORAGE_KEYS = {
  CLIENTS: "clario_freelancer_clients",
  INVOICES: "clario_freelancer_invoices",
  FAMILY_MEMBERS: "clario_family_members",
  FAMILY_BILLS: "clario_family_bills",
  FAMILY_SETTLEMENTS: "clario_family_settlements",
  BUSINESS_TEAM: "clario_business_team",
  BUSINESS_REIMBURSEMENTS: "clario_business_reimbursements",
  BUSINESS_POLICIES: "clario_business_policies",
  BUSINESS_AUDIT: "clario_business_audit_events",
  BUDGETS: "clario_personal_budgets",
  SUBSCRIPTIONS: "clario_personal_subscriptions",
};

const knownScopes = new Set<string>();

/**
 * Uniformly normalizes user identifiers across all modes and storage layers,
 * handling EVM 0x addresses, Privy DIDs, and local IDs with case-insensitivity.
 */
export function normalizeIdentityKey(id?: string | null): string {
  if (!id || typeof id !== "string") return "";
  return id.trim().toLowerCase();
}

export function registerStorageScope(scopeId?: string): void {
  if (scopeId && scopeId.trim()) {
    knownScopes.add(normalizeIdentityKey(scopeId));
  }
}

export function getScopedStorageKey(baseKey: string, scopeId?: string): string {
  if (!scopeId || !scopeId.trim()) return baseKey;
  const normalized = normalizeIdentityKey(scopeId);
  registerStorageScope(normalized);
  return `${normalized}_${baseKey}`;
}

function readLocal<T>(key: string, fallback: T[]): T[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, data: T[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`Error caching to localStorage [${key}]:`, e);
  }
}

export function readScopedLocal<T>(
  baseKey: string,
  scopeId?: string,
  fallback: T[] = [],
): T[] {
  if (typeof window === "undefined") return fallback;
  if (scopeId) registerStorageScope(scopeId);
  const scopedKey = getScopedStorageKey(baseKey, scopeId);
  const scopedData = readLocal<T>(scopedKey, null as unknown as T[]);
  if (scopedData !== null && scopedData !== undefined) {
    return scopedData;
  }
  // Check unscoped/legacy key for backwards compatibility if scopeId was not present previously
  if (scopedKey !== baseKey) {
    const legacyData = readLocal<T>(baseKey, null as unknown as T[]);
    if (legacyData !== null && legacyData !== undefined) {
      return legacyData;
    }
  }
  return fallback;
}

export function writeScopedLocal<T>(
  baseKey: string,
  data: T[],
  scopeId?: string,
): void {
  if (scopeId) registerStorageScope(scopeId);
  const scopedKey = getScopedStorageKey(baseKey, scopeId);
  writeLocal(scopedKey, data);
}

function deleteFromScopes<T extends { id: string }>(
  baseKey: string,
  itemId: string,
  scopeId?: string,
): void {
  if (scopeId) {
    const list = readScopedLocal<T>(baseKey, scopeId, []);
    writeScopedLocal(
      baseKey,
      list.filter((item) => item.id !== itemId),
      scopeId,
    );
    return;
  }
  // If no scopeId is provided, remove from unscoped key
  const unscoped = readLocal<T>(baseKey, []);
  if (unscoped.length > 0) {
    writeLocal(
      baseKey,
      unscoped.filter((item) => item.id !== itemId),
    );
  }
  // Clean up across all active/known scopes
  for (const scope of knownScopes) {
    const list = readScopedLocal<T>(baseKey, scope, []);
    if (list.some((item) => item.id === itemId)) {
      writeScopedLocal(
        baseKey,
        list.filter((item) => item.id !== itemId),
        scope,
      );
    }
  }
  // Also clean up across any matching scoped keys in localStorage
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      if (typeof localStorage.length === "number") {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k === baseKey || k.endsWith(`_${baseKey}`))) {
            const raw = localStorage.getItem(k);
            if (raw) {
              const parsed = JSON.parse(raw) as T[];
              if (
                Array.isArray(parsed) &&
                parsed.some((item) => item.id === itemId)
              ) {
                localStorage.setItem(
                  k,
                  JSON.stringify(parsed.filter((item) => item.id !== itemId)),
                );
              }
            }
          }
        }
      }
    } catch {
      // ignore storage scan errors
    }
  }
}

// ============================================================================
// FREELANCER: CLIENTS
// ============================================================================
export async function getClients(userId: string): Promise<Client[]> {
  try {
    const supabase = getSupabaseClient(userId);
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    // FIX-P1-01: If Supabase succeeded and returned an array (even if empty []),
    // that is the authoritative state for this user. Update scoped local cache and return it.
    if (!error && Array.isArray(data)) {
      writeScopedLocal(STORAGE_KEYS.CLIENTS, data as Client[], userId);
      return data as Client[];
    }
  } catch {
    // network or client exception: fallback to user-scoped local storage
  }
  return readScopedLocal<Client>(STORAGE_KEYS.CLIENTS, userId, []);
}

export async function saveClient(client: Client): Promise<Client> {
  const scopeId = client.user_id;
  const localList = readScopedLocal<Client>(STORAGE_KEYS.CLIENTS, scopeId, []);
  const updated = [client, ...localList.filter((c) => c.id !== client.id)];
  writeScopedLocal(STORAGE_KEYS.CLIENTS, updated, scopeId);

  try {
    const supabase = getSupabaseClient(scopeId);
    await supabase.from("clients").upsert(client);
  } catch {
    // Supabase optional in offline/demo mode
  }
  return client;
}

export async function deleteClient(
  clientId: string,
  userId?: string,
): Promise<void> {
  deleteFromScopes<Client>(STORAGE_KEYS.CLIENTS, clientId, userId);

  try {
    const supabase = getSupabaseClient(userId);
    await supabase.from("clients").delete().eq("id", clientId);
  } catch {
    // Supabase optional
  }
}

// ============================================================================
// FREELANCER: INVOICES
// ============================================================================
export async function getInvoices(userId: string): Promise<Invoice[]> {
  try {
    const supabase = getSupabaseClient(userId);
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      writeScopedLocal(STORAGE_KEYS.INVOICES, data as Invoice[], userId);
      return data as Invoice[];
    }
  } catch {
    // fallback to user-scoped local storage
  }
  return readScopedLocal<Invoice>(STORAGE_KEYS.INVOICES, userId, []);
}

export async function saveInvoice(invoice: Invoice): Promise<Invoice> {
  const scopeId = invoice.user_id;
  const localList = readScopedLocal<Invoice>(
    STORAGE_KEYS.INVOICES,
    scopeId,
    [],
  );
  const updated = [invoice, ...localList.filter((i) => i.id !== invoice.id)];
  writeScopedLocal(STORAGE_KEYS.INVOICES, updated, scopeId);

  try {
    const supabase = getSupabaseClient(scopeId);
    await supabase.from("invoices").upsert(invoice);
  } catch {
    // Supabase optional in offline/demo mode
  }
  return invoice;
}

export async function deleteInvoice(
  invoiceId: string,
  userId?: string,
): Promise<void> {
  deleteFromScopes<Invoice>(STORAGE_KEYS.INVOICES, invoiceId, userId);

  try {
    const supabase = getSupabaseClient(userId);
    await supabase.from("invoices").delete().eq("id", invoiceId);
  } catch {
    // Supabase optional
  }
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus,
  paymentDate?: string,
  userId?: string,
): Promise<void> {
  const scopesToUpdate = userId ? [userId] : [undefined, ...knownScopes];
  for (const scope of scopesToUpdate) {
    const localList = readScopedLocal<Invoice>(
      STORAGE_KEYS.INVOICES,
      scope,
      [],
    );
    const target = localList.find((i) => i.id === invoiceId);
    if (target) {
      target.status = status;
      if (paymentDate) target.payment_received_date = paymentDate;
      target.updated_at = new Date().toISOString();
      writeScopedLocal(STORAGE_KEYS.INVOICES, localList, scope);
    }
  }

  try {
    const supabase = getSupabaseClient(userId);
    await supabase
      .from("invoices")
      .update({
        status,
        payment_received_date: paymentDate || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);
  } catch {
    // Supabase optional
  }
}

// ============================================================================
// FAMILY: MEMBERS & ROLES
// ============================================================================
export async function getFamilyMembers(
  householdId: string,
): Promise<FamilyMember[]> {
  try {
    const supabase = getSupabaseClient(householdId);
    const { data, error } = await supabase
      .from("family_members")
      .select("*")
      .eq("household_id", householdId)
      .order("created_at", { ascending: true });

    if (!error && Array.isArray(data)) {
      writeScopedLocal(
        STORAGE_KEYS.FAMILY_MEMBERS,
        data as FamilyMember[],
        householdId,
      );
      return data as FamilyMember[];
    }
  } catch {
    // fallback
  }
  return readScopedLocal<FamilyMember>(
    STORAGE_KEYS.FAMILY_MEMBERS,
    householdId,
    [],
  );
}

export async function saveFamilyMember(
  member: FamilyMember,
): Promise<FamilyMember> {
  const scopeId = member.household_id;
  const localList = readScopedLocal<FamilyMember>(
    STORAGE_KEYS.FAMILY_MEMBERS,
    scopeId,
    [],
  );
  const updated = [...localList.filter((m) => m.id !== member.id), member];
  writeScopedLocal(STORAGE_KEYS.FAMILY_MEMBERS, updated, scopeId);

  try {
    const supabase = getSupabaseClient(scopeId);
    await supabase.from("family_members").upsert(member);
  } catch {
    // Supabase optional
  }
  return member;
}

export async function deleteFamilyMember(
  memberId: string,
  householdId?: string,
): Promise<void> {
  deleteFromScopes<FamilyMember>(
    STORAGE_KEYS.FAMILY_MEMBERS,
    memberId,
    householdId,
  );

  try {
    const supabase = getSupabaseClient(householdId);
    await supabase.from("family_members").delete().eq("id", memberId);
  } catch {
    // Supabase optional
  }
}

// ============================================================================
// FAMILY: BILLS
// ============================================================================
export async function getFamilyBills(
  householdId: string,
): Promise<FamilyBill[]> {
  try {
    const supabase = getSupabaseClient(householdId);
    const { data, error } = await supabase
      .from("family_bills")
      .select("*")
      .eq("household_id", householdId)
      .order("due_date", { ascending: true });

    if (!error && Array.isArray(data)) {
      writeScopedLocal(
        STORAGE_KEYS.FAMILY_BILLS,
        data as FamilyBill[],
        householdId,
      );
      return data as FamilyBill[];
    }
  } catch {
    // fallback
  }
  return readScopedLocal<FamilyBill>(
    STORAGE_KEYS.FAMILY_BILLS,
    householdId,
    [],
  );
}

export async function saveFamilyBill(bill: FamilyBill): Promise<FamilyBill> {
  const scopeId = bill.household_id;
  const localList = readScopedLocal<FamilyBill>(
    STORAGE_KEYS.FAMILY_BILLS,
    scopeId,
    [],
  );
  const updated = [bill, ...localList.filter((b) => b.id !== bill.id)];
  writeScopedLocal(STORAGE_KEYS.FAMILY_BILLS, updated, scopeId);

  try {
    const supabase = getSupabaseClient(scopeId);
    await supabase.from("family_bills").upsert(bill);
  } catch {
    // Supabase optional
  }
  return bill;
}

export async function deleteFamilyBill(
  billId: string,
  householdId?: string,
): Promise<void> {
  deleteFromScopes<FamilyBill>(STORAGE_KEYS.FAMILY_BILLS, billId, householdId);

  try {
    const supabase = getSupabaseClient(householdId);
    await supabase.from("family_bills").delete().eq("id", billId);
  } catch {
    // Supabase optional
  }
}

export async function updateFamilyBillStatus(
  billId: string,
  status: "unpaid" | "paid" | "overdue",
  paidByName?: string,
  householdId?: string,
): Promise<void> {
  const scopesToUpdate = householdId
    ? [householdId]
    : [undefined, ...knownScopes];
  for (const scope of scopesToUpdate) {
    const localList = readScopedLocal<FamilyBill>(
      STORAGE_KEYS.FAMILY_BILLS,
      scope,
      [],
    );
    const target = localList.find((b) => b.id === billId);
    if (target) {
      target.status = status;
      if (paidByName) target.paid_by_name = paidByName;
      writeScopedLocal(STORAGE_KEYS.FAMILY_BILLS, localList, scope);
    }
  }

  try {
    const supabase = getSupabaseClient(householdId);
    await supabase
      .from("family_bills")
      .update({ status, paid_by_name: paidByName || null })
      .eq("id", billId);
  } catch {
    // Supabase optional
  }
}

// ============================================================================
// FAMILY: SETTLEMENTS
// ============================================================================
export async function getFamilySettlements(
  householdId: string,
): Promise<FamilySettlement[]> {
  try {
    const supabase = getSupabaseClient(householdId);
    const { data, error } = await supabase
      .from("family_settlements")
      .select("*")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      writeScopedLocal(
        STORAGE_KEYS.FAMILY_SETTLEMENTS,
        data as FamilySettlement[],
        householdId,
      );
      return data as FamilySettlement[];
    }
  } catch {
    // fallback
  }
  return readScopedLocal<FamilySettlement>(
    STORAGE_KEYS.FAMILY_SETTLEMENTS,
    householdId,
    [],
  );
}

export async function saveFamilySettlement(
  settlement: FamilySettlement,
): Promise<FamilySettlement> {
  const scopeId = settlement.household_id;
  const localList = readScopedLocal<FamilySettlement>(
    STORAGE_KEYS.FAMILY_SETTLEMENTS,
    scopeId,
    [],
  );
  const updated = [
    settlement,
    ...localList.filter((s) => s.id !== settlement.id),
  ];
  writeScopedLocal(STORAGE_KEYS.FAMILY_SETTLEMENTS, updated, scopeId);

  try {
    const supabase = getSupabaseClient(scopeId);
    await supabase.from("family_settlements").upsert(settlement);
  } catch {
    // Supabase optional
  }
  return settlement;
}

export async function deleteFamilySettlement(
  settlementId: string,
  householdId?: string,
): Promise<void> {
  deleteFromScopes<FamilySettlement>(
    STORAGE_KEYS.FAMILY_SETTLEMENTS,
    settlementId,
    householdId,
  );

  try {
    const supabase = getSupabaseClient(householdId);
    await supabase.from("family_settlements").delete().eq("id", settlementId);
  } catch {
    // Supabase optional
  }
}

// ============================================================================
// BUSINESS: TEAM & ROLES
// ============================================================================
export async function getBusinessTeam(
  orgId: string,
): Promise<BusinessTeamMember[]> {
  try {
    const supabase = getSupabaseClient(orgId);
    const { data, error } = await supabase
      .from("business_team_members")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });

    if (!error && Array.isArray(data)) {
      writeScopedLocal(
        STORAGE_KEYS.BUSINESS_TEAM,
        data as BusinessTeamMember[],
        orgId,
      );
      return data as BusinessTeamMember[];
    }
  } catch {
    // fallback
  }
  return readScopedLocal<BusinessTeamMember>(
    STORAGE_KEYS.BUSINESS_TEAM,
    orgId,
    [],
  );
}

export async function saveBusinessTeamMember(
  member: BusinessTeamMember,
): Promise<BusinessTeamMember> {
  const scopeId = member.org_id;
  const localList = readScopedLocal<BusinessTeamMember>(
    STORAGE_KEYS.BUSINESS_TEAM,
    scopeId,
    [],
  );
  const updated = [...localList.filter((m) => m.id !== member.id), member];
  writeScopedLocal(STORAGE_KEYS.BUSINESS_TEAM, updated, scopeId);

  try {
    const supabase = getSupabaseClient(scopeId);
    await supabase.from("business_team_members").upsert(member);
  } catch {
    // Supabase optional
  }
  return member;
}

export async function deleteBusinessTeamMember(
  memberId: string,
  orgId?: string,
): Promise<void> {
  deleteFromScopes<BusinessTeamMember>(
    STORAGE_KEYS.BUSINESS_TEAM,
    memberId,
    orgId,
  );

  try {
    const supabase = getSupabaseClient(orgId);
    await supabase.from("business_team_members").delete().eq("id", memberId);
  } catch {
    // Supabase optional
  }
}

// ============================================================================
// BUSINESS: REIMBURSEMENTS
// ============================================================================
export async function getBusinessReimbursements(
  orgId: string,
): Promise<BusinessReimbursement[]> {
  try {
    const supabase = getSupabaseClient(orgId);
    const { data, error } = await supabase
      .from("business_reimbursements")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      writeScopedLocal(
        STORAGE_KEYS.BUSINESS_REIMBURSEMENTS,
        data as BusinessReimbursement[],
        orgId,
      );
      return data as BusinessReimbursement[];
    }
  } catch {
    // fallback
  }
  return readScopedLocal<BusinessReimbursement>(
    STORAGE_KEYS.BUSINESS_REIMBURSEMENTS,
    orgId,
    [],
  );
}

export async function saveBusinessReimbursement(
  claim: BusinessReimbursement,
): Promise<BusinessReimbursement> {
  const scopeId = claim.org_id;
  const localList = readScopedLocal<BusinessReimbursement>(
    STORAGE_KEYS.BUSINESS_REIMBURSEMENTS,
    scopeId,
    [],
  );
  const updated = [claim, ...localList.filter((c) => c.id !== claim.id)];
  writeScopedLocal(STORAGE_KEYS.BUSINESS_REIMBURSEMENTS, updated, scopeId);

  try {
    const supabase = getSupabaseClient(scopeId);
    await supabase.from("business_reimbursements").upsert(claim);
  } catch {
    // Supabase optional
  }
  return claim;
}

export async function updateReimbursementStatus(
  claimId: string,
  status: ReimbursementStatus,
  reviewerName?: string,
  reviewNotes?: string,
  monadTxHash?: string,
  orgId?: string,
): Promise<void> {
  const scopesToUpdate = orgId ? [orgId] : [undefined, ...knownScopes];
  for (const scope of scopesToUpdate) {
    const localList = readScopedLocal<BusinessReimbursement>(
      STORAGE_KEYS.BUSINESS_REIMBURSEMENTS,
      scope,
      [],
    );
    const target = localList.find((c) => c.id === claimId);
    if (target) {
      target.status = status;
      if (reviewerName) target.reviewed_by = reviewerName;
      if (reviewNotes) target.review_notes = reviewNotes;
      if (monadTxHash) target.monad_tx_hash = monadTxHash;
      if (status === "approved") target.approved_at = new Date().toISOString();
      if (status === "paid") target.paid_at = new Date().toISOString();
      writeScopedLocal(STORAGE_KEYS.BUSINESS_REIMBURSEMENTS, localList, scope);
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
        approved_at:
          status === "approved" ? new Date().toISOString() : undefined,
        paid_at: status === "paid" ? new Date().toISOString() : undefined,
      })
      .eq("id", claimId);
  } catch {
    // Supabase optional
  }
}

export async function deleteBusinessReimbursement(
  claimId: string,
  orgId?: string,
): Promise<void> {
  deleteFromScopes<BusinessReimbursement>(
    STORAGE_KEYS.BUSINESS_REIMBURSEMENTS,
    claimId,
    orgId,
  );

  try {
    const supabase = getSupabaseClient(orgId);
    await supabase.from("business_reimbursements").delete().eq("id", claimId);
  } catch {
    // Supabase optional
  }
}

// ============================================================================
// BUSINESS: EXPENSE POLICIES
// ============================================================================
export async function getExpensePolicies(
  orgId: string,
): Promise<ExpensePolicy[]> {
  try {
    const supabase = getSupabaseClient(orgId);
    const { data, error } = await supabase
      .from("expense_policies")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      writeScopedLocal(
        STORAGE_KEYS.BUSINESS_POLICIES,
        data as ExpensePolicy[],
        orgId,
      );
      return data as ExpensePolicy[];
    }
  } catch {
    // fallback
  }
  return readScopedLocal<ExpensePolicy>(
    STORAGE_KEYS.BUSINESS_POLICIES,
    orgId,
    [],
  );
}

export async function saveExpensePolicy(
  policy: ExpensePolicy,
): Promise<ExpensePolicy> {
  const scopeId = policy.org_id;
  const localList = readScopedLocal<ExpensePolicy>(
    STORAGE_KEYS.BUSINESS_POLICIES,
    scopeId,
    [],
  );
  const updated = [policy, ...localList.filter((p) => p.id !== policy.id)];
  writeScopedLocal(STORAGE_KEYS.BUSINESS_POLICIES, updated, scopeId);

  try {
    const supabase = getSupabaseClient(scopeId);
    await supabase.from("expense_policies").upsert(policy);
  } catch {
    // Supabase optional
  }
  return policy;
}

export async function deleteExpensePolicy(
  policyId: string,
  orgId?: string,
): Promise<void> {
  deleteFromScopes<ExpensePolicy>(
    STORAGE_KEYS.BUSINESS_POLICIES,
    policyId,
    orgId,
  );

  try {
    const supabase = getSupabaseClient(orgId);
    await supabase.from("expense_policies").delete().eq("id", policyId);
  } catch {
    // Supabase optional
  }
}

// ============================================================================
// BUSINESS: AUDIT LOG
// ============================================================================
export async function getBusinessAuditEvents(
  orgId: string,
): Promise<BusinessAuditEvent[]> {
  try {
    const supabase = getSupabaseClient(orgId);
    const { data, error } = await supabase
      .from("business_audit_events")
      .select("*")
      .eq("org_id", orgId)
      .order("timestamp", { ascending: false });

    if (!error && Array.isArray(data)) {
      writeScopedLocal(
        STORAGE_KEYS.BUSINESS_AUDIT,
        data as BusinessAuditEvent[],
        orgId,
      );
      return data as BusinessAuditEvent[];
    }
  } catch {
    // fallback
  }
  return readScopedLocal<BusinessAuditEvent>(
    STORAGE_KEYS.BUSINESS_AUDIT,
    orgId,
    [],
  );
}

export async function recordBusinessAuditEvent(
  event: BusinessAuditEvent,
): Promise<BusinessAuditEvent> {
  const sanitizedEvent: BusinessAuditEvent = {
    ...event,
    details: redactSensitiveString(event.details || ""),
  };
  const scopeId = sanitizedEvent.org_id;
  const localList = readScopedLocal<BusinessAuditEvent>(
    STORAGE_KEYS.BUSINESS_AUDIT,
    scopeId,
    [],
  );
  const updated = [sanitizedEvent, ...localList];
  writeScopedLocal(STORAGE_KEYS.BUSINESS_AUDIT, updated, scopeId);

  try {
    const supabase = getSupabaseClient(scopeId);
    await supabase.from("business_audit_events").upsert(sanitizedEvent);
  } catch {
    // Supabase optional
  }
  return sanitizedEvent;
}

// ============================================================================
// PERSONAL MODE: BUDGETS & SUBSCRIPTIONS PERSISTENCE
// ============================================================================

export function getStoredBudgets(scopeId?: string): Budget[] {
  return readScopedLocal<Budget>(STORAGE_KEYS.BUDGETS, scopeId, []);
}

export function saveStoredBudgets(budgets: Budget[], scopeId?: string): void {
  writeScopedLocal<Budget>(STORAGE_KEYS.BUDGETS, budgets, scopeId);
}

export function getStoredSubscriptions(scopeId?: string): Subscription[] {
  return readScopedLocal<Subscription>(STORAGE_KEYS.SUBSCRIPTIONS, scopeId, []);
}

export function saveStoredSubscriptions(
  subscriptions: Subscription[],
  scopeId?: string,
): void {
  writeScopedLocal<Subscription>(
    STORAGE_KEYS.SUBSCRIPTIONS,
    subscriptions,
    scopeId,
  );
}

