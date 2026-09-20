import type { DatabaseClient } from "@clario/database";
import {
  parseBytes32,
  parseEvmAddress,
  type Bytes32,
  type EvmAddress,
} from "@clario/protocol";
import type { CheckpointState } from "./types";

interface DbCheckpointRow {
  chain_id: string | number;
  contract_address: string;
  last_indexed_block: string | number;
  last_indexed_block_hash: string;
  updated_at: Date | string;
}

/**
 * Retrieves the latest indexed checkpoint for a given chain ID and contract address.
 */
export async function getCheckpoint(
  client: DatabaseClient,
  chainId: bigint,
  contractAddress: EvmAddress,
): Promise<CheckpointState | null> {
  const result = await client.query<DbCheckpointRow>(
    `SELECT chain_id, contract_address, last_indexed_block, last_indexed_block_hash, updated_at
     FROM indexer_checkpoints
     WHERE chain_id = $1 AND LOWER(contract_address) = LOWER($2)
     LIMIT 1;`,
    [chainId.toString(), contractAddress],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    chainId: BigInt(row.chain_id),
    contractAddress: parseEvmAddress(row.contract_address),
    lastIndexedBlock: BigInt(row.last_indexed_block),
    lastIndexedBlockHash: parseBytes32(row.last_indexed_block_hash),
    updatedAt: row.updated_at,
  };
}

/**
 * Saves or advances the indexed checkpoint for a given chain ID and contract address.
 * Only advances if the new block number is greater than or equal to the currently stored block.
 */
export async function saveCheckpoint(
  client: DatabaseClient,
  chainId: bigint,
  contractAddress: EvmAddress,
  blockNumber: bigint,
  blockHash: Bytes32,
): Promise<void> {
  const existing = await getCheckpoint(client, chainId, contractAddress);
  if (existing && existing.lastIndexedBlock > blockNumber) {
    // Do not rewind checkpoint during normal forward ingestion
    return;
  }

  await client.query(
    `INSERT INTO indexer_checkpoints (
       chain_id, contract_address, last_indexed_block, last_indexed_block_hash, updated_at
     ) VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (chain_id, contract_address)
     DO UPDATE SET
       last_indexed_block = EXCLUDED.last_indexed_block,
       last_indexed_block_hash = EXCLUDED.last_indexed_block_hash,
       updated_at = NOW();`,
    [
      chainId.toString(),
      contractAddress.toLowerCase(),
      blockNumber.toString(),
      blockHash,
    ],
  );
}

/**
 * Forces a checkpoint rewind to a specific block (e.g., following a chain reorganization).
 */
export async function rewindCheckpoint(
  client: DatabaseClient,
  chainId: bigint,
  contractAddress: EvmAddress,
  blockNumber: bigint,
  blockHash: Bytes32,
): Promise<void> {
  await client.query(
    `INSERT INTO indexer_checkpoints (
       chain_id, contract_address, last_indexed_block, last_indexed_block_hash, updated_at
     ) VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (chain_id, contract_address)
     DO UPDATE SET
       last_indexed_block = EXCLUDED.last_indexed_block,
       last_indexed_block_hash = EXCLUDED.last_indexed_block_hash,
       updated_at = NOW();`,
    [
      chainId.toString(),
      contractAddress.toLowerCase(),
      blockNumber.toString(),
      blockHash,
    ],
  );
}
