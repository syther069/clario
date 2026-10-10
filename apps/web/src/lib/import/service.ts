/**
 * Clario Transaction Import Service
 * Source: PRD §9.3; Architecture §4
 *
 * Implements transaction candidate listing, duplicate detection by workspace/chain/hash/slot,
 * single transaction lookup with RPC/manual fallback, and claim registration.
 */

import {
  type DatabaseClient,
  type SourceTransactionRow,
} from "@clario/database";
import { ProtocolError } from "@clario/protocol";
import { getDatabaseClient } from "../db";
import {
  type TransactionImportAdapter,
  getDefaultImportAdapter,
} from "./adapter";
import { isChainSupported } from "./chains";
import {
  type NormalizedTransaction,
  type TransactionFilter,
  type TransactionImportCandidate,
  type PaginatedTransactions,
  IMPORTED_FACTS_DISCLAIMER,
} from "./types";

const BYTES32_REGEX = /^0x[0-9a-fA-F]{64}$/;

function makeClaimKey(
  chainId: number | string,
  hash: string,
  claimSlot: number,
): string {
  return `${chainId}:${hash.toLowerCase()}:${claimSlot}`;
}

export class TransactionImportService {
  private db: DatabaseClient | undefined;
  private adapter: TransactionImportAdapter;

  constructor(
    db?: DatabaseClient | undefined,
    adapter: TransactionImportAdapter = getDefaultImportAdapter(),
  ) {
    if (db) {
      this.db = db;
    } else {
      try {
        this.db = getDatabaseClient();
      } catch {
        this.db = undefined;
      }
    }
    this.adapter = adapter;
  }

  /**
   * Lists import candidate transactions for an address, enriched with duplicate detection
   * against the current workspace's claimed transactions.
   */
  async listCandidates(
    workspaceId: string,
    filter: TransactionFilter,
  ): Promise<PaginatedTransactions> {
    if (!workspaceId) {
      throw new ProtocolError("INVALID_IDENTIFIER", {
        message: "Workspace ID is required.",
      });
    }

    // 1. Fetch normalized transactions from the adapter
    const { items, nextCursor } = await this.adapter.fetchTransactions(filter);

    // 2. Query workspace claimed source transactions for duplicate detection
    const claimMap = new Map<string, SourceTransactionRow>();
    if (this.db) {
      try {
        const existingClaimsRes = await this.db.query<SourceTransactionRow>(
          `SELECT id, workspace_id, expense_id, source_chain_id, source_transaction_hash, claim_slot, provider, status, imported_at
           FROM source_transactions
           WHERE workspace_id = $1`,
          [workspaceId],
        );
        for (const claim of existingClaimsRes.rows) {
          const key = makeClaimKey(
            claim.source_chain_id,
            claim.source_transaction_hash,
            claim.claim_slot,
          );
          claimMap.set(key, claim);
        }
      } catch {
        // In dev or before migrations run, allow transaction listing to proceed without claims
      }
    }

    // 3. Annotate candidates with claim and status warnings
    const candidates: TransactionImportCandidate[] = items.map((item) => {
      const key = makeClaimKey(
        item.sourceChainId,
        item.sourceTransactionHash,
        item.claimSlot,
      );
      const existing = claimMap.get(key);

      if (existing) {
        return {
          ...item,
          isClaimed: true,
          claimedByExpenseId: existing.expense_id,
          warning: `This transaction has already been claimed in this workspace (Expense ID: ${existing.expense_id.slice(0, 12)}...).`,
        };
      }

      if (item.status === "failed") {
        return {
          ...item,
          isClaimed: false,
          claimedByExpenseId: null,
          warning:
            "This transaction failed on the source chain and cannot be used for expense claims.",
        };
      }

      return {
        ...item,
        isClaimed: false,
        claimedByExpenseId: null,
        warning: null,
      };
    });

    return {
      items: candidates,
      nextCursor,
      provider: this.adapter.providerName,
      disclaimer: IMPORTED_FACTS_DISCLAIMER,
    };
  }

  /**
   * Looks up a single transaction by source chain ID and transaction hash,
   * enriched with claim check against the workspace.
   */
  async lookupByHash(
    workspaceId: string,
    chainId: number,
    hash: string,
  ): Promise<TransactionImportCandidate | null> {
    if (!workspaceId) {
      throw new ProtocolError("INVALID_IDENTIFIER", {
        message: "Workspace ID is required.",
      });
    }
    if (!Number.isInteger(chainId) || chainId < 0) {
      throw new ProtocolError("UNSUPPORTED_CHAIN", {
        message: "Invalid chain ID.",
      });
    }
    const cleanHash = hash.trim();
    if (!BYTES32_REGEX.test(cleanHash)) {
      throw new ProtocolError("INVALID_IDENTIFIER", {
        message:
          "Transaction hash must be a 0x-prefixed 64-character hex string.",
      });
    }

    const normalizedHash = cleanHash.toLowerCase() as `0x${string}`;

    // 1. Fetch transaction details via adapter (with multi-chain auto-detect if chainId is 0)
    let tx: NormalizedTransaction | null = null;
    let resolvedChainId = chainId;

    if (chainId === 0) {
      const probeChainIds = [
        10143, 143, 8453, 1, 999, 42161, 10, 137, 11155111, 84532,
      ];
      const results = await Promise.all(
        probeChainIds.map((cid) =>
          this.adapter
            .fetchTransactionByHash(cid, normalizedHash)
            .catch(() => null),
        ),
      );
      const matchedIdx = results.findIndex((res) => res !== null);
      if (matchedIdx !== -1) {
        tx = results[matchedIdx]!;
        resolvedChainId = probeChainIds[matchedIdx]!;
      }
    } else {
      tx = await this.adapter.fetchTransactionByHash(
        chainId,
        normalizedHash,
      );
      resolvedChainId = chainId;
    }

    if (!tx) {
      return null;
    }

    // 2. Check if already claimed in this workspace
    let existing: SourceTransactionRow | undefined;
    if (this.db) {
      try {
        const claimRes = await this.db.query<SourceTransactionRow>(
          `SELECT id, workspace_id, expense_id, source_chain_id, source_transaction_hash, claim_slot, provider, status, imported_at
           FROM source_transactions
           WHERE workspace_id = $1 AND source_chain_id = $2 AND source_transaction_hash = $3 AND claim_slot = $4`,
          [workspaceId, resolvedChainId, normalizedHash, tx.claimSlot],
        );
        existing = claimRes.rows[0];
      } catch {
        existing = undefined;
      }
    }
    if (existing) {
      return {
        ...tx,
        isClaimed: true,
        claimedByExpenseId: existing.expense_id,
        warning: `This transaction has already been claimed in this workspace (Expense ID: ${existing.expense_id.slice(0, 12)}...).`,
      };
    }

    if (tx.status === "failed") {
      return {
        ...tx,
        isClaimed: false,
        claimedByExpenseId: null,
        warning:
          "This transaction failed on the source chain and cannot be used for expense claims.",
      };
    }

    return {
      ...tx,
      isClaimed: false,
      claimedByExpenseId: null,
      warning: null,
    };
  }

  /**
   * Records an imported transaction claim for an expense draft, enforcing
   * the database uniqueness constraint on (workspace_id, source_chain_id, source_transaction_hash, claim_slot).
   */
  async claimTransaction(params: {
    workspaceId: string;
    expenseId: string;
    transaction: NormalizedTransaction;
    claimSlot?: number | undefined;
  }): Promise<SourceTransactionRow> {
    const { workspaceId, expenseId, transaction } = params;
    const claimSlot = params.claimSlot ?? transaction.claimSlot ?? 0;

    if (!workspaceId || !expenseId) {
      throw new ProtocolError("INVALID_IDENTIFIER", {
        message: "Workspace ID and Expense ID are required.",
      });
    }
    if (!isChainSupported(transaction.sourceChainId)) {
      throw new ProtocolError("UNSUPPORTED_CHAIN", {
        message: `Chain ${transaction.sourceChainId} is not supported.`,
      });
    }
    if (transaction.status === "failed") {
      throw new ProtocolError("INVALID_TYPED_DATA", {
        message: "Cannot claim a failed transaction as payment proof.",
      });
    }

    if (!this.db) {
      throw new ProtocolError("INTERNAL_ERROR", {
        message: "Database connection is required to record transaction claims.",
      });
    }

    const cleanHash = transaction.sourceTransactionHash.toLowerCase();

    // Verify expense exists in this workspace
    const expenseRes = await this.db.query(
      `SELECT expense_id FROM expenses WHERE workspace_id = $1 AND expense_id = $2`,
      [workspaceId, expenseId],
    );
    if (expenseRes.rowCount === 0) {
      throw new ProtocolError("INVALID_IDENTIFIER", {
        message: "Expense not found in this workspace.",
      });
    }

    // Insert claim or fail on duplicate
    try {
      const insertRes = await this.db.query<SourceTransactionRow>(
        `INSERT INTO source_transactions (
           workspace_id,
           expense_id,
           source_chain_id,
           source_transaction_hash,
           claim_slot,
           provider,
           status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, workspace_id, expense_id, source_chain_id, source_transaction_hash, claim_slot, provider, status, imported_at`,
        [
          workspaceId,
          expenseId,
          transaction.sourceChainId,
          cleanHash,
          claimSlot,
          transaction.provenance.provider,
          transaction.status,
        ],
      );

      return insertRes.rows[0]!;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes("uq_source_transactions") ||
        message.includes("unique")
      ) {
        throw new ProtocolError("INVALID_TYPED_DATA", {
          message: `Transaction ${cleanHash} (slot ${claimSlot}) has already been claimed in this workspace.`,
        });
      }
      throw err;
    }
  }

  /**
   * Releases an existing transaction claim when an expense draft unlinks it or is deleted.
   */
  async releaseClaim(workspaceId: string, expenseId: string): Promise<number> {
    if (!this.db) {
      return 0;
    }
    const res = await this.db.query(
      `DELETE FROM source_transactions WHERE workspace_id = $1 AND expense_id = $2`,
      [workspaceId, expenseId],
    );
    return res.rowCount ?? 0;
  }
}
