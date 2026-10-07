import { createPool, type DatabaseClient } from "@clario/database";

let cachedClient: DatabaseClient | undefined;

/**
 * Returns the singleton database client for the web application.
 */
export function getDatabaseClient(): DatabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || connectionString.trim().length === 0) {
    throw new Error("DATABASE_URL environment variable is not defined");
  }
  cachedClient = createPool(connectionString);
  return cachedClient;
}

/**
 * Overrides the database client (used in tests and local simulations).
 */
export function setDatabaseClient(client: DatabaseClient | undefined): void {
  cachedClient = client;
}
