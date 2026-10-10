import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closePool, query } from "./db.ts";
import { getAvailableMigrations, pendingMigrations } from "./migration.ts";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(dirname, "sql");

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

try {
  await query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
  );

  const available = await getAvailableMigrations();
  const appliedResult = await query<{ name: string }>("SELECT name FROM schema_migrations");
  const pending = pendingMigrations(appliedResult.rows.map((row) => row.name), available);

  for (const name of pending) {
    const sql = stripBom(await readFile(path.join(migrationsDir, name), "utf8"));
    await query(sql);
    await query("INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [name]);
    console.log(`Applied migration ${name}`);
  }

  console.log(pending.length === 0 ? "Database already up to date" : "Database migration completed");
} finally {
  await closePool();
}