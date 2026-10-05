import { describe, it, expect } from "vitest";
import {
  extractCanonicalReceiptData,
  generateJsonReceipt,
  generateCsvReceipt,
  generateTxtReceipt,
  generatePdfReceipt,
} from "./receipt-exporter";
import type { ReceiptBundle } from "@/lib/supabase/types";

describe("Receipt Exporter", () => {
  const mockBundle: ReceiptBundle = {
    id: "bundle-12345678",
    user_id: "0x1111111111111111111111111111111111111111",
    wallet_address: "0x1111111111111111111111111111111111111111",
    name: "AWS & Vercel Cloud Infrastructure",
    receipt_name: "AWS & Vercel Cloud Infrastructure",
    receipt_number: "RCP-2026-0042",
    file_hash: "0xfilehash123",
    receipt_hash: "0x9876543210abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    transaction_count: 2,
    total_amount: 142.5,
    currency: "USD",
    transaction_ids: ["tx-1", "tx-2"],
    receipt_data: {
      receiptId: "bundle-12345678",
      receiptNumber: "RCP-2026-0042",
      receiptName: "AWS & Vercel Cloud Infrastructure",
      createdAt: "2026-10-05T12:00:00.000Z",
      owner: "0x1111111111111111111111111111111111111111",
      transactionCount: 2,
      totalAmount: 142.5,
      currency: "USD",
      transactionIds: ["tx-1", "tx-2"],
      version: 1,
      transactions: [
        {
          id: "tx-1",
          amount: 100.0,
          currency: "USD",
          merchant: "Amazon Web Services",
          category: "Hosting",
          date: "2026-10-04T10:00:00.000Z",
          type: "expense",
        },
        {
          id: "tx-2",
          amount: 42.5,
          currency: "USD",
          merchant: "Vercel Inc",
          category: "Hosting",
          date: "2026-10-05T11:00:00.000Z",
          type: "expense",
        },
      ],
    },
    blockchain_network: "Monad Testnet",
    blockchain_status: "confirmed",
    blockchain_tx_hash: "0xmonadtxhashabcdef1234567890",
    blockchain_contract_address: "0x92f9B76673C1D88c9E3c490A88eB95b08823bA87",
    blockchain_chain_id: 10143,
    verification_status: "verified",
    created_at: "2026-10-05T12:00:00.000Z",
    updated_at: "2026-10-05T12:00:00.000Z",
  };

  it("extracts canonical receipt data accurately", () => {
    const data = extractCanonicalReceiptData(mockBundle);
    expect(data.receiptName).toBe("AWS & Vercel Cloud Infrastructure");
    expect(data.receiptNumber).toBe("RCP-2026-0042");
    expect(data.totalAmount).toBe(142.5);
    expect(data.transactions).toHaveLength(2);
    expect(data.blockchain.verificationStatus).toBe("VERIFIED ON MONAD");
    expect(data.blockchain.txHash).toBe("0xmonadtxhashabcdef1234567890");
    expect(data.blockchain.receiptHash).toBe(mockBundle.receipt_hash);
  });

  it("generates valid structured JSON with all receipt metadata", () => {
    const data = extractCanonicalReceiptData(mockBundle);
    const jsonStr = generateJsonReceipt(data);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.protocol).toBe("Clario Financial Intelligence");
    expect(parsed.receipt.name).toBe("AWS & Vercel Cloud Infrastructure");
    expect(parsed.receipt.totalAmount).toBe(142.5);
    expect(parsed.receipt.transactions[0].merchant).toBe("Amazon Web Services");
    expect(parsed.blockchain.monadTxHash).toBe("0xmonadtxhashabcdef1234567890");
    expect(parsed.blockchain.canonicalHash).toBe(mockBundle.receipt_hash);
  });

  it("generates valid CSV with header and itemized transactions", () => {
    const data = extractCanonicalReceiptData(mockBundle);
    const csvStr = generateCsvReceipt(data);

    expect(csvStr).toContain("Receipt Name,\"AWS & Vercel Cloud Infrastructure\"");
    expect(csvStr).toContain("Total Amount,142.50");
    expect(csvStr).toContain("Verification Status,\"VERIFIED ON MONAD\"");
    expect(csvStr).toContain("Amazon Web Services");
    expect(csvStr).toContain("Vercel Inc");
    expect(csvStr).toContain("100.00");
    expect(csvStr).toContain("42.50");
  });

  it("generates human-readable TXT receipt document", () => {
    const data = extractCanonicalReceiptData(mockBundle);
    const txtStr = generateTxtReceipt(data);

    expect(txtStr).toContain("CLARIO FINANCIAL RECEIPT");
    expect(txtStr).toContain("RECEIPT NAME:        AWS & Vercel Cloud Infrastructure");
    expect(txtStr).toContain("TOTAL AMOUNT:        $142.50 USD");
    expect(txtStr).toContain("Amazon Web Services");
    expect(txtStr).toContain("Vercel Inc");
    expect(txtStr).toContain("ONCHAIN MONAD VERIFICATION PROOF");
    expect(txtStr).toContain("0xmonadtxhashabcdef1234567890");
  });

  it("generates vector PDF blob", () => {
    const data = extractCanonicalReceiptData(mockBundle);
    const pdfBlob = generatePdfReceipt(data);

    expect(pdfBlob).toBeInstanceOf(Blob);
    expect(pdfBlob.type).toBe("application/pdf");
    expect(pdfBlob.size).toBeGreaterThan(500);
  });
});
