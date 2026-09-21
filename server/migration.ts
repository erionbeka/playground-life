import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(dirname, "sql");

/** Pure function: returns available migration filenames sorted by version. */
export async function getAvailableMigrations(): Promise<string[]> {
  const entries = await readdir(migrationsDir);
  return entries
    .filter((name) => name.endsWith(".sql"))
    .toSorted();
}

/** Pure function: returns pending migrations given applied and available lists. */
export function pendingMigrations(applied: string[], available: string[]): string[] {
  const appliedSet = new Set(applied);
  return available.filter((name) => !appliedSet.has(name));
}

// Re-export for backward compatibility
export { readFile, readdir, path, fileURLToPath } from "node:fs/promises";