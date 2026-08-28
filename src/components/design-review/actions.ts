"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { annotationComments, annotations, designAssets } from "@/db/schema";
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
  await db.update(annotations).set({ resolved: !annotation.resolved }).where(eq(annotations.id, annotationId));
  revalidateBoth();
}
