import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { DatabaseClient, QueryResult } from "@clario/database";
import { GET as getTransactionsHandler } from "@/app/api/workspaces/[workspaceId]/import/transactions/route";
import { GET as lookupHandler } from "@/app/api/workspaces/[workspaceId]/import/lookup/route";
import { POST as claimHandler } from "@/app/api/workspaces/[workspaceId]/import/claim/route";
import { setDatabaseClient } from "@/lib/db";
import {
  createSessionPayload,
  signSessionToken,
  serializeSessionCookie,
} from "@/lib/auth/session";
import { getSessionSecret } from "@/lib/auth/context";
import { IMPORTED_FACTS_DISCLAIMER, type NormalizedTransaction } from "./types";

interface SourceTxRecord {
  id: string;
  workspace_id: string;
  expense_id: string;
  source_chain_id: number;
  source_transaction_hash: string;
  claim_slot: number;
  provider: string;
  status: string;
  imported_at: string;
}

class MockDbForImportRoutes implements DatabaseClient {
  workspaces: Array<{ workspace_id: string; created_by: string }> = [];
  memberships: Array<{
    membership_id: string;
    workspace_id: string;
    user_id: string;
    address: string;
    status: "active" | "suspended" | "revoked";
  }> = [];
  expenses: Array<{ workspace_id: string; expense_id: string }> = [];
  sourceTransactions: SourceTxRecord[] = [];

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    const s = sql.replace(/\s+/g, " ").trim();

