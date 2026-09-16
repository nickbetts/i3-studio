import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export async function consumeRateLimit(key: string, limit: number, windowSeconds: number) {
  const digest = createHash("sha256").update(key).digest("hex");
  const result = await db.execute(sql`
    INSERT INTO app_rate_limit (key, attempts, expires_at) VALUES (${digest}, 1, now() + ${windowSeconds} * interval '1 second')
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE WHEN app_rate_limit.expires_at <= now() THEN 1 ELSE app_rate_limit.attempts + 1 END,
      expires_at = CASE WHEN app_rate_limit.expires_at <= now() THEN now() + ${windowSeconds} * interval '1 second' ELSE app_rate_limit.expires_at END
    RETURNING attempts
  `);
  return Number(result.rows[0]?.attempts) <= limit;
}