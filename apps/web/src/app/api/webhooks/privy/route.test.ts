import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, GET } from "./route";

// Mock database and supabase
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => ({
    from: () => ({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: () => ({
        or: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  }),
}));

vi.mock("@/lib/db", () => ({
  getDatabaseClient: () => ({
    query: vi.fn().mockResolvedValue({ rows: [{ workspace_id: "test-workspace" }] }),
  }),
}));

describe("POST /api/webhooks/privy", () => {
  beforeEach(() => {
    delete process.env.PRIVY_WEBHOOK_SECRET;
  });

  it("handles GET request as health / discovery endpoint", async () => {
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.supportedEvents).toContain("transaction.confirmed");
    expect(data.supportedEvents).toContain("user.wallet_created");
  });

  it("processes user.wallet_created event", async () => {
    const payload = {
      type: "user.wallet_created",
      data: {
        user: { id: "did:privy:cm123456789" },
        wallet: {
          address: "0x111122223333444455556666777788889999aaaa",
          chain_type: "ethereum",
          wallet_client_type: "privy",
        },
      },
    };

    const req = new Request("http://localhost:3000/api/webhooks/privy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("processed");
    expect(data.event).toBe("user.wallet_created");
    expect(data.address).toBe("0x111122223333444455556666777788889999aaaa");
    expect(data.auditId).toBeDefined();
  });

  it("processes wallet.restored event", async () => {
    const payload = {
      type: "wallet.restored",
      data: {
        user: { id: "did:privy:cm123456789" },
        wallet: { address: "0x3333222233334444555566667777888899993333" },
      },
    };

    const req = new Request("http://localhost:3000/api/webhooks/privy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("processed");
    expect(data.event).toBe("wallet.restored");
    expect(data.address).toBe("0x3333222233334444555566667777888899993333");
  });

  it("processes wallet.private_key_export event with alert severity", async () => {
    const payload = {
      type: "wallet.private_key_export",
      data: {
        user: { id: "did:privy:cm123456789" },
        wallet: { address: "0xbbbb22223333444455556666777788889999cccc" },
        timestamp: 1730000000,
      },
    };

    const req = new Request("http://localhost:3000/api/webhooks/privy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("processed");
    expect(data.event).toBe("wallet.private_key_export");
    expect(data.severity).toBe("alert");
    expect(data.address).toBe("0xbbbb22223333444455556666777788889999cccc");
  });

  it("processes transaction.broadcasted event", async () => {
    const payload = {
      type: "transaction.broadcasted",
      data: {
        transaction_hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        chain_id: 10143,
        wallet_address: "0x111122223333444455556666777788889999aaaa",
      },
    };

    const req = new Request("http://localhost:3000/api/webhooks/privy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("processed");
    expect(data.event).toBe("transaction.broadcasted");
    expect(data.txHash).toBe("0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890");
  });

  it("processes transaction.confirmed event", async () => {
    const payload = {
      type: "transaction.confirmed",
      data: {
        transaction_hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        chain_id: 10143,
        block_number: 67304188,
        wallet_address: "0x111122223333444455556666777788889999aaaa",
      },
    };

    const req = new Request("http://localhost:3000/api/webhooks/privy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("processed");
    expect(data.event).toBe("transaction.confirmed");
    expect(data.txHash).toBe("0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890");
  });

  it("processes transaction.execution_reverted event", async () => {
    const payload = {
      type: "transaction.execution_reverted",
      data: {
        transaction_hash: "0xfailedtx123",
        chain_id: 10143,
        error: "Execution reverted: Duplicate commitment",
      },
    };

    const req = new Request("http://localhost:3000/api/webhooks/privy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("processed");
    expect(data.event).toBe("transaction.execution_reverted");
  });

  it("processes transaction.replaced event", async () => {
    const payload = {
      type: "transaction.replaced",
      data: {
        transaction_hash: "0xoldtx123",
        replacement_transaction_hash: "0xnewtx456",
        chain_id: 10143,
      },
    };

    const req = new Request("http://localhost:3000/api/webhooks/privy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("processed");
    expect(data.event).toBe("transaction.replaced");
  });
});
