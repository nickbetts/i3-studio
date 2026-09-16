"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { referenceFiles } from "@/db/schema";
import { getCurrentUser, isAgencyRole } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";
import { registerFile, verifiedUpload } from "@/lib/upload-server";

export type UploadState = { error?: string; success?: string };

export async function uploadReference(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You are not signed in." };
  const title = String(formData.get("title") ?? "").trim();
  const clientAccountId = isAgencyRole(user.role) ? String(formData.get("clientAccountId") ?? "") : user.clientAccountId ?? "";
  if (!clientAccountId) return { error: "Missing client." };
  if (title.length < 2) return { error: "Enter a title (at least 2 characters)." };

  try {
    const blob = await verifiedUpload(formData, user.id, "reference", clientAccountId);
    await registerFile(blob, user.id, clientAccountId, "reference", title);
    revalidatePath("/portal/files");
    revalidatePath(`/agency/clients/${clientAccountId}`);
    return { success: `Uploaded “${title}”.` };
  } catch {
    console.error(JSON.stringify({ event: "reference_upload_failed" }));
    return { error: "Upload failed. Please try again." };
  }
}

export async function deleteReference(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const id = String(formData.get("id") ?? "");
  const row = await db.query.referenceFiles.findFirst({ where: eq(referenceFiles.id, id) });
  if (!row) return;
  if (!isAgencyRole(user.role) && (row.clientAccountId !== user.clientAccountId || row.uploadedByUserId !== user.id)) return;
  await db.delete(referenceFiles).where(eq(referenceFiles.id, id));
  await auditLog({ actorUserId: user.id, action: "reference.deleted", entityType: "reference_file", entityId: id, clientAccountId: row.clientAccountId });
  revalidatePath("/portal/files");
  revalidatePath(`/agency/clients/${row.clientAccountId}`);
}
