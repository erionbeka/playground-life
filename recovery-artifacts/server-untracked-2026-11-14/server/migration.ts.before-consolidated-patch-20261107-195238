import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closePool, query } from "./db.ts";

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
  await query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
  );
  const available = await getAvailableMigrations();
  const appliedResult = await query<{ name: string }>("SELECT name FROM schema_migrations");
  const pending = pendingMigrations(appliedResult.rows.map((row) => row.name), available);
  for (const name of pending) {
    const sql = (await readFile(path.join(migrationsDir, name), "utf8")).replace(/^\uFEFF/, "");
    await query(sql);
    await query("INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [name]);
    console.log(`Applied migration ${name}`);
  }
  if (pending.length === 0) console.log("Database already up to date");
}
