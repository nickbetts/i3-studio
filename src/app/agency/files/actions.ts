"use server";

import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";

const uploadSchema = z.object({ clientAccountId: z.string().min(1), title: z.string().trim().min(2), description: z.string().trim().optional() });

export async function uploadDocument(formData: FormData): Promise<void> {
  const actor = await requireAgencyUser();
  const parsed = uploadSchema.safeParse({ clientAccountId: formData.get("clientAccountId"), title: formData.get("title"), description: formData.get("description") || undefined });
  const file = formData.get("file");
  if (!parsed.success || !(file instanceof File) || file.size === 0) return;

  const blob = await put(`clients/${parsed.data.clientAccountId}/documents/${Date.now()}-${file.name}`, file, { access: "public", addRandomSuffix: false });
  const [document] = await db.insert(documents).values({ clientAccountId: parsed.data.clientAccountId, uploadedByUserId: actor.id, title: parsed.data.title, description: parsed.data.description, fileUrl: blob.url, fileName: file.name, contentType: file.type, size: file.size, kind: "document" }).returning({ id: documents.id });
  await auditLog({ actorUserId: actor.id, action: "document.uploaded", entityType: "document", entityId: document.id, clientAccountId: parsed.data.clientAccountId });
  revalidatePath("/agency/files");
  revalidatePath("/portal/approvals");
  revalidatePath("/portal");
}
