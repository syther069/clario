import { describe, it, expect } from "vitest";
import {
  queryClarioCopilot,
  detectFinancialAnomalies,
  anonymizeCopilotContext,
  buildGroundedSystemPrompt,
} from "./copilot";
import type { CopilotContext } from "./copilot";

describe("Clario Multi-Mode AI Copilot & Anomaly Intelligence", () => {
  const baseContext: CopilotContext = {
    activeMode: "personal",
    userName: "Alice",
    transactions: [
      {
        id: "tx-1",
        user_id: "user-alice",
        type: "income",
        amount: 5000,
        currency: "USD",
        merchant: "Acme Client Retainer",
        timestamp: "2026-09-01T00:00:00Z",
        status: "cleared",
        source: "manual",
        version: 1,
        verification_state: "verified",
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
      },
      {
        id: "tx-2",
        user_id: "user-alice",
        type: "expense",
        amount: 120,
        currency: "USD",
        merchant: "Cloud Infrastructure",
        timestamp: "2026-09-05T00:00:00Z",
        status: "cleared",
        source: "receipt_ocr",
        version: 1,
        tax_deductible: true,
        verification_state: "anchored_onchain",
        created_at: "2026-09-05T00:00:00Z",
        updated_at: "2026-09-05T00:00:00Z",
      },
      {
        id: "tx-3",
        user_id: "user-alice",
        type: "expense",
        amount: 80,
        currency: "USD",
        merchant: "Hardware Tools",
        timestamp: "2026-09-10T00:00:00Z",
        status: "cleared",
        source: "manual",
        version: 1,
        tax_deductible: true,
        verification_state: "unverified",
        created_at: "2026-09-10T00:00:00Z",
        updated_at: "2026-09-10T00:00:00Z",
      },
    ],
    subscriptions: [
      {
        id: "sub-1",
        user_id: "user-alice",
        name: "Developer Pro Plan",
        amount: 60,
        currency: "USD",
        frequency: "monthly",
        status: "active",
        created_at: "2026-09-01T00:00:00Z",
      },
    ],
    budgets: [
      {
        id: "b-1",
        user_id: "user-alice",
        category_id: "software_tools",
        amount_limit: 150,
        spent_amount: 160,
        period: "monthly",
        created_at: "2026-09-01T00:00:00Z",
      },
    ],
  };

  describe("Personal Mode Queries", () => {
    it("calculates grounded spending figures without hallucinating", async () => {
      const response = await queryClarioCopilot(
        [{ role: "user", content: "How much did I spend in total?" }],
        baseContext,
      );

      expect(response).toContain("200.00");
    });

    it("accurately reports subscription count and auditing advice", async () => {
      const response = await queryClarioCopilot(
        [{ role: "user", content: "Analyze my subscriptions" }],
        baseContext,
      );

      expect(response).toContain("1 recurring subscription");
      expect(response).toContain("$60.00/mo");
    });

    it("calculates net cash flow correctly", async () => {
      const response = await queryClarioCopilot(
        [{ role: "user", content: "What is my net cash flow this month?" }],
        baseContext,
      );

      expect(response).toContain("4800.00");
      expect(response).toContain("5000.00");
      expect(response).toContain("200.00");
    });

    it("reports onchain proof verification state on Monad", async () => {
      const response = await queryClarioCopilot(
        [{ role: "user", content: "Check my verified receipts on monad" }],
        baseContext,
      );

      expect(response).toContain("Monad Testnet (Chain ID 10143)");
      expect(response).toContain("1 verified transaction");
    });
  });

  describe("Freelancer Mode Grounded Queries", () => {
    const freelancerContext: CopilotContext = {
      ...baseContext,
      activeMode: "freelancer",
      clients: [
        {
          id: "cli-1",
          user_id: "user-alice",
          name: "Acme Corp",
          email: "billing@acme.com",
          company: "Acme Corp",
          rate_currency: "USD",
          hourly_rate: 150,
          status: "active",
          created_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-01T00:00:00Z",
        },
      ],
      invoices: [
        {
          id: "inv-1",
          user_id: "user-alice",
          client_id: "cli-1",
          client_name: "Acme Corp",
          invoice_number: "INV-001",
          issue_date: "2026-09-01",
          due_date: "2026-09-15",
          currency: "USD",
          subtotal: 3500,
          total_amount: 3500,
          status: "sent",
          items: [
            {
              id: "item-1",
              description: "Design Systems",
              quantity: 1,
              rate: 3500,
              amount: 3500,
            },
          ],
          created_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-01T00:00:00Z",
        },
        {
          id: "inv-2",
          user_id: "user-alice",
          client_id: "cli-1",
          client_name: "Acme Corp",
          invoice_number: "INV-002",
          issue_date: "2026-09-05",
          due_date: "2026-09-20",
          currency: "USD",
          subtotal: 6500,
          total_amount: 6500,
          status: "paid",
          items: [
            {
              id: "item-2",
              description: "Contract Audit",
              quantity: 1,
              rate: 6500,
              amount: 6500,
            },
          ],
          created_at: "2026-09-05T00:00:00Z",
          updated_at: "2026-09-05T00:00:00Z",
        },
      ],
    };

    it("summarizes unpaid client invoices accurately", async () => {
      const response = await queryClarioCopilot(
        [{ role: "user", content: "Summarize my unpaid client invoices" }],
        freelancerContext,
      );

      expect(response).toContain("3500.00");
      expect(response).toContain("INV-001");
      expect(response).toContain("Acme Corp");
    });

    it("computes tax deductible expenses and estimated tax reduction", async () => {
      const response = await queryClarioCopilot(
        [
          {
            role: "user",
            content: "What are my total deductible expenses this year?",
          },
        ],
        freelancerContext,
      );

      // tx-2 ($120) + tx-3 ($80) = $200 deductible
      expect(response).toContain("200.00");
      expect(response).toContain("50.00"); // 25% of $200 = $50
      expect(response).toContain("Monad");
    });
  });

  describe("Family Mode Grounded Queries", () => {
    const familyContext: CopilotContext = {
      ...baseContext,
      activeMode: "family",
      familyMembers: [
        {
          id: "fm-1",
          household_id: "fam-1",
          name: "Bob",
          role: "member",
          created_at: "2026-09-01T00:00:00Z",
        },
      ],
      familyBills: [
        {
          id: "fb-1",
          household_id: "fam-1",
          name: "Electric & Water",
          amount: 220,
          currency: "USD",
          due_date: "2026-10-10",
          category: "Utilities",
          is_recurring: true,
          status: "unpaid",
          created_at: "2026-09-01T00:00:00Z",
        },
      ],
      familySettlements: [
        {
          id: "fs-1",
          household_id: "fam-1",
          from_member_id: "fm-1",
          from_member_name: "Bob",
          to_member_id: "fm-2",
          to_member_name: "Alice",
          amount: 110,
          currency: "USD",
          status: "pending",
          created_at: "2026-09-01T00:00:00Z",
        },
      ],
    };

    it("reports upcoming household bills and pending settlements", async () => {
      const response = await queryClarioCopilot(
        [
          {
            role: "user",
            content:
              "Who owes money in our household settlements and what bills are due?",
          },
        ],
        familyContext,
      );

      expect(response).toContain("220.00");
      expect(response).toContain("Electric & Water");
      expect(response).toContain("1 pending settlement");
    });
  });

  describe("Business Mode Grounded Queries", () => {
    const businessContext: CopilotContext = {
      ...baseContext,
      activeMode: "business",
      businessTeam: [
        {
          id: "bt-1",
          org_id: "org-1",
          name: "Dan Employee",
          email: "dan@company.internal",
          role: "employee",
          department: "Engineering",
          spending_limit_monthly: 2000,
          created_at: "2026-09-01T00:00:00Z",
        },
      ],
      businessClaims: [
        {
          id: "claim-1",
          org_id: "org-1",
          employee_id: "bt-1",
          employee_name: "Dan Employee",
          title: "Cloud Dev Server Hardware",
          amount: 450,
          currency: "USD",
          category: "Hardware",
          department: "Engineering",
          expense_date: "2026-09-20",
          status: "submitted",
          created_at: "2026-09-20T00:00:00Z",
        },
      ],
      businessPolicies: [
        {
          id: "pol-1",
          org_id: "org-1",
          name: "Engineering Hardware",
          category: "Hardware",
          max_single_amount: 300,
          monthly_budget: 1500,
          requires_receipt_above: 50,
          requires_approval_above: 200,
          is_active: true,
          created_at: "2026-09-01T00:00:00Z",
        },
      ],
    };

    it("summarizes corporate reimbursement claims pending review", async () => {
      const response = await queryClarioCopilot(
        [
          {
            role: "user",
            content: "Are there any pending reimbursement claims to approve?",
          },
        ],
        businessContext,
      );

      expect(response).toContain("450.00");
      expect(response).toContain("Cloud Dev Server Hardware");
      expect(response).toContain("Dan Employee");
    });
  });

  describe("Cross-Mode Anomaly Intelligence Detection", () => {
    it("detects budget overrun and high subscription ratio anomalies", () => {
      const insights = detectFinancialAnomalies(baseContext);

      // b-1 has spent 160 vs limit 150 -> budget exceeded
      const budgetExceeded = insights.find((i) =>
        i.id.startsWith("budget-exceeded"),
      );
      expect(budgetExceeded).toBeDefined();
      expect(budgetExceeded?.type).toBe("warning");

      // subscriptions ($60) / total expenses ($200) = 30% -> high subscription load
      const subLoad = insights.find((i) => i.id === "high-subscription-load");
      expect(subLoad).toBeDefined();
      expect(subLoad?.type).toBe("opportunity");
    });

    it("detects freelancer unpaid invoices and business policy cap violations", () => {
      const combinedContext: CopilotContext = {
        ...baseContext,
        invoices: [
          {
            id: "inv-overdue",
            user_id: "user-1",
            client_id: "c-1",
            client_name: "Slow Payer LLC",
            invoice_number: "INV-999",
            issue_date: "2026-08-01",
            due_date: "2026-08-15",
            currency: "USD",
            subtotal: 1500,
            total_amount: 1500,
            status: "overdue",
            items: [
              {
                id: "item-3",
                description: "Audit",
                quantity: 1,
                rate: 1500,
                amount: 1500,
              },
            ],
            created_at: "2026-08-01T00:00:00Z",
            updated_at: "2026-08-01T00:00:00Z",
          },
        ],
        businessClaims: [
          {
            id: "claim-overcap",
            org_id: "org-1",
            employee_id: "e-1",
            employee_name: "Alice",
            title: "VIP Conference Pass",
            amount: 1200,
            currency: "USD",
            category: "Conferences",
            department: "Marketing",
            expense_date: "2026-09-10",
            status: "submitted",
            created_at: "2026-09-10T00:00:00Z",
          },
        ],
        businessPolicies: [
          {
            id: "pol-conf",
            org_id: "org-1",
            name: "Conferences Policy",
            category: "Conferences",
            max_single_amount: 500,
            monthly_budget: 2000,
            requires_receipt_above: 25,
            requires_approval_above: 100,
            is_active: true,
            created_at: "2026-09-01T00:00:00Z",
          },
        ],
      };

      const insights = detectFinancialAnomalies(combinedContext);

      const overdueInsight = insights.find(
        (i) => i.id === "freelancer-overdue-invoices",
      );
      expect(overdueInsight).toBeDefined();
      expect(overdueInsight?.type).toBe("warning");

      const policyViolation = insights.find(
        (i) => i.id === "business-policy-violation",
      );
      expect(policyViolation).toBeDefined();
      expect(policyViolation?.type).toBe("warning");
    });
  });

  describe("Phase 1: PII Anonymization & Privacy Guardrails", () => {
    it("anonymizes personal names, client identities, emails, and wallet addresses", () => {
      const sensitiveContext: CopilotContext = {
        activeMode: "freelancer",
        userName: "Alice Smith",
        transactions: [
          {
            id: "tx-sensitive",
            user_id: "user-123",
            type: "expense",
            amount: 450,
            currency: "USD",
            merchant: "Payment to 0x1234567890abcdef1234567890abcdef12345678",
            description:
              "Direct wire contact alice.smith@example.com for consulting",
            timestamp: "2026-09-15T00:00:00Z",
            status: "cleared",
            source: "manual",
            version: 1,
            verification_state: "verified",
            created_at: "2026-09-15T00:00:00Z",
            updated_at: "2026-09-15T00:00:00Z",
          },
        ],
        subscriptions: [],
        budgets: [],
        clients: [
          {
            id: "c-1",
            user_id: "user-123",
            name: "Secret MegaCorp LLC",
            company: "MegaCorp Industries",
            email: "ceo@megacorp.com",
            rate_currency: "USD",
            hourly_rate: 250,
            status: "active",
            created_at: "2026-09-01T00:00:00Z",
            updated_at: "2026-09-01T00:00:00Z",
          },
        ],
        invoices: [
          {
            id: "inv-secret",
            user_id: "user-123",
            client_name: "Secret MegaCorp LLC",
            invoice_number: "INV-2026-987654",
            issue_date: "2026-09-01",
            due_date: "2026-09-15",
            currency: "USD",
            subtotal: 5000,
            tax_rate: 0,
            tax_amount: 0,
            total_amount: 5000,
            status: "sent",
            items: [],
            notes:
              "Send to 0x1234567890abcdef1234567890abcdef12345678 or support@megacorp.com",
            created_at: "2026-09-01T00:00:00Z",
            updated_at: "2026-09-01T00:00:00Z",
          },
        ],
      };

      const anonymized = anonymizeCopilotContext(sensitiveContext);

      // User name anonymized
      expect(anonymized.userName).toBe("User");

      // Client name masked
      expect(anonymized.clients?.[0]?.name).toBe("Client A");
      expect(anonymized.clients?.[0]?.company).toContain("ME***");
      expect(anonymized.clients?.[0]?.email).toBe("[REDACTED_EMAIL]");

      // Invoice number and notes masked
      expect(anonymized.invoices?.[0]?.client_name).toBe("Client A");
      expect(anonymized.invoices?.[0]?.invoice_number).not.toContain("987654");
      expect(anonymized.invoices?.[0]?.notes).toContain("[REDACTED_EMAIL]");
      expect(anonymized.invoices?.[0]?.notes).toContain("0x1234...5678");

      // Transaction descriptions sanitized
      expect(anonymized.transactions[0]?.merchant).toContain("0x1234...5678");
      expect(anonymized.transactions[0]?.description).toContain(
        "[REDACTED_EMAIL]",
      );

      // Financial figures strictly preserved for accurate grounded reasoning
      expect(anonymized.transactions[0]?.amount).toBe(450);
      expect(anonymized.clients?.[0]?.hourly_rate).toBe(250);
      expect(anonymized.invoices?.[0]?.total_amount).toBe(5000);

      // System prompt contains zero raw PII
      const systemPrompt = buildGroundedSystemPrompt(anonymized);
      expect(systemPrompt).not.toContain("Alice Smith");
      expect(systemPrompt).not.toContain("Secret MegaCorp LLC");
      expect(systemPrompt).not.toContain("ceo@megacorp.com");
      expect(systemPrompt).not.toContain("alice.smith@example.com");
      expect(systemPrompt).not.toContain(
        "0x1234567890abcdef1234567890abcdef12345678",
      );
      expect(systemPrompt).toContain("$5000.00");
    });
  });
});
