/**
 * Copyright (c) 2026 Erion Beka. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Proprietary
 */
import nodemailer from "nodemailer";
import { query } from "./db.ts";

async function main() {
  const transport = process.env.MAIL_TRANSPORT || "smtp";

  if (transport !== "smtp") {
    console.log("MAIL_TRANSPORT is not set to 'smtp'; skipping email delivery.");
    process.exit(0);
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error("SMTP_USER and SMTP_PASS are required to send emails.");
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const from = process.env.MAIL_FROM || process.env.SMTP_USER;

  // Deliver up to 50 queued messages per run (idempotent and safe for cron)
  const result = await query<{ id: string; to_email: string; subject: string; body: string }>(
    `SELECT id, to_email, subject, body
     FROM email_outbox
     WHERE status = 'queued'
     ORDER BY created_at ASC
     LIMIT 50`
  );

  if (result.rows.length === 0) {
    console.log("No queued emails to deliver.");
    process.exit(0);
  }

  for (const row of result.rows) {
    try {
      await transporter.sendMail({
        from,
        to: row.to_email,
        subject: row.subject,
        text: row.body,
      });
      await query("UPDATE email_outbox SET status = 'sent', sent_at = now() WHERE id = $1", [row.id]);
      console.log(`sent ${row.id} -> ${row.to_email}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`failed ${row.id} -> ${row.to_email}: ${message}`);
      await query("UPDATE email_outbox SET status = 'failed' WHERE id = $1", [row.id]);
    }
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
