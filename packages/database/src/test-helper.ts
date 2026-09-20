import { randomUUID } from "node:crypto";
import { DataType, newDb, type IMemoryDb } from "pg-mem";
import type { DatabaseClient, QueryResult } from "./client.js";

export function createInMemoryDb(): { db: IMemoryDb; client: DatabaseClient } {
  const db = newDb({ noAstCoverageCheck: true });

  // Register pgcrypto extension
  db.registerExtension("pgcrypto", () => {});

  // Register gen_random_uuid function as impure
  db.public.registerFunction({
    name: "gen_random_uuid",
    returns: DataType.uuid,
    impure: true,
    implementation: () => randomUUID(),
  });

  const { Pool } = db.adapters.createPg();
  const pool = new Pool();

  const client: DatabaseClient = {
    async query<T = Record<string, unknown>>(
      sql: string,
      params?: unknown[],
    ): Promise<QueryResult<T>> {
      const res = await pool.query(sql, params);

      // Clean up orphaned index relations left by pg-mem after DROP TABLE CASCADE
      if (sql.includes("DROP TABLE")) {
        const publicSchema = db.public as unknown as {
          relsByNameCas: Map<
            string,
            { type: string; onTable?: { name: string } }
          >;
          _reg_unregister: (rel: unknown) => void;
        };
        for (const rel of Array.from(publicSchema.relsByNameCas.values())) {
          if (
            rel.type === "index" &&
            !publicSchema.relsByNameCas.has(rel.onTable?.name ?? "")
          ) {
            publicSchema._reg_unregister(rel);
          }
        }
      }

      return {
        rows: (res.rows as T[]) || [],
        rowCount: res.rowCount,
      };
    },
  };

  return { db, client };
}
