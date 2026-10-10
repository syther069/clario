/**
 * Clean Architecture Facade: Multi-Mode Workspaces Storage & Services
 *
 * This module acts as an Anti-Corruption Layer and Facade providing 100% backward
 * compatibility for existing components while delegating all business logic, invariants,
 * and persistence to the Clean Architecture Domain Entities, Repositories, and Use Cases.
 */

import {
  container,
  IdentityScope,
  ClientEntity,
  InvoiceEntity,
  FamilyMemberEntity,
  FamilyBillEntity,
  FamilySettlementEntity,
  BusinessTeamMemberEntity,
  BusinessReimbursementEntity,
  ExpensePolicyEntity,
  BusinessAuditEventEntity,
  BudgetEntity,
  SubscriptionEntity,
} from "@/core";

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
// STORAGE KEYS & MULTI-TENANT SCOPING ADAPTER
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

export function normalizeIdentityKey(id?: string | null): string {
  return IdentityScope.normalize(id);
}

export function registerStorageScope(scopeId?: string): void {
  IdentityScope.register(scopeId);
}

export function getScopedStorageKey(baseKey: string, scopeId?: string): string {
  return IdentityScope.getScopedKey(baseKey, scopeId);
}

export function readScopedLocal<T>(
  baseKey: string,
  scopeId?: string,
  fallback: T[] = [],
): T[] {
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

export function writeScopedLocal<T>(
  baseKey: string,
  data: T[],
  scopeId?: string,
): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  if (scopeId) IdentityScope.register(scopeId);
  const scopedKey = IdentityScope.getScopedKey(baseKey, scopeId);

  try {
    localStorage.setItem(scopedKey, JSON.stringify(data));
  } catch (err) {
    console.warn(`Error writing to localStorage [${scopedKey}]:`, err);
  }
}

// ============================================================================
// FREELANCER MODE WORKFLOWS
// ============================================================================

export async function getClients(userId: string): Promise<Client[]> {
  const entities = await container.manageClientsUseCase.getClients(userId);
  return entities.map((e) => e.toDTO());
}

export async function saveClient(client: Client): Promise<Client> {
  const entity = ClientEntity.fromDTO(client);
  const saved = await container.manageClientsUseCase.saveClient(entity);
  return saved.toDTO();
}

export async function deleteClient(
  clientId: string,
  userId?: string,
): Promise<void> {
  await container.manageClientsUseCase.deleteClient(clientId, userId);
}

export async function getInvoices(userId: string): Promise<Invoice[]> {
  const entities = await container.manageInvoicesUseCase.getInvoices(userId);
  return entities.map((e) => e.toDTO());
}

export async function saveInvoice(invoice: Invoice): Promise<Invoice> {
  const entity = InvoiceEntity.fromDTO(invoice);
  const saved = await container.manageInvoicesUseCase.saveInvoice(entity);
  return saved.toDTO();
}

export async function deleteInvoice(
  invoiceId: string,
  userId?: string,
): Promise<void> {
  await container.manageInvoicesUseCase.deleteInvoice(invoiceId, userId);
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus,
  paymentDate?: string,
  userId?: string,
): Promise<void> {
  await container.manageInvoicesUseCase.updateInvoiceStatus(
    invoiceId,
    status,
    paymentDate,
    userId,
  );
}

// ============================================================================
// FAMILY MODE WORKFLOWS
// ============================================================================

export async function getFamilyMembers(householdId: string): Promise<FamilyMember[]> {
  const entities = await container.manageFamilyUseCase.getFamilyMembers(householdId);
  return entities.map((e) => e.toDTO());
}

export async function saveFamilyMember(member: FamilyMember): Promise<FamilyMember> {
  const entity = FamilyMemberEntity.fromDTO(member);
  const saved = await container.manageFamilyUseCase.saveFamilyMember(entity);
  return saved.toDTO();
}

export async function deleteFamilyMember(
  memberId: string,
  householdId?: string,
): Promise<void> {
  await container.manageFamilyUseCase.deleteFamilyMember(memberId, householdId);
}

export async function getFamilyBills(householdId: string): Promise<FamilyBill[]> {
  const entities = await container.manageFamilyUseCase.getFamilyBills(householdId);
  return entities.map((e) => e.toDTO());
}

export async function saveFamilyBill(bill: FamilyBill): Promise<FamilyBill> {
  const entity = FamilyBillEntity.fromDTO(bill);
  const saved = await container.manageFamilyUseCase.saveFamilyBill(entity);
  return saved.toDTO();
}

export async function deleteFamilyBill(
  billId: string,
  householdId?: string,
): Promise<void> {
  await container.manageFamilyUseCase.deleteFamilyBill(billId, householdId);
}

export async function updateFamilyBillStatus(
  billId: string,
  status: "unpaid" | "paid" | "overdue",
  paidByName?: string,
  householdId?: string,
): Promise<void> {
  await container.manageFamilyUseCase.updateFamilyBillStatus(
    billId,
    status,
    paidByName,
    householdId,
  );
}

