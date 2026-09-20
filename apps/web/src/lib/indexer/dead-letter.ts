import type { DatabaseClient } from "@clario/database";
import {
  parseBytes32,
  parseEvmAddress,
  type Bytes32,
  type EvmAddress,
} from "@clario/protocol";
import type { DeadLetterItem } from "./types";

interface DbDeadLetterRow {
  dead_letter_id: string;
  chain_id: string | number;
  block_number: string | number;
  block_hash: string;
  transaction_hash: string;
  log_index: number;
  event_name: string;
  contract_address: string;
  payload: Record<string, unknown>;
  error_message: string;
  attempts: number;
  created_at: Date | string;
  resolved_at: Date | string | null;
}

/**
 * Records or updates a dead letter entry when an event fails processing after max retries.
 */
export async function recordDeadLetter(
  client: DatabaseClient,
  params: {
    chainId: bigint;
    blockNumber: bigint;
    blockHash: Bytes32;
    transactionHash: Bytes32;
    logIndex: number;
    eventName: string;
    contractAddress: EvmAddress;
    payload: Record<string, unknown>;
    errorMessage: string;
    attempts: number;
  },
): Promise<string> {
  const result = await client.query<{ dead_letter_id: string }>(
    `INSERT INTO indexer_dead_letters (
       chain_id, block_number, block_hash, transaction_hash, log_index,
       event_name, contract_address, payload, error_message, attempts
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING dead_letter_id;`,
    [
      params.chainId.toString(),
      params.blockNumber.toString(),
      params.blockHash,
      params.transactionHash,
      params.logIndex,
      params.eventName,
      params.contractAddress,
      JSON.stringify(params.payload, (_k, v) =>
        typeof v === "bigint" ? v.toString() : v,
      ),
      params.errorMessage,
      params.attempts,
    ],
  );

  return result.rows[0]!.dead_letter_id;
}

/**
 * Retrieves unresolved dead letters for a specific chain or across all chains.
 */
export async function listUnresolvedDeadLetters(
  client: DatabaseClient,
  chainId?: bigint | undefined,
): Promise<DeadLetterItem[]> {
  let sql = `
    SELECT dead_letter_id, chain_id, block_number, block_hash, transaction_hash,
           log_index, event_name, contract_address, payload, error_message, attempts,
           created_at, resolved_at
    FROM indexer_dead_letters
    WHERE resolved_at IS NULL
  `;
  const params: unknown[] = [];

  if (chainId !== undefined) {
    sql += ` AND chain_id = $1`;
    params.push(chainId.toString());
  }

  sql += ` ORDER BY created_at ASC;`;

  const result = await client.query<DbDeadLetterRow>(sql, params);

  return result.rows.map((row) => ({
    deadLetterId: row.dead_letter_id,
    chainId: BigInt(row.chain_id),
    blockNumber: BigInt(row.block_number),
    blockHash: parseBytes32(row.block_hash),
    transactionHash: parseBytes32(row.transaction_hash),
    logIndex: row.log_index,
    eventName: row.event_name,
    contractAddress: parseEvmAddress(row.contract_address),
    payload: row.payload,
    errorMessage: row.error_message,
    attempts: row.attempts,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }));
}

/**
 * Marks a dead letter entry as resolved.
 */
export async function markDeadLetterResolved(
  client: DatabaseClient,
  deadLetterId: string,
): Promise<void> {
  await client.query(
    `UPDATE indexer_dead_letters
     SET resolved_at = NOW()
     WHERE dead_letter_id = $1;`,
    [deadLetterId],
  );
}
