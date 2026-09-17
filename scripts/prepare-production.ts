import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import { DEFAULT_PROJECT_TEMPLATES } from "../src/lib/project-templates";
import { DEFAULT_ONBOARDING_FLOW_STEPS } from "../src/lib/onboarding-flow";

config({ path: ".env.local", quiet: true });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const database = neon(process.env.DATABASE_URL);

const DEFAULT_CLIENT_TYPES = [
  { key: "charity", label: "Charity" },
  { key: "ecommerce", label: "Ecommerce" },
  { key: "corporate", label: "Corporate / Brochure" },
  { key: "campaign", label: "Campaign / Marketing" },
];

// Seeds lookup defaults without ever overwriting rows an admin has since edited.
async function seedDefaults() {
  for (const type of DEFAULT_CLIENT_TYPES) {
    await database.query("INSERT INTO client_type (id, key, label) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING", [randomUUID(), type.key, type.label]);
  }
  const clientTypeRows = (await database.query("SELECT id, key FROM client_type WHERE key = ANY($1)", [DEFAULT_CLIENT_TYPES.map((t) => t.key)])) as { id: string; key: string }[];
  const clientTypeIdByKey = Object.fromEntries(clientTypeRows.map((row) => [row.key, row.id]));

  for (const template of DEFAULT_PROJECT_TEMPLATES) {
    const clientTypeId = template.clientTypeKey ? (clientTypeIdByKey[template.clientTypeKey] ?? null) : null;
    await database.query(
      "INSERT INTO project_template (id, name, client_type_id, milestones, deliverables) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb) ON CONFLICT (name) DO NOTHING",
      [randomUUID(), template.name, clientTypeId, JSON.stringify(template.milestones), JSON.stringify(template.deliverables)],
    );
  }

  await database.query(
    "INSERT INTO onboarding_flow (id, name, client_type_id, steps) VALUES ($1, $2, NULL, $3::jsonb) ON CONFLICT (name) DO NOTHING",
    [randomUUID(), "Standard onboarding", JSON.stringify(DEFAULT_ONBOARDING_FLOW_STEPS)],
  );
}

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
  database.query("CREATE TABLE IF NOT EXISTS client_type (id text PRIMARY KEY, key text NOT NULL UNIQUE, label text NOT NULL, archived boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now())"),
  database.query("CREATE TABLE IF NOT EXISTS project_template (id text PRIMARY KEY, name text NOT NULL, client_type_id text REFERENCES client_type(id) ON DELETE SET NULL, milestones jsonb NOT NULL DEFAULT '[]', deliverables jsonb NOT NULL DEFAULT '[]', archived boolean NOT NULL DEFAULT false, created_by_user_id text REFERENCES \"user\"(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())"),
  database.query("CREATE UNIQUE INDEX IF NOT EXISTS project_template_name_idx ON project_template (name)"),
  database.query("CREATE TABLE IF NOT EXISTS onboarding_flow (id text PRIMARY KEY, name text NOT NULL, client_type_id text REFERENCES client_type(id) ON DELETE SET NULL, steps jsonb NOT NULL DEFAULT '[]', archived boolean NOT NULL DEFAULT false, created_by_user_id text REFERENCES \"user\"(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())"),
  database.query("CREATE UNIQUE INDEX IF NOT EXISTS onboarding_flow_name_idx ON onboarding_flow (name)"),
  database.query("CREATE TABLE IF NOT EXISTS project_account_manager_assignment (id text PRIMARY KEY, project_id text NOT NULL REFERENCES project(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES \"user\"(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now())"),
  database.query("CREATE UNIQUE INDEX IF NOT EXISTS project_assignment_unique_idx ON project_account_manager_assignment (project_id, user_id)"),
  database.query("CREATE TABLE IF NOT EXISTS project_deliverable (id text PRIMARY KEY, project_id text NOT NULL REFERENCES project(id) ON DELETE CASCADE, type text NOT NULL, title text NOT NULL, description text, standard boolean NOT NULL DEFAULT true, design_asset_id text REFERENCES design_asset(id) ON DELETE SET NULL, content_item_id text REFERENCES content_item(id) ON DELETE SET NULL, document_id text REFERENCES document(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now())"),
  database.query("CREATE INDEX IF NOT EXISTS project_deliverable_project_idx ON project_deliverable (project_id)"),
  database.query("ALTER TABLE client_account ADD COLUMN IF NOT EXISTS client_type_id text REFERENCES client_type(id) ON DELETE SET NULL"),
  database.query("ALTER TABLE project ADD COLUMN IF NOT EXISTS project_template_id text REFERENCES project_template(id) ON DELETE SET NULL"),
  database.query("ALTER TABLE project_milestone ADD COLUMN IF NOT EXISTS assigned_to_user_id text REFERENCES \"user\"(id) ON DELETE SET NULL"),
  database.query("ALTER TABLE onboarding_submission ADD COLUMN IF NOT EXISTS onboarding_flow_id text REFERENCES onboarding_flow(id) ON DELETE SET NULL"),
  database.query("ALTER TABLE task ADD COLUMN IF NOT EXISTS project_id text REFERENCES project(id) ON DELETE CASCADE"),
  database.query("CREATE INDEX IF NOT EXISTS task_project_idx ON task (project_id)"),
  database.query("ALTER TABLE task ADD COLUMN IF NOT EXISTS parent_task_id text REFERENCES task(id) ON DELETE CASCADE"),
  database.query("ALTER TABLE task ADD COLUMN IF NOT EXISTS recurrence_rule text"),
  database.query("ALTER TABLE task ADD COLUMN IF NOT EXISTS recurrence_next_date timestamptz"),
  database.query("ALTER TABLE task ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '[]'::jsonb"),
  database.query("CREATE INDEX IF NOT EXISTS task_parent_idx ON task (parent_task_id)"),
  database.query("CREATE TABLE IF NOT EXISTS task_dependency (id text PRIMARY KEY, task_id text NOT NULL REFERENCES task(id) ON DELETE CASCADE, depends_on_task_id text NOT NULL REFERENCES task(id) ON DELETE CASCADE, created_by_user_id text REFERENCES \"user\"(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now())"),
  database.query("CREATE UNIQUE INDEX IF NOT EXISTS task_dependency_unique_idx ON task_dependency (task_id, depends_on_task_id)"),
  database.query("CREATE INDEX IF NOT EXISTS task_dependency_task_idx ON task_dependency (task_id)"),
  database.query("CREATE TABLE IF NOT EXISTS task_activity (id text PRIMARY KEY, task_id text NOT NULL REFERENCES task(id) ON DELETE CASCADE, actor_user_id text REFERENCES \"user\"(id) ON DELETE SET NULL, action text NOT NULL, metadata jsonb, created_at timestamptz NOT NULL DEFAULT now())"),
  database.query("CREATE INDEX IF NOT EXISTS task_activity_task_idx ON task_activity (task_id, created_at)"),
  database.query("CREATE TABLE IF NOT EXISTS saved_task_view (id text PRIMARY KEY, user_id text NOT NULL REFERENCES \"user\"(id) ON DELETE CASCADE, name text NOT NULL, filters jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now())"),
  database.query("CREATE UNIQUE INDEX IF NOT EXISTS saved_task_view_user_name_idx ON saved_task_view (user_id, name)"),
  database.query("CREATE TABLE IF NOT EXISTS task_comment (id text PRIMARY KEY, task_id text NOT NULL REFERENCES task(id) ON DELETE CASCADE, author_user_id text REFERENCES \"user\"(id) ON DELETE SET NULL, body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())"),
  database.query("ALTER TABLE task_comment ADD COLUMN IF NOT EXISTS attachment_url text"),
  database.query("ALTER TABLE task_comment ADD COLUMN IF NOT EXISTS attachment_name text"),
  database.query("ALTER TABLE task_comment ADD COLUMN IF NOT EXISTS attachment_content_type text"),
  database.query("ALTER TABLE task_comment ADD COLUMN IF NOT EXISTS attachment_size integer"),
  database.query("CREATE INDEX IF NOT EXISTS task_comment_task_idx ON task_comment (task_id)"),
  database.query("CREATE TABLE IF NOT EXISTS time_entry (id text PRIMARY KEY, user_id text NOT NULL REFERENCES \"user\"(id) ON DELETE CASCADE, client_account_id text NOT NULL REFERENCES client_account(id) ON DELETE CASCADE, project_id text REFERENCES project(id) ON DELETE SET NULL, task_id text REFERENCES task(id) ON DELETE SET NULL, started_at timestamptz NOT NULL, stopped_at timestamptz NOT NULL, duration_seconds integer NOT NULL, note text, created_at timestamptz NOT NULL DEFAULT now())"),
  database.query("CREATE INDEX IF NOT EXISTS time_entry_client_idx ON time_entry (client_account_id)"),
  database.query("CREATE INDEX IF NOT EXISTS time_entry_task_idx ON time_entry (task_id)"),
  database.query("CREATE INDEX IF NOT EXISTS time_entry_user_started_idx ON time_entry (user_id, started_at)"),
  database.query("CREATE TABLE IF NOT EXISTS active_timer (id text PRIMARY KEY, user_id text NOT NULL REFERENCES \"user\"(id) ON DELETE CASCADE, client_account_id text NOT NULL REFERENCES client_account(id) ON DELETE CASCADE, project_id text REFERENCES project(id) ON DELETE SET NULL, task_id text REFERENCES task(id) ON DELETE SET NULL, started_at timestamptz NOT NULL DEFAULT now(), note text)"),
  database.query("CREATE UNIQUE INDEX IF NOT EXISTS active_timer_user_idx ON active_timer (user_id)"),
  database.query("CREATE TABLE IF NOT EXISTS client_time_budget (id text PRIMARY KEY, client_account_id text NOT NULL REFERENCES client_account(id) ON DELETE CASCADE, period_start timestamptz NOT NULL, period_end timestamptz NOT NULL, allocated_seconds integer NOT NULL, created_by_user_id text REFERENCES \"user\"(id) ON DELETE SET NULL, updated_at timestamptz NOT NULL DEFAULT now())"),
  database.query("CREATE UNIQUE INDEX IF NOT EXISTS client_time_budget_period_idx ON client_time_budget (client_account_id, period_start)"),
    database.query("ALTER TABLE ticket_message ADD COLUMN IF NOT EXISTS attachment_url text"),
    database.query("ALTER TABLE ticket_message ADD COLUMN IF NOT EXISTS attachment_name text"),
    database.query("ALTER TABLE ticket_message ADD COLUMN IF NOT EXISTS attachment_content_type text"),
    database.query("ALTER TABLE ticket_message ADD COLUMN IF NOT EXISTS attachment_size integer"),
  database.query("ALTER TABLE onboarding_submission ADD COLUMN IF NOT EXISTS terms_version text"),
  database.query("ALTER TABLE onboarding_submission ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz"),
]);
await seedDefaults();
console.log("Additive authentication and webhook safeguards ready. Existing data was not reset.");
}
main().catch(() => { console.error("Production preparation failed. Check database connectivity and permissions."); process.exitCode = 1; });