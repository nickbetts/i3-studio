"use server";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { annotationComments, annotations, designAssets, designVersions, users } from "@/db/schema";
import { getCurrentUser, isAgencyRole } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/permissions";
import { auditLog } from "@/lib/audit";
import { notifyMentions } from "@/lib/notifications";
import { verifiedUpload } from "@/lib/upload-server";

// Both agency staff and the owning client can pin, reply and resolve — access is
// checked per design asset rather than gated to a single role.
async function assertAccess(clientAccountId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (isAgencyRole(user.role)) return user;
  if (user.role === "client" && user.clientAccountId === clientAccountId) return user;
  return null;
}

async function notifyDesignMentions(text: string, clientAccountId: string, actorId: string, actorName: string) {
  const [staff, clientUsers] = await Promise.all([
    db.query.users.findMany({ where: inArray(users.role, ["admin", "account_manager", "content_writer"]), columns: { id: true, name: true, email: true, role: true } }),
    db.query.users.findMany({ where: and(eq(users.clientAccountId, clientAccountId), eq(users.role, "client")), columns: { id: true, name: true, email: true, role: true } }),
  ]);
  await notifyMentions({
    text,
    candidates: [...staff, ...clientUsers].map((person) => ({ id: person.id, name: person.name || person.email, role: person.role })),
    actorUserId: actorId,
    actorName,
    excerpt: text,
    linkUrlForRole: (role) => (role === "client" ? "/portal/approvals" : "/agency/designs"),
  });
}

function revalidateBoth() {
  revalidatePath("/agency/designs");
  revalidatePath("/portal/approvals");
}

async function requireLatest(designId: string, version: number) {
  const latest = await db.query.designVersions.findFirst({ where: eq(designVersions.designAssetId, designId), orderBy: desc(designVersions.version) });
  if (version !== (latest?.version ?? 1)) throw new Error("This revision is read-only. Reload the latest version.");
}

export async function createAnnotation(designAssetId: string, x: number, y: number, body: string, version: number): Promise<void> {
  const design = await db.query.designAssets.findFirst({ where: eq(designAssets.id, designAssetId) });
  if (!design) return;
  const user = await assertAccess(design.clientAccountId);
  if (!user || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1 || !body.trim() || body.length > 10000) throw new Error("Invalid annotation.");
  await requireLatest(designAssetId, version);
  const [annotation] = await db.insert(annotations).values({ designAssetId, version, x, y, createdByUserId: user.id }).returning({ id: annotations.id });
  await db.insert(annotationComments).values({ annotationId: annotation.id, authorUserId: user.id, body: body.trim() });
  await auditLog({ actorUserId: user.id, action: "design.annotation_created", entityType: "annotation", entityId: annotation.id, clientAccountId: design.clientAccountId });
  await notifyDesignMentions(body.trim(), design.clientAccountId, user.id, user.name || user.email);
  revalidateBoth();
}

export async function addAnnotationComment(annotationId: string, body: string): Promise<void> {
  const annotation = await db.query.annotations.findFirst({ where: eq(annotations.id, annotationId), with: { designAsset: true } });
  if (!annotation || !body.trim()) return;
  const user = await assertAccess(annotation.designAsset.clientAccountId);
  if (!user) return;
  await requireLatest(annotation.designAssetId, annotation.version);
  await db.insert(annotationComments).values({ annotationId, authorUserId: user.id, body: body.trim() });
  await auditLog({ actorUserId: user.id, action: "design.comment_created", entityType: "annotation", entityId: annotationId, clientAccountId: annotation.designAsset.clientAccountId });
  await notifyDesignMentions(body.trim(), annotation.designAsset.clientAccountId, user.id, user.name || user.email);
  revalidateBoth();
}

export async function resolveAnnotation(annotationId: string): Promise<void> {
  const annotation = await db.query.annotations.findFirst({ where: eq(annotations.id, annotationId), with: { designAsset: true } });
  if (!annotation) return;
  const user = await assertAccess(annotation.designAsset.clientAccountId);
  if (!user) return;
  const next = !annotation.resolved;
  await requireLatest(annotation.designAssetId, annotation.version);
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

export type UploadVersionState = { error?: string; success?: string };

// Uploading a new version re-opens the design for review and keeps every prior image accessible.
export async function uploadDesignVersion(_prev: UploadVersionState, formData: FormData): Promise<UploadVersionState> {
  const actor = await getCurrentUser();
  if (!actor || !isAgencyRole(actor.role) || !(await hasPermission(actor, "upload_design_versions"))) return { error: "You don't have permission to upload new versions." };
  const designAssetId = String(formData.get("designAssetId") ?? "");
  const design = await db.query.designAssets.findFirst({ where: eq(designAssets.id, designAssetId), with: { versions: true } });
  if (!design) return { error: "Design not found." };

  try {
    const version = design.versions.length ? Math.max(...design.versions.map((v) => v.version)) + 1 : 2;
    const blob = await verifiedUpload(formData, actor.id, "version", designAssetId);
    const result = await db.execute(sql`
      WITH moved AS (UPDATE design_asset SET image_url = ${blob.url}, status = 'pending' WHERE id = ${designAssetId} AND image_url = ${design.imageUrl} AND EXISTS (SELECT 1 FROM app_upload WHERE pathname = ${blob.pathname} AND consumed_at IS NULL) RETURNING id),
      original AS (INSERT INTO design_version (id, design_asset_id, version, image_url, status, created_at) SELECT ${crypto.randomUUID()}, id, 1, ${design.imageUrl}, ${design.status}::approval_status, ${design.createdAt.toISOString()}::timestamp FROM moved WHERE ${design.versions.length === 0}),
      saved AS (INSERT INTO design_version (id, design_asset_id, version, image_url) SELECT ${crypto.randomUUID()}, id, ${version}, ${blob.url} FROM moved),
      claimed AS (UPDATE app_upload SET consumed_at = now() WHERE pathname = ${blob.pathname} AND EXISTS (SELECT 1 FROM moved)),
      audit AS (INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id, client_account_id, metadata) SELECT ${crypto.randomUUID()}, ${actor.id}, 'design.version_uploaded', 'design_asset', id, ${design.clientAccountId}, ${JSON.stringify({ version })}::jsonb FROM moved)
      SELECT id FROM moved
    `);
    if (!result.rows.length) return { error: "A new revision was uploaded meanwhile. Reload and retry." };
    revalidateBoth();
    return { success: `Version ${version} uploaded.` };
  } catch (error) {
    console.error("uploadDesignVersion failed", error);
    return { error: "Upload failed. Please try again." };
  }
}
