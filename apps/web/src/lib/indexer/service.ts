import type { DatabaseClient } from "@clario/database";
import { withTransaction } from "@clario/database";
import {
  parseBytes32,
  parseCommitmentHash,
  parseEvmAddress,
  parseExpenseId,
  parseExpenseVersion,
  parsePaymentReference,
  parsePolicyCommitment,
  parsePolicyVersion,
  parseWorkspaceId,
  type Bytes32,
  type ClarioPublicEvent,
  type EvmAddress,
  type ExpenseId,
  type ExpenseVersion,
  type WorkspaceId,
} from "@clario/protocol";
import { rewindCheckpoint, saveCheckpoint } from "./checkpoints";
import { recordDeadLetter } from "./dead-letter";
import { handlePublicEvent } from "./handlers";
import { handleReorgRollback, handleSingleLogRemoved } from "./reorg";
import type {
  BatchIngestResult,
  IngestEventOptions,
  IngestResult,
  LogMetadata,
  PublicDecisionProjection,
  PublicExpenseProjection,
  PublicExpenseVersionProjection,
  PublicPolicyVersionProjection,
  PublicRoleGrantProjection,
  PublicSettlementProjection,
  PublicWorkspaceProjection,
  RawEventLog,
  RebuildProjectionsResult,
  ReorgRollbackResult,
} from "./types";

interface IndexedEventCheckRow {
  event_id: string;
  removed: boolean;
  status: string;
}

export class EventIndexerService {
  constructor(private readonly client: DatabaseClient) {}

