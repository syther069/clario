import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Migrator, MigrationError } from "./migrator.js";
import { createInMemoryDb } from "./test-helper.js";

const MIGRATIONS_DIR = resolve(__dirname, "../migrations");

describe("PostgreSQL Schema Migration Suite", () => {
  it("migrates cleanly from zero", async () => {
    const { client } = createInMemoryDb();
    const migrator = new Migrator(client, MIGRATIONS_DIR);

    const initialStatus = await migrator.status();
    expect(initialStatus.applied).toHaveLength(0);
    expect(initialStatus.pending).toHaveLength(2);
    expect(initialStatus.pending[0]!.version).toBe(1);
    expect(initialStatus.pending[0]!.name).toBe("initial_schema");
    expect(initialStatus.pending[1]!.version).toBe(2);
    expect(initialStatus.pending[1]!.name).toBe("event_indexing");

    // Execute forward migration
    const applied = await migrator.up();
    expect(applied).toHaveLength(2);
    expect(applied[0]!.version).toBe(1);
    expect(applied[1]!.version).toBe(2);

    // Verify status after up
    const postStatus = await migrator.status();
    expect(postStatus.applied).toHaveLength(2);
    expect(postStatus.applied[0]!.version).toBe(1);
    expect(postStatus.applied[0]!.name).toBe("initial_schema");
    expect(postStatus.applied[0]!.checksum).toBe(applied[0]!.checksum);
    expect(postStatus.applied[1]!.version).toBe(2);
    expect(postStatus.applied[1]!.name).toBe("event_indexing");
    expect(postStatus.applied[1]!.checksum).toBe(applied[1]!.checksum);
    expect(postStatus.pending).toHaveLength(0);
  });

  it("is idempotent when re-running up on already migrated database", async () => {
    const { client } = createInMemoryDb();
    const migrator = new Migrator(client, MIGRATIONS_DIR);

    await migrator.up();
    const secondRun = await migrator.up();
    expect(secondRun).toHaveLength(0);

    const status = await migrator.status();
    expect(status.applied).toHaveLength(2);
    expect(status.pending).toHaveLength(0);
  });

  it("detects checksum tampering on applied migrations", async () => {
    const { client } = createInMemoryDb();
    const migrator = new Migrator(client, MIGRATIONS_DIR);
    await migrator.up();

    // Instantiate a migrator with tampered migration content for version 1
    const tamperedMigrator = new Migrator(client, [
      {
        version: 1,
        name: "initial_schema",
        upSql: "-- tampered sql",
        downSql: "-- tampered down",
        checksum:
          "0000000000000000000000000000000000000000000000000000000000000000",
      },
    ]);

    await expect(tamperedMigrator.verify()).rejects.toThrowError(
      MigrationError,
    );
  });

  it("rolls back cleanly and recovers from zero", async () => {
    const { client } = createInMemoryDb();
    const migrator = new Migrator(client, MIGRATIONS_DIR);

    // Migrate up both
    await migrator.up();

    // Rollback migration 2
    const rolledBack2 = await migrator.down();
    expect(rolledBack2.version).toBe(2);

    const statusAfterDown2 = await migrator.status();
    expect(statusAfterDown2.applied).toHaveLength(1);
    expect(statusAfterDown2.pending).toHaveLength(1);
    expect(statusAfterDown2.pending[0]!.version).toBe(2);

    // Rollback migration 1
    const rolledBack1 = await migrator.down();
    expect(rolledBack1.version).toBe(1);

    const statusAfterDown1 = await migrator.status();
    expect(statusAfterDown1.applied).toHaveLength(0);
    expect(statusAfterDown1.pending).toHaveLength(2);

    // Re-migrate from zero after rollback
    const recovered = await migrator.up();
    expect(recovered).toHaveLength(2);
    expect(recovered[0]!.version).toBe(1);
    expect(recovered[1]!.version).toBe(2);

    const statusAfterRecovery = await migrator.status();
    expect(statusAfterRecovery.applied).toHaveLength(2);
    expect(statusAfterRecovery.pending).toHaveLength(0);
  });
});
