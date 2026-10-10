import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseClient, QueryResult } from "@clario/database";
import { ProtocolError } from "@clario/protocol";
import { TransactionImportService } from "./service";
import { MockImportAdapter } from "./adapter";
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

class MockDb implements DatabaseClient {
  expenses: Array<{ workspace_id: string; expense_id: string }> = [];
  sourceTransactions: SourceTxRecord[] = [];

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    if (
      sql.includes("FROM expenses WHERE workspace_id = $1 AND expense_id = $2")
    ) {
      const rows = this.expenses.filter(
        (e) => e.workspace_id === params[0] && e.expense_id === params[1],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    if (sql.includes("DELETE FROM source_transactions")) {
      const before = this.sourceTransactions.length;
      this.sourceTransactions = this.sourceTransactions.filter(
        (st) => !(st.workspace_id === params[0] && st.expense_id === params[1]),
      );
      const deleted = before - this.sourceTransactions.length;
      return { rows: [], rowCount: deleted };
    }

    if (
      sql.includes("FROM source_transactions") &&
      sql.includes("WHERE workspace_id = $1 AND source_chain_id = $2")
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

    if (
      sql.includes("FROM source_transactions") &&
      sql.includes("WHERE workspace_id = $1")
    ) {
      const rows = this.sourceTransactions.filter(
        (st) => st.workspace_id === params[0],
      ) as unknown as T[];
      return { rows, rowCount: rows.length };
    }

    if (sql.includes("INSERT INTO source_transactions")) {
      const workspaceId = params[0] as string;
      const expenseId = params[1] as string;
      const sourceChainId = Number(params[2]);
      const hash = (params[3] as string).toLowerCase();
      const slot = Number(params[4]);
      const provider = params[5] as string;
      const status = params[6] as string;

      // Unique constraint check: (workspace_id, source_chain_id, source_transaction_hash, claim_slot)
      const existing = this.sourceTransactions.find(
        (st) =>
          st.workspace_id === workspaceId &&
          st.source_chain_id === sourceChainId &&
          st.source_transaction_hash === hash &&
          st.claim_slot === slot,
      );
      if (existing) {
        throw new Error(
          "duplicate key value violates unique constraint uq_source_transactions",
        );
      }

      const newRecord: SourceTxRecord = {
        id: `uuid-${this.sourceTransactions.length + 1}`,
        workspace_id: workspaceId,
        expense_id: expenseId,
        source_chain_id: sourceChainId,
        source_transaction_hash: hash,
        claim_slot: slot,
        provider,
        status,
        imported_at: new Date().toISOString(),
      };
      this.sourceTransactions.push(newRecord);
      return { rows: [newRecord as unknown as T], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }
}

describe("TransactionImportService", () => {
  let db: MockDb;
  let adapter: MockImportAdapter;
  let service: TransactionImportService;
  const workspaceA =
    "0x1111111111111111111111111111111111111111111111111111111111111111";
  const workspaceB =
    "0x2222222222222222222222222222222222222222222222222222222222222222";
  const expense1 =
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const userAddr = "0x1111111111111111111111111111111111111111" as const;

  beforeEach(() => {
    db = new MockDb();
    adapter = new MockImportAdapter();
    service = new TransactionImportService(db, adapter);

    db.expenses.push({ workspace_id: workspaceA, expense_id: expense1 });
    db.expenses.push({ workspace_id: workspaceB, expense_id: expense1 });
  });

  describe("listCandidates", () => {
    it("returns candidate transactions with disclaimer and duplicate annotations", async () => {
      // 1. Initially no claimed transactions
      const res1 = await service.listCandidates(workspaceA, {
        address: userAddr,
      });

      expect(res1.items.length).toBeGreaterThan(0);
      expect(res1.disclaimer).toBe(IMPORTED_FACTS_DISCLAIMER);
      expect(res1.items.every((i) => !i.isClaimed)).toBe(true);

      // 2. Claim one transaction in workspaceA
      const targetTx = res1.items[0]!;
      await service.claimTransaction({
        workspaceId: workspaceA,
        expenseId: expense1,
        transaction: targetTx,
      });

      // 3. Query candidates again
      const res2 = await service.listCandidates(workspaceA, {
        address: userAddr,
      });

      const claimedItem = res2.items.find(
        (i) =>
          i.sourceTransactionHash.toLowerCase() ===
          targetTx.sourceTransactionHash.toLowerCase(),
      );
      expect(claimedItem).toBeDefined();
      expect(claimedItem?.isClaimed).toBe(true);
      expect(claimedItem?.claimedByExpenseId).toBe(expense1);
      expect(claimedItem?.warning).toContain("already been claimed");

      // 4. Verify multi-tenant isolation: in workspaceB, it should NOT be claimed
      const resB = await service.listCandidates(workspaceB, {
        address: userAddr,
      });
      const itemInB = resB.items.find(
        (i) =>
          i.sourceTransactionHash.toLowerCase() ===
          targetTx.sourceTransactionHash.toLowerCase(),
      );
      expect(itemInB?.isClaimed).toBe(false);
    });

    it("flags failed transactions with warning", async () => {
      const res = await service.listCandidates(workspaceA, {
        address: userAddr,
      });

      const failedItem = res.items.find((i) => i.status === "failed");
      expect(failedItem).toBeDefined();
      expect(failedItem?.warning).toContain("failed on the source chain");
    });

    it("validates required workspace ID", async () => {
      await expect(
        service.listCandidates("", { address: userAddr }),
      ).rejects.toThrowError(ProtocolError);
    });
  });

  describe("lookupByHash", () => {
    const validHash =
      "0x1111111111111111111111111111111111111111111111111111111111111111";

    it("looks up transaction by chain ID and hash", async () => {
      const tx = await service.lookupByHash(workspaceA, 10143, validHash);
      expect(tx).not.toBeNull();
      expect(tx?.sourceChainId).toBe(10143);
      expect(tx?.sourceTransactionHash).toBe(validHash);
      expect(tx?.isClaimed).toBe(false);
    });

    it("auto-detects transaction across supported chains when chainId is 0", async () => {
      const tx = await service.lookupByHash(workspaceA, 0, validHash);
      expect(tx).not.toBeNull();
      expect(tx?.sourceTransactionHash).toBe(validHash);
      expect(tx?.isClaimed).toBe(false);
    });

    it("reflects claim status in lookup result", async () => {
      const tx = (await service.lookupByHash(workspaceA, 10143, validHash))!;
      await service.claimTransaction({
        workspaceId: workspaceA,
        expenseId: expense1,
        transaction: tx,
      });

      const txAfterClaim = await service.lookupByHash(
        workspaceA,
        10143,
        validHash,
      );
      expect(txAfterClaim?.isClaimed).toBe(true);
      expect(txAfterClaim?.claimedByExpenseId).toBe(expense1);
    });

    it("rejects invalid hash or chain ID", async () => {
      await expect(
        service.lookupByHash(workspaceA, 10143, "invalid-hash"),
      ).rejects.toThrowError(ProtocolError);

      await expect(
        service.lookupByHash(workspaceA, -1, validHash),
      ).rejects.toThrowError(ProtocolError);
    });
  });

  describe("claimTransaction and duplicate detection", () => {
    const validTx: NormalizedTransaction = {
      sourceChainId: 10143,
      sourceTransactionHash:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      sender: userAddr,
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

    it("successfully claims a transaction and inserts into source_transactions", async () => {
      const claim = await service.claimTransaction({
        workspaceId: workspaceA,
        expenseId: expense1,
        transaction: validTx,
      });

      expect(claim.workspace_id).toBe(workspaceA);
      expect(claim.expense_id).toBe(expense1);
      expect(claim.source_chain_id).toBe(10143);
      expect(claim.source_transaction_hash).toBe(
        validTx.sourceTransactionHash.toLowerCase(),
      );
      expect(claim.claim_slot).toBe(0);
    });

    it("rejects duplicate claim on the same workspace, chain, hash, and slot", async () => {
      await service.claimTransaction({
        workspaceId: workspaceA,
        expenseId: expense1,
        transaction: validTx,
      });

      // Second claim with same slot should fail
      await expect(
        service.claimTransaction({
          workspaceId: workspaceA,
          expenseId: expense1,
          transaction: validTx,
        }),
      ).rejects.toThrowError(/already been claimed/);
    });

    it("permits claiming a different slot for the same transaction", async () => {
      await service.claimTransaction({
        workspaceId: workspaceA,
        expenseId: expense1,
        transaction: validTx,
        claimSlot: 0,
      });

      // Claiming slot 1 succeeds
      const claimSlot1 = await service.claimTransaction({
        workspaceId: workspaceA,
        expenseId: expense1,
        transaction: validTx,
        claimSlot: 1,
      });

      expect(claimSlot1.claim_slot).toBe(1);
    });

    it("rejects claiming a failed transaction", async () => {
      const failedTx: NormalizedTransaction = {
        ...validTx,
        status: "failed",
      };

      await expect(
        service.claimTransaction({
          workspaceId: workspaceA,
          expenseId: expense1,
          transaction: failedTx,
        }),
      ).rejects.toThrowError(/failed transaction/);
    });

    it("rejects claiming on unsupported chain", async () => {
      const unsupportedTx: NormalizedTransaction = {
        ...validTx,
        sourceChainId: 999999,
      };

      await expect(
        service.claimTransaction({
          workspaceId: workspaceA,
          expenseId: expense1,
          transaction: unsupportedTx,
        }),
      ).rejects.toThrowError(/not supported/);
    });

    it("releases claim when unlinked", async () => {
      await service.claimTransaction({
        workspaceId: workspaceA,
        expenseId: expense1,
        transaction: validTx,
      });

      expect(db.sourceTransactions.length).toBe(1);

      const deleted = await service.releaseClaim(workspaceA, expense1);
      expect(deleted).toBe(1);
      expect(db.sourceTransactions.length).toBe(0);
    });
  });
});
