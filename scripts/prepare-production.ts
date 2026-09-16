import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const database = neon(process.env.DATABASE_URL);
async function main() {
await database.transaction([
  database.query("ALTER TABLE annotation ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1"),
  database.query("CREATE TABLE IF NOT EXISTS app_upload (pathname text PRIMARY KEY, actor_id text NOT NULL REFERENCES \"user\"(id) ON DELETE CASCADE, client_id text, kind text NOT NULL, target_id text, file_name text NOT NULL, content_type text NOT NULL, expires_at timestamptz NOT NULL, consumed_at timestamptz)"),
  database.query("CREATE TABLE IF NOT EXISTS app_rate_limit (key text PRIMARY KEY, attempts integer NOT NULL, expires_at timestamptz NOT NULL)"),
  database.query("CREATE TABLE IF NOT EXISTS app_password_reset (token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES \"user\"(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL)"),
  database.query("CREATE TABLE IF NOT EXISTS app_webhook_receipt (token_hash text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now())"),
  database.query("CREATE INDEX IF NOT EXISTS app_rate_limit_expiry_idx ON app_rate_limit (expires_at)"),
  database.query("CREATE INDEX IF NOT EXISTS app_password_reset_expiry_idx ON app_password_reset (expires_at)"),
  database.query("CREATE TABLE IF NOT EXISTS app_email_outbox (id text PRIMARY KEY, recipient text NOT NULL, subject text NOT NULL, body text NOT NULL, reply_to text, attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz, last_error text, created_at timestamptz NOT NULL DEFAULT now())"),
  database.query("CREATE INDEX IF NOT EXISTS app_email_outbox_pending_idx ON app_email_outbox (sent_at, next_attempt_at)"),
  database.query("CREATE OR REPLACE FUNCTION app_cleanup_expired() RETURNS void LANGUAGE sql AS $$ DELETE FROM app_rate_limit WHERE expires_at < now(); DELETE FROM app_password_reset WHERE expires_at < now(); DELETE FROM app_upload WHERE expires_at < now() AND consumed_at IS NULL; DELETE FROM app_webhook_receipt WHERE created_at < now() - interval '7 days'; DELETE FROM app_email_outbox WHERE sent_at IS NOT NULL AND sent_at < now() - interval '30 days'; $$"),
]);
console.log("Additive authentication and webhook safeguards ready. Existing data was not reset.");
}
main().catch(() => { console.error("Production preparation failed. Check database connectivity and permissions."); process.exitCode = 1; });