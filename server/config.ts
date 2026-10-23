import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const runningInProduction = (process.env.NODE_ENV || "development") === "production";

/**
 * Reads a boolean from the environment.
 *
 * `z.coerce.boolean()` cannot be used here: it applies `Boolean(value)` to the
 * raw string, so the string "false" becomes `true` and the string "0" becomes
 * `true` as well. A setting that reads "false" but behaves as "true" is a
 * trap, so the accepted spellings are listed explicitly and anything else
 * falls back to the default.
 */
const booleanFromEnv = (defaultValue: boolean) =>
  z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => {
      if (value === undefined) return defaultValue;
      if (typeof value === "boolean") return value;
      const normalized = value.trim().toLowerCase();
      if (normalized === "") return defaultValue;
      if (["1", "true", "yes", "on"].includes(normalized)) return true;
      if (["0", "false", "no", "off"].includes(normalized)) return false;
      return defaultValue;
    });

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  CORS_ORIGIN: z.string().default("http://localhost:8080"),
  COOKIE_SECURE: booleanFromEnv(runningInProduction),
  /**
   * How many proxy hops in front of the API to trust when reading the client
   * address. The API sits behind nginx, which sets `X-Forwarded-For`, so one
   * hop is right for the container deployment. Zero means the socket address
   * is used, which is what an exposed API should use.
   */
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(runningInProduction ? 1 : 0),
  /**
   * The key that de-identifies the research export. A participant id is an
   * HMAC of the child id under this key, so the key must be a secret. It
   * falls back to the JWT secret, which is already a secret of the required
   * length, but a dedicated key keeps the participant ids stable if the
   * session secret is ever rotated.
   */
  RESEARCH_DEIDENTIFICATION_KEY: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(32).optional()),
});

const parsed = configSchema.parse(process.env);

export const config = {
  ...parsed,
  /** Every origin allowed to call the API with credentials. */
  CORS_ORIGINS: parsed.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  /** The key used to de-identify research exports. Never written to a log. */
  RESEARCH_KEY: parsed.RESEARCH_DEIDENTIFICATION_KEY || parsed.JWT_SECRET,
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
