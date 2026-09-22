"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { projectTemplates } from "@/db/schema";
import { requireAgencyPermission } from "@/lib/permissions";
import { auditLog } from "@/lib/audit";
import type { ProjectDeliverableTemplate, ProjectMilestoneTemplate } from "@/lib/project-templates";

export async function createProjectTemplate(formData: FormData): Promise<void> {
  const actor = await requireAgencyPermission("manage_settings");
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
  const actor = await requireAgencyPermission("manage_settings");
  if (!templateId || name.trim().length < 2) return;
  await db.update(projectTemplates).set({ name: name.trim(), clientTypeId, milestones, deliverables, updatedAt: new Date() }).where(eq(projectTemplates.id, templateId));
  await auditLog({ actorUserId: actor.id, action: "project_template.updated", entityType: "project_template", entityId: templateId, metadata: { milestoneCount: milestones.length, deliverableCount: deliverables.length } });
  revalidatePath("/agency/settings/project-templates");
}

export async function archiveProjectTemplate(formData: FormData): Promise<void> {
  const actor = await requireAgencyPermission("manage_settings");
  const templateId = String(formData.get("templateId") ?? "");
  if (!templateId) return;
  await db.update(projectTemplates).set({ archived: true }).where(eq(projectTemplates.id, templateId));
  await auditLog({ actorUserId: actor.id, action: "project_template.archived", entityType: "project_template", entityId: templateId });
  revalidatePath("/agency/settings/project-templates");
}

export async function duplicateProjectTemplate(formData: FormData): Promise<void> {
  const actor = await requireAgencyPermission("manage_settings");
  const templateId = String(formData.get("templateId") ?? "");
  const original = await db.query.projectTemplates.findFirst({ where: eq(projectTemplates.id, templateId) });
  if (!original) return;
  let name = `${original.name} (copy)`;
  for (let attempt = 2; await db.query.projectTemplates.findFirst({ where: eq(projectTemplates.name, name) }); attempt++) name = `${original.name} (copy ${attempt})`;
  const [row] = await db.insert(projectTemplates).values({ name, clientTypeId: original.clientTypeId, milestones: original.milestones, deliverables: original.deliverables, createdByUserId: actor.id }).returning({ id: projectTemplates.id });
  await auditLog({ actorUserId: actor.id, action: "project_template.duplicated", entityType: "project_template", entityId: row.id, metadata: { sourceId: templateId } });
  revalidatePath("/agency/settings/project-templates");
}
