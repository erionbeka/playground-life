import { query } from "../db.ts";

interface OutboxInput {
  to: string;
  kind: "invite" | "reset" | "notice";
  subject: string;
  body: string;
}

/**
 * Transactional email sink. Messages are persisted to `email_outbox` so
 * delivery is auditable and retryable; a worker (or SMTP relay reading this
 * table, e.g. via LISTEN/NOTIFY or cron) performs final delivery.
 *
 * To plug in SMTP directly, set MAIL_TRANSPORT=smtp and wire a transport in
 * deliverQueued() — the outbox row remains the source of truth either way.
 */
export async function queueEmail(input: OutboxInput): Promise<void> {
  await query(
    `INSERT INTO email_outbox (to_email, kind, subject, body)
     VALUES ($1, $2, $3, $4)`,
    [input.to, input.kind, input.subject, input.body]
  );
  if (process.env.NODE_ENV !== "production") {
    console.info(`[outbox:${input.kind}] → ${input.to} :: ${input.subject}`);
  }
}

export function appUrl(): string {
  return process.env.APP_URL || "http://localhost:5173";
}
