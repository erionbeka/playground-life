import { Router } from "express";
import { query } from "../db.ts";
import { requireAuth, requireRole } from "../middleware.ts";

const superadminRoutes = Router();

// Platform-wide account metadata only. Clinical records remain behind
// clinic-scoped routes and are not exposed by this directory.
superadminRoutes.use(requireAuth, requireRole("superadmin"));

superadminRoutes.get("/users", async (_req, res) => {
  const [users, clinics] = await Promise.all([
    query<{
      id: string;
      name: string;
      email: string | null;
      role: string;
      clinic_id: string;
      clinic_name: string;
      credential_status: string;
      last_signed_in_at: string | null;
      created_at: string;
    }>(
      `SELECT
         users.id,
         users.name,
         users.email,
         users.role,
         users.clinic_id,
         clinics.name AS clinic_name,
         users.credential_status,
         users.last_signed_in_at,
         users.created_at
       FROM users
       INNER JOIN clinics ON clinics.id = users.clinic_id
       ORDER BY clinics.name ASC, users.role ASC, users.name ASC`
    ),
    query<{ id: string; name: string; created_at: string; user_count: number }>(
      `SELECT clinics.id, clinics.name, clinics.created_at, COUNT(users.id)::int AS user_count
       FROM clinics
       LEFT JOIN users ON users.clinic_id = clinics.id
       GROUP BY clinics.id
       ORDER BY clinics.name ASC`
    ),
  ]);

  return res.json({ users: users.rows, clinics: clinics.rows });
});

export default superadminRoutes;
