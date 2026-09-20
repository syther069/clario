import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  TEST_FIXTURE_EXPENSE,
  TEST_FIXTURE_EXPENSE_VERSION_1,
  TEST_FIXTURE_USER,
  TEST_FIXTURE_USER_2,
  TEST_FIXTURE_WORKSPACE,
  TEST_FIXTURE_WORKSPACE_2,
} from "./fixtures/index.js";
import { Migrator } from "./migrator.js";
import { createInMemoryDb } from "./test-helper.js";
import type { DatabaseClient } from "./client.js";

const MIGRATIONS_DIR = resolve(__dirname, "../migrations");

describe("PostgreSQL Multi-Tenant Workspace Isolation Suite", () => {
  let client: DatabaseClient;

  beforeEach(async () => {
    const mem = createInMemoryDb();
    client = mem.client;
    const migrator = new Migrator(client, MIGRATIONS_DIR);
    await migrator.up();

    // Create User 1 & Workspace 1
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

    // Create User 2 & Workspace 2
    await client.query(
      `INSERT INTO users (user_id, primary_address) VALUES ($1, $2);`,
      [TEST_FIXTURE_USER_2.userId, TEST_FIXTURE_USER_2.primaryAddress],
    );
    await client.query(
      `INSERT INTO workspaces (workspace_id, name, created_by) VALUES ($1, $2, $3);`,
      [
        TEST_FIXTURE_WORKSPACE_2.workspaceId,
        TEST_FIXTURE_WORKSPACE_2.name,
        TEST_FIXTURE_WORKSPACE_2.createdBy,
      ],
    );
  });

  it("allows same expense_id across different workspaces without collision", async () => {
    // Insert expense in Workspace 1
    await client.query(
      `INSERT INTO expenses (workspace_id, expense_id, created_by, current_version)
       VALUES ($1, $2, $3, NULL);`,
      [
        TEST_FIXTURE_WORKSPACE.workspaceId,
        TEST_FIXTURE_EXPENSE.expenseId,
        TEST_FIXTURE_USER.primaryAddress,
      ],
    );

    // Insert same expense_id in Workspace 2
    await client.query(
      `INSERT INTO expenses (workspace_id, expense_id, created_by, current_version)
       VALUES ($1, $2, $3, NULL);`,
      [
        TEST_FIXTURE_WORKSPACE_2.workspaceId,
        TEST_FIXTURE_EXPENSE.expenseId,
        TEST_FIXTURE_USER_2.primaryAddress,
      ],
    );

    // Verify both exist independently
    const ws1Expenses = await client.query(
      `SELECT * FROM expenses WHERE workspace_id = $1;`,
      [TEST_FIXTURE_WORKSPACE.workspaceId],
    );
    expect(ws1Expenses.rows).toHaveLength(1);
    expect(ws1Expenses.rows[0]!["created_by"]).toBe(
      TEST_FIXTURE_USER.primaryAddress,
    );

    const ws2Expenses = await client.query(
      `SELECT * FROM expenses WHERE workspace_id = $1;`,
      [TEST_FIXTURE_WORKSPACE_2.workspaceId],
    );
    expect(ws2Expenses.rows).toHaveLength(1);
    expect(ws2Expenses.rows[0]!["created_by"]).toBe(
      TEST_FIXTURE_USER_2.primaryAddress,
    );
  });

  it("prevents cross-workspace expense version queries", async () => {
    // Insert in Workspace 1
    await client.query(
      `INSERT INTO expenses (workspace_id, expense_id, created_by, current_version)
       VALUES ($1, $2, $3, NULL);`,
      [
        TEST_FIXTURE_WORKSPACE.workspaceId,
        TEST_FIXTURE_EXPENSE.expenseId,
        TEST_FIXTURE_USER.primaryAddress,
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

    // Query scoped to Workspace 2 returns zero rows
    const ws2Query = await client.query(
      `SELECT * FROM expense_versions WHERE workspace_id = $1;`,
      [TEST_FIXTURE_WORKSPACE_2.workspaceId],
    );
    expect(ws2Query.rows).toHaveLength(0);

    // Query scoped to Workspace 1 returns the row
    const ws1Query = await client.query(
      `SELECT * FROM expense_versions WHERE workspace_id = $1;`,
      [TEST_FIXTURE_WORKSPACE.workspaceId],
    );
    expect(ws1Query.rows).toHaveLength(1);
  });

  it("prevents referencing nonexistent workspace in expenses", async () => {
    const nonexistentWorkspace =
      "0x9999999999999999999999999999999999999999999999999999999999999999";

    await expect(
      client.query(
        `INSERT INTO expenses (workspace_id, expense_id, created_by, current_version)
         VALUES ($1, $2, $3, NULL);`,
        [
          nonexistentWorkspace,
          TEST_FIXTURE_EXPENSE.expenseId,
          TEST_FIXTURE_USER.primaryAddress,
        ],
      ),
    ).rejects.toThrow();
  });
});
