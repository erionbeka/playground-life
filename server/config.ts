import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  CORS_ORIGIN: z.string().default("http://localhost:8080"),
  COOKIE_SECURE: z.coerce.boolean().default(false),
});

const parsed = configSchema.parse(process.env);

export const config = {
  ...parsed,
  /** Every origin allowed to call the API with credentials. */
  CORS_ORIGINS: parsed.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};
export const isProduction = config.NODE_ENV === "production";

/**
 * The database target with no credentials in it, safe to write to a log.
 * `postgres://user:secret@host:5432/db` becomes
 * `postgres://host:5432/db`.
 */
export function databaseTarget(databaseUrl: string = config.DATABASE_URL): string {
  try {
    const url = new URL(databaseUrl);
    return `${url.protocol}//${url.host}/${url.pathname.replace(/^\//, "")}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

/**
 * Removes any Postgres connection string from a message. `pg_dump` puts its
 * argv into its error message, and that argv carries the password.
 */
export function redactDatabaseUrl(text: string): string {
  return text.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "postgres://[redacted]");
}
