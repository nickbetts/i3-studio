"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { registerFile, verifiedUpload } from "@/lib/upload-server";

const uploadSchema = z.object({ clientAccountId: z.string().min(1), title: z.string().trim().min(2), description: z.string().trim().optional() });

export type UploadState = { error?: string; success?: string };

export async function uploadDocument(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const actor = await requireAgencyUser();
  const parsed = uploadSchema.safeParse({ clientAccountId: formData.get("clientAccountId"), title: formData.get("title"), description: formData.get("description") || undefined });
  if (!parsed.success) return { error: "Choose a client and enter a title (at least 2 characters)." };

  try {
    const blob = await verifiedUpload(formData, actor.id, "document", parsed.data.clientAccountId);
    await registerFile(blob, actor.id, parsed.data.clientAccountId, "document", parsed.data.title, parsed.data.description);
    revalidatePath(`/agency/clients/${parsed.data.clientAccountId}`);
    revalidatePath("/agency/files");
    revalidatePath("/portal/approvals");
    revalidatePath("/portal");
    return { success: `Uploaded “${parsed.data.title}”.` };
  } catch {
    console.error(JSON.stringify({ event: "document_upload_failed" }));
    return { error: "Upload failed. Please try again." };
  }
}
