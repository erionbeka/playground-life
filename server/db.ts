import pg from "pg";
import { config } from "./config.ts";

const useSsl = /sslmode=require|ssl=true/i.test(config.DATABASE_URL);
export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: true } : false,
  // A reachable-but-unresponsive host must not hang the connection forever.
  connectionTimeoutMillis: 5000,
});

export async function query<T extends pg.QueryResultRow>(text: string, params: unknown[] = []) {
  return pool.query<T>(text, params);
}

export async function closePool() {
  await pool.end();
}


/**
 * Run related database operations on one connection and commit them atomically.
 * The client is always released, and failed operations trigger a rollback.
 */
export async function withTransaction<T>(
  operation: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
