"use server";

import { put } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { referenceFiles } from "@/db/schema";
import { getCurrentUser, isAgencyRole } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";

export type UploadState = { error?: string; success?: string };

const MAX_BYTES = 25 * 1024 * 1024;

export async function uploadReference(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You are not signed in." };
  const title = String(formData.get("title") ?? "").trim();
  const file = formData.get("file");
  const clientAccountId = isAgencyRole(user.role) ? String(formData.get("clientAccountId") ?? "") : user.clientAccountId ?? "";
  if (!clientAccountId) return { error: "Missing client." };
  if (title.length < 2) return { error: "Enter a title (at least 2 characters)." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > MAX_BYTES) return { error: "That file is over the 25MB limit." };

  try {
    const blob = await put(`clients/${clientAccountId}/references/${Date.now()}-${file.name}`, file, { access: "public", addRandomSuffix: false });
    const [row] = await db
      .insert(referenceFiles)
      .values({ clientAccountId, uploadedByUserId: user.id, title, fileUrl: blob.url, fileName: file.name, contentType: file.type, size: file.size })
      .returning({ id: referenceFiles.id });
    await auditLog({ actorUserId: user.id, action: "reference.uploaded", entityType: "reference_file", entityId: row.id, clientAccountId });
    revalidatePath("/portal/files");
    revalidatePath(`/agency/clients/${clientAccountId}`);
    return { success: `Uploaded “${title}”.` };
  } catch (error) {
    console.error("uploadReference failed", error);
    return { error: "Upload failed. Please try again." };
  }
}

export async function deleteReference(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const id = String(formData.get("id") ?? "");
  const row = await db.query.referenceFiles.findFirst({ where: eq(referenceFiles.id, id) });
  if (!row) return;
  if (!isAgencyRole(user.role) && row.clientAccountId !== user.clientAccountId) return;
  await db.delete(referenceFiles).where(eq(referenceFiles.id, id));
  await auditLog({ actorUserId: user.id, action: "reference.deleted", entityType: "reference_file", entityId: id, clientAccountId: row.clientAccountId });
  revalidatePath("/portal/files");
  revalidatePath(`/agency/clients/${row.clientAccountId}`);
}
