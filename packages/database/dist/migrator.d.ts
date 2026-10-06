import type { DatabaseClient } from "./client.js";
import type { SchemaMigrationRow } from "./types.js";
export interface MigrationFile {
    version: number;
    name: string;
    upSql: string;
    downSql: string;
    checksum: string;
}
export interface MigrationStatus {
    applied: SchemaMigrationRow[];
    pending: MigrationFile[];
}
export declare class MigrationError extends Error {
    readonly code: "CHECKSUM_MISMATCH" | "MIGRATION_FAILED" | "MISSING_DOWN_SCRIPT" | "NO_MIGRATIONS_TO_ROLLBACK";
    constructor(code: "CHECKSUM_MISMATCH" | "MIGRATION_FAILED" | "MISSING_DOWN_SCRIPT" | "NO_MIGRATIONS_TO_ROLLBACK", message: string);
}
/**
 * Computes SHA-256 checksum for a string.
 */
export declare function computeChecksum(content: string): string;
/**
 * Loads migration files from a directory.
 * Requires both `<version>_<name>.up.sql` and `<version>_<name>.down.sql`.
 */
export declare function loadMigrationsFromDir(dirPath: string): MigrationFile[];
/**
 * Core migration runner supporting forward migration, rollback, status, and integrity verification.
 */
export declare class Migrator {
    private readonly client;
    private readonly migrations;
    constructor(client: DatabaseClient, migrationsOrDir?: MigrationFile[] | string);
    /**
     * Ensures the schema_migrations tracking table exists.
     */
    ensureMigrationTable(): Promise<void>;
    /**
     * Retrieves all applied migrations from schema_migrations table.
     */
    getAppliedMigrations(): Promise<SchemaMigrationRow[]>;
    /**
     * Verifies that all applied migrations match disk definitions and have not been tampered with.
     */
    verify(): Promise<void>;
    /**
     * Reports current status of applied and pending migrations.
     */
    status(): Promise<MigrationStatus>;
    /**
     * Applies all pending migrations in ascending version order.
     */
    up(): Promise<MigrationFile[]>;
    /**
     * Rolls back the single latest applied migration in descending version order.
     */
    down(): Promise<MigrationFile>;
}
//# sourceMappingURL=migrator.d.ts.map