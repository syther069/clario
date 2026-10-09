import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

// Mock Viem and Monad registry client
vi.mock("@/lib/blockchain/registry", () => ({
  getMonadPublicClient: vi.fn(() => ({
    getTransactionReceipt: vi.fn(async ({ hash }: { hash: string }) => {
      if (
        hash ===
        "0x1111111111111111111111111111111111111111111111111111111111111111"
      ) {
        return {
          status: "success",
          blockNumber: 14298104n,
          to: "0x92f9B76673C1D88c9E3c490A88eB95b08823bA87",
          gasUsed: 21000n,
          logs: [],
        };
      }
      if (
        hash ===
        "0x2222222222222222222222222222222222222222222222222222222222222222"
      ) {
        return {
          status: "reverted",
          blockNumber: 14298105n,
          to: "0x92f9B76673C1D88c9E3c490A88eB95b08823bA87",
          gasUsed: 21000n,
          logs: [],
        };
      }
      return null;
    }),
    getBlock: vi.fn(async () => ({
      timestamp: 1727980000n,
    })),
  })),
  CLARIO_REGISTRY_ADDRESS: "0x92f9B76673C1D88c9E3c490A88eB95b08823bA87",
  CLARIO_REGISTRY_ABI: [],
  MONAD_TESTNET_CHAIN_ID: 10143,
  getMonadExplorerTxUrl: (tx: string) =>
    `https://testnet.monadexplorer.com/tx/${tx}`,
}));

// Mock Supabase Server Admin Client
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        or: vi.fn((queryStr: string) => ({
          limit: vi.fn(() => ({
            maybeSingle: vi.fn(async () => {
              if (
                table === "receipt_bundles" &&
                !queryStr.includes("0x9999") &&
                (queryStr.includes("bundle-123") ||
                  queryStr.includes("0xreceiptBundleHash123"))
              ) {
                return {
                  data: {
                    id: "bundle-123",
                    receipt_number: "CR-10143-001",
                    receipt_name: "Test Office Supplies",
                    total_amount: 150.0,
                    currency: "USD",
                    transaction_count: 3,
                    wallet_address:
                      "0x742d35cc6634c0532925a3b844bc454e4438f44e",
                    blockchain_tx_hash:
                      "0x1111111111111111111111111111111111111111111111111111111111111111",
                  },
                  error: null,
                };
              }
              return { data: null, error: null };
            }),
          })),
        })),
      })),
    })),
  })),
}));

import { _resetRateLimits } from "@/lib/security/rate-limit";

describe("Proof Verification API (/api/proof/verify)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetRateLimits();
  });

  it("returns 400 when empty hash payload is provided", async () => {
    const req = new NextRequest("http://localhost:3000/api/proof/verify", {
      method: "POST",
      body: JSON.stringify({ hash: "" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("successfully verifies a valid Monad Testnet transaction hash", async () => {
    const req = new NextRequest("http://localhost:3000/api/proof/verify", {
      method: "POST",
      body: JSON.stringify({
        hash: "0x1111111111111111111111111111111111111111111111111111111111111111",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.verified).toBe(true);
    expect(json.blockNumber).toBe(14298104);
    expect(json.chain).toBe("Monad Testnet");
    expect(json.chainId).toBe(10143);
    expect(json.explorerUrl).toContain(
      "1111111111111111111111111111111111111111111111111111111111111111",
    );
  });

  it("reports unverified for a reverted transaction on Monad Testnet", async () => {
    const req = new NextRequest("http://localhost:3000/api/proof/verify", {
      method: "POST",
      body: JSON.stringify({
        hash: "0x2222222222222222222222222222222222222222222222222222222222222222",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.verified).toBe(false);
  });

  it("honest error returned when an unknown hash is submitted", async () => {
    const req = new NextRequest("http://localhost:3000/api/proof/verify", {
      method: "POST",
      body: JSON.stringify({
        hash: "0x9999999999999999999999999999999999999999999999999999999999999999",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.verified).toBe(false);
    expect(json.error).toContain(
      "could not be found or verified on Monad Testnet",
    );
  });

  it("rejects malicious injection attempts and invalid characters with 400", async () => {
    const maliciousInputs = [
      "0x1234,id.eq.admin",
      "'; DROP TABLE users; --",
      "<script>alert(1)</script>",
      "../../../etc/passwd",
      "0x123", // incomplete hex
      "not_a_valid_hash_with_special_chars!@#$",
    ];

    for (const input of maliciousInputs) {
      const req = new NextRequest("http://localhost:3000/api/proof/verify", {
        method: "POST",
        body: JSON.stringify({ hash: input }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Invalid cryptographic fingerprint or identifier format");
    }
  });

  it("verifies receipt bundle using valid alphanumeric identifier", async () => {
    const req = new NextRequest("http://localhost:3000/api/proof/verify", {
      method: "POST",
      body: JSON.stringify({ hash: "bundle-123" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.verified).toBe(true);
    expect(json.type).toBe("commitment");
    expect(json.metadata?.receiptNumber).toBe("CR-10143-001");
  });
});
