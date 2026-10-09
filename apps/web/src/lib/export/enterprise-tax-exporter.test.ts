import { describe, it, expect } from "vitest";
import {
  generateQuickBooksCsv,
  generateXeroCsv,
  generateScheduleCReport,
  generateCorporateAuditPackagePdf,
  mapCategoryToScheduleCLine,
} from "./enterprise-tax-exporter";
import type { Transaction } from "@/lib/supabase/types";

describe("Enterprise & Tax Exporter Connectors", () => {
  const sampleTransactions: Partial<Transaction>[] = [
    {
      id: "tx-qb-001",
      date: "2026-10-04",
      merchant: "Amazon Web Services",
      description: "AWS EC2 and S3 hosting",
      category: "hosting",
      amount: 150.0,
      type: "expense",
      blockchain_tx_hash: "0xabcdef1234567890abcdef1234567890abcdef12",
    },
    {
      id: "tx-qb-002",
      date: "2026-10-05",
      merchant: "Blue Bottle Coffee",
      description: "Client business lunch",
      category: "food_dining",
      amount: 40.0,
      type: "expense",
      blockchain_tx_hash: "0x1234567890abcdef1234567890abcdef12345678",
    },
    {
      id: "tx-qb-003",
      date: "2026-10-06",
      merchant: "GitHub Enterprise",
      description: "CI/CD & Copilot seats",
      category: "software_tools",
      amount: 210.0,
      type: "expense",
      proof_hash: "0x9876543210fedcba9876543210fedcba98765432",
    },
  ];

  describe("QuickBooks Online Connector", () => {
    it("generates pre-mapped QuickBooks CSV with Monad transaction verification links", () => {
      const csv = generateQuickBooksCsv(sampleTransactions, "Monad Foundry Workspace");

      expect(csv).toContain("Date,Transaction Type,Payee,Category,Amount,Memo,Reference Number,Monad Tx Hash,Monad Explorer URL");
      expect(csv).toContain("2026-10-04,Expense,Amazon Web Services,hosting,150.00");
      expect(csv).toContain("CLR-TX-QB-00");
      expect(csv).toContain("https://testnet.monadexplorer.com/tx/0xabcdef1234567890abcdef1234567890abcdef12");
    });
  });

  describe("Xero Accounting Connector", () => {
    it("generates valid Xero bank/expense statement CSV with Monad reference tags", () => {
      const csv = generateXeroCsv(sampleTransactions);

      expect(csv).toContain("*Date,*Amount,Payee,Description,Reference,Cheque Number,Account Code,Tax Rate");
      expect(csv).toContain("2026-10-04,-150.00,Amazon Web Services");
      expect(csv).toContain("MON-0xabcdef12");
      expect(csv).toContain("400,Tax Exclusive");
    });
  });

  describe("IRS Form 1040 Schedule C Organizer", () => {
    it("maps business expenses accurately to IRS Part II expense categories", () => {
      const meals = mapCategoryToScheduleCLine("food_dining");
      expect(meals.lineNumber).toBe("Line 24b");
      expect(meals.deductiblePct).toBe(50); // 50% IRS business meal limit

      const software = mapCategoryToScheduleCLine("software_tools");
      expect(software.lineNumber).toBe("Line 27a");
      expect(software.deductiblePct).toBe(100);

      const ads = mapCategoryToScheduleCLine("advertising");
      expect(ads.lineNumber).toBe("Line 8");
      expect(ads.deductiblePct).toBe(100);

      const office = mapCategoryToScheduleCLine("office_expenses");
      expect(office.lineNumber).toBe("Line 18");
      expect(office.deductiblePct).toBe(100);
    });

    it("calculates exact deduction amounts with 50% meal reduction and summary", () => {
      const report = generateScheduleCReport(sampleTransactions, 2026);

      // Total spent = 150 (hosting: 100%) + 40 (meals: 50% = 20) + 210 (software: 100%) = 400.00
      // Deductible = 150 + 20 + 210 = 380.00
      // Non-deductible = 20.00
      expect(report.taxYear).toBe(2026);
      expect(report.totalGrossExpenses).toBe(400);
      expect(report.totalDeductibleExpenses).toBe(380);
      expect(report.nonDeductiblePortion).toBe(20);

      expect(report.csvContent).toContain("SCHEDULE C SUMMARY");
      expect(report.csvContent).toContain("Total Gross Expenses,400.00");
      expect(report.csvContent).toContain("Total Net Deductible,380.00");
      expect(report.csvContent).toContain("Non-Deductible Portion (e.g. 50% meals),20.00");
      expect(report.csvContent).toContain("Monad Testnet Chain ID 10143");
    });
  });

  describe("Corporate Audit Package PDF Generator", () => {
    it("generates valid vector PDF audit bundle with Monad verification headers", () => {
      const pdfBlob = generateCorporateAuditPackagePdf({
        companyName: "Acme Decentralized Labs",
        workspaceId: "ws_monad_enterprise_1",
        reportPeriod: "Q3 2026 (Oct 1 - Oct 9)",
        generatedDate: "2026-10-09",
        totalExpensesCount: sampleTransactions.length,
        totalVolumeUsd: 400.0,
        monadChainId: 10143,
        contractAddress: "0x92f9B76673C1D88c9E3c490A88eB95b08823bA87",
        transactions: sampleTransactions.map((tx) => ({
          id: tx.id || "tx",
          date: tx.date || "2026-10-09",
          merchant: tx.merchant || "Vendor",
          category: String(tx.category || "General"),
          amount: Number(tx.amount || 0),
          currency: "USD",
          requester: "0x1111...1111",
          approver: "0x2222...2222",
          sha256EvidenceDigest: "0xsha256...",
          monadCommitmentRoot: "0xcommitment...",
          monadTxHash: tx.blockchain_tx_hash || "",
        })),
      });

      expect(pdfBlob).toBeInstanceOf(Blob);
      expect(pdfBlob.type).toBe("application/pdf");
      expect(pdfBlob.size).toBeGreaterThan(500);
    });
  });
});
