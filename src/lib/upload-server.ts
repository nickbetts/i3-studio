import { head } from "@vercel/blob";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { validateUpload, type UploadKind } from "./upload-policy";

export async function verifiedUpload(form: FormData, actorId: string, kind: UploadKind, targetId: string) {
  const url = new URL(String(form.get("uploadedUrl") ?? ""));
  const isPrivate = kind === "document" || kind === "reference";
  if (url.protocol !== "https:" || !new RegExp(`^[a-z0-9]+\\.${isPrivate ? "private" : "public"}\\.blob\\.vercel-storage\\.com$`).test(url.hostname)) throw new Error("Invalid storage URL.");
  const pathname = decodeURIComponent(url.pathname.slice(1));
  const result = await db.execute(sql`SELECT * FROM app_upload WHERE pathname = ${pathname} AND actor_id = ${actorId} AND kind = ${kind} AND expires_at > now() AND consumed_at IS NULL`);
  const receipt = result.rows[0];
  if (!receipt || String(["version", "avatar"].includes(kind) ? receipt.target_id : receipt.client_id) !== targetId) throw new Error("Upload does not belong to this account.");
  const blob = await head(url.href, { token: isPrivate ? process.env.BLOB_PRIVATE_READ_WRITE_TOKEN : process.env.BLOB_READ_WRITE_TOKEN });
  validateUpload(kind, blob.size, blob.contentType);
  if (blob.pathname !== pathname) throw new Error("Upload path mismatch.");
  return { ...blob, fileName: String(receipt.file_name) };
}

export async function consumeUpload(pathname: string) {
  const result = await db.execute(sql`UPDATE app_upload SET consumed_at = now() WHERE pathname = ${pathname} AND consumed_at IS NULL RETURNING pathname`);
  if (!result.rows.length) throw new Error("Upload already registered.");
}

export async function registerFile(blob: Awaited<ReturnType<typeof verifiedUpload>>, actorId: string, clientId: string, kind: "document" | "reference", title: string, description?: string) {
  const id = crypto.randomUUID();
  const table = sql.identifier(kind === "document" ? "document" : "reference_file");
  const extraColumns = kind === "document" ? sql`, description, kind, status` : sql``;
  const extraValues = kind === "document" ? sql`, ${description ?? null}, 'document'::document_kind, 'pending'::approval_status` : sql``;
  const result = await db.execute(sql`
    WITH claimed AS (UPDATE app_upload SET consumed_at = now() WHERE pathname = ${blob.pathname} AND actor_id = ${actorId} AND consumed_at IS NULL RETURNING pathname),
    saved AS (
      INSERT INTO ${table} (id, client_account_id, uploaded_by_user_id, title, file_url, file_name, content_type, size ${extraColumns})
      SELECT ${id}, ${clientId}, ${actorId}, ${title}, ${blob.url}, ${blob.fileName}, ${blob.contentType}, ${blob.size} ${extraValues} FROM claimed RETURNING id
    ), audit AS (
      INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id, client_account_id)
      SELECT ${crypto.randomUUID()}, ${actorId}, ${`${kind}.uploaded`}, ${kind === "document" ? "document" : "reference_file"}, id, ${clientId} FROM saved
    ) SELECT id FROM saved
  `);
  if (!result.rows.length) throw new Error("This upload has already been saved.");
  return id;
}