export async function getFamilySettlements(householdId: string): Promise<FamilySettlement[]> {
  const entities = await container.manageFamilyUseCase.getFamilySettlements(householdId);
  return entities.map((e) => e.toDTO());
}

export async function saveFamilySettlement(
  settlement: FamilySettlement,
): Promise<FamilySettlement> {
  const entity = FamilySettlementEntity.fromDTO(settlement);
  const saved = await container.manageFamilyUseCase.saveFamilySettlement(entity);
  return saved.toDTO();
}

export async function deleteFamilySettlement(
  settlementId: string,
  householdId?: string,
): Promise<void> {
  await container.manageFamilyUseCase.deleteFamilySettlement(settlementId, householdId);
}

// ============================================================================
// BUSINESS MODE WORKFLOWS
// ============================================================================

export async function getBusinessTeam(orgId: string): Promise<BusinessTeamMember[]> {
  const entities = await container.manageBusinessUseCase.getBusinessTeam(orgId);
  return entities.map((e) => e.toDTO());
}

export async function saveBusinessTeamMember(
  member: BusinessTeamMember,
): Promise<BusinessTeamMember> {
  const entity = BusinessTeamMemberEntity.fromDTO(member);
  const saved = await container.manageBusinessUseCase.saveBusinessTeamMember(entity);
  return saved.toDTO();
}

export async function deleteBusinessTeamMember(
  memberId: string,
  orgId?: string,
): Promise<void> {
  await container.manageBusinessUseCase.deleteBusinessTeamMember(memberId, orgId);
}

export async function getBusinessReimbursements(orgId: string): Promise<BusinessReimbursement[]> {
  const entities = await container.manageBusinessUseCase.getBusinessReimbursements(orgId);
  return entities.map((e) => e.toDTO());
}

export async function saveBusinessReimbursement(
  claim: BusinessReimbursement,
): Promise<BusinessReimbursement> {
  const entity = BusinessReimbursementEntity.fromDTO(claim);
  const saved = await container.manageBusinessUseCase.saveBusinessReimbursement(entity);
  return saved.toDTO();
}

export async function updateReimbursementStatus(
  claimId: string,
  status: ReimbursementStatus,
  reviewerName?: string,
  reviewNotes?: string,
  monadTxHash?: string,
  orgId?: string,
): Promise<void> {
  await container.manageBusinessUseCase.updateReimbursementStatus(
    claimId,
    status,
    reviewerName,
    reviewNotes,
    monadTxHash,
    orgId,
  );
}

export async function deleteBusinessReimbursement(
  claimId: string,
  orgId?: string,
): Promise<void> {
  await container.manageBusinessUseCase.deleteBusinessReimbursement(claimId, orgId);
}

export async function getExpensePolicies(orgId: string): Promise<ExpensePolicy[]> {
  const entities = await container.manageBusinessUseCase.getExpensePolicies(orgId);
  return entities.map((e) => e.toDTO());
}

export async function saveExpensePolicy(policy: ExpensePolicy): Promise<ExpensePolicy> {
  const entity = ExpensePolicyEntity.fromDTO(policy);
  const saved = await container.manageBusinessUseCase.saveExpensePolicy(entity);
  return saved.toDTO();
}

export async function deleteExpensePolicy(
  policyId: string,
  orgId?: string,
): Promise<void> {
  await container.manageBusinessUseCase.deleteExpensePolicy(policyId, orgId);
}

export async function getBusinessAuditEvents(orgId: string): Promise<BusinessAuditEvent[]> {
  const entities = await container.manageBusinessUseCase.getBusinessAuditEvents(orgId);
  return entities.map((e) => e.toDTO());
}

export async function recordBusinessAuditEvent(
  event: BusinessAuditEvent,
): Promise<BusinessAuditEvent> {
  const entity = BusinessAuditEventEntity.fromDTO(event);
  const saved = await container.manageBusinessUseCase.recordBusinessAuditEvent(entity);
  return saved.toDTO();
}

// ============================================================================
// PERSONAL MODE: BUDGETS & SUBSCRIPTIONS WORKFLOWS
// ============================================================================

export function getStoredBudgets(scopeId?: string): Budget[] {
  const entities = container.managePersonalModeUseCase.getBudgets(scopeId);
  return entities.map((e) => e.toDTO());
}

export function saveStoredBudgets(budgets: Budget[], scopeId?: string): void {
  const entities = budgets.map((b) => BudgetEntity.fromDTO(b));
  container.managePersonalModeUseCase.saveBudgets(entities, scopeId);
}

export function getStoredSubscriptions(scopeId?: string): Subscription[] {
  const entities = container.managePersonalModeUseCase.getSubscriptions(scopeId);
  return entities.map((e) => e.toDTO());
}

export function saveStoredSubscriptions(
  subscriptions: Subscription[],
  scopeId?: string,
): void {
  const entities = subscriptions.map((s) => SubscriptionEntity.fromDTO(s));
  container.managePersonalModeUseCase.saveSubscriptions(entities, scopeId);
}
