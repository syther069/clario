import { describe, it, expect, beforeEach, vi } from "vitest";
import { SupabaseBusinessRepository } from "./SupabaseBusinessRepository";
import { BusinessTeamMemberEntity } from "../../domain/business/entities/BusinessTeamMember";
import { BusinessReimbursementEntity } from "../../domain/business/entities/BusinessReimbursement";
import { ExpensePolicyEntity } from "../../domain/business/entities/ExpensePolicy";
import { BusinessAuditEventEntity } from "../../domain/business/entities/BusinessAuditEvent";
import { ClarioIndexedDB } from "./indexeddb/ClarioIndexedDB";
import { SyncQueueManager } from "./indexeddb/SyncQueueManager";

const mockMembers: any[] = [];
const mockClaims: any[] = [];
const mockPolicies: any[] = [];
const mockAudit: any[] = [];

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          order: () => {
            if (table === "business_team_members")
              return Promise.resolve({ data: mockMembers, error: null });
            if (table === "business_reimbursements")
              return Promise.resolve({ data: mockClaims, error: null });
            if (table === "business_policies")
              return Promise.resolve({ data: mockPolicies, error: null });
            if (table === "business_audit_events")
              return Promise.resolve({ data: mockAudit, error: null });
            return Promise.resolve({ data: [], error: null });
          },
        }),
      }),
      upsert: (payload: any) => {
        if (table === "business_team_members") mockMembers.push(payload);
        if (table === "business_reimbursements") mockClaims.push(payload);
        if (table === "business_policies") mockPolicies.push(payload);
        if (table === "business_audit_events") mockAudit.push(payload);
        return Promise.resolve({ error: null });
      },
      delete: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
      insert: (payload: any) => {
        if (table === "business_audit_events") mockAudit.push(payload);
        return Promise.resolve({ error: null });
      },
    }),
  }),
}));

Object.defineProperty(globalThis, "navigator", {
  value: { onLine: true },
  writable: true,
  configurable: true,
});

describe("SupabaseBusinessRepository (Hybrid Persistence)", () => {
  let mockIdb: ClarioIndexedDB;
  let mockQueue: SyncQueueManager;
  let repo: SupabaseBusinessRepository;

  beforeEach(() => {
    mockMembers.length = 0;
    mockClaims.length = 0;
    mockPolicies.length = 0;
    mockAudit.length = 0;

    mockIdb = new ClarioIndexedDB();
    vi.spyOn(mockIdb, "isSupported").mockReturnValue(false);

    mockQueue = new SyncQueueManager(mockIdb);
    vi.spyOn(mockQueue, "enqueue").mockResolvedValue();

    repo = new SupabaseBusinessRepository(mockIdb, mockQueue);
  });

  it("saves and retrieves business team members", async () => {
    const member = BusinessTeamMemberEntity.fromDTO({
      id: "member-1",
      org_id: "org-1",
      name: "Alice Engineer",
      email: "alice@clario.xyz",
      role: "manager",
      department: "Engineering",
      spending_limit_monthly: 5000,
      created_at: "2026-10-12T10:00:00Z",
    });

    await repo.saveBusinessTeamMember(member);
    const team = await repo.getBusinessTeam("org-1");

    expect(team).toHaveLength(1);
    expect(team[0]?.id).toBe("member-1");
    expect(team[0]?.name).toBe("Alice Engineer");
    expect(team[0]?.role).toBe("manager");
  });

  it("saves and updates reimbursement claim status", async () => {
    const claim = BusinessReimbursementEntity.fromDTO({
      id: "claim-1",
      org_id: "org-1",
      employee_id: "emp-1",
      employee_name: "Alice",
      title: "Flight to Offsite",
      amount: 450,
      currency: "USD",
      category: "Travel",
      department: "Engineering",
      expense_date: "2026-10-10",
      status: "submitted",
      created_at: "2026-10-10T12:00:00Z",
    });

    await repo.saveBusinessReimbursement(claim);
    await repo.updateReimbursementStatus(
      "claim-1",
      "approved",
      "Bob Manager",
      "Approved for quarterly offsite",
      "0xmonadhash",
      "org-1",
    );

    const reimbursements = await repo.getBusinessReimbursements("org-1");
    expect(reimbursements).toHaveLength(1);
    expect(reimbursements[0]?.id).toBe("claim-1");
  });

  it("records and retrieves business audit events", async () => {
    const event = BusinessAuditEventEntity.fromDTO({
      id: "audit-1",
      org_id: "org-1",
      actor_name: "Admin Alice",
      action: "policy_created",
      entity_type: "policy",
      entity_id: "pol-1",
      details: "Created Travel Policy $500 cap",
      severity: "info",
      timestamp: "2026-10-12T11:00:00Z",
    });

    await repo.recordBusinessAuditEvent(event);
    const events = await repo.getBusinessAuditEvents("org-1");
    expect(events).toHaveLength(1);
    expect(events[0]?.action).toBe("policy_created");
  });
});
