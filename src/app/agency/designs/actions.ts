"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireAgencyPermission } from "@/lib/permissions";
import { verifiedUpload } from "@/lib/upload-server";

export type UploadState = { error?: string; success?: string };

export async function uploadDesign(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const actor = await requireAgencyPermission("manage_designs");
  const clientAccountId = String(formData.get("clientAccountId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!clientAccountId) return { error: "Choose a client." };
  if (title.length < 2) return { error: "Enter a title (at least 2 characters)." };

  try {
    const blob = await verifiedUpload(formData, actor.id, "design", clientAccountId);
    const result = await db.execute(sql`
      WITH claimed AS (UPDATE app_upload SET consumed_at = now() WHERE pathname = ${blob.pathname} AND consumed_at IS NULL RETURNING pathname),
      saved AS (INSERT INTO design_asset (id, client_account_id, created_by_user_id, title, image_url) SELECT ${crypto.randomUUID()}, ${clientAccountId}, ${actor.id}, ${title}, ${blob.url} FROM claimed RETURNING id),
      version AS (INSERT INTO design_version (id, design_asset_id, version, image_url) SELECT ${crypto.randomUUID()}, id, 1, ${blob.url} FROM saved),
      audit AS (INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id, client_account_id) SELECT ${crypto.randomUUID()}, ${actor.id}, 'design.uploaded', 'design_asset', id, ${clientAccountId} FROM saved)
      SELECT id FROM saved
    `);
    if (!result.rows.length) return { error: "Upload already saved." };
    revalidatePath("/agency/designs");
    revalidatePath("/portal/approvals");
    revalidatePath("/portal");
    return { success: `Uploaded “${title}”.` };
  } catch {
    console.error(JSON.stringify({ event: "design_upload_failed" }));
    return { error: "Upload failed. Please try again." };
  }
}
