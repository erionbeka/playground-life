import pg from "pg";
import { config } from "./config.ts";

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  ssl: config.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined,
  // A reachable-but-unresponsive host must not hang the connection forever.
  connectionTimeoutMillis: 5000,
});

export async function query<T extends pg.QueryResultRow>(text: string, params: unknown[] = []) {
  return pool.query<T>(text, params);
}

export async function closePool() {
  await pool.end();
}
