import type { DatabaseClient } from "@clario/database";
import {
  parseWorkspaceId,
  type Bytes32,
  type WorkspaceId,
} from "@clario/protocol";
import type { ReorgRollbackResult } from "./types";

interface AffectedEventRow {
  workspace_id: string | null;
  transaction_hash: string;
  log_index: number;
  event_name: string;
}

/**
 * Handles a chain reorganization by rolling back all events and projections at or above `fromBlockNumber`.
 */
export async function handleReorgRollback(
  client: DatabaseClient,
  chainId: bigint,
  fromBlockNumber: bigint,
): Promise<ReorgRollbackResult> {
  // 1. Identify all non-removed events at or above fromBlockNumber
  const affectedEventsRes = await client.query<AffectedEventRow>(
    `SELECT workspace_id, transaction_hash, log_index, event_name
     FROM indexed_events
     WHERE chain_id = $1
       AND block_number >= $2
       AND removed = FALSE;`,
    [chainId.toString(), fromBlockNumber.toString()],
  );

  const affectedEvents = affectedEventsRes.rows;
  const affectedWorkspacesSet = new Set<WorkspaceId>();

  for (const ev of affectedEvents) {
    if (ev.workspace_id) {
      affectedWorkspacesSet.add(parseWorkspaceId(ev.workspace_id));
    }
  }

  // 2. Mark events as removed and reorged in indexed_events
  await client.query(
    `UPDATE indexed_events
     SET removed = TRUE,
         status = 'reorged'
     WHERE chain_id = $1
       AND block_number >= $2
       AND removed = FALSE;`,
    [chainId.toString(), fromBlockNumber.toString()],
  );

  // 3. Mark affected chain transactions as reorged
  await client.query(
    `UPDATE chain_transactions
     SET status = 'reorged'
     WHERE chain_id = $1
       AND block_number >= $2;`,
    [chainId.toString(), fromBlockNumber.toString()],
  );

  // 4. Retract public projections created at or above fromBlockNumber
  // Decisions
  await client.query(
    `DELETE FROM projection_decisions
     WHERE recorded_at_block >= $1;`,
    [fromBlockNumber.toString()],
  );

  // Settlements
  await client.query(
    `DELETE FROM projection_settlements
     WHERE settled_at_block >= $1;`,
    [fromBlockNumber.toString()],
  );

  // Expense Versions
  await client.query(
    `DELETE FROM projection_expense_versions
     WHERE submitted_at_block >= $1;`,
    [fromBlockNumber.toString()],
  );

  // Policy Versions
  await client.query(
    `DELETE FROM projection_policy_versions
     WHERE updated_at_block >= $1 AND policy_version > 1;`,
    [fromBlockNumber.toString()],
  );

  // Role Grants: Remove grants made in reorged blocks, un-revoke grants revoked in reorged blocks
  await client.query(
    `DELETE FROM projection_role_grants
     WHERE granted_at_block >= $1;`,
    [fromBlockNumber.toString()],
  );

  await client.query(
    `UPDATE projection_role_grants
     SET active = TRUE,
         revoked_at_block = NULL,
         revoked_at_tx = NULL,
         updated_at = NOW()
     WHERE revoked_at_block >= $1;`,
    [fromBlockNumber.toString()],
  );

  // Re-synchronize projection_expenses anchor from remaining valid projection_expense_versions
  await client.query(
    `DELETE FROM projection_expenses
     WHERE submitted_at_block >= $1
       AND NOT EXISTS (
         SELECT 1 FROM projection_expense_versions pev
         WHERE pev.workspace_id = projection_expenses.workspace_id
           AND pev.expense_id = projection_expenses.expense_id
       );`,
    [fromBlockNumber.toString()],
  );

  return {
    rolledBackFromBlock: fromBlockNumber,
    markedRemovedCount: affectedEvents.length,
    affectedWorkspaces: Array.from(affectedWorkspacesSet),
  };
}

/**
 * Handles a single log removal (when an RPC log arrives with `removed: true`).
 */
export async function handleSingleLogRemoved(
  client: DatabaseClient,
  chainId: bigint,
  transactionHash: Bytes32,
  logIndex: number,
): Promise<boolean> {
  const check = await client.query<{ block_number: string | number }>(
    `SELECT block_number
     FROM indexed_events
     WHERE chain_id = $1 AND transaction_hash = $2 AND log_index = $3
     LIMIT 1;`,
    [chainId.toString(), transactionHash, logIndex],
  );

  if (!check.rows[0]) {
    return false;
  }

  const blockNumber = BigInt(check.rows[0].block_number);

  await client.query(
    `UPDATE indexed_events
     SET removed = TRUE,
         status = 'removed'
     WHERE chain_id = $1 AND transaction_hash = $2 AND log_index = $3;`,
    [chainId.toString(), transactionHash, logIndex],
  );

  // Roll back affected projections from this block
  await handleReorgRollback(client, chainId, blockNumber);
  return true;
}
