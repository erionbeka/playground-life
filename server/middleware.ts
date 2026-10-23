import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "./auth.ts";
import type { UserRole } from "./types.ts";

function tokenFromRequest(req: Request) {
  const header = req.header("authorization");
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length);
  const cookieToken = req.cookies?.access_token;
  return typeof cookieToken === "string" ? cookieToken : null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = tokenFromRequest(req);
  if (!token) return res.status(401).json({ error: "Authentication required" });

  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

export function requireRole(...roles: UserRole[]) {
  const expanded = roles.includes("admin") && !roles.includes("superadmin") ? [...roles, "superadmin"] : roles;
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    if (!expanded.includes(req.user.role)) return res.status(403).json({ error: "Insufficient permissions" });
    return next();
  };
}
