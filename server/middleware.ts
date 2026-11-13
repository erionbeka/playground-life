import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "./auth.ts";
import { config } from "./config.ts";
import { query } from "./db.ts";
import type { AuthUser, UserRole } from "./types.ts";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Cookie-authenticated state changes must come from one of the configured
 * application origins.
 *
 * Production cookies use `SameSite=None` because the web app and API are
 * separate origins. SameSite then provides no CSRF protection at all, and
 * CORS does not stop a cross-site form POST or a `no-cors` request. Checking
 * Origin/Referer closes that gap. Bearer-token clients are exempt because the
 * browser never attaches that header automatically.
 *
 * A request with neither header is allowed: non-browser clients and some
 * privacy tools omit them, and a browser cannot perform a cross-site
 * state-changing request without one of them.
 */
export function csrfOriginGuard(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();

  const authorization = req.header("authorization");
  if (authorization?.startsWith("Bearer ")) return next();

  const source = req.header("origin") || req.header("referer");
  if (!source) return next();

  const origin = normalizeOrigin(source);
  const allowed = config.CORS_ORIGINS
    .map(normalizeOrigin)
    .filter((value): value is string => value !== null);
  if (!origin || !allowed.includes(origin)) {
    return res.status(403).json({ error: "Cross-site request blocked" });
  }

  return next();
}

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
    // Roles are exact by default. A superadmin must use explicitly superadmin-
    // gated platform routes and must not inherit clinic-level clinical access.
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Insufficient permissions" });
    return next();
  };
}
