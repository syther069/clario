import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

const mockUpdate = vi.fn(() => ({
  eq: vi.fn(async () => ({ error: null })),
}));

vi.mock("@/lib/blockchain/registry", () => ({
  fetchUserOnchainTransactions: vi.fn(async () => []),
  computeTransactionDataHash: vi.fn(() => "0xdatahash123"),
  toBytes32Id: vi.fn((id: string) => `0x${id.padEnd(64, "0")}`),
  getMonadPublicClient: vi.fn(() => ({
    getTransactionReceipt: vi.fn(async ({ hash }: { hash: string }) => {
      if (
        hash ===
        "0x1111111111111111111111111111111111111111111111111111111111111111"
      ) {
        return {
          status: "success",
          blockNumber: 54321n,
          to: "0x92f9B76673C1D88c9E3c490A88eB95b08823bA87",
        };
      }
      if (
        hash ===
        "0x2222222222222222222222222222222222222222222222222222222222222222"
      ) {
        return {
          status: "reverted",
          blockNumber: 54322n,
          to: "0x92f9B76673C1D88c9E3c490A88eB95b08823bA87",
        };
      }
      if (
        hash ===
        "0x3333333333333333333333333333333333333333333333333333333333333333"
      ) {
        return {
          status: "success",
          blockNumber: 54323n,
          to: "0xattackerContractAddress0000000000000000",
        };
      }
      return null;
    }),
  })),
  CLARIO_REGISTRY_ADDRESS: "0x92f9B76673C1D88c9E3c490A88eB95b08823bA87",
  MONAD_TESTNET_CHAIN_ID: 10143,
  getMonadExplorerTxUrl: (tx: string) =>
    `https://testnet.monadexplorer.com/tx/${tx}`,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      update: mockUpdate,
    })),
  })),
}));

describe("Onchain Transactions API (/api/transactions/onchain)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validTx = {
    id: "tx-123",
    merchant: "AWS Cloud Services",
    amount: 120.5,
    currency: "USD",
  };

  it("rejects request missing transaction payload", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/transactions/onchain",
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("verifies confirmed Monad transaction via RPC and updates Supabase", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/transactions/onchain",
      {
        method: "POST",
        body: JSON.stringify({
          transaction: validTx,
          txHash:
            "0x1111111111111111111111111111111111111111111111111111111111111111",
          userAddress: "0x742d35cc6634c0532925a3b844bc454e4438f44e",
        }),
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.status).toBe("confirmed");
    expect(json.blockNumber).toBe(54321);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("rejects reverted Monad transaction hash", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/transactions/onchain",
      {
        method: "POST",
        body: JSON.stringify({
          transaction: validTx,
          txHash:
            "0x2222222222222222222222222222222222222222222222222222222222222222",
        }),
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("failed on Monad Testnet");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects transaction sent to wrong contract address", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/transactions/onchain",
      {
        method: "POST",
        body: JSON.stringify({
          transaction: validTx,
          txHash:
            "0x3333333333333333333333333333333333333333333333333333333333333333",
        }),
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain(
      "not directed to the Clario Transaction Registry",
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
