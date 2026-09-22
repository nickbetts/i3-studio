"use server";

import { desc, eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { contentComments, contentEvents, contentItems, contentTemplates, contentVersions, users } from "@/db/schema";
import { getCurrentUser, isAgencyRole, requireClientUser } from "@/lib/auth-helpers";
import { hasPermission, requireAgencyPermission } from "@/lib/permissions";
import { auditLog } from "@/lib/audit";
import { notifyMentions } from "@/lib/notifications";
import { DEFAULT_TEMPLATE_FIELDS, type ContentField, type ContentStatus } from "@/lib/content";
import { safeContentData } from "@/lib/safe-html";
import { canEditContent, canReadContent, canReviewContent } from "@/lib/content-policy";

type Actor = { id: string; role: string };

function revalidateItem(id: string) {
  revalidatePath("/agency/content");
  revalidatePath(`/agency/content/${id}`);
  revalidatePath("/portal/content");
  revalidatePath(`/portal/content/${id}`);
  revalidatePath("/portal/approvals");
}

async function logEvent(itemId: string, actor: Actor, type: string, fromStatus: ContentStatus | null, toStatus: ContentStatus | null, note?: string, clientAccountId?: string) {
  await db.insert(contentEvents).values({ contentItemId: itemId, actorUserId: actor.id, actorRole: actor.role, type, fromStatus, toStatus, note: note ?? null });
  await auditLog({ actorUserId: actor.id, action: `content.${type}`, entityType: "content_item", entityId: itemId, clientAccountId: clientAccountId ?? null, metadata: { fromStatus, toStatus, note } });
}

async function transition(item: typeof contentItems.$inferSelect, actor: Actor, nextStatus: ContentStatus, event: string, note: string, data?: Record<string, unknown>) {
  const isSnapshot = data !== undefined;
  const result = await db.execute(sql`
    WITH moved AS (
      UPDATE content_item SET status = ${nextStatus}::content_status,
        data = ${JSON.stringify(data ?? item.data)}::jsonb,
        current_version = current_version + ${isSnapshot ? 1 : 0}, updated_at = ${new Date().toISOString()}::timestamp
      WHERE id = ${item.id} AND status = ${item.status}::content_status AND current_version = ${item.currentVersion}
        AND date_trunc('milliseconds', updated_at) = ${item.updatedAt.toISOString()}::timestamp
      RETURNING *
    ), snapshot AS (
      INSERT INTO content_version (id, content_item_id, version, data, author_user_id, note)
      SELECT ${crypto.randomUUID()}, id, current_version, data, ${actor.id}, ${note} FROM moved WHERE ${isSnapshot}
    ), event AS (
      INSERT INTO content_event (id, content_item_id, actor_user_id, actor_role, type, from_status, to_status, note)
      SELECT ${crypto.randomUUID()}, id, ${actor.id}, ${actor.role}, ${event}, ${item.status}, ${nextStatus}, ${note} FROM moved
    ), audit AS (
      INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id, client_account_id, metadata)
      SELECT ${crypto.randomUUID()}, ${actor.id}, ${`content.${event}`}, 'content_item', id, client_account_id,
        jsonb_build_object('fromStatus', ${item.status}::text, 'toStatus', ${nextStatus}::text, 'version', current_version, 'note', ${note}::text) FROM moved
    ) SELECT id FROM moved
  `);
  if (!result.rows.length) throw new Error("This item changed. Reload before continuing.");
  revalidateItem(item.id);
}

// ----- Templates -----------------------------------------------------------
export async function createTemplate(formData: FormData): Promise<void> {
  const actor = await requireAgencyPermission("edit_content_templates");
  const name = String(formData.get("name") ?? "").trim();
  const contentType = String(formData.get("contentType") ?? "blog");
  if (name.length < 2) return;
  const fields = DEFAULT_TEMPLATE_FIELDS[contentType] ?? DEFAULT_TEMPLATE_FIELDS.blog;
  const [row] = await db.insert(contentTemplates).values({ name, contentType, fields, createdByUserId: actor.id }).returning({ id: contentTemplates.id });
  await auditLog({ actorUserId: actor.id, action: "content.template_created", entityType: "content_template", entityId: row.id, metadata: { name, contentType } });
  revalidatePath("/agency/content/templates");
}

export async function saveTemplateFields(templateId: string, name: string, fields: ContentField[]): Promise<void> {
  const actor = await requireAgencyPermission("edit_content_templates");
  if (!templateId || name.trim().length < 2) return;
  await db.update(contentTemplates).set({ name: name.trim(), fields, updatedAt: new Date() }).where(eq(contentTemplates.id, templateId));
  await auditLog({ actorUserId: actor.id, action: "content.template_updated", entityType: "content_template", entityId: templateId, metadata: { fieldCount: fields.length } });
  revalidatePath("/agency/content/templates");
}

export async function archiveTemplate(formData: FormData): Promise<void> {
  const actor = await requireAgencyPermission("edit_content_templates");
  const templateId = String(formData.get("templateId") ?? "");
  if (!templateId) return;
  await db.update(contentTemplates).set({ archived: true }).where(eq(contentTemplates.id, templateId));
  await auditLog({ actorUserId: actor.id, action: "content.template_archived", entityType: "content_template", entityId: templateId });
  revalidatePath("/agency/content/templates");
}

// ----- Content items -------------------------------------------------------
export async function createContentItem(formData: FormData): Promise<void> {
  const actor = await requireAgencyPermission("edit_content");
  const clientAccountId = String(formData.get("clientAccountId") ?? "");
  const templateId = String(formData.get("templateId") ?? "") || null;
  const title = String(formData.get("title") ?? "").trim();
  const assignedToUserId = String(formData.get("assignedToUserId") ?? "") || actor.id;
  if (!clientAccountId || title.length < 2) return;
  let contentType = "blog";
  if (templateId) {
    const template = await db.query.contentTemplates.findFirst({ where: eq(contentTemplates.id, templateId) });
    if (template) contentType = template.contentType;
  }
  const [row] = await db
    .insert(contentItems)
    .values({ clientAccountId, templateId, title, contentType, status: "draft", assignedToUserId, createdByUserId: actor.id, data: {} })
    .returning({ id: contentItems.id });
  await logEvent(row.id, actor, "created", null, "draft", undefined, clientAccountId);
  revalidatePath("/agency/content");
}

export async function saveDraft(itemId: string, data: Record<string, unknown>): Promise<void> {
  const actor = await requireAgencyPermission("edit_content");
  const item = await db.query.contentItems.findFirst({ where: eq(contentItems.id, itemId) });
  if (!item || !canEditContent(actor, item)) throw new Error("This content cannot be edited.");
  await transition(item, actor, item.status, "draft_saved", "Draft saved", safeContentData(data));
}

export async function submitForReview(itemId: string, data: Record<string, unknown>): Promise<void> {
  const actor = await requireAgencyPermission("edit_content");
  const item = await db.query.contentItems.findFirst({ where: eq(contentItems.id, itemId) });
  if (!item || !canEditContent(actor, item)) throw new Error("This content cannot be submitted.");
  const cleaned = safeContentData(data);
  const template = item.templateId ? await db.query.contentTemplates.findFirst({ where: eq(contentTemplates.id, item.templateId) }) : null;
  const fields = (template?.fields ?? []) as ContentField[];
  if (fields.some((field) => field.required && !String(cleaned[field.key] ?? "").replace(/<[^>]*>/g, "").trim())) throw new Error("Complete all required fields.");
  await transition(item, actor, "pending_am", "submitted", "Submitted for review", cleaned);
}

export async function amDecision(itemId: string, decision: "approve" | "changes", note: string): Promise<void> {
  const actor = await getCurrentUser();
  if (!actor) throw new Error("Sign in to continue.");
  const item = await db.query.contentItems.findFirst({ where: eq(contentItems.id, itemId) });
  const latest = await db.query.contentVersions.findFirst({ where: eq(contentVersions.contentItemId, itemId), orderBy: desc(contentVersions.version) });
  if (!item || !canReviewContent(actor, item, latest?.authorUserId ?? item.createdByUserId)) throw new Error("A different manager must review this submission.");
  if (!["approve", "changes"].includes(decision) || (decision === "changes" && !note.trim())) throw new Error("Provide a valid decision and reason.");
  await transition(item, actor, decision === "approve" ? "pending_client" : "am_changes", decision === "approve" ? "am_approved" : "am_changes", note.slice(0, 10000));
}

export async function clientDecision(itemId: string, decision: "approve" | "changes", note: string): Promise<void> {
  const actor = await requireClientUser();
  const item = await db.query.contentItems.findFirst({ where: eq(contentItems.id, itemId) });
  if (!item || !canReadContent(actor, item) || item.status !== "pending_client") throw new Error("This item is not awaiting your approval.");
  if (!["approve", "changes"].includes(decision) || (decision === "changes" && !note.trim())) throw new Error("Provide a valid decision and reason.");
  await transition(item, actor, decision === "approve" ? "approved" : "client_changes", decision === "approve" ? "client_approved" : "client_changes", note.slice(0, 10000));
}

export async function publishContent(itemId: string): Promise<void> {
  const actor = await getCurrentUser();
  if (!actor || !(await hasPermission(actor, "publish_content"))) return;
  const item = await db.query.contentItems.findFirst({ where: eq(contentItems.id, itemId) });
  if (!item || item.status !== "approved") return;
  await transition(item, actor, "published", "published", "Marked as published");
}

// ----- Comments (redlines) -------------------------------------------------
export type AddCommentInput = { fieldKey?: string | null; quote?: string | null; body: string; parentId?: string | null };

export async function addContentComment(itemId: string, input: AddCommentInput): Promise<void> {
  const actor = await getCurrentUser();
  if (!actor) return;
  const item = await db.query.contentItems.findFirst({ where: eq(contentItems.id, itemId) });
  if (!item) return;
  if (!isAgencyRole(actor.role) && item.clientAccountId !== actor.clientAccountId) return;
  if (input.body.trim().length === 0) return;
  const trimmed = input.body.trim();
  await db.insert(contentComments).values({ contentItemId: itemId, fieldKey: input.fieldKey || null, quote: input.quote?.trim() || null, body: trimmed, authorUserId: actor.id, parentId: input.parentId || null });
  await auditLog({ actorUserId: actor.id, action: "content.comment", entityType: "content_item", entityId: itemId, clientAccountId: item.clientAccountId, metadata: { fieldKey: input.fieldKey, hasQuote: Boolean(input.quote) } });
  const [staff, clientUsers] = await Promise.all([
    db.query.users.findMany({ where: (row, { inArray: inA }) => inA(row.role, ["admin", "account_manager", "content_writer"]), columns: { id: true, name: true, email: true, role: true } }),
    db.query.users.findMany({ where: and(eq(users.clientAccountId, item.clientAccountId), eq(users.role, "client")), columns: { id: true, name: true, email: true, role: true } }),
  ]);
  await notifyMentions({
    text: trimmed,
    candidates: [...staff, ...clientUsers].map((person) => ({ id: person.id, name: person.name || person.email, role: person.role })),
    actorUserId: actor.id,
    actorName: actor.name || actor.email,
    excerpt: `"${item.title}": ${trimmed}`,
    linkUrlForRole: (role) => (role === "client" ? "/portal/content" : `/agency/content/${itemId}`),
  });
  revalidateItem(itemId);
}

export async function resolveContentComment(formData: FormData): Promise<void> {
  const actor = await getCurrentUser();
  if (!actor) return;
  const commentId = String(formData.get("commentId") ?? "");
  const comment = await db.query.contentComments.findFirst({ where: eq(contentComments.id, commentId) });
  if (!comment) return;
  const item = await db.query.contentItems.findFirst({ where: eq(contentItems.id, comment.contentItemId) });
  if (!item) return;
  if (!isAgencyRole(actor.role) && item.clientAccountId !== actor.clientAccountId) return;
  const next = !comment.resolved;
  await db.update(contentComments).set({ resolved: next }).where(eq(contentComments.id, commentId));
  await auditLog({ actorUserId: actor.id, action: next ? "content.comment_resolved" : "content.comment_reopened", entityType: "content_item", entityId: comment.contentItemId, clientAccountId: item.clientAccountId, metadata: { commentId } });
  revalidateItem(comment.contentItemId);
}

// Admins can remove a comment outright — every deletion is still logged.
export async function deleteContentComment(formData: FormData): Promise<void> {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "admin") return;
  const commentId = String(formData.get("commentId") ?? "");
  const comment = await db.query.contentComments.findFirst({ where: eq(contentComments.id, commentId) });
  if (!comment) return;
  const item = await db.query.contentItems.findFirst({ where: eq(contentItems.id, comment.contentItemId) });
  if (!item) return;
  await db.delete(contentComments).where(eq(contentComments.id, commentId));
  await auditLog({ actorUserId: actor.id, action: "content.comment_deleted", entityType: "content_item", entityId: comment.contentItemId, clientAccountId: item.clientAccountId, metadata: { deletedBody: comment.body, deletedAuthorId: comment.authorUserId } });
  revalidateItem(comment.contentItemId);
}
