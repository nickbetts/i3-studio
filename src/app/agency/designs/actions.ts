"use server";

import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { designAssets } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";

export async function uploadDesign(formData: FormData): Promise<void> {
  const actor = await requireAgencyUser();
  const clientAccountId = String(formData.get("clientAccountId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const file = formData.get("file");
  if (!clientAccountId || !title || !(file instanceof File) || file.size === 0 || !file.type.startsWith("image/")) return;
  const blob = await put(`clients/${clientAccountId}/designs/${Date.now()}-${file.name}`, file, { access: "public", addRandomSuffix: false });
  const [design] = await db.insert(designAssets).values({ clientAccountId, createdByUserId: actor.id, title, imageUrl: blob.url, width: null, height: null, status: "pending" }).returning({ id: designAssets.id });
  await auditLog({ actorUserId: actor.id, action: "design.uploaded", entityType: "design_asset", entityId: design.id, clientAccountId });
  revalidatePath("/agency/designs");
  revalidatePath("/portal/designs");
  revalidatePath("/portal");
}
