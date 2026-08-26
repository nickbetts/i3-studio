"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { contentSubmissions, projectUpdates, projects } from "@/db/schema";
import { requireClientUser } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";

const contentSchema = z.object({ projectId: z.string().min(1), pageTitle: z.string().trim().min(2), body: z.string().trim().min(2), status: z.enum(["draft", "finalised", "needs_optimisation"]) });
const updateSchema = z.object({ projectId: z.string().min(1), body: z.string().trim().min(2), updateType: z.enum(["meeting", "phone_call", "note"]), sentiment: z.enum(["positive", "neutral", "at_risk"]) });

export async function submitContent(formData: FormData): Promise<void> {
  const user = await requireClientUser();
  const parsed = contentSchema.safeParse({ projectId: formData.get("projectId"), pageTitle: formData.get("pageTitle"), body: formData.get("body"), status: formData.get("status") || "draft" });
  if (!parsed.success) return;
  const project = await db.query.projects.findFirst({ where: eq(projects.id, parsed.data.projectId) });
  if (!project || project.clientAccountId !== user.clientAccountId) return;
  await db.insert(contentSubmissions).values({ ...parsed.data, submittedByUserId: user.id });
  await auditLog({ actorUserId: user.id, action: "content.submitted", entityType: "content_submission", clientAccountId: user.clientAccountId, metadata: { pageTitle: parsed.data.pageTitle, status: parsed.data.status } });
  revalidatePath("/portal/projects");
}

export async function addProjectUpdate(formData: FormData): Promise<void> {
  const user = await requireClientUser();
  const parsed = updateSchema.safeParse({ projectId: formData.get("projectId"), body: formData.get("body"), updateType: formData.get("updateType") || "note", sentiment: formData.get("sentiment") || "neutral" });
  if (!parsed.success) return;
  const project = await db.query.projects.findFirst({ where: eq(projects.id, parsed.data.projectId) });
  if (!project || project.clientAccountId !== user.clientAccountId) return;
  await db.insert(projectUpdates).values({ ...parsed.data, authorUserId: user.id });
  await auditLog({ actorUserId: user.id, action: "project.update_added", entityType: "project_update", clientAccountId: user.clientAccountId, metadata: { updateType: parsed.data.updateType, sentiment: parsed.data.sentiment } });
  revalidatePath("/portal/projects");
}
