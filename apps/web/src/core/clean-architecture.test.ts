import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
      upsert: () => Promise.resolve({ error: null }),
      delete: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
  }),
}));
import {
  container,
  IdentityScope,
  ClientEntity,
  InvoiceEntity,
  FamilyBillEntity,
  FamilySettlementEntity,
  BusinessReimbursementEntity,
  ExpensePolicyEntity,
  BusinessAuditEventEntity,
  BudgetEntity,
  SubscriptionEntity,
  EVENT_CLIENTS_UPDATED,
  EVENT_FAMILY_UPDATED,
  EVENT_BUSINESS_UPDATED,
  EVENT_PERSONAL_MODE_UPDATED,
} from "./index";

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const key in store) delete store[key];
  },
  length: 0,
  key: () => null,
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

Object.defineProperty(globalThis, "window", {
  value: {
    localStorage: localStorageMock,
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  },
  writable: true,
  configurable: true,
});

describe("Clean Architecture: Multi-Domain Entities, Use Cases & IoC Container", () => {
  beforeEach(() => {
    localStorageMock.clear();
    IdentityScope.clearKnownScopes();
  });

  describe("Domain Value Objects: IdentityScope", () => {
    it("normalizes addresses and keys with case-insensitivity", () => {
      expect(IdentityScope.normalize("0xAbCd1234")).toBe("0xabcd1234");
      expect(IdentityScope.normalize("  User-ABC  ")).toBe("user-abc");
      expect(IdentityScope.normalize(null)).toBe("");
    });

    it("registers scopes and derives tenant keys cleanly", () => {
      const scopedKey = IdentityScope.getScopedKey("clario_test", "0xOwner");
      expect(scopedKey).toBe("0xowner_clario_test");
      expect(IdentityScope.getKnownScopes()).toContain("0xowner");
    });
  });

  describe("Freelancer Domain: Entities & Use Cases", () => {
    it("validates ClientEntity invariants and DTO conversion", () => {
      const client = new ClientEntity({
        id: "cli-1",
        userId: "0xFreelancer",
        name: "Acme Web3 Labs",
        company: "Acme Corp",
        hourlyRate: 175,
        status: "active",
      });

      expect(client.id).toBe("cli-1");
      expect(client.userId).toBe("0xfreelancer");
      expect(client.hourlyRate).toBe(175);

      const dto = client.toDTO();
      expect(dto.name).toBe("Acme Web3 Labs");
      expect(dto.hourly_rate).toBe(175);

      const fromDto = ClientEntity.fromDTO(dto);
      expect(fromDto.id).toBe(client.id);
      expect(fromDto.name).toBe(client.name);
    });

    it("calculates InvoiceEntity subtotal, tax amount, and due status", () => {
      const invoice = new InvoiceEntity({
        id: "inv-1",
        userId: "0xFreelancer",
        invoiceNumber: "INV-2026-001",
        clientName: "Acme Web3 Labs",
        items: [
          { id: "item-1", description: "Smart Contract Audit", quantity: 1, rate: 3000, amount: 3000 },
          { id: "item-2", description: "Architecture Refactoring", quantity: 10, rate: 200, amount: 2000 },
        ],
        taxRate: 10,
        issueDate: "2026-10-01",
        dueDate: "2026-10-15",
      });

      expect(invoice.subtotal).toBe(5000);
      expect(invoice.taxAmount).toBe(500);
      expect(invoice.totalAmount).toBe(5500);
      expect(invoice.isPaid()).toBe(false);

      const dto = invoice.toDTO();
      expect(dto.total_amount).toBe(5500);
      expect(dto.invoice_number).toBe("INV-2026-001");
    });

    it("executes ManageClientsUseCase and dispatches domain event", async () => {
      let eventFired = false;
      container.eventBus.subscribe(EVENT_CLIENTS_UPDATED, () => {
        eventFired = true;
      });

      const client = new ClientEntity({
        id: "cli-event-1",
        userId: "0xFreelancerA",
        name: "Monad Ventures",
      });

      const saved = await container.manageClientsUseCase.saveClient(client);
      expect(saved.name).toBe("Monad Ventures");
      expect(eventFired).toBe(true);

      const list = await container.manageClientsUseCase.getClients("0xFreelancerA");
      expect(list.length).toBe(1);
      expect(list[0]?.id).toBe("cli-event-1");
    });
  });

  describe("Family Domain: Entities & Use Cases", () => {
    it("validates FamilyBillEntity and updates status", async () => {
      let eventFired = false;
      container.eventBus.subscribe(EVENT_FAMILY_UPDATED, () => {
        eventFired = true;
      });

      const bill = new FamilyBillEntity({
        id: "bill-domain-1",
        householdId: "hh-clean-1",
        name: "Fiber Internet",
        amount: 90,
        category: "utilities",
        dueDate: "2026-10-25",
        status: "unpaid",
      });

      await container.manageFamilyUseCase.saveFamilyBill(bill);
      expect(eventFired).toBe(true);

      let bills = await container.manageFamilyUseCase.getFamilyBills("hh-clean-1");
      expect(bills).toHaveLength(1);
      expect(bills[0]?.name).toBe("Fiber Internet");
      expect(bills[0]?.status).toBe("unpaid");

      await container.manageFamilyUseCase.updateFamilyBillStatus(
        "bill-domain-1",
        "paid",
        "Alice",
        "hh-clean-1",
      );

      bills = await container.manageFamilyUseCase.getFamilyBills("hh-clean-1");
      expect(bills[0]?.status).toBe("paid");
      expect(bills[0]?.paidByName).toBe("Alice");
    });

    it("records and deletes FamilySettlementEntity", async () => {
      const settlement = new FamilySettlementEntity({
        id: "settle-clean-1",
        householdId: "hh-clean-1",
        fromMemberId: "m1",
        fromMemberName: "Bob",
        toMemberId: "m2",
        toMemberName: "Alice",
        amount: 45,
      });

      await container.manageFamilyUseCase.saveFamilySettlement(settlement);
      let settlements = await container.manageFamilyUseCase.getFamilySettlements("hh-clean-1");
      expect(settlements).toHaveLength(1);
      expect(settlements[0]?.amount).toBe(45);

      await container.manageFamilyUseCase.deleteFamilySettlement("settle-clean-1", "hh-clean-1");
      settlements = await container.manageFamilyUseCase.getFamilySettlements("hh-clean-1");
      expect(settlements).toHaveLength(0);
    });
  });

  describe("Business Domain: Entities & Use Cases", () => {
    it("validates BusinessReimbursementEntity and updates review lifecycle", async () => {
      let eventFired = false;
      container.eventBus.subscribe(EVENT_BUSINESS_UPDATED, () => {
        eventFired = true;
      });

      const claim = new BusinessReimbursementEntity({
        id: "reimb-clean-1",
        orgId: "org-clean-1",
        employeeId: "emp-1",
        employeeName: "Carol Engineer",
        title: "Conference Travel Ticket",
        amount: 650,
        currency: "USD",
        category: "travel",
        department: "Engineering",
        status: "submitted",
      });

      await container.manageBusinessUseCase.saveBusinessReimbursement(claim);
      expect(eventFired).toBe(true);

      let list = await container.manageBusinessUseCase.getBusinessReimbursements("org-clean-1");
      expect(list).toHaveLength(1);
      expect(list[0]?.status).toBe("submitted");

      await container.manageBusinessUseCase.updateReimbursementStatus(
        "reimb-clean-1",
        "approved",
        "Lead Architect",
        "Approved for Monad Summit",
        "0xmonadtxhash123",
        "org-clean-1",
      );

      list = await container.manageBusinessUseCase.getBusinessReimbursements("org-clean-1");
      expect(list[0]?.status).toBe("approved");
      expect(list[0]?.reviewedBy).toBe("Lead Architect");
      expect(list[0]?.monadTxHash).toBe("0xmonadtxhash123");
    });

    it("governs spending with ExpensePolicyEntity and logs sanitized audit events", async () => {
      const policy = new ExpensePolicyEntity({
        id: "pol-1",
        orgId: "org-clean-1",
        name: "Standard Dev Policy",
        maxSingleAmount: 1500,
        requiresApprovalAbove: 250,
      });

      await container.manageBusinessUseCase.saveExpensePolicy(policy);
      const policies = await container.manageBusinessUseCase.getExpensePolicies("org-clean-1");
      expect(policies).toHaveLength(1);
      expect(policies[0]?.requiresApprovalAbove).toBe(250);

      const audit = new BusinessAuditEventEntity({
        id: "aud-1",
        orgId: "org-clean-1",
        actorName: "SecurityBot",
        action: "POLICY_ENFORCED",
        entityType: "ExpensePolicy",
        entityId: "pol-1",
        details: "Policy applied to transaction",
      });

      const recorded = await container.manageBusinessUseCase.recordBusinessAuditEvent(audit);
      expect(recorded.actorName).toBe("SecurityBot");

      const auditTrail = await container.manageBusinessUseCase.getBusinessAuditEvents("org-clean-1");
      expect(auditTrail).toHaveLength(1);
      expect(auditTrail[0]?.action).toBe("POLICY_ENFORCED");
    });
  });

  describe("Personal Domain: Entities & Use Cases", () => {
    it("persists Budgets and Subscriptions via ManagePersonalModeUseCase", () => {
      let eventFired = false;
      container.eventBus.subscribe(EVENT_PERSONAL_MODE_UPDATED, () => {
        eventFired = true;
      });

      const budget = new BudgetEntity({
        id: "b-clean-1",
        userId: "0xUserPersonal",
        categoryId: "software_tools",
        amountLimit: 400,
      });

      container.managePersonalModeUseCase.saveBudgets([budget], "0xUserPersonal");
      expect(eventFired).toBe(true);

      const budgets = container.managePersonalModeUseCase.getBudgets("0xUserPersonal");
      expect(budgets).toHaveLength(1);
      expect(budgets[0]?.amountLimit).toBe(400);

      const sub = new SubscriptionEntity({
        id: "sub-clean-1",
        userId: "0xUserPersonal",
        name: "GitHub Enterprise",
        amount: 21,
        frequency: "monthly",
      });

      container.managePersonalModeUseCase.saveSubscriptions([sub], "0xUserPersonal");
      const subs = container.managePersonalModeUseCase.getSubscriptions("0xUserPersonal");
      expect(subs).toHaveLength(1);
      expect(subs[0]?.name).toBe("GitHub Enterprise");
    });
  });
});
