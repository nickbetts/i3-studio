"use server";

import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";

const uploadSchema = z.object({ clientAccountId: z.string().min(1), title: z.string().trim().min(2), description: z.string().trim().optional() });

export type UploadState = { error?: string; success?: string };

const MAX_BYTES = 25 * 1024 * 1024;

export async function uploadDocument(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const actor = await requireAgencyUser();
  const parsed = uploadSchema.safeParse({ clientAccountId: formData.get("clientAccountId"), title: formData.get("title"), description: formData.get("description") || undefined });
  const file = formData.get("file");
  if (!parsed.success) return { error: "Choose a client and enter a title (at least 2 characters)." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > MAX_BYTES) return { error: "That file is over the 25MB limit." };

  try {
    const blob = await put(`clients/${parsed.data.clientAccountId}/documents/${Date.now()}-${file.name}`, file, { access: "public", addRandomSuffix: false });
    const [document] = await db.insert(documents).values({ clientAccountId: parsed.data.clientAccountId, uploadedByUserId: actor.id, title: parsed.data.title, description: parsed.data.description, fileUrl: blob.url, fileName: file.name, contentType: file.type, size: file.size, kind: "document" }).returning({ id: documents.id });
    await auditLog({ actorUserId: actor.id, action: "document.uploaded", entityType: "document", entityId: document.id, clientAccountId: parsed.data.clientAccountId });
    revalidatePath("/agency/files");
    revalidatePath("/portal/approvals");
    revalidatePath("/portal");
    return { success: `Uploaded “${parsed.data.title}”.` };
  } catch (error) {
    console.error("uploadDocument failed", error);
    return { error: "Upload failed. Please try again." };
  }
}
