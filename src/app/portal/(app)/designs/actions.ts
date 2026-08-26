"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { annotationComments, annotations, designAssets } from "@/db/schema";
import { requireClientUser } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";

export async function createAnnotation(designAssetId: string, x: number, y: number, body: string): Promise<void> {
  const user = await requireClientUser();
  const design = await db.query.designAssets.findFirst({ where: and(eq(designAssets.id, designAssetId), eq(designAssets.clientAccountId, user.clientAccountId)) });
  if (!design || x < 0 || x > 1 || y < 0 || y > 1 || !body.trim()) return;
  const [annotation] = await db.insert(annotations).values({ designAssetId, x, y, createdByUserId: user.id }).returning({ id: annotations.id });
  await db.insert(annotationComments).values({ annotationId: annotation.id, authorUserId: user.id, body: body.trim() });
  await auditLog({ actorUserId: user.id, action: "design.annotation_created", entityType: "annotation", entityId: annotation.id, clientAccountId: user.clientAccountId });
  revalidatePath("/portal/designs");
}

export async function addAnnotationComment(annotationId: string, body: string): Promise<void> {
  const user = await requireClientUser();
  const annotation = await db.query.annotations.findFirst({ where: eq(annotations.id, annotationId), with: { designAsset: true } });
  if (!annotation || annotation.designAsset.clientAccountId !== user.clientAccountId || !body.trim()) return;
  await db.insert(annotationComments).values({ annotationId, authorUserId: user.id, body: body.trim() });
  await auditLog({ actorUserId: user.id, action: "design.comment_created", entityType: "annotation", entityId: annotationId, clientAccountId: user.clientAccountId });
  revalidatePath("/portal/designs");
}

export async function resolveAnnotation(annotationId: string): Promise<void> {
  const user = await requireClientUser();
  const annotation = await db.query.annotations.findFirst({ where: eq(annotations.id, annotationId), with: { designAsset: true } });
  if (!annotation || annotation.designAsset.clientAccountId !== user.clientAccountId) return;
  await db.update(annotations).set({ resolved: !annotation.resolved }).where(eq(annotations.id, annotationId));
  revalidatePath("/portal/designs");
}
