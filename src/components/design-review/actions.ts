"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { db } from "@/db";
import { annotationComments, annotations, designAssets, designVersions } from "@/db/schema";
import { getCurrentUser, isAgencyRole } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";

// Both agency staff and the owning client can pin, reply and resolve — access is
// checked per design asset rather than gated to a single role.
async function assertAccess(clientAccountId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (isAgencyRole(user.role)) return user;
  if (user.role === "client" && user.clientAccountId === clientAccountId) return user;
  return null;
}

function revalidateBoth() {
  revalidatePath("/agency/designs");
  revalidatePath("/portal/approvals");
}

export async function createAnnotation(designAssetId: string, x: number, y: number, body: string): Promise<void> {
  const design = await db.query.designAssets.findFirst({ where: eq(designAssets.id, designAssetId) });
  if (!design) return;
  const user = await assertAccess(design.clientAccountId);
  if (!user || x < 0 || x > 1 || y < 0 || y > 1 || !body.trim()) return;
  const [annotation] = await db.insert(annotations).values({ designAssetId, x, y, createdByUserId: user.id }).returning({ id: annotations.id });
  await db.insert(annotationComments).values({ annotationId: annotation.id, authorUserId: user.id, body: body.trim() });
  await auditLog({ actorUserId: user.id, action: "design.annotation_created", entityType: "annotation", entityId: annotation.id, clientAccountId: design.clientAccountId });
  revalidateBoth();
}

export async function addAnnotationComment(annotationId: string, body: string): Promise<void> {
  const annotation = await db.query.annotations.findFirst({ where: eq(annotations.id, annotationId), with: { designAsset: true } });
  if (!annotation || !body.trim()) return;
  const user = await assertAccess(annotation.designAsset.clientAccountId);
  if (!user) return;
  await db.insert(annotationComments).values({ annotationId, authorUserId: user.id, body: body.trim() });
  await auditLog({ actorUserId: user.id, action: "design.comment_created", entityType: "annotation", entityId: annotationId, clientAccountId: annotation.designAsset.clientAccountId });
  revalidateBoth();
}

export async function resolveAnnotation(annotationId: string): Promise<void> {
  const annotation = await db.query.annotations.findFirst({ where: eq(annotations.id, annotationId), with: { designAsset: true } });
  if (!annotation) return;
  const user = await assertAccess(annotation.designAsset.clientAccountId);
  if (!user) return;
  const next = !annotation.resolved;
  await db.update(annotations).set({ resolved: next }).where(eq(annotations.id, annotationId));
  await auditLog({ actorUserId: user.id, action: next ? "design.annotation_resolved" : "design.annotation_reopened", entityType: "annotation", entityId: annotationId, clientAccountId: annotation.designAsset.clientAccountId });
  revalidateBoth();
}

// Admins can remove a comment outright — every deletion is still logged.
export async function deleteAnnotationComment(commentId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return;
  const comment = await db.query.annotationComments.findFirst({ where: eq(annotationComments.id, commentId), with: { annotation: { with: { designAsset: true } } } });
  if (!comment) return;
  await db.delete(annotationComments).where(eq(annotationComments.id, commentId));
  await auditLog({ actorUserId: user.id, action: "design.comment_deleted", entityType: "annotation", entityId: comment.annotationId, clientAccountId: comment.annotation.designAsset.clientAccountId, metadata: { deletedBody: comment.body, deletedAuthorId: comment.authorUserId } });
  revalidateBoth();
}

const MAX_BYTES = 25 * 1024 * 1024;
export type UploadVersionState = { error?: string; success?: string };

// Uploading a new version re-opens the design for review and keeps every prior image accessible.
export async function uploadDesignVersion(_prev: UploadVersionState, formData: FormData): Promise<UploadVersionState> {
  const actor = await getCurrentUser();
  if (!actor || !isAgencyRole(actor.role)) return { error: "Only the agency team can upload new versions." };
  const designAssetId = String(formData.get("designAssetId") ?? "");
  const file = formData.get("file");
  const design = await db.query.designAssets.findFirst({ where: eq(designAssets.id, designAssetId), with: { versions: true } });
  if (!design) return { error: "Design not found." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image to upload." };
  if (!file.type.startsWith("image/")) return { error: "Only image files are supported." };
  if (file.size > MAX_BYTES) return { error: "That image is over the 25MB limit." };

  try {
    const version = design.versions.length ? Math.max(...design.versions.map((v) => v.version)) + 1 : 2;
    const blob = await put(`clients/${design.clientAccountId}/designs/${designAssetId}/v${version}-${Date.now()}-${file.name}`, file, { access: "public", addRandomSuffix: false });
    if (design.versions.length === 0) {
      // Backfill version 1 from the design's original image so history starts complete.
      await db.insert(designVersions).values({ designAssetId, version: 1, imageUrl: design.imageUrl, status: design.status, createdAt: design.createdAt });
    }
    await db.insert(designVersions).values({ designAssetId, version, imageUrl: blob.url, status: "pending" });
    await db.update(designAssets).set({ imageUrl: blob.url, status: "pending" }).where(eq(designAssets.id, designAssetId));
    await auditLog({ actorUserId: actor.id, action: "design.version_uploaded", entityType: "design_asset", entityId: designAssetId, clientAccountId: design.clientAccountId, metadata: { version } });
    revalidateBoth();
    return { success: `Version ${version} uploaded.` };
  } catch (error) {
    console.error("uploadDesignVersion failed", error);
    return { error: "Upload failed. Please try again." };
  }
}
