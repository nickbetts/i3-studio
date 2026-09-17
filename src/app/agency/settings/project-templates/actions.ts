"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { projectTemplates } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";
import type { ProjectDeliverableTemplate, ProjectMilestoneTemplate } from "@/lib/project-templates";

export async function createProjectTemplate(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return;
  const clientTypeId = String(formData.get("clientTypeId") ?? "") || null;
  const [row] = await db.insert(projectTemplates).values({ name, clientTypeId, createdByUserId: actor.id }).onConflictDoNothing({ target: projectTemplates.name }).returning({ id: projectTemplates.id });
  if (!row) return;
  await auditLog({ actorUserId: actor.id, action: "project_template.created", entityType: "project_template", entityId: row.id, metadata: { name } });
  revalidatePath("/agency/settings/project-templates");
}

export async function saveProjectTemplate(
  templateId: string,
  name: string,
  clientTypeId: string | null,
  milestones: ProjectMilestoneTemplate[],
  deliverables: ProjectDeliverableTemplate[],
): Promise<void> {
  const actor = await requireAdmin();
  if (!templateId || name.trim().length < 2) return;
  await db.update(projectTemplates).set({ name: name.trim(), clientTypeId, milestones, deliverables, updatedAt: new Date() }).where(eq(projectTemplates.id, templateId));
  await auditLog({ actorUserId: actor.id, action: "project_template.updated", entityType: "project_template", entityId: templateId, metadata: { milestoneCount: milestones.length, deliverableCount: deliverables.length } });
  revalidatePath("/agency/settings/project-templates");
}

export async function archiveProjectTemplate(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const templateId = String(formData.get("templateId") ?? "");
  if (!templateId) return;
  await db.update(projectTemplates).set({ archived: true }).where(eq(projectTemplates.id, templateId));
  await auditLog({ actorUserId: actor.id, action: "project_template.archived", entityType: "project_template", entityId: templateId });
  revalidatePath("/agency/settings/project-templates");
}
