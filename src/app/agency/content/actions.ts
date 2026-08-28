"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { contentComments, contentEvents, contentItems, contentTemplates, contentVersions } from "@/db/schema";
import { getCurrentUser, isAgencyRole, requireAgencyUser, requireClientUser } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";
import { DEFAULT_TEMPLATE_FIELDS, type ContentField, type ContentStatus } from "@/lib/content";

type Actor = { id: string; role: string };

function revalidateItem(id: string) {
  revalidatePath("/agency/content");
  revalidatePath(`/agency/content/${id}`);
  revalidatePath("/portal/content");
  revalidatePath(`/portal/content/${id}`);
}

async function logEvent(itemId: string, actor: Actor, type: string, fromStatus: ContentStatus | null, toStatus: ContentStatus | null, note?: string, clientAccountId?: string) {
  await db.insert(contentEvents).values({ contentItemId: itemId, actorUserId: actor.id, actorRole: actor.role, type, fromStatus, toStatus, note: note ?? null });
  await auditLog({ actorUserId: actor.id, action: `content.${type}`, entityType: "content_item", entityId: itemId, clientAccountId: clientAccountId ?? null, metadata: { fromStatus, toStatus, note } });
}

async function snapshot(itemId: string, data: unknown, authorId: string, note: string) {
  const [item] = await db.select({ v: contentItems.currentVersion }).from(contentItems).where(eq(contentItems.id, itemId));
  const next = (item?.v ?? 0) + 1;
  await db.insert(contentVersions).values({ contentItemId: itemId, version: next, data: data as object, authorUserId: authorId, note });
  await db.update(contentItems).set({ currentVersion: next }).where(eq(contentItems.id, itemId));
  return next;
}

// ----- Templates -----------------------------------------------------------
export async function createTemplate(formData: FormData): Promise<void> {
  const actor = await requireAgencyUser();
  const name = String(formData.get("name") ?? "").trim();
  const contentType = String(formData.get("contentType") ?? "blog");
  if (name.length < 2) return;
  const fields = DEFAULT_TEMPLATE_FIELDS[contentType] ?? DEFAULT_TEMPLATE_FIELDS.blog;
  const [row] = await db.insert(contentTemplates).values({ name, contentType, fields, createdByUserId: actor.id }).returning({ id: contentTemplates.id });
  await auditLog({ actorUserId: actor.id, action: "content.template_created", entityType: "content_template", entityId: row.id, metadata: { name, contentType } });
  revalidatePath("/agency/content/templates");
}

export async function saveTemplateFields(templateId: string, name: string, fields: ContentField[]): Promise<void> {
  const actor = await requireAgencyUser();
  if (!templateId || name.trim().length < 2) return;
  await db.update(contentTemplates).set({ name: name.trim(), fields, updatedAt: new Date() }).where(eq(contentTemplates.id, templateId));
  await auditLog({ actorUserId: actor.id, action: "content.template_updated", entityType: "content_template", entityId: templateId, metadata: { fieldCount: fields.length } });
  revalidatePath("/agency/content/templates");
}

export async function archiveTemplate(formData: FormData): Promise<void> {
  const actor = await requireAgencyUser();
  const templateId = String(formData.get("templateId") ?? "");
  if (!templateId) return;
  await db.update(contentTemplates).set({ archived: true }).where(eq(contentTemplates.id, templateId));
  await auditLog({ actorUserId: actor.id, action: "content.template_archived", entityType: "content_template", entityId: templateId });
  revalidatePath("/agency/content/templates");
}

// ----- Content items -------------------------------------------------------
export async function createContentItem(formData: FormData): Promise<void> {
  const actor = await requireAgencyUser();
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
  const actor = await getCurrentUser();
  if (!actor || !isAgencyRole(actor.role)) return;
  await db.update(contentItems).set({ data, updatedAt: new Date() }).where(eq(contentItems.id, itemId));
  revalidateItem(itemId);
}

