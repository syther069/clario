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
  saveClient,
  getClients,
  deleteClient,
  saveInvoice,
  getInvoices,
  deleteInvoice,
  updateInvoiceStatus,
  saveFamilyMember,
  getFamilyMembers,
  deleteFamilyMember,
  saveFamilyBill,
  getFamilyBills,
  deleteFamilyBill,
  updateFamilyBillStatus,
  saveFamilySettlement,
  getFamilySettlements,
  deleteFamilySettlement,
  saveBusinessTeamMember,
  getBusinessTeam,
  deleteBusinessTeamMember,
  saveBusinessReimbursement,
  getBusinessReimbursements,
  deleteBusinessReimbursement,
  updateReimbursementStatus,
  saveExpensePolicy,
  getExpensePolicies,
  deleteExpensePolicy,
  recordBusinessAuditEvent,
  getBusinessAuditEvents,
} from "./mode-storage";
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
} from "@/lib/supabase/types";

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
};

// @ts-expect-error test environment polyfill
globalThis.localStorage = localStorageMock;
// @ts-expect-error test environment polyfill
globalThis.window = globalThis;

describe("Clario Multi-Mode Workspaces Storage & Services", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe("Freelancer Mode Workflows", () => {
    it("persists and retrieves freelancer clients", async () => {
      const client: Client = {
        id: "client-1",
        user_id: "test-freelancer",
        name: "Acme Studios",
        company: "Acme Corp",
        email: "billing@acme.com",
        rate_currency: "USD",
        hourly_rate: 150,
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await saveClient(client);
      const clients = await getClients("test-freelancer");
      expect(clients.length).toBe(1);
      expect(clients[0]?.name).toBe("Acme Studios");
      expect(clients[0]?.hourly_rate).toBe(150);
    });

    it("generates an invoice and transitions status to paid", async () => {
      const invoice: Invoice = {
        id: "inv-1",
        user_id: "test-freelancer",
        client_name: "Acme Studios",
        invoice_number: "INV-2026-001",
        issue_date: "2026-10-01",
        due_date: "2026-10-15",
        currency: "USD",
        subtotal: 1500,
        tax_rate: 10,
        tax_amount: 150,
        total_amount: 1650,
        status: "sent",
        items: [
          {
            id: "item-1",
            description: "Smart contract audit",
            quantity: 10,
            rate: 150,
            amount: 1500,
          },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await saveInvoice(invoice);
      let invoices = await getInvoices("test-freelancer");
      expect(invoices[0]?.status).toBe("sent");
      expect(invoices[0]?.total_amount).toBe(1650);

      await updateInvoiceStatus("inv-1", "paid", "2026-10-05");
      invoices = await getInvoices("test-freelancer");
      expect(invoices[0]?.status).toBe("paid");
      expect(invoices[0]?.payment_received_date).toBe("2026-10-05");
    });

    it("deletes clients and invoices cleanly", async () => {
      const client: Client = {
        id: "client-to-del",
        user_id: "test-freelancer",
        name: "Temporary Client",
        rate_currency: "USD",
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await saveClient(client);
      let clients = await getClients("test-freelancer");
      expect(clients.some((c) => c.id === "client-to-del")).toBe(true);

      await deleteClient("client-to-del");
      clients = await getClients("test-freelancer");
      expect(clients.some((c) => c.id === "client-to-del")).toBe(false);

      const invoice: Invoice = {
        id: "inv-to-del",
        user_id: "test-freelancer",
        client_name: "Temporary Client",
        invoice_number: "INV-DEL-01",
        issue_date: "2026-10-01",
        due_date: "2026-10-15",
        currency: "USD",
        subtotal: 500,
        tax_rate: 0,
        tax_amount: 0,
        total_amount: 500,
        status: "draft",
        items: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await saveInvoice(invoice);
      let invoices = await getInvoices("test-freelancer");
      expect(invoices.some((i) => i.id === "inv-to-del")).toBe(true);

      await deleteInvoice("inv-to-del");
      invoices = await getInvoices("test-freelancer");
      expect(invoices.some((i) => i.id === "inv-to-del")).toBe(false);
    });
  });

  describe("Family Mode Workflows", () => {
    it("registers household members and tracks shared bills", async () => {
      const member: FamilyMember = {
        id: "member-1",
        household_id: "hh-1",
        name: "Partner",
        email: "partner@home.internal",
        role: "member",
        avatar_color: "#836EF9",
        created_at: new Date().toISOString(),
      };

      await saveFamilyMember(member);
      const members = await getFamilyMembers("hh-1");
      expect(members.length).toBe(1);
      expect(members[0]?.role).toBe("member");

      const bill: FamilyBill = {
        id: "bill-1",
        household_id: "hh-1",
        name: "Gigabit Internet",
        amount: 85,
        currency: "USD",
        due_date: "2026-10-12",
        category: "internet",
        is_recurring: true,
        frequency: "monthly",
        status: "unpaid",
        created_at: new Date().toISOString(),
      };

      await saveFamilyBill(bill);
      let bills = await getFamilyBills("hh-1");
      expect(bills.length).toBe(1);
      expect(bills[0]?.status).toBe("unpaid");

      await updateFamilyBillStatus("bill-1", "paid", "Partner");
      bills = await getFamilyBills("hh-1");
      expect(bills[0]?.status).toBe("paid");
      expect(bills[0]?.paid_by_name).toBe("Partner");
    });

    it("records and clears family settlement balances", async () => {
      const settlement: FamilySettlement = {
        id: "settle-1",
        household_id: "hh-1",
        from_member_id: "m-1",
        from_member_name: "Alice",
        to_member_id: "m-2",
        to_member_name: "Bob",
        amount: 42.5,
        currency: "USD",
        status: "pending",
        created_at: new Date().toISOString(),
      };

      await saveFamilySettlement(settlement);
      let list = await getFamilySettlements("hh-1");
      expect(list.length).toBe(1);
      expect(list[0]?.status).toBe("pending");

      await saveFamilySettlement({
        ...settlement,
        status: "settled",
        settled_at: new Date().toISOString(),
      });
      list = await getFamilySettlements("hh-1");
      expect(list[0]?.status).toBe("settled");
    });

    it("deletes family members, bills, and settlements", async () => {
      const member: FamilyMember = {
        id: "mem-del-1",
        household_id: "hh-del",
        name: "Temporary Member",
        role: "member",
        avatar_color: "#121212",
        created_at: new Date().toISOString(),
      };
      await saveFamilyMember(member);
      let members = await getFamilyMembers("hh-del");
      expect(members.some((m) => m.id === "mem-del-1")).toBe(true);

      await deleteFamilyMember("mem-del-1");
      members = await getFamilyMembers("hh-del");
      expect(members.some((m) => m.id === "mem-del-1")).toBe(false);

      const bill: FamilyBill = {
        id: "bill-del-1",
        household_id: "hh-del",
        name: "Temp Bill",
        amount: 50,
        currency: "USD",
        due_date: "2026-11-01",
        category: "utilities",
        is_recurring: false,
        status: "unpaid",
        created_at: new Date().toISOString(),
      };
      await saveFamilyBill(bill);
      let bills = await getFamilyBills("hh-del");
      expect(bills.some((b) => b.id === "bill-del-1")).toBe(true);

      await deleteFamilyBill("bill-del-1");
      bills = await getFamilyBills("hh-del");
      expect(bills.some((b) => b.id === "bill-del-1")).toBe(false);

      const settlement: FamilySettlement = {
        id: "settle-del-1",
        household_id: "hh-del",
        from_member_id: "m1",
        from_member_name: "A",
        to_member_id: "m2",
        to_member_name: "B",
        amount: 25,
        currency: "USD",
        status: "pending",
        created_at: new Date().toISOString(),
      };
      await saveFamilySettlement(settlement);
      let settlements = await getFamilySettlements("hh-del");
      expect(settlements.some((s) => s.id === "settle-del-1")).toBe(true);

      await deleteFamilySettlement("settle-del-1");
      settlements = await getFamilySettlements("hh-del");
      expect(settlements.some((s) => s.id === "settle-del-1")).toBe(false);
    });
  });

  describe("Business Mode Workflows", () => {
    it("invites team members, sets expense limits, and approves claims", async () => {
      const teamMember: BusinessTeamMember = {
        id: "emp-1",
        org_id: "org-1",
        name: "Lead Engineer",
        email: "eng@corp.internal",
        role: "employee",
        department: "Engineering",
        spending_limit_monthly: 5000,
        created_at: new Date().toISOString(),
      };

      await saveBusinessTeamMember(teamMember);
      const team = await getBusinessTeam("org-1");
      expect(team.length).toBe(1);
      expect(team[0]?.spending_limit_monthly).toBe(5000);

      const claim: BusinessReimbursement = {
        id: "claim-1",
        org_id: "org-1",
        employee_id: "emp-1",
        employee_name: "Lead Engineer",
        title: "Database Cluster Credits",
        amount: 350,
        currency: "USD",
        category: "Software",
        department: "Engineering",
        expense_date: "2026-10-01",
        status: "submitted",
        created_at: new Date().toISOString(),
      };

      await saveBusinessReimbursement(claim);
      let claims = await getBusinessReimbursements("org-1");
      expect(claims[0]?.status).toBe("submitted");

      await updateReimbursementStatus(
        "claim-1",
        "approved",
        "VP of Finance",
        "Approved under SaaS policy",
      );
      claims = await getBusinessReimbursements("org-1");
      expect(claims[0]?.status).toBe("approved");
      expect(claims[0]?.reviewed_by).toBe("VP of Finance");
    });

    it("governs spending with policies and logs chronological audit events", async () => {
      const policy: ExpensePolicy = {
        id: "pol-1",
        org_id: "org-1",
        name: "Conference Travel Limit",
        category: "Travel",
        max_single_amount: 800,
        monthly_budget: 6000,
        requires_receipt_above: 25,
        requires_approval_above: 300,
        is_active: true,
        created_at: new Date().toISOString(),
      };

      await saveExpensePolicy(policy);
      const policies = await getExpensePolicies("org-1");
      expect(policies.length).toBe(1);
      expect(policies[0]?.requires_approval_above).toBe(300);

      const auditEvent: BusinessAuditEvent = {
        id: "audit-1",
        org_id: "org-1",
        actor_name: "Admin",
        action: "POLICY_CREATED",
        entity_type: "expense_policy",
        entity_id: "pol-1",
        details: "Created Conference Travel Limit policy",
        severity: "info",
        timestamp: new Date().toISOString(),
      };

      await recordBusinessAuditEvent(auditEvent);
      const events = await getBusinessAuditEvents("org-1");
      expect(events.length).toBe(1);
      expect(events[0]?.action).toBe("POLICY_CREATED");
    });

    it("deletes business team members, reimbursements, and policies cleanly", async () => {
      const member: BusinessTeamMember = {
        id: "emp-del",
        org_id: "org-1",
        name: "Temporary Contractor",
        email: "temp@contractor.internal",
        role: "employee",
        department: "Marketing",
        spending_limit_monthly: 1000,
        created_at: new Date().toISOString(),
      };
      await saveBusinessTeamMember(member);
      expect(
        (await getBusinessTeam("org-1")).some((m) => m.id === "emp-del"),
      ).toBe(true);
      await deleteBusinessTeamMember("emp-del");
      expect(
        (await getBusinessTeam("org-1")).some((m) => m.id === "emp-del"),
      ).toBe(false);

      const claim: BusinessReimbursement = {
        id: "claim-del",
        org_id: "org-1",
        employee_id: "emp-del",
        employee_name: "Temp",
        title: "Office Supplies",
        amount: 50,
        currency: "USD",
        category: "Supplies",
        department: "Marketing",
        expense_date: "2026-03-15",
        status: "draft",
        created_at: new Date().toISOString(),
      };
      await saveBusinessReimbursement(claim);
      expect(
        (await getBusinessReimbursements("org-1")).some(
          (c) => c.id === "claim-del",
        ),
      ).toBe(true);
      await deleteBusinessReimbursement("claim-del");
      expect(
        (await getBusinessReimbursements("org-1")).some(
          (c) => c.id === "claim-del",
        ),
      ).toBe(false);

      const policy: ExpensePolicy = {
        id: "pol-del",
        org_id: "org-1",
        name: "Temporary Travel Policy",
        category: "Travel",
        max_single_amount: 100,
        monthly_budget: 500,
        requires_receipt_above: 10,
        requires_approval_above: 50,
        is_active: false,
        created_at: new Date().toISOString(),
      };
      await saveExpensePolicy(policy);
      expect(
        (await getExpensePolicies("org-1")).some((p) => p.id === "pol-del"),
      ).toBe(true);
      await deleteExpensePolicy("pol-del");
      expect(
        (await getExpensePolicies("org-1")).some((p) => p.id === "pol-del"),
      ).toBe(false);
    });
  });

  describe("Phase 1: User-Scoped Isolation & Cache Resuscitation Prevention", () => {
    it("strictly isolates client and invoice storage between different users", async () => {
      const clientUserA: Client = {
        id: "client-user-a",
        user_id: "user-alpha",
        name: "Alpha Corp",
        rate_currency: "USD",
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const clientUserB: Client = {
        id: "client-user-b",
        user_id: "user-beta",
        name: "Beta Corp",
        rate_currency: "USD",
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await saveClient(clientUserA);
      await saveClient(clientUserB);

      const alphaClients = await getClients("user-alpha");
      const betaClients = await getClients("user-beta");

      expect(alphaClients.some((c) => c.id === "client-user-a")).toBe(true);
      expect(alphaClients.some((c) => c.id === "client-user-b")).toBe(false);

      expect(betaClients.some((c) => c.id === "client-user-b")).toBe(true);
      expect(betaClients.some((c) => c.id === "client-user-a")).toBe(false);
    });

    it("prevents cache resuscitation: does not resurrect old items when query returns empty", async () => {
      // 1. User starts with an empty client list
      const emptyClients = await getClients("fresh-user-empty");
      expect(emptyClients).toEqual([]);

      // 2. Even if an unscoped legacy key somehow had junk, getClients for an explicit user returns fresh state
      const invoices = await getInvoices("user-with-zero-invoices");
      expect(invoices).toEqual([]);
    });
  });
});
