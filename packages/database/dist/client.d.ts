import { Pool, type PoolConfig } from "pg";
export interface QueryResult<T = Record<string, unknown>> {
    rows: T[];
    rowCount?: number | null;
}
export interface DatabaseClient {
    query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}
/**
 * Creates a configured PostgreSQL connection pool.
 * Does not initiate connections until queried.
 */
export declare function createPool(connectionString?: string, config?: PoolConfig): Pool;
/**
 * Executes a callback within a database transaction.
 * Automatically issues BEGIN, COMMIT, or ROLLBACK.
 */
export declare function withTransaction<T>(client: DatabaseClient, fn: (tx: DatabaseClient) => Promise<T>): Promise<T>;
//# sourceMappingURL=client.d.ts.map