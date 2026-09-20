import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  TEST_FIXTURE_EXPENSE,
  TEST_FIXTURE_EXPENSE_VERSION_1,
  TEST_FIXTURE_EXPENSE_VERSION_2,
  TEST_FIXTURE_USER,
  TEST_FIXTURE_WORKSPACE,
} from "./fixtures/index.js";
import { Migrator } from "./migrator.js";
import { createInMemoryDb } from "./test-helper.js";
import type { DatabaseClient } from "./client.js";

const MIGRATIONS_DIR = resolve(__dirname, "../migrations");

describe("PostgreSQL Constraints and Invariants Suite", () => {
  let client: DatabaseClient;

  beforeEach(async () => {
    const mem = createInMemoryDb();
    client = mem.client;
    const migrator = new Migrator(client, MIGRATIONS_DIR);
    await migrator.up();

    // Seed baseline user and workspace
    await client.query(
      `INSERT INTO users (user_id, primary_address) VALUES ($1, $2);`,
      [TEST_FIXTURE_USER.userId, TEST_FIXTURE_USER.primaryAddress],
    );

    await client.query(
      `INSERT INTO workspaces (workspace_id, name, created_by) VALUES ($1, $2, $3);`,
      [
        TEST_FIXTURE_WORKSPACE.workspaceId,
        TEST_FIXTURE_WORKSPACE.name,
        TEST_FIXTURE_WORKSPACE.createdBy,
      ],
    );
  });

  it("enforces unique (workspace_id, expense_id, version) on expense_versions", async () => {
    // Insert expense header
    await client.query(
      `INSERT INTO expenses (workspace_id, expense_id, created_by, current_version)
       VALUES ($1, $2, $3, NULL);`,
      [
        TEST_FIXTURE_WORKSPACE.workspaceId,
        TEST_FIXTURE_EXPENSE.expenseId,
        TEST_FIXTURE_EXPENSE.createdBy,
      ],
    );

    // Insert version 1
    await client.query(
      `INSERT INTO expense_versions (
         workspace_id, expense_id, version, commitment, previous_commitment,
         salt_ciphertext, salt_key_reference, record_ciphertext, record_key_reference,
         amount, currency, recipient, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);`,
      [
        TEST_FIXTURE_WORKSPACE.workspaceId,
        TEST_FIXTURE_EXPENSE.expenseId,
        TEST_FIXTURE_EXPENSE_VERSION_1.version,
        TEST_FIXTURE_EXPENSE_VERSION_1.commitment,
        TEST_FIXTURE_EXPENSE_VERSION_1.previousCommitment,
        TEST_FIXTURE_EXPENSE_VERSION_1.saltCiphertext,
        TEST_FIXTURE_EXPENSE_VERSION_1.saltKeyReference,
        TEST_FIXTURE_EXPENSE_VERSION_1.recordCiphertext,
        TEST_FIXTURE_EXPENSE_VERSION_1.recordKeyReference,
        TEST_FIXTURE_EXPENSE_VERSION_1.amount,
        TEST_FIXTURE_EXPENSE_VERSION_1.currency,
        TEST_FIXTURE_EXPENSE_VERSION_1.recipient,
        TEST_FIXTURE_EXPENSE_VERSION_1.status,
      ],
    );

    // Duplicate version 1 on same workspace and expense must fail
    await expect(
      client.query(
        `INSERT INTO expense_versions (
           workspace_id, expense_id, version, commitment, previous_commitment,
           salt_ciphertext, salt_key_reference, record_ciphertext, record_key_reference,
           amount, currency, recipient, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);`,
        [
          TEST_FIXTURE_WORKSPACE.workspaceId,
          TEST_FIXTURE_EXPENSE.expenseId,
          TEST_FIXTURE_EXPENSE_VERSION_1.version,
          "0x9999999999999999999999999999999999999999999999999999999999999999",
          null,
          "salt2",
          "ref2",
          "rec2",
          "refrec2",
          "500",
          "USDC",
          TEST_FIXTURE_EXPENSE_VERSION_1.recipient,
          "draft",
        ],
      ),
    ).rejects.toThrow();
  });

  it("enforces foreign key from expenses.current_version to existing expense_versions", async () => {
    // Insert expense header
    await client.query(
      `INSERT INTO expenses (workspace_id, expense_id, created_by, current_version)
       VALUES ($1, $2, $3, NULL);`,
      [
        TEST_FIXTURE_WORKSPACE.workspaceId,
        TEST_FIXTURE_EXPENSE.expenseId,
        TEST_FIXTURE_EXPENSE.createdBy,
      ],
    );

    // Attempting to set current_version to 1 when version 1 does not exist must fail
    await expect(
      client.query(
        `UPDATE expenses SET current_version = 1
         WHERE workspace_id = $1 AND expense_id = $2;`,
        [TEST_FIXTURE_WORKSPACE.workspaceId, TEST_FIXTURE_EXPENSE.expenseId],
      ),
    ).rejects.toThrow();

    // Now insert version 1
    await client.query(
      `INSERT INTO expense_versions (
         workspace_id, expense_id, version, commitment, previous_commitment,
         salt_ciphertext, salt_key_reference, record_ciphertext, record_key_reference,
         amount, currency, recipient, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);`,
      [
        TEST_FIXTURE_WORKSPACE.workspaceId,
        TEST_FIXTURE_EXPENSE.expenseId,
        TEST_FIXTURE_EXPENSE_VERSION_1.version,
        TEST_FIXTURE_EXPENSE_VERSION_1.commitment,
        TEST_FIXTURE_EXPENSE_VERSION_1.previousCommitment,
        TEST_FIXTURE_EXPENSE_VERSION_1.saltCiphertext,
        TEST_FIXTURE_EXPENSE_VERSION_1.saltKeyReference,
        TEST_FIXTURE_EXPENSE_VERSION_1.recordCiphertext,
        TEST_FIXTURE_EXPENSE_VERSION_1.recordKeyReference,
        TEST_FIXTURE_EXPENSE_VERSION_1.amount,
        TEST_FIXTURE_EXPENSE_VERSION_1.currency,
        TEST_FIXTURE_EXPENSE_VERSION_1.recipient,
        TEST_FIXTURE_EXPENSE_VERSION_1.status,
      ],
    );

    // Setting current_version to 1 now succeeds
    await client.query(
      `UPDATE expenses SET current_version = 1
       WHERE workspace_id = $1 AND expense_id = $2;`,
      [TEST_FIXTURE_WORKSPACE.workspaceId, TEST_FIXTURE_EXPENSE.expenseId],
    );

    const expenseRes = await client.query<{ current_version: number }>(
      `SELECT current_version FROM expenses WHERE workspace_id = $1 AND expense_id = $2;`,
      [TEST_FIXTURE_WORKSPACE.workspaceId, TEST_FIXTURE_EXPENSE.expenseId],
    );
    expect(expenseRes.rows[0]!.current_version).toBe(1);

    // Setting current_version to nonexistent version 2 must fail
    await expect(
      client.query(
        `UPDATE expenses SET current_version = 2
         WHERE workspace_id = $1 AND expense_id = $2;`,
        [TEST_FIXTURE_WORKSPACE.workspaceId, TEST_FIXTURE_EXPENSE.expenseId],
      ),
    ).rejects.toThrow();
  });

  it("enforces predecessor commitment invariant across versions", async () => {
    await client.query(
      `INSERT INTO expenses (workspace_id, expense_id, created_by, current_version)
       VALUES ($1, $2, $3, NULL);`,
      [
        TEST_FIXTURE_WORKSPACE.workspaceId,
        TEST_FIXTURE_EXPENSE.expenseId,
        TEST_FIXTURE_EXPENSE.createdBy,
      ],
    );

    // Version 1 with non-null previous_commitment must fail
    await expect(
      client.query(
        `INSERT INTO expense_versions (
           workspace_id, expense_id, version, commitment, previous_commitment,
           salt_ciphertext, salt_key_reference, record_ciphertext, record_key_reference,
           amount, currency, recipient, status
         ) VALUES ($1, $2, 1, $3, $4, 's', 'k', 'r', 'k', 100, 'USDC', $5, 'draft');`,
        [
          TEST_FIXTURE_WORKSPACE.workspaceId,
          TEST_FIXTURE_EXPENSE.expenseId,
          TEST_FIXTURE_EXPENSE_VERSION_1.commitment,
          "0x1111111111111111111111111111111111111111111111111111111111111111", // non-null for v1!
          TEST_FIXTURE_EXPENSE_VERSION_1.recipient,
        ],
      ),
    ).rejects.toThrow();

    // Version 1 with null previous_commitment succeeds
    await client.query(
      `INSERT INTO expense_versions (
         workspace_id, expense_id, version, commitment, previous_commitment,
         salt_ciphertext, salt_key_reference, record_ciphertext, record_key_reference,
         amount, currency, recipient, status
       ) VALUES ($1, $2, 1, $3, NULL, 's', 'k', 'r', 'k', 100, 'USDC', $4, 'submitted');`,
      [
        TEST_FIXTURE_WORKSPACE.workspaceId,
        TEST_FIXTURE_EXPENSE.expenseId,
        TEST_FIXTURE_EXPENSE_VERSION_1.commitment,
        TEST_FIXTURE_EXPENSE_VERSION_1.recipient,
      ],
    );

    // Version 2 with null previous_commitment must fail
    await expect(
      client.query(
        `INSERT INTO expense_versions (
           workspace_id, expense_id, version, commitment, previous_commitment,
           salt_ciphertext, salt_key_reference, record_ciphertext, record_key_reference,
           amount, currency, recipient, status
         ) VALUES ($1, $2, 2, $3, NULL, 's', 'k', 'r', 'k', 100, 'USDC', $4, 'draft');`,
        [
          TEST_FIXTURE_WORKSPACE.workspaceId,
          TEST_FIXTURE_EXPENSE.expenseId,
          TEST_FIXTURE_EXPENSE_VERSION_2.commitment,
          TEST_FIXTURE_EXPENSE_VERSION_2.recipient,
        ],
      ),
    ).rejects.toThrow();

    // Version 2 with non-null previous_commitment succeeds
    await client.query(
      `INSERT INTO expense_versions (
         workspace_id, expense_id, version, commitment, previous_commitment,
         salt_ciphertext, salt_key_reference, record_ciphertext, record_key_reference,
         amount, currency, recipient, status
       ) VALUES ($1, $2, 2, $3, $4, 's', 'k', 'r', 'k', 100, 'USDC', $5, 'current');`,
      [
        TEST_FIXTURE_WORKSPACE.workspaceId,
        TEST_FIXTURE_EXPENSE.expenseId,
        TEST_FIXTURE_EXPENSE_VERSION_2.commitment,
        TEST_FIXTURE_EXPENSE_VERSION_1.commitment,
        TEST_FIXTURE_EXPENSE_VERSION_2.recipient,
      ],
    );
  });

  it("enforces at most one active standard reimbursement per expense version", async () => {
    // Setup expense and version 1
    await client.query(
      `INSERT INTO expenses (workspace_id, expense_id, created_by, current_version)
       VALUES ($1, $2, $3, NULL);`,
      [
        TEST_FIXTURE_WORKSPACE.workspaceId,
        TEST_FIXTURE_EXPENSE.expenseId,
        TEST_FIXTURE_EXPENSE.createdBy,
      ],
    );

    await client.query(
      `INSERT INTO expense_versions (
         workspace_id, expense_id, version, commitment, previous_commitment,
         salt_ciphertext, salt_key_reference, record_ciphertext, record_key_reference,
         amount, currency, recipient, status
       ) VALUES ($1, $2, 1, $3, NULL, 's', 'k', 'r', 'k', 500, 'USDC', $4, 'current');`,
      [
        TEST_FIXTURE_WORKSPACE.workspaceId,
        TEST_FIXTURE_EXPENSE.expenseId,
        TEST_FIXTURE_EXPENSE_VERSION_1.commitment,
        TEST_FIXTURE_EXPENSE_VERSION_1.recipient,
      ],
    );

    // Insert active reimbursement attempt (status: 'submitted')
    const r1Id = "00000000-0000-0000-0000-000000000010";
    await client.query(
      `INSERT INTO reimbursements (
         reimbursement_id, workspace_id, expense_id, version, token_address,
         recipient_address, amount, payment_reference, status
       ) VALUES ($1, $2, $3, 1, $4, $5, 500, $6, 'submitted');`,
      [
        r1Id,
        TEST_FIXTURE_WORKSPACE.workspaceId,
        TEST_FIXTURE_EXPENSE.expenseId,
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        TEST_FIXTURE_EXPENSE_VERSION_1.recipient,
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      ],
    );

    // Second concurrent active reimbursement (status: 'preparing') on same version must fail
    const r2Id = "00000000-0000-0000-0000-000000000011";
    await expect(
      client.query(
        `INSERT INTO reimbursements (
           reimbursement_id, workspace_id, expense_id, version, token_address,
           recipient_address, amount, payment_reference, status
         ) VALUES ($1, $2, $3, 1, $4, $5, 500, $6, 'preparing');`,
        [
          r2Id,
          TEST_FIXTURE_WORKSPACE.workspaceId,
          TEST_FIXTURE_EXPENSE.expenseId,
          "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
          TEST_FIXTURE_EXPENSE_VERSION_1.recipient,
          "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        ],
      ),
    ).rejects.toThrow();

    // Mark first reimbursement as failed (e.g. reverted onchain)
    await client.query(
      `UPDATE reimbursements SET status = 'failed' WHERE reimbursement_id = $1;`,
      [r1Id],
    );

    // Now a new active retry attempt succeeds!
    await client.query(
      `INSERT INTO reimbursements (
         reimbursement_id, workspace_id, expense_id, version, token_address,
         recipient_address, amount, payment_reference, status
       ) VALUES ($1, $2, $3, 1, $4, $5, 500, $6, 'submitted');`,
      [
        r2Id,
        TEST_FIXTURE_WORKSPACE.workspaceId,
        TEST_FIXTURE_EXPENSE.expenseId,
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        TEST_FIXTURE_EXPENSE_VERSION_1.recipient,
        "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      ],
    );

    const activeCount = await client.query<{ count: string | number }>(
      `SELECT count(*) FROM reimbursements
       WHERE workspace_id = $1 AND expense_id = $2 AND version = 1
       AND status NOT IN ('failed', 'cancelled');`,
      [TEST_FIXTURE_WORKSPACE.workspaceId, TEST_FIXTURE_EXPENSE.expenseId],
    );
    expect(Number(activeCount.rows[0]!.count)).toBe(1);
  });

  it("enforces uniqueness on source_transactions and idempotency_keys", async () => {
    // Setup expense
    await client.query(
      `INSERT INTO expenses (workspace_id, expense_id, created_by, current_version)
       VALUES ($1, $2, $3, NULL);`,
      [
        TEST_FIXTURE_WORKSPACE.workspaceId,
        TEST_FIXTURE_EXPENSE.expenseId,
        TEST_FIXTURE_EXPENSE.createdBy,
      ],
    );

    // Insert source transaction slot 0
    await client.query(
      `INSERT INTO source_transactions (
         workspace_id, expense_id, source_chain_id, source_transaction_hash,
         claim_slot, provider, status
       ) VALUES ($1, $2, 1, $3, 0, 'zerion', 'confirmed');`,
      [
        TEST_FIXTURE_WORKSPACE.workspaceId,
        TEST_FIXTURE_EXPENSE.expenseId,
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      ],
    );

    // Duplicate source transaction on slot 0 must fail
    await expect(
      client.query(
        `INSERT INTO source_transactions (
           workspace_id, expense_id, source_chain_id, source_transaction_hash,
           claim_slot, provider, status
         ) VALUES ($1, $2, 1, $3, 0, 'zerion', 'confirmed');`,
        [
          TEST_FIXTURE_WORKSPACE.workspaceId,
          TEST_FIXTURE_EXPENSE.expenseId,
          "0x1111111111111111111111111111111111111111111111111111111111111111",
        ],
      ),
    ).rejects.toThrow();

    // Slot 1 for multiple claims from same transaction succeeds
    await client.query(
      `INSERT INTO source_transactions (
         workspace_id, expense_id, source_chain_id, source_transaction_hash,
         claim_slot, provider, status
       ) VALUES ($1, $2, 1, $3, 1, 'zerion', 'confirmed');`,
      [
        TEST_FIXTURE_WORKSPACE.workspaceId,
        TEST_FIXTURE_EXPENSE.expenseId,
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      ],
    );

    // Insert idempotency key
    await client.query(
      `INSERT INTO idempotency_keys (
         key, workspace_id, actor_address, action, response_code, response_body, expires_at
       ) VALUES ($1, $2, $3, $4, 200, $5, NOW() + INTERVAL '1 hour');`,
      [
        "idem_key_test_123",
        TEST_FIXTURE_WORKSPACE.workspaceId,
        TEST_FIXTURE_USER.primaryAddress,
        "expense.submit",
        JSON.stringify({ ok: true }),
      ],
    );

    // Duplicate idempotency key for same actor and action must fail
    await expect(
      client.query(
        `INSERT INTO idempotency_keys (
           key, workspace_id, actor_address, action, response_code, response_body, expires_at
         ) VALUES ($1, $2, $3, $4, 200, $5, NOW() + INTERVAL '1 hour');`,
        [
          "idem_key_test_123",
          TEST_FIXTURE_WORKSPACE.workspaceId,
          TEST_FIXTURE_USER.primaryAddress,
          "expense.submit",
          JSON.stringify({ ok: true }),
        ],
      ),
    ).rejects.toThrow();
  });

  it("enforces decision reasoning rules and uniqueness per version", async () => {
    // Setup expense and version 1
    await client.query(
      `INSERT INTO expenses (workspace_id, expense_id, created_by, current_version)
       VALUES ($1, $2, $3, NULL);`,
      [
        TEST_FIXTURE_WORKSPACE.workspaceId,
        TEST_FIXTURE_EXPENSE.expenseId,
        TEST_FIXTURE_EXPENSE.createdBy,
      ],
    );

    await client.query(
      `INSERT INTO expense_versions (
         workspace_id, expense_id, version, commitment, previous_commitment,
         salt_ciphertext, salt_key_reference, record_ciphertext, record_key_reference,
         amount, currency, recipient, status
       ) VALUES ($1, $2, 1, $3, NULL, 's', 'k', 'r', 'k', 500, 'USDC', $4, 'current');`,
      [
        TEST_FIXTURE_WORKSPACE.workspaceId,
        TEST_FIXTURE_EXPENSE.expenseId,
        TEST_FIXTURE_EXPENSE_VERSION_1.commitment,
        TEST_FIXTURE_EXPENSE_VERSION_1.recipient,
      ],
    );

    // Rejection without reason_commitment must fail check constraint
    await expect(
      client.query(
        `INSERT INTO decisions (
           workspace_id, expense_id, version, commitment, decision_type,
           reviewer_address, reason_commitment, policy_version, nonce
         ) VALUES ($1, $2, 1, $3, 'reject', $4, NULL, 1, 0);`,
        [
          TEST_FIXTURE_WORKSPACE.workspaceId,
          TEST_FIXTURE_EXPENSE.expenseId,
          TEST_FIXTURE_EXPENSE_VERSION_1.commitment,
          TEST_FIXTURE_USER.primaryAddress,
        ],
      ),
    ).rejects.toThrow();

    // Approval without reason_commitment succeeds
    await client.query(
      `INSERT INTO decisions (
         workspace_id, expense_id, version, commitment, decision_type,
         reviewer_address, reason_commitment, policy_version, nonce
       ) VALUES ($1, $2, 1, $3, 'approve', $4, NULL, 1, 0);`,
      [
        TEST_FIXTURE_WORKSPACE.workspaceId,
        TEST_FIXTURE_EXPENSE.expenseId,
        TEST_FIXTURE_EXPENSE_VERSION_1.commitment,
        TEST_FIXTURE_USER.primaryAddress,
      ],
    );

    // Second decision on same immutable version must fail unique constraint
    await expect(
      client.query(
        `INSERT INTO decisions (
           workspace_id, expense_id, version, commitment, decision_type,
           reviewer_address, reason_commitment, policy_version, nonce
         ) VALUES ($1, $2, 1, $3, 'reject', $4, $5, 1, 1);`,
        [
          TEST_FIXTURE_WORKSPACE.workspaceId,
          TEST_FIXTURE_EXPENSE.expenseId,
          TEST_FIXTURE_EXPENSE_VERSION_1.commitment,
          TEST_FIXTURE_USER.primaryAddress,
          "0x3333333333333333333333333333333333333333333333333333333333333333",
        ],
      ),
    ).rejects.toThrow();
  });

  it("enforces ON DELETE RESTRICT preventing orphaned state", async () => {
    // Setup expense
    await client.query(
      `INSERT INTO expenses (workspace_id, expense_id, created_by, current_version)
       VALUES ($1, $2, $3, NULL);`,
      [
        TEST_FIXTURE_WORKSPACE.workspaceId,
        TEST_FIXTURE_EXPENSE.expenseId,
        TEST_FIXTURE_EXPENSE.createdBy,
      ],
    );

    // Attempting to delete workspace that has expenses must fail with RESTRICT
    await expect(
      client.query(`DELETE FROM workspaces WHERE workspace_id = $1;`, [
        TEST_FIXTURE_WORKSPACE.workspaceId,
      ]),
    ).rejects.toThrow();
  });

  it("enforces NUMERIC(78, 0) base units and rejects negative amounts", async () => {
    await client.query(
      `INSERT INTO expenses (workspace_id, expense_id, created_by, current_version)
       VALUES ($1, $2, $3, NULL);`,
      [
        TEST_FIXTURE_WORKSPACE.workspaceId,
        TEST_FIXTURE_EXPENSE.expenseId,
        TEST_FIXTURE_EXPENSE.createdBy,
      ],
    );

    // Negative amount must fail check constraint
    await expect(
      client.query(
        `INSERT INTO expense_versions (
           workspace_id, expense_id, version, commitment, previous_commitment,
           salt_ciphertext, salt_key_reference, record_ciphertext, record_key_reference,
           amount, currency, recipient, status
         ) VALUES ($1, $2, 1, $3, NULL, 's', 'k', 'r', 'k', -1, 'USDC', $4, 'draft');`,
        [
          TEST_FIXTURE_WORKSPACE.workspaceId,
          TEST_FIXTURE_EXPENSE.expenseId,
          TEST_FIXTURE_EXPENSE_VERSION_1.commitment,
          TEST_FIXTURE_EXPENSE_VERSION_1.recipient,
        ],
      ),
    ).rejects.toThrow();

    // Base unit integer amount stores and retrieves accurately
    const baseUnits = "500000000"; // 500.00 USDC in 6 decimals base units

    await client.query(
      `INSERT INTO expense_versions (
         workspace_id, expense_id, version, commitment, previous_commitment,
         salt_ciphertext, salt_key_reference, record_ciphertext, record_key_reference,
         amount, currency, recipient, status
       ) VALUES ($1, $2, 1, $3, NULL, 's', 'k', 'r', 'k', $4, 'USDC', $5, 'draft');`,
      [
        TEST_FIXTURE_WORKSPACE.workspaceId,
        TEST_FIXTURE_EXPENSE.expenseId,
        TEST_FIXTURE_EXPENSE_VERSION_1.commitment,
        baseUnits,
        TEST_FIXTURE_EXPENSE_VERSION_1.recipient,
      ],
    );

    const versionRow = await client.query<{ amount: string | number }>(
      `SELECT amount FROM expense_versions WHERE workspace_id = $1 AND expense_id = $2 AND version = 1;`,
      [TEST_FIXTURE_WORKSPACE.workspaceId, TEST_FIXTURE_EXPENSE.expenseId],
    );
    expect(String(versionRow.rows[0]!.amount)).toBe(baseUnits);
  });
});
