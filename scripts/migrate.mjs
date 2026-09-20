#!/usr/bin/env node

/**
 * Clario Database Migration CLI
 *
 * Usage:
 *   node scripts/migrate.mjs [command] [options]
 *
 * Commands:
 *   status     Report applied and pending migrations (default)
 *   up         Apply all pending migrations in ascending order
 *   down       Roll back the single latest applied migration
 *
 * Options:
 *   --db <url>    PostgreSQL connection string (defaults to process.env.DATABASE_URL)
 *   --dir <path>  Path to migrations directory
 *   --help        Display help message
 */

import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createPool, Migrator } from "../packages/database/dist/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_MIGRATIONS_DIR = path.resolve(
  ROOT_DIR,
  "packages",
  "database",
  "migrations",
);

function parseArgs(args) {
  let command = "status";
  const options = {
    db: process.env.DATABASE_URL || "",
    dir: DEFAULT_MIGRATIONS_DIR,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === "status" || arg === "up" || arg === "down") {
      command = arg;
      i++;
    } else if (arg === "--db" && i + 1 < args.length) {
      options.db = args[i + 1];
      i += 2;
    } else if (arg === "--dir" && i + 1 < args.length) {
      options.dir = path.resolve(process.cwd(), args[i + 1]);
      i += 2;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }

  return { command, options };
}

function printHelp() {
  console.log(`
Clario Database Migration CLI

Usage:
  node scripts/migrate.mjs [status|up|down] [options]

Commands:
  status     Report applied and pending migrations (default)
  up         Apply all pending migrations
  down       Roll back the latest applied migration

Options:
  --db <url>    PostgreSQL connection string (or DATABASE_URL)
  --dir <path>  Migrations directory path
  --help        Show this help message
`);
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (!options.db) {
    console.error(
      "Error: Database connection URL is required. Provide --db <url> or set DATABASE_URL.",
    );
    process.exit(1);
  }

  const pool = createPool(options.db);
  const migrator = new Migrator(pool, options.dir);

  try {
    if (command === "status") {
      const status = await migrator.status();
      console.log(`Applied migrations (${status.applied.length}):`);
      for (const m of status.applied) {
        console.log(
          `  - v${m.version}: ${m.name} [checksum: ${m.checksum.slice(0, 8)}...]`,
        );
      }
      console.log(`Pending migrations (${status.pending.length}):`);
      for (const m of status.pending) {
        console.log(`  - v${m.version}: ${m.name}`);
      }
    } else if (command === "up") {
      console.log("Applying pending migrations...");
      const executed = await migrator.up();
      if (executed.length === 0) {
        console.log("Database is already up to date.");
      } else {
        for (const m of executed) {
          console.log(`  + Applied v${m.version}: ${m.name}`);
        }
        console.log(`Successfully applied ${executed.length} migration(s).`);
      }
    } else if (command === "down") {
      console.log("Rolling back latest migration...");
      const rolledBack = await migrator.down();
      console.log(`  - Rolled back v${rolledBack.version}: ${rolledBack.name}`);
    }
  } catch (error) {
    console.error(
      `Migration error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
