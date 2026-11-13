// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(dirname, "..", "sql");
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

if (!TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL is required; run against a disposable PostgreSQL database.");
}

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
    await pool.query("SELECT 1");
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("applies prerequisite migrations and 020-023 in order, then safely reapplies 020-023", async () => {
    for (const name of ["001_init.sql", "002_compliance.sql", ...MIGRATION_NAMES]) {
      await pool.query(await readMigration(name));
    }

    // A second pass verifies that the migrations tolerate being re-run.
    for (const name of MIGRATION_NAMES) {
      await pool.query(await readMigration(name));
    }
  });

  it("stores the children unique constraint in (clinic_id, id) order", async () => {
    const result = await pool.query<{ conkey: number[] }>(
      `SELECT conkey::text[]::int[] AS conkey
       FROM pg_constraint
       WHERE conname = 'children_id_clinic_id_key'
         AND conrelid = 'children'::regclass`
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].conkey).toEqual([2, 1]);
  });

  it("references children through (clinic_id, id)", async () => {
    const result = await pool.query<{ confkey: number[] }>(
      `SELECT confkey::text[]::int[] AS confkey
       FROM pg_constraint
       WHERE conname = 'family_child_links_clinic_child_fkey'
         AND conrelid = 'family_child_links'::regclass`
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].confkey).toEqual([2, 1]);
  });

  it("rejects a family-child link that crosses clinic boundaries", async () => {
    const clinicA = (await pool.query(
      "INSERT INTO clinics (name) VALUES ('Migration test clinic A') RETURNING id"
    )).rows[0].id as string;
    const clinicB = (await pool.query(
      "INSERT INTO clinics (name) VALUES ('Migration test clinic B') RETURNING id"
    )).rows[0].id as string;

    const userA = (await pool.query(
      `INSERT INTO users (clinic_id, role, name, email, password_hash)
       VALUES ($1, 'parent', 'Test Parent A', 'migration-parent-a@example.test', 'test-hash')
       RETURNING id`,
      [clinicA]
    )).rows[0].id as string;
    const userB = (await pool.query(
      `INSERT INTO users (clinic_id, role, name, email, password_hash)
       VALUES ($1, 'parent', 'Test Parent B', 'migration-parent-b@example.test', 'test-hash')
       RETURNING id`,
      [clinicB]
    )).rows[0].id as string;
    const childA = (await pool.query(
      `INSERT INTO children (clinic_id, first_name, display_name)
       VALUES ($1, 'Test', 'Test child A') RETURNING id`,
      [clinicA]
    )).rows[0].id as string;

    // A valid same-clinic link remains allowed.
    await pool.query(
      `INSERT INTO family_child_links (clinic_id, child_id, user_id, relationship)
       VALUES ($1, $2, $3, 'parent')`,
      [clinicA, childA, userA]
    );

    // The child's UUID exists, but pairing it with another clinic must fail.
    await expect(
      pool.query(
        `INSERT INTO family_child_links (clinic_id, child_id, user_id, relationship)
         VALUES ($1, $2, $3, 'parent')`,
        [clinicB, childA, userB]
      )
    ).rejects.toMatchObject({ code: "23503" });
  });
});
