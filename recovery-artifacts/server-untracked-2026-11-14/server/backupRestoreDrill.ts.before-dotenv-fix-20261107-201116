import { mkdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import pg from "pg";

type DrillMode = "backup" | "restore-test" | "drill";

const mode = (process.argv[2] || "drill") as DrillMode;
const backupDir = process.env.BACKUP_DIR || path.resolve(process.cwd(), "backups");
const backupFile = process.env.BACKUP_FILE || path.join(backupDir, `playground-life-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`);

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function databaseName(connectionString: string) {
  const url = new URL(connectionString);
  return url.pathname.replace(/^\//, "");
}

/**
 * Splits the password out of a connection string.
 *
 * The password used to be handed to `pg_dump` as part of the connection
 * string in the argument list. An argument list is visible to every process
 * on the machine, and `pg_dump` puts its own arguments into its error
 * messages, so the database password ended up in the logs. The password now
 * travels in the `PGPASSWORD` environment variable and the argument only
 * carries the address.
 */
function splitCredentials(connectionString: string) {
  const url = new URL(connectionString);
  const password = decodeURIComponent(url.password);
  url.password = "";
  return { url: url.toString(), password };
}

/**
 * Quotes an argument for the shell.
 *
 * On Windows the child is started through `cmd.exe`, which reads `&`, `|`,
 * `>` and spaces as syntax. A connection string can contain all of them.
 */
function quoteArgument(value: string) {
  if (process.platform !== "win32") return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function assertRestoreTargetIsSafe(connectionString: string) {
  const name = databaseName(connectionString).toLowerCase();
  if (!/(test|restore|drill|staging)/.test(name)) {
    throw new Error("RESTORE_TEST_DATABASE_URL must point to a database with test, restore, drill, or staging in its name");
  }
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  return new Promise<void>((resolve, reject) => {
    const useShell = process.platform === "win32";
    const child = spawn(useShell ? quoteArgument(command) : command, useShell ? args.map(quoteArgument) : args, {
      stdio: "inherit",
      shell: useShell,
      env,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function verifyRestoredDatabase(connectionString: string) {
  const pool = new pg.Pool({ connectionString });
  try {
    const requiredTables = ["clinics", "users", "children", "assignments", "game_results", "audit_log"];
    const result = await pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1)
       ORDER BY table_name`,
      [requiredTables]
    );
    const restored = new Set(result.rows.map((row) => row.table_name));
    const missing = requiredTables.filter((table) => !restored.has(table));
    if (missing.length > 0) throw new Error(`Restore verification failed. Missing tables: ${missing.join(", ")}`);
  } finally {
    await pool.end();
  }
}

async function createBackup() {
  const databaseUrl = requireEnv("DATABASE_URL");
  const { url: safeUrl, password } = splitCredentials(databaseUrl);
  await mkdir(path.dirname(backupFile), { recursive: true });
  await run(
    "pg_dump",
    ["--format=custom", "--no-owner", "--no-acl", "--file", backupFile, safeUrl],
    { ...process.env, PGPASSWORD: password },
  );
  console.log(`Backup created: ${backupFile}`);
}

async function restoreAndVerify() {
  const restoreUrl = requireEnv("RESTORE_TEST_DATABASE_URL");
  assertRestoreTargetIsSafe(restoreUrl);
  const { url: safeUrl, password } = splitCredentials(restoreUrl);
  await run(
    "pg_restore",
    ["--clean", "--if-exists", "--no-owner", "--no-acl", "--dbname", safeUrl, backupFile],
    { ...process.env, PGPASSWORD: password },
  );
  await verifyRestoredDatabase(restoreUrl);
  console.log(`Restore test verified against ${databaseName(restoreUrl)}`);
}

if (!["backup", "restore-test", "drill"].includes(mode)) {
  throw new Error("Usage: tsx server/backupRestoreDrill.ts [backup|restore-test|drill]");
}

if (mode === "backup") {
  await createBackup();
} else if (mode === "restore-test") {
  await restoreAndVerify();
} else {
  await createBackup();
  await restoreAndVerify();
}
