"use server";

import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { consumeRateLimit } from "@/lib/rate-limit";
import { sendMail } from "@/lib/mailgun";

export type RecoveryState = { message?: string; error?: string };
const generic = { message: "If that account is active, a reset link will be sent to its email address." };

export async function requestPasswordReset(_previous: RecoveryState, form: FormData): Promise<RecoveryState> {
  const parsed = z.string().trim().email().max(254).safeParse(form.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };
  const email = parsed.data.toLowerCase();
  if (!await consumeRateLimit(`recovery:${email}`, 3, 3600)) return generic;
  const user = await db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true, status: true } });
  if (!user || user.status !== "active") return generic;
  const origin = new URL(process.env.AUTH_URL ?? "http://localhost:3000");
  if (process.env.NODE_ENV === "production" && origin.protocol !== "https:") throw new Error("Password recovery requires an HTTPS AUTH_URL.");
  const token = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(token).digest("hex");
  await db.execute(sql`INSERT INTO app_password_reset (token_hash, user_id, expires_at) VALUES (${hash}, ${user.id}, now() + interval '30 minutes')`);
  try {
    const result = await sendMail({ to: email, subject: "Reset your i3 Studio password", text: `Reset your password: ${origin.origin}/reset-password?token=${token}\n\nThis link expires in 30 minutes and can be used once. If you did not request this, ignore this email.` });
    if ("skipped" in result) console.error(JSON.stringify({ event: "password_recovery_unconfigured" }));
  } catch {
    console.error(JSON.stringify({ event: "password_recovery_delivery_failed" }));
  }
  return generic;
}

export async function resetPassword(_previous: RecoveryState, form: FormData): Promise<RecoveryState> {
  const parsed = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: z.string().min(12).max(72).refine((value) => Buffer.byteLength(value) <= 72) }).safeParse({ token: form.get("token"), password: form.get("password") });
  if (!parsed.success) return { error: "Use a valid reset link and a password of 12 to 72 bytes." };
  const hash = createHash("sha256").update(parsed.data.token).digest("hex");
  if (!await consumeRateLimit(`reset:${hash}`, 5, 3600)) return { error: "Too many attempts. Request another reset link." };
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const result = await db.execute(sql`
    WITH consumed AS (
      DELETE FROM app_password_reset WHERE token_hash = ${hash} AND expires_at > now() RETURNING user_id
    ), changed AS (
      UPDATE "user" SET password_hash = ${passwordHash} WHERE id IN (SELECT user_id FROM consumed) AND status = 'active' RETURNING id
    ), cleared AS (
      DELETE FROM app_password_reset WHERE user_id IN (SELECT id FROM changed)
    ), audit AS (
      INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id)
      SELECT ${crypto.randomUUID()}, id, 'user.password_reset', 'user', id FROM changed
    ) SELECT id FROM changed
  `);
  return result.rows.length ? { message: "Password updated. Sign in with your new password." } : { error: "This link is expired or already used. Request another reset link." };
}