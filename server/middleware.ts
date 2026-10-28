import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "./auth.ts";
import { query } from "./db.ts";
import type { AuthUser, UserRole } from "./types.ts";

function tokenFromRequest(req: Request) {
  const header = req.header("authorization");
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length);
  const cookieToken = req.cookies?.access_token;
  return typeof cookieToken === "string" ? cookieToken : null;
}

interface CurrentUserRow {
  id: string;
  clinic_id: string;
  role: UserRole;
  name: string;
  credential_status: string;
  session_version: number;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = tokenFromRequest(req);
  if (!token) return res.status(401).json({ error: "Authentication required" });

  let tokenUser: AuthUser;

  try {
    tokenUser = verifyAccessToken(token);
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  try {
    const result = await query<CurrentUserRow>(
      `SELECT id, clinic_id, role, name, credential_status, session_version
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [tokenUser.id]
    );

    const current = result.rows[0];

    if (
      !current ||
      current.credential_status !== "active" ||
      current.session_version !== tokenUser.sessionVersion
    ) {
      return res.status(401).json({ error: "Session is no longer valid" });
    }

    // Authorization uses current database values, never stale JWT role/clinic data.
    req.user = {
      id: current.id,
      clinicId: current.clinic_id,
      role: current.role,
      name: current.name,
      sessionVersion: current.session_version,
    };

    return next();
  } catch (error) {
    // Fail closed: a database error must never turn into authenticated access.
    console.error("Session validation failed:", error);
    return res.status(503).json({ error: "Authentication service temporarily unavailable" });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Insufficient permissions" });
    return next();
  };
}
