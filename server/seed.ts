import { hashPassword } from "./auth.ts";
import { closePool, query } from "./db.ts";

const clinicName = process.env.SEED_CLINIC_NAME || "Playground Life Clinic";
const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@playgroundlife.app";
const adminPassword = process.env.SEED_ADMIN_PASSWORD;

/**
 * The admin password is never defaulted.
 *
 * A built-in default password is a password that ends up in a repository, in
 * a deployment guide and in every copy of this file, so it stops being a
 * secret the moment the seed runs. The operator has to choose one.
 */
if (!adminPassword) {
  throw new Error(
    "SEED_ADMIN_PASSWORD is required. Set it in .env (12 characters or more) and run the seed again.",
  );
}

if (adminPassword.length < 12) {
  throw new Error("SEED_ADMIN_PASSWORD must be at least 12 characters.");
}

try {
  const clinic = await query<{ id: string }>(
    `INSERT INTO clinics (name)
     VALUES ($1)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [clinicName]
  );

  const clinicId = clinic.rows[0]?.id ?? (await query<{ id: string }>("SELECT id FROM clinics WHERE name = $1 LIMIT 1", [clinicName])).rows[0].id;
  const passwordHash = await hashPassword(adminPassword);

  await query(
    `INSERT INTO users (clinic_id, role, name, email, password_hash)
     VALUES ($1, 'admin', 'Clinic Administrator', $2, $3)
     ON CONFLICT (lower(email)) WHERE email IS NOT NULL
     DO UPDATE SET role = 'admin', password_hash = EXCLUDED.password_hash, updated_at = now()`,
    [clinicId, adminEmail, passwordHash]
  );

  console.log(`Seed complete. Admin email: ${adminEmail}`);
  console.log("Store the seed password securely and rotate it after first sign-in.");
} finally {
  await closePool();
}