export async function submitForReview(itemId: string, data: Record<string, unknown>): Promise<void> {
  const actor = await requireAgencyUser();
  const item = await db.query.contentItems.findFirst({ where: eq(contentItems.id, itemId) });
  if (!item || !["draft", "am_changes", "client_changes"].includes(item.status)) return;
  await db.update(contentItems).set({ data, status: "pending_am", updatedAt: new Date() }).where(eq(contentItems.id, itemId));
  await snapshot(itemId, data, actor.id, "Submitted for review");
  await logEvent(itemId, actor, "submitted", item.status as ContentStatus, "pending_am", undefined, item.clientAccountId);
  revalidateItem(itemId);
}

export async function amDecision(itemId: string, decision: "approve" | "changes", note: string): Promise<void> {
  const actor = await getCurrentUser();
  if (!actor || (actor.role !== "admin" && actor.role !== "account_manager")) return;
  const item = await db.query.contentItems.findFirst({ where: eq(contentItems.id, itemId) });
  if (!item || item.status !== "pending_am") return;
  if (decision === "approve") {
    await db.update(contentItems).set({ status: "pending_client", updatedAt: new Date() }).where(eq(contentItems.id, itemId));
    await logEvent(itemId, actor, "am_approved", "pending_am", "pending_client", note || undefined, item.clientAccountId);
    await logEvent(itemId, actor, "sent_to_client", "pending_am", "pending_client", undefined, item.clientAccountId);
  } else {
    await db.update(contentItems).set({ status: "am_changes", updatedAt: new Date() }).where(eq(contentItems.id, itemId));
    await logEvent(itemId, actor, "am_changes", "pending_am", "am_changes", note || undefined, item.clientAccountId);
  }
  revalidateItem(itemId);
}

export async function clientDecision(itemId: string, decision: "approve" | "changes", note: string): Promise<void> {
  const actor = await requireClientUser();
  const item = await db.query.contentItems.findFirst({ where: eq(contentItems.id, itemId) });
  if (!item || item.clientAccountId !== actor.clientAccountId || item.status !== "pending_client") return;
  if (decision === "approve") {
    await db.update(contentItems).set({ status: "approved", updatedAt: new Date() }).where(eq(contentItems.id, itemId));
    await snapshot(itemId, item.data, actor.id, "Client approved");
    await logEvent(itemId, actor, "client_approved", "pending_client", "approved", note || undefined, item.clientAccountId);
  } else {
    await db.update(contentItems).set({ status: "client_changes", updatedAt: new Date() }).where(eq(contentItems.id, itemId));
    await logEvent(itemId, actor, "client_changes", "pending_client", "client_changes", note || undefined, item.clientAccountId);
  }
  revalidateItem(itemId);
}

export async function publishContent(itemId: string): Promise<void> {
  const actor = await getCurrentUser();
  if (!actor || (actor.role !== "admin" && actor.role !== "account_manager")) return;
  const item = await db.query.contentItems.findFirst({ where: eq(contentItems.id, itemId) });
  if (!item || item.status !== "approved") return;
  await db.update(contentItems).set({ status: "published", updatedAt: new Date() }).where(eq(contentItems.id, itemId));
  await logEvent(itemId, actor, "published", "approved", "published", undefined, item.clientAccountId);
  revalidateItem(itemId);
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
  await db.insert(contentComments).values({ contentItemId: itemId, fieldKey: input.fieldKey || null, quote: input.quote?.trim() || null, body: input.body.trim(), authorUserId: actor.id, parentId: input.parentId || null });
  await auditLog({ actorUserId: actor.id, action: "content.comment", entityType: "content_item", entityId: itemId, clientAccountId: item.clientAccountId, metadata: { fieldKey: input.fieldKey, hasQuote: Boolean(input.quote) } });
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
  await db.update(contentComments).set({ resolved: !comment.resolved }).where(eq(contentComments.id, commentId));
  revalidateItem(comment.contentItemId);
}
