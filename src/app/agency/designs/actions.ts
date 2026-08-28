"use server";

import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { designAssets } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";

export type UploadState = { error?: string; success?: string };

const MAX_BYTES = 25 * 1024 * 1024;

export async function uploadDesign(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const actor = await requireAgencyUser();
  const clientAccountId = String(formData.get("clientAccountId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const file = formData.get("file");
  if (!clientAccountId) return { error: "Choose a client." };
  if (title.length < 2) return { error: "Enter a title (at least 2 characters)." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image to upload." };
  if (!file.type.startsWith("image/")) return { error: "Only image files are supported." };
  if (file.size > MAX_BYTES) return { error: "That image is over the 25MB limit." };

  try {
    const blob = await put(`clients/${clientAccountId}/designs/${Date.now()}-${file.name}`, file, { access: "public", addRandomSuffix: false });
    const [design] = await db.insert(designAssets).values({ clientAccountId, createdByUserId: actor.id, title, imageUrl: blob.url, width: null, height: null, status: "pending" }).returning({ id: designAssets.id });
    await auditLog({ actorUserId: actor.id, action: "design.uploaded", entityType: "design_asset", entityId: design.id, clientAccountId });
    revalidatePath("/agency/designs");
    revalidatePath("/portal/designs");
    revalidatePath("/portal");
    return { success: `Uploaded “${title}”.` };
  } catch (error) {
    console.error("uploadDesign failed", error);
    return { error: "Upload failed. Please try again." };
  }
}
