import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { DatabaseClient } from "./client.js";
import { withTransaction } from "./client.js";
import type { SchemaMigrationRow } from "./types.js";

export interface MigrationFile {
  version: number;
  name: string;
  upSql: string;
  downSql: string;
  checksum: string; // SHA-256 of upSql
}

export interface MigrationStatus {
  applied: SchemaMigrationRow[];
  pending: MigrationFile[];
}

export class MigrationError extends Error {
  readonly code:
    | "CHECKSUM_MISMATCH"
    | "MIGRATION_FAILED"
    | "MISSING_DOWN_SCRIPT"
    | "NO_MIGRATIONS_TO_ROLLBACK";

  constructor(
    code:
      | "CHECKSUM_MISMATCH"
      | "MIGRATION_FAILED"
      | "MISSING_DOWN_SCRIPT"
      | "NO_MIGRATIONS_TO_ROLLBACK",
    message: string,
  ) {
    super(message);
    this.name = "MigrationError";
    this.code = code;
  }
}

/**
 * Computes SHA-256 checksum for a string.
 */
export function computeChecksum(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Loads migration files from a directory.
 * Requires both `<version>_<name>.up.sql` and `<version>_<name>.down.sql`.
 */
export function loadMigrationsFromDir(dirPath: string): MigrationFile[] {
  const files = readdirSync(dirPath);
  const upFiles = new Map<number, { filename: string; name: string }>();
  const downFiles = new Map<number, string>();

  const pattern = /^(\d+)_([a-zA-Z0-9_-]+)\.(up|down)\.sql$/;

  for (const file of files) {
    const match = file.match(pattern);
    if (!match) continue;

    const version = parseInt(match[1]!, 10);
    const name = match[2]!;
    const direction = match[3]!;

    if (direction === "up") {
      upFiles.set(version, { filename: file, name });
    } else if (direction === "down") {
      downFiles.set(version, file);
    }
  }

  const migrations: MigrationFile[] = [];

  for (const [version, up] of Array.from(upFiles.entries()).sort(
    ([a], [b]) => a - b,
  )) {
    const downFilename = downFiles.get(version);
    if (!downFilename) {
      throw new MigrationError(
        "MISSING_DOWN_SCRIPT",
        `Migration version ${version} (${up.name}) is missing its corresponding .down.sql script.`,
      );
    }

    const upSql = readFileSync(join(dirPath, up.filename), "utf8");
    const downSql = readFileSync(join(dirPath, downFilename), "utf8");
    const checksum = computeChecksum(upSql);

    migrations.push({
      version,
      name: up.name,
      upSql,
      downSql,
      checksum,
    });
  }

  return migrations;
}

/**
 * Core migration runner supporting forward migration, rollback, status, and integrity verification.
 */
export class Migrator {
  private readonly client: DatabaseClient;
  private readonly migrations: MigrationFile[];

  constructor(
    client: DatabaseClient,
    migrationsOrDir?: MigrationFile[] | string,
  ) {
    this.client = client;
    if (typeof migrationsOrDir === "string") {
      this.migrations = loadMigrationsFromDir(migrationsOrDir);
    } else if (Array.isArray(migrationsOrDir)) {
      this.migrations = [...migrationsOrDir].sort(
        (a, b) => a.version - b.version,
      );
    } else {
      // Default: check standard migrations directory relative to package root
      const defaultDir = resolve(process.cwd(), "migrations");
      try {
        this.migrations = loadMigrationsFromDir(defaultDir);
      } catch {
        // Fallback for when running from packages/database or repo root
        const altDir = resolve(
          process.cwd(),
          "packages",
          "database",
          "migrations",
        );
        this.migrations = loadMigrationsFromDir(altDir);
      }
    }
  }

  /**
   * Ensures the schema_migrations tracking table exists.
   */
  async ensureMigrationTable(): Promise<void> {
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  /**
   * Retrieves all applied migrations from schema_migrations table.
   */
  async getAppliedMigrations(): Promise<SchemaMigrationRow[]> {
    await this.ensureMigrationTable();
    const result = await this.client.query<SchemaMigrationRow>(`
      SELECT version, name, checksum, applied_at
      FROM schema_migrations
      ORDER BY version ASC;
    `);
    return result.rows;
  }

  /**
   * Verifies that all applied migrations match disk definitions and have not been tampered with.
   */
  async verify(): Promise<void> {
    const applied = await this.getAppliedMigrations();
    const migrationMap = new Map(this.migrations.map((m) => [m.version, m]));

    for (const record of applied) {
      const disk = migrationMap.get(record.version);
      if (!disk) {
        throw new MigrationError(
          "CHECKSUM_MISMATCH",
          `Applied migration version ${record.version} (${record.name}) not found on disk.`,
        );
      }
      if (disk.checksum !== record.checksum) {
        throw new MigrationError(
          "CHECKSUM_MISMATCH",
          `Applied migration version ${record.version} (${record.name}) has checksum mismatch. Applied: ${record.checksum}, Disk: ${disk.checksum}. Migrations are append-only and cannot be modified in place.`,
        );
      }
    }
  }

  /**
   * Reports current status of applied and pending migrations.
   */
  async status(): Promise<MigrationStatus> {
    await this.verify();
    const applied = await this.getAppliedMigrations();
    const appliedVersions = new Set(applied.map((a) => a.version));
    const pending = this.migrations.filter(
      (m) => !appliedVersions.has(m.version),
    );

    return { applied, pending };
  }

  /**
   * Applies all pending migrations in ascending version order.
   */
  async up(): Promise<MigrationFile[]> {
    await this.verify();
    const applied = await this.getAppliedMigrations();
    const appliedVersions = new Set(applied.map((a) => a.version));
    const pending = this.migrations.filter(
      (m) => !appliedVersions.has(m.version),
    );

    const executed: MigrationFile[] = [];

    for (const migration of pending) {
      await withTransaction(this.client, async (tx) => {
        try {
          await tx.query(migration.upSql);
          await tx.query(
            `INSERT INTO schema_migrations (version, name, checksum, applied_at)
             VALUES ($1, $2, $3, NOW());`,
            [migration.version, migration.name, migration.checksum],
          );
        } catch (error) {
          throw new MigrationError(
            "MIGRATION_FAILED",
            `Migration version ${migration.version} (${migration.name}) failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      });
      executed.push(migration);
    }

    return executed;
  }

  /**
   * Rolls back the single latest applied migration in descending version order.
   */
  async down(): Promise<MigrationFile> {
    await this.verify();
    const applied = await this.getAppliedMigrations();
    if (applied.length === 0) {
      throw new MigrationError(
        "NO_MIGRATIONS_TO_ROLLBACK",
        "Cannot rollback: no migrations have been applied.",
      );
    }

    const latest = applied[applied.length - 1]!;
    const migration = this.migrations.find((m) => m.version === latest.version);
    if (!migration) {
      throw new MigrationError(
        "MIGRATION_FAILED",
        `Cannot rollback: migration version ${latest.version} not found in definition list.`,
      );
    }

    await withTransaction(this.client, async (tx) => {
      try {
        await tx.query(migration.downSql);
        await tx.query(`DELETE FROM schema_migrations WHERE version = $1;`, [
          migration.version,
        ]);
      } catch (error) {
        throw new MigrationError(
          "MIGRATION_FAILED",
          `Rollback of version ${migration.version} (${migration.name}) failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    });

    return migration;
  }
}
