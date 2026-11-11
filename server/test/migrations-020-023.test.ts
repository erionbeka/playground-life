// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(dirname, "..", "sql");

// Test PostgreSQL on port 5433 with trust authentication.
// The `test` database must exist before running (create with: createdb -h 127.0.0.1 -p 5433 -U postgres test).
const TEST_DATABASE_URL = "postgres://postgres@127.0.0.1:5433/test";

const MIGRATION_NAMES = [
  "020_clinic_link_integrity.sql",
  "021_clinic_operation_accountability.sql",
  "022_operator_authorization.sql",
  "023_operator_audit_log.sql",
] as const;

async function readMigration(name: string): Promise<string> {
  return (await readFile(path.join(migrationsDir, name), "utf8")).replace(/^\uFEFF/, "");
}

let pool: Pool;

describe("migrations 020-023", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DATABASE_URL });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("applies prerequisite migrations 001-002 then 020-023 in sequence", async () => {
    for (const name of [
      "001_init.sql",
      "002_compliance.sql",
      ...MIGRATION_NAMES,
    ]) {
      const sql = await readMigration(name);
      await pool.query(sql);
    }
  });

  it("applies 020_clinic_link_integrity.sql successfully", async () => {
    const sql = await readMigration("020_clinic_link_integrity.sql");
    await pool.query(sql);
  });

  it("applies 021_clinic_operation_accountability.sql successfully", async () => {
    const sql = await readMigration("021_clinic_operation_accountability.sql");
    await pool.query(sql);
  });

  it("applies 022_operator_authorization.sql successfully", async () => {
    const sql = await readMigration("022_operator_authorization.sql");
    await pool.query(sql);
  });

  it("applies 023_operator_audit_log.sql successfully", async () => {
    const sql = await readMigration("023_operator_audit_log.sql");
    await pool.query(sql);
  });

  it("verifies the children unique constraint column order matches the FK reference", async () => {
    const constraint = await pool.query<{ conname: string; conkey: number[] }>(
      `SELECT conname, conkey::text[]::int[]
       FROM pg_constraint
       WHERE conname = 'children_id_clinic_id_key' AND conrelid = 'children'::regclass`
    );
    expect(constraint.rows).toHaveLength(1);
    // children table column order: id(1), clinic_id(2), ...
    // UNIQUE (clinic_id, id) → conkey [2, 1]
    expect(constraint.rows[0].conkey).toEqual([2, 1]);
  });

  it("verifies the foreign key references children (clinic_id, id)", async () => {
    const fk = await pool.query<{ conname: string; confkey: number[] }>(
      `SELECT conname, confkey::text[]::int[]
       FROM pg_constraint
       WHERE conname = 'family_child_links_clinic_child_fkey' AND conrelid = 'family_child_links'::regclass`
    );
    expect(fk.rows).toHaveLength(1);
    // References children.clinic_id(2), children.id(1)
    expect(fk.rows[0].confkey).toEqual([2, 1]);
  });
});
