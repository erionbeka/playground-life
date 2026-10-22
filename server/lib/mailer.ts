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
export async function queueEmail(input: OutboxInput): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO email_outbox (to_email, kind, subject, body)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [input.to, input.kind, input.subject, input.body]
  );
  if (process.env.NODE_ENV !== "production") {
    console.info(`[outbox:${input.kind}] �+' ${input.to} :: ${input.subject}`);
  }
  return result.rows[0]?.id ?? "";
}

export function appUrl(): string {
  return process.env.APP_URL || "http://localhost:5173";
}

export async function deliverQueued(): Promise<void> {
  if ((process.env.MAIL_TRANSPORT || "smtp") !== "smtp") return;
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.default.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const result = await query<{ id: string; to_email: string; subject: string; body: string }>(
    `SELECT id, to_email, subject, body FROM email_outbox WHERE status = 'queued' ORDER BY created_at ASC LIMIT 50`
  );
  for (const row of result.rows) {
    try {
      await transporter.sendMail({ from, to: row.to_email, subject: row.subject, text: row.body });
      await query("UPDATE email_outbox SET status = 'sent', sent_at = now() WHERE id = $1", [row.id]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`mail failed ${row.id}: ${message}`);
      await query("UPDATE email_outbox SET status = 'failed' WHERE id = $1", [row.id]);
    }
  }
}
