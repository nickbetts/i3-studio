type SendMailInput = { to: string; subject: string; text: string; replyTo?: string };

import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { emailOutbox } from "@/db/schema";

export async function sendMail(input: SendMailInput) {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const from = process.env.SUPPORT_INBOUND_ADDRESS;
  if (!apiKey || !domain || !from) return { skipped: true };
  const base = process.env.MAILGUN_API_BASE || "https://api.mailgun.net";
  const body = new URLSearchParams({ from, to: input.to, subject: input.subject, text: input.text });
  if (input.replyTo) body.set("h:Reply-To", input.replyTo);
  const response = await fetch(`${base}/v3/${domain}/messages`, { method: "POST", signal: AbortSignal.timeout(10000), headers: { Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) throw new Error(`Mailgun request failed: ${response.status}`);
  return response.json() as Promise<{ id: string }>;
}

export async function queueMail(input: SendMailInput) {
  if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN || !process.env.SUPPORT_INBOUND_ADDRESS) return null;
  const [message] = await db.insert(emailOutbox).values({ recipient: input.to, subject: input.subject, body: input.text, replyTo: input.replyTo }).returning({ id: emailOutbox.id });
  return message.id;
}

export async function cleanupMailAndSecurityRecords() {
  await db.execute(sql`
    DELETE FROM app_rate_limit WHERE expires_at < now();
    DELETE FROM app_password_reset WHERE expires_at < now();
    DELETE FROM app_upload WHERE expires_at < now() AND consumed_at IS NULL;
    DELETE FROM app_webhook_receipt WHERE created_at < now() - interval '7 days';
    DELETE FROM app_email_outbox WHERE sent_at IS NOT NULL AND sent_at < now() - interval '30 days';
  `);
}

export async function processMail(limit = 20) {
  const pending = await db.select().from(emailOutbox).where(and(isNull(emailOutbox.sentAt), lte(emailOutbox.nextAttemptAt, new Date()))).limit(limit);
  let sent = 0;
  for (const message of pending) {
    const claimed = await db.update(emailOutbox).set({ attempts: sql`${emailOutbox.attempts} + 1`, nextAttemptAt: new Date(Date.now() + 15 * 60 * 1000) }).where(and(eq(emailOutbox.id, message.id), isNull(emailOutbox.sentAt), lte(emailOutbox.nextAttemptAt, new Date()))).returning({ id: emailOutbox.id, attempts: emailOutbox.attempts });
    if (!claimed.length) continue;
    try {
      await sendMail({ to: message.recipient, subject: message.subject, text: message.body, replyTo: message.replyTo ?? undefined });
      await db.update(emailOutbox).set({ sentAt: new Date(), lastError: null }).where(eq(emailOutbox.id, message.id));
      sent++;
    } catch (error) {
      const attempts = claimed[0].attempts;
      const delay = Math.min(24 * 60 * 60 * 1000, 2 ** Math.min(attempts, 10) * 60 * 1000);
      await db.update(emailOutbox).set({ nextAttemptAt: new Date(Date.now() + delay), lastError: error instanceof Error ? error.message.slice(0, 500) : "Mail delivery failed." }).where(eq(emailOutbox.id, message.id));
    }
  }
  return { processed: pending.length, sent };
}
