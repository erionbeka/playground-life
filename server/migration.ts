import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closePool, withTransaction } from "./db.ts";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(dirname, "sql");

export async function getAvailableMigrations(): Promise<string[]> {
  const entries = await readdir(migrationsDir);
  return entries
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

export function pendingMigrations(applied: string[], available: string[]): string[] {
  const appliedSet = new Set(applied);
  return available.filter((name) => !appliedSet.has(name));
}

export async function runMigrations(): Promise<void> {
  const available = await getAvailableMigrations();

  const appliedCount = await withTransaction(async (client) => {
    // Serialize migration runners and keep migrations plus tracking atomic.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('playground-life:migrations')::bigint)"
    );

    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
    );

    const appliedResult = await client.query<{ name: string }>(
      "SELECT name FROM schema_migrations"
    );
    const pending = pendingMigrations(
      appliedResult.rows.map((row) => row.name),
      available
    );

    for (const name of pending) {
      const sql = (await readFile(path.join(migrationsDir, name), "utf8"))
        .replace(/^\uFEFF/, "");

      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (name) VALUES ($1)",
        [name]
      );
      console.log(`Applied migration ${name}`);
    }

    return pending.length;
  });

  if (appliedCount === 0) {
    console.log("Database already up to date");
  }
}
