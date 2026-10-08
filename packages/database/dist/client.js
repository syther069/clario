import { Pool } from "pg";
/**
 * Creates a configured PostgreSQL connection pool.
 * Does not initiate connections until queried.
 */
export function createPool(connectionString, config) {
    const pool = new Pool({
        connectionString,
        ...config,
    });
    pool.on("error", (err) => {
        console.warn("[Database] Background connection pool error:", err.message);
    });
    return pool;
}
/**
 * Executes a callback within a database transaction.
 * Automatically issues BEGIN, COMMIT, or ROLLBACK.
 */
export async function withTransaction(client, fn) {
    // If the client is a pg.Pool, acquire a dedicated client for the transaction
    if ("connect" in client &&
        typeof client.connect === "function") {
        const pool = client;
        const poolClient = await pool.connect();
        try {
            await poolClient.query("BEGIN");
            const result = await fn(poolClient);
            await poolClient.query("COMMIT");
            return result;
        }
        catch (error) {
            await poolClient.query("ROLLBACK").catch(() => { });
            throw error;
        }
        finally {
            poolClient.release();
        }
    }
    // Otherwise, use the provided client directly (e.g. pg-mem adapter or single client)
    await client.query("BEGIN");
    try {
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
    }
    catch (error) {
        await client.query("ROLLBACK").catch(() => { });
        throw error;
    }
}
//# sourceMappingURL=client.js.map