  /**
   * Idempotently ingests a parsed Clario public event.
   * If the event was already indexed and not removed, returns "already_processed" with zero side-effects.
   */
  async ingestEvent(
    event: ClarioPublicEvent,
    meta: LogMetadata,
    options: IngestEventOptions = {},
  ): Promise<IngestResult> {
    const maxAttempts = options.retryAttempts ?? 3;
    const shouldUpdateCheckpoint = options.updateCheckpoint ?? true;

    // 1. Check idempotency: Has this exact log been processed?
    const existingRes = await this.client.query<IndexedEventCheckRow>(
      `SELECT event_id, removed, status
       FROM indexed_events
       WHERE chain_id = $1 AND transaction_hash = $2 AND log_index = $3
       LIMIT 1;`,
      [meta.chainId.toString(), meta.transactionHash, meta.logIndex],
    );

    const existing = existingRes.rows[0];
    if (existing && !existing.removed && existing.status === "confirmed") {
      return {
        status: "already_processed",
        eventId: existing.event_id,
        eventName: event.eventName,
        transactionHash: meta.transactionHash,
        logIndex: meta.logIndex,
      };
    }

    // 2. Attempt processing with retries and dead-letter fallback
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        const eventId = await withTransaction(this.client, async (tx) => {
          // Record or update indexed_events row
          const insertRes = await tx.query<{ event_id: string }>(
            `INSERT INTO indexed_events (
               chain_id, block_number, block_hash, transaction_hash, log_index,
               event_name, contract_address, workspace_id, payload, removed, status, indexed_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE, 'confirmed', NOW())
             ON CONFLICT (chain_id, transaction_hash, log_index)
             DO UPDATE SET
               block_number = EXCLUDED.block_number,
               block_hash = EXCLUDED.block_hash,
               event_name = EXCLUDED.event_name,
               contract_address = EXCLUDED.contract_address,
               workspace_id = EXCLUDED.workspace_id,
               payload = EXCLUDED.payload,
               removed = FALSE,
               status = 'confirmed',
               indexed_at = NOW()
             RETURNING event_id;`,
            [
              meta.chainId.toString(),
              meta.blockNumber.toString(),
              meta.blockHash,
              meta.transactionHash,
              meta.logIndex,
              event.eventName,
              meta.contractAddress.toLowerCase(),
              event.workspaceId,
              JSON.stringify(event, (_k, v) =>
                typeof v === "bigint" ? v.toString() : v,
              ),
            ],
          );

          // Dispatch to projection handler
          await handlePublicEvent(tx, event, meta);

          // Update checkpoint within transaction if requested
          if (shouldUpdateCheckpoint) {
            await saveCheckpoint(
              tx,
              meta.chainId,
              meta.contractAddress,
              meta.blockNumber,
              meta.blockHash,
            );
          }

          return insertRes.rows[0]!.event_id;
        });

        return {
          status: "indexed",
          eventId,
          eventName: event.eventName,
          transactionHash: meta.transactionHash,
          logIndex: meta.logIndex,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    // 3. Retries exhausted: Record to dead-letter queue
    const errorMessage = lastError
      ? lastError.message
      : "Unknown indexing error";
    await recordDeadLetter(this.client, {
      chainId: meta.chainId,
      blockNumber: meta.blockNumber,
      blockHash: meta.blockHash,
      transactionHash: meta.transactionHash,
      logIndex: meta.logIndex,
      eventName: event.eventName,
      contractAddress: meta.contractAddress,
      payload: event as unknown as Record<string, unknown>,
      errorMessage,
      attempts: attempt,
    });

    return {
      status: "dead_lettered",
      eventName: event.eventName,
      transactionHash: meta.transactionHash,
      logIndex: meta.logIndex,
      error: errorMessage,
    };
  }

  /**
   * Ingests a batch of parsed events in ordered sequence.
   */
  async ingestBatch(
    items: Array<{ event: ClarioPublicEvent; meta: LogMetadata }>,
    options: IngestEventOptions = {},
  ): Promise<BatchIngestResult> {
    const results: IngestResult[] = [];
    let indexed = 0;
    let skipped = 0;
    let deadLettered = 0;
    let failed = 0;

    for (const item of items) {
      const res = await this.ingestEvent(item.event, item.meta, options);
      results.push(res);

      if (res.status === "indexed") indexed++;
      else if (res.status === "already_processed") skipped++;
      else if (res.status === "dead_lettered") deadLettered++;
      else failed++;
    }

    return {
      total: items.length,
      indexed,
      skipped,
      deadLettered,
      failed,
      results,
    };
  }

  /**
   * Ingests a raw RPC/Viem event log.
   */
  async ingestRawLog(
    rawLog: RawEventLog,
    chainId: bigint,
    eventParser: (log: RawEventLog) => ClarioPublicEvent,
  ): Promise<IngestResult> {
    const transactionHash = parseBytes32(rawLog.transactionHash);
    const logIndex = Number(rawLog.logIndex);

    // Handle removed logs
    if (rawLog.removed === true) {
      await handleSingleLogRemoved(
        this.client,
        chainId,
        transactionHash,
        logIndex,
      );
      return {
        status: "indexed",
        eventName: "LogRemoved",
        transactionHash,
        logIndex,
      };
    }

    const event = eventParser(rawLog);
    const meta: LogMetadata = {
      chainId,
      contractAddress: parseEvmAddress(rawLog.address),
      blockNumber: BigInt(rawLog.blockNumber),
      blockHash: parseBytes32(rawLog.blockHash),
      transactionHash,
      logIndex,
    };

    return this.ingestEvent(event, meta);
  }

  /**
   * Handles a chain reorganization from `fromBlockNumber`.
   */
  async handleReorganization(
    chainId: bigint,
    fromBlockNumber: bigint,
  ): Promise<ReorgRollbackResult> {
    return handleReorgRollback(this.client, chainId, fromBlockNumber);
  }

  /**
   * Deterministically rebuilds all public projections from genesis or a specific block.
   * Proves that public projections are 100% rebuildable from indexed event history.
   */
  async rebuildProjections(
    chainId: bigint,
    fromBlock = 0n,
  ): Promise<RebuildProjectionsResult> {
    const startTime = Date.now();

    return withTransaction(this.client, async (tx) => {
      // 1. Clear projections
      await tx.query(`DELETE FROM projection_settlements;`);
      await tx.query(`DELETE FROM projection_decisions;`);
      await tx.query(`DELETE FROM projection_expense_versions;`);
      await tx.query(`DELETE FROM projection_expenses;`);
      await tx.query(
        `DELETE FROM projection_policy_versions WHERE policy_version > 1;`,
      );
      await tx.query(`DELETE FROM projection_role_grants;`);
      await tx.query(`DELETE FROM projection_workspaces;`);

      // 2. Fetch all valid indexed events in strict chronological order
      const eventsRes = await tx.query<{
        event_name: string;
        contract_address: string;
        block_number: string | number;
        block_hash: string;
        transaction_hash: string;
        log_index: number;
        payload: Record<string, unknown>;
      }>(
        `SELECT event_name, contract_address, block_number, block_hash,
                transaction_hash, log_index, payload
         FROM indexed_events
         WHERE chain_id = $1
           AND block_number >= $2
           AND removed = FALSE
         ORDER BY block_number ASC, log_index ASC;`,
        [chainId.toString(), fromBlock.toString()],
      );

      let lastBlock = 0n;
      let lastBlockHash =
        "0x0000000000000000000000000000000000000000000000000000000000000000" as Bytes32;
      let lastContractAddress =
        "0x0000000000000000000000000000000000000000" as EvmAddress;

      for (const row of eventsRes.rows) {
        const meta: LogMetadata = {
          chainId,
          contractAddress: parseEvmAddress(row.contract_address),
          blockNumber: BigInt(row.block_number),
          blockHash: parseBytes32(row.block_hash),
          transactionHash: parseBytes32(row.transaction_hash),
          logIndex: row.log_index,
        };

        const event = row.payload as unknown as ClarioPublicEvent;
        await handlePublicEvent(tx, event, meta);

        lastBlock = meta.blockNumber;
        lastBlockHash = meta.blockHash;
        lastContractAddress = meta.contractAddress;
      }

      if (eventsRes.rows.length > 0) {
        await rewindCheckpoint(
          tx,
          chainId,
          lastContractAddress,
          lastBlock,
          lastBlockHash,
        );
      }

      // Count reconstructed projections
      const [wsRes, rolesRes, policiesRes, expRes, expVerRes, decRes, setRes] =
        await Promise.all([
          tx.query<{ count: string | number }>(
            `SELECT COUNT(*) as count FROM projection_workspaces;`,
          ),
          tx.query<{ count: string | number }>(
            `SELECT COUNT(*) as count FROM projection_role_grants;`,
          ),
          tx.query<{ count: string | number }>(
            `SELECT COUNT(*) as count FROM projection_policy_versions;`,
          ),
          tx.query<{ count: string | number }>(
            `SELECT COUNT(*) as count FROM projection_expenses;`,
          ),
          tx.query<{ count: string | number }>(
            `SELECT COUNT(*) as count FROM projection_expense_versions;`,
          ),
          tx.query<{ count: string | number }>(
            `SELECT COUNT(*) as count FROM projection_decisions;`,
          ),
          tx.query<{ count: string | number }>(
            `SELECT COUNT(*) as count FROM projection_settlements;`,
          ),
        ]);

      return {
        chainId,
        fromBlock,
        totalEventsReplayed: eventsRes.rows.length,
        projectionsRebuilt: {
          workspaces: Number(wsRes.rows[0]?.count ?? 0),
          roleGrants: Number(rolesRes.rows[0]?.count ?? 0),
          policyVersions: Number(policiesRes.rows[0]?.count ?? 0),
          expenses: Number(expRes.rows[0]?.count ?? 0),
          expenseVersions: Number(expVerRes.rows[0]?.count ?? 0),
          decisions: Number(decRes.rows[0]?.count ?? 0),
          settlements: Number(setRes.rows[0]?.count ?? 0),
        },
        durationMs: Date.now() - startTime,
      };
    });
  }

  /**
   * Queries public workspace projection.
   */
  async getWorkspaceProjection(
    workspaceId: WorkspaceId,
  ): Promise<PublicWorkspaceProjection | null> {
    const res = await this.client.query<{
      workspace_id: string;
      owner_address: string;
      policy_commitment: string;
      current_policy_version: number;
      created_at_block: string | number;
      created_at_tx: string;
      updated_at: Date | string;
    }>(
      `SELECT workspace_id, owner_address, policy_commitment, current_policy_version,
              created_at_block, created_at_tx, updated_at
       FROM projection_workspaces
       WHERE workspace_id = $1
       LIMIT 1;`,
      [workspaceId],
    );

    const row = res.rows[0];
    if (!row) return null;

    return {
      workspaceId: parseWorkspaceId(row.workspace_id),
      ownerAddress: parseEvmAddress(row.owner_address),
      policyCommitment: parsePolicyCommitment(row.policy_commitment),
      currentPolicyVersion: parsePolicyVersion(row.current_policy_version),
      createdAtBlock: BigInt(row.created_at_block),
      createdAtTx: parseBytes32(row.created_at_tx),
      updatedAt: row.updated_at,
    };
  }

  /**
   * Queries public role grants for a workspace.
   */
  async getRoleGrantsProjection(
    workspaceId: WorkspaceId,
  ): Promise<PublicRoleGrantProjection[]> {
    const res = await this.client.query<{
      grant_id: string;
      workspace_id: string;
      account_address: string;
      role: string;
      scope: string;
      active: boolean;
      granted_at_block: string | number;
      granted_at_tx: string;
      revoked_at_block: string | number | null;
      revoked_at_tx: string | null;
    }>(
      `SELECT grant_id, workspace_id, account_address, role, scope, active,
              granted_at_block, granted_at_tx, revoked_at_block, revoked_at_tx
       FROM projection_role_grants
       WHERE workspace_id = $1
       ORDER BY granted_at_block ASC;`,
      [workspaceId],
    );

    return res.rows.map((row) => ({
      grantId: row.grant_id,
      workspaceId: parseWorkspaceId(row.workspace_id),
      accountAddress: parseEvmAddress(row.account_address),
      role: parseBytes32(row.role),
      scope: parseBytes32(row.scope),
      active: Boolean(row.active),
      grantedAtBlock: BigInt(row.granted_at_block),
      grantedAtTx: parseBytes32(row.granted_at_tx),
      revokedAtBlock:
        row.revoked_at_block !== null ? BigInt(row.revoked_at_block) : null,
      revokedAtTx:
        row.revoked_at_tx !== null ? parseBytes32(row.revoked_at_tx) : null,
    }));
  }

  /**
   * Queries public policy versions for a workspace.
   */
  async getPolicyVersionsProjection(
    workspaceId: WorkspaceId,
  ): Promise<PublicPolicyVersionProjection[]> {
    const res = await this.client.query<{
      workspace_id: string;
      policy_version: number;
      policy_commitment: string;
      updated_at_block: string | number;
      updated_at_tx: string;
      indexed_at: Date | string;
    }>(
      `SELECT workspace_id, policy_version, policy_commitment, updated_at_block, updated_at_tx, indexed_at
       FROM projection_policy_versions
       WHERE workspace_id = $1
       ORDER BY policy_version ASC;`,
      [workspaceId],
    );

    return res.rows.map((row) => ({
      workspaceId: parseWorkspaceId(row.workspace_id),
      policyVersion: parsePolicyVersion(row.policy_version),
      policyCommitment: parsePolicyCommitment(row.policy_commitment),
      updatedAtBlock: BigInt(row.updated_at_block),
      updatedAtTx: parseBytes32(row.updated_at_tx),
      indexedAt: row.indexed_at,
    }));
  }

  /**
   * Queries public expense anchor projection.
   */
  async getExpenseProjection(
    workspaceId: WorkspaceId,
    expenseId: ExpenseId,
  ): Promise<PublicExpenseProjection | null> {
    const res = await this.client.query<{
      workspace_id: string;
      expense_id: string;
      current_version: number;
      current_commitment: string;
      latest_submitter: string;
      submitted_at_block: string | number;
      submitted_at_tx: string;
      updated_at: Date | string;
    }>(
      `SELECT workspace_id, expense_id, current_version, current_commitment,
              latest_submitter, submitted_at_block, submitted_at_tx, updated_at
       FROM projection_expenses
       WHERE workspace_id = $1 AND expense_id = $2
       LIMIT 1;`,
      [workspaceId, expenseId],
    );

    const row = res.rows[0];
    if (!row) return null;

    return {
      workspaceId: parseWorkspaceId(row.workspace_id),
      expenseId: parseExpenseId(row.expense_id),
      currentVersion: parseExpenseVersion(row.current_version),
      currentCommitment: parseCommitmentHash(row.current_commitment),
      latestSubmitter: parseEvmAddress(row.latest_submitter),
      submittedAtBlock: BigInt(row.submitted_at_block),
      submittedAtTx: parseBytes32(row.submitted_at_tx),
      updatedAt: row.updated_at,
    };
  }

  /**
   * Queries public expense version projection.
   */
  async getExpenseVersionProjection(
    workspaceId: WorkspaceId,
    expenseId: ExpenseId,
    version: ExpenseVersion,
  ): Promise<PublicExpenseVersionProjection | null> {
    const res = await this.client.query<{
      workspace_id: string;
      expense_id: string;
      version: number;
      commitment: string;
      submitter: string;
      is_superseded: boolean;
      superseded_by_version: number | null;
      submitted_at_block: string | number;
      submitted_at_tx: string;
      indexed_at: Date | string;
    }>(
      `SELECT workspace_id, expense_id, version, commitment, submitter,
              is_superseded, superseded_by_version, submitted_at_block, submitted_at_tx, indexed_at
       FROM projection_expense_versions
       WHERE workspace_id = $1 AND expense_id = $2 AND version = $3
       LIMIT 1;`,
      [workspaceId, expenseId, version],
    );

    const row = res.rows[0];
    if (!row) return null;

    return {
      workspaceId: parseWorkspaceId(row.workspace_id),
      expenseId: parseExpenseId(row.expense_id),
      version: parseExpenseVersion(row.version),
      commitment: parseCommitmentHash(row.commitment),
      submitter: parseEvmAddress(row.submitter),
      isSuperseded: Boolean(row.is_superseded),
      supersededByVersion:
        row.superseded_by_version !== null
          ? parseExpenseVersion(row.superseded_by_version)
          : null,
      submittedAtBlock: BigInt(row.submitted_at_block),
      submittedAtTx: parseBytes32(row.submitted_at_tx),
      indexedAt: row.indexed_at,
    };
  }

  /**
   * Queries public decision projection.
   */
  async getDecisionProjection(
    workspaceId: WorkspaceId,
    expenseId: ExpenseId,
    version: ExpenseVersion,
  ): Promise<PublicDecisionProjection | null> {
    const res = await this.client.query<{
      workspace_id: string;
      expense_id: string;
      version: number;
      commitment: string;
      reviewer: string;
      decision: "approve" | "reject" | "request_changes";
      reason_commitment: string | null;
      recorded_at_block: string | number;
      recorded_at_tx: string;
      indexed_at: Date | string;
    }>(
      `SELECT workspace_id, expense_id, version, commitment, reviewer,
              decision, reason_commitment, recorded_at_block, recorded_at_tx, indexed_at
       FROM projection_decisions
       WHERE workspace_id = $1 AND expense_id = $2 AND version = $3
       LIMIT 1;`,
      [workspaceId, expenseId, version],
    );

    const row = res.rows[0];
    if (!row) return null;

    return {
      workspaceId: parseWorkspaceId(row.workspace_id),
      expenseId: parseExpenseId(row.expense_id),
      version: parseExpenseVersion(row.version),
      commitment: parseCommitmentHash(row.commitment),
      reviewer: parseEvmAddress(row.reviewer),
      decision: row.decision,
      reasonCommitment:
        row.reason_commitment !== null
          ? parseBytes32(row.reason_commitment)
          : null,
      recordedAtBlock: BigInt(row.recorded_at_block),
      recordedAtTx: parseBytes32(row.recorded_at_tx),
      indexedAt: row.indexed_at,
    };
  }

  /**
   * Queries public settlement projection.
   */
  async getSettlementProjection(
    workspaceId: WorkspaceId,
    expenseId: ExpenseId,
    version: ExpenseVersion,
  ): Promise<PublicSettlementProjection | null> {
    const res = await this.client.query<{
      workspace_id: string;
      expense_id: string;
      version: number;
      commitment: string;
      token: string;
      recipient: string;
      amount: string | number;
      payment_reference: string;
      settled_at_block: string | number;
      settled_at_tx: string;
      indexed_at: Date | string;
    }>(
      `SELECT workspace_id, expense_id, version, commitment, token, recipient,
              amount, payment_reference, settled_at_block, settled_at_tx, indexed_at
       FROM projection_settlements
       WHERE workspace_id = $1 AND expense_id = $2 AND version = $3
       LIMIT 1;`,
      [workspaceId, expenseId, version],
    );

    const row = res.rows[0];
    if (!row) return null;

    return {
      workspaceId: parseWorkspaceId(row.workspace_id),
      expenseId: parseExpenseId(row.expense_id),
      version: parseExpenseVersion(row.version),
      commitment: parseCommitmentHash(row.commitment),
      token: parseEvmAddress(row.token),
      recipient: parseEvmAddress(row.recipient),
      amount: BigInt(row.amount),
      paymentReference: parsePaymentReference(row.payment_reference),
      settledAtBlock: BigInt(row.settled_at_block),
      settledAtTx: parseBytes32(row.settled_at_tx),
      indexedAt: row.indexed_at,
    };
  }
}