    // Workspaces
    if (s.includes("FROM workspaces WHERE workspace_id = $1")) {
      const rows = this.workspaces.filter(
        (w) => w.workspace_id === params[0],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Memberships
    if (s.includes("FROM memberships")) {
      const rows = this.memberships.filter(
        (m) =>
          m.workspace_id === params[0] &&
          (m.address.toLowerCase() === (params[1] as string)?.toLowerCase() ||
            m.user_id === params[1]),
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Expenses
    if (
      s.includes("FROM expenses WHERE workspace_id = $1 AND expense_id = $2")
    ) {
      const rows = this.expenses.filter(
        (e) => e.workspace_id === params[0] && e.expense_id === params[1],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Source Transactions query by workspace
    if (
      s.includes("FROM source_transactions") &&
      s.includes("WHERE workspace_id = $1") &&
      !s.includes("source_chain_id")
    ) {
      const rows = this.sourceTransactions.filter(
        (st) => st.workspace_id === params[0],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Source Transactions query by workspace, chain, hash, slot
    if (
      s.includes("FROM source_transactions") &&
      s.includes("source_chain_id = $2")
    ) {
      const rows = this.sourceTransactions.filter(
        (st) =>
          st.workspace_id === params[0] &&
          st.source_chain_id === Number(params[1]) &&
          st.source_transaction_hash.toLowerCase() ===
            (params[2] as string).toLowerCase() &&
          st.claim_slot === Number(params[3]),
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    // Insert source transaction
    if (s.includes("INSERT INTO source_transactions")) {
      const workspaceId = params[0] as string;
      const expenseId = params[1] as string;
      const chainId = Number(params[2]);
      const hash = (params[3] as string).toLowerCase();
      const slot = Number(params[4]);
      const provider = params[5] as string;
      const status = params[6] as string;

      const existing = this.sourceTransactions.find(
        (st) =>
          st.workspace_id === workspaceId &&
          st.source_chain_id === chainId &&
          st.source_transaction_hash === hash &&
          st.claim_slot === slot,
      );
      if (existing) {
        throw new Error(
          "duplicate key value violates unique constraint uq_source_transactions",
        );
      }

      const row: SourceTxRecord = {
        id: `uuid-${this.sourceTransactions.length + 1}`,
        workspace_id: workspaceId,
        expense_id: expenseId,
        source_chain_id: chainId,
        source_transaction_hash: hash,
        claim_slot: slot,
        provider,
        status,
        imported_at: new Date().toISOString(),
      };
      this.sourceTransactions.push(row);
      return { rows: [row as unknown as T], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }
}

describe("Transaction Import API Routes", () => {
  let mockDb: MockDbForImportRoutes;
  const WS_ID =
    "0x1111111111111111111111111111111111111111111111111111111111111111";
  const EXPENSE_ID =
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const USER_ADDR: `0x${string}` = "0x1111111111111111111111111111111111111111";

  function createAuthHeader(address: `0x${string}`): {
    Cookie: string;
    "x-csrf-token": string;
  } {
    const payload = createSessionPayload({
      userId: `user-${address.slice(2, 8)}`,
      address,
    });
    const token = signSessionToken(payload, getSessionSecret());
    const cookieStr = serializeSessionCookie(token);
    return {
      Cookie: cookieStr.split(";")[0]!,
      "x-csrf-token": payload.csrfToken,
    };
  }

  beforeEach(() => {
    mockDb = new MockDbForImportRoutes();
    setDatabaseClient(mockDb);

    mockDb.workspaces.push({
      workspace_id: WS_ID,
      created_by: USER_ADDR,
    });

    mockDb.memberships.push({
      membership_id: "mem-1",
      workspace_id: WS_ID,
      user_id: "user-111111",
      address: USER_ADDR,
      status: "active",
    });

    mockDb.expenses.push({
      workspace_id: WS_ID,
      expense_id: EXPENSE_ID,
    });
  });

  afterEach(() => {
    setDatabaseClient(null as unknown as DatabaseClient);
  });

  describe("GET /api/workspaces/[wsId]/import/transactions", () => {
    it("rejects unauthenticated request with 401", async () => {
      const req = new Request(
        `http://localhost/api/workspaces/${WS_ID}/import/transactions`,
      );
      const res = await getTransactionsHandler(req, {
        params: Promise.resolve({ workspaceId: WS_ID }),
      });

      expect(res.status).toBe(401);
    });

    it("rejects invalid address query param with 400", async () => {
      const auth = createAuthHeader(USER_ADDR);
      const req = new Request(
        `http://localhost/api/workspaces/${WS_ID}/import/transactions?address=invalid-address`,
        { headers: auth },
      );
      const res = await getTransactionsHandler(req, {
        params: Promise.resolve({ workspaceId: WS_ID }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("INVALID_IDENTIFIER");
    });

    it("returns candidate transactions and disclaimer when authenticated", async () => {
      const auth = createAuthHeader(USER_ADDR);
      const req = new Request(
        `http://localhost/api/workspaces/${WS_ID}/import/transactions?address=${USER_ADDR}&chainId=10143`,
        { headers: auth },
      );
      const res = await getTransactionsHandler(req, {
        params: Promise.resolve({ workspaceId: WS_ID }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.items.length).toBeGreaterThan(0);
      expect(body.disclaimer).toBe(IMPORTED_FACTS_DISCLAIMER);
    });
  });

  describe("GET /api/workspaces/[wsId]/import/lookup", () => {
    const validHash =
      "0x1111111111111111111111111111111111111111111111111111111111111111";

    it("rejects missing parameters with 400", async () => {
      const auth = createAuthHeader(USER_ADDR);
      const req = new Request(
        `http://localhost/api/workspaces/${WS_ID}/import/lookup?hash=${validHash}`,
        { headers: auth },
      );
      const res = await lookupHandler(req, {
        params: Promise.resolve({ workspaceId: WS_ID }),
      });

      expect(res.status).toBe(400);
    });

    it("looks up transaction by hash successfully", async () => {
      const auth = createAuthHeader(USER_ADDR);
      const req = new Request(
        `http://localhost/api/workspaces/${WS_ID}/import/lookup?chainId=10143&hash=${validHash}`,
        { headers: auth },
      );
      const res = await lookupHandler(req, {
        params: Promise.resolve({ workspaceId: WS_ID }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.transaction.sourceTransactionHash).toBe(validHash);
      expect(body.disclaimer).toBe(IMPORTED_FACTS_DISCLAIMER);
    });
  });

  describe("POST /api/workspaces/[wsId]/import/claim", () => {
    const validTx: NormalizedTransaction = {
      sourceChainId: 10143,
      sourceTransactionHash:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      sender: USER_ADDR,
      recipient: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      assetAddress: "0x0000000000000000000000000000000000001001",
      assetSymbol: "USDC",
      assetDecimals: 6,
      rawAmount: "150000000",
      formattedAmount: "150.00",
      blockNumber: 123456,
      blockTimestamp: "2026-09-15T12:00:00Z",
      status: "confirmed",
      claimSlot: 0,
      provenance: {
        provider: "mock",
        fetchedAt: "2026-09-17T12:00:00Z",
        rawReference: null,
        disclaimer: IMPORTED_FACTS_DISCLAIMER,
      },
    };

    it("rejects mutating claim without CSRF token", async () => {
      const auth = createAuthHeader(USER_ADDR);
      const req = new Request(
        `http://localhost/api/workspaces/${WS_ID}/import/claim`,
        {
          method: "POST",
          headers: {
            Cookie: auth.Cookie,
            // Omitting x-csrf-token
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            expenseId: EXPENSE_ID,
            transaction: validTx,
          }),
        },
      );
      const res = await claimHandler(req, {
        params: Promise.resolve({ workspaceId: WS_ID }),
      });

      expect(res.status).toBe(401);
    });

    it("successfully claims transaction and records claim", async () => {
      const auth = createAuthHeader(USER_ADDR);
      const req = new Request(
        `http://localhost/api/workspaces/${WS_ID}/import/claim`,
        {
          method: "POST",
          headers: {
            ...auth,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            expenseId: EXPENSE_ID,
            transaction: validTx,
          }),
        },
      );
      const res = await claimHandler(req, {
        params: Promise.resolve({ workspaceId: WS_ID }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.claim.source_transaction_hash).toBe(
        validTx.sourceTransactionHash.toLowerCase(),
      );
      expect(body.disclaimer).toBe(IMPORTED_FACTS_DISCLAIMER);
    });

    it("rejects duplicate claim with 400", async () => {
      const auth = createAuthHeader(USER_ADDR);
      // First claim
      await claimHandler(
        new Request(`http://localhost/api/workspaces/${WS_ID}/import/claim`, {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({
            expenseId: EXPENSE_ID,
            transaction: validTx,
          }),
        }),
        { params: Promise.resolve({ workspaceId: WS_ID }) },
      );

      // Duplicate claim
      const res = await claimHandler(
        new Request(`http://localhost/api/workspaces/${WS_ID}/import/claim`, {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({
            expenseId: EXPENSE_ID,
            transaction: validTx,
          }),
        }),
        { params: Promise.resolve({ workspaceId: WS_ID }) },
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toContain("already been claimed");
    });
  });
});
