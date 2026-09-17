"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { projectAccountManagerAssignments, projectDeliverables, projectMilestones, projectTemplates, projects } from "@/db/schema";
import { requireManager } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";
import type { ProjectDeliverableTemplate, ProjectMilestoneTemplate } from "@/lib/project-templates";
import { and, eq } from "drizzle-orm";

const schema = z.object({ clientAccountId: z.string().min(1), name: z.string().trim().min(2), projectTemplateId: z.string().min(1) });

export async function createProject(formData: FormData): Promise<void> {
  const actor = await requireManager();
  const parsed = schema.safeParse({ clientAccountId: formData.get("clientAccountId"), name: formData.get("name"), projectTemplateId: formData.get("projectTemplateId") });
  if (!parsed.success) return;
  const client = await db.query.clientAccounts.findFirst({ where: (account, { eq }) => eq(account.id, parsed.data.clientAccountId) });
  if (!client) return;
  const template = await db.query.projectTemplates.findFirst({ where: eq(projectTemplates.id, parsed.data.projectTemplateId) });
  if (!template) return;
  const milestones = (template.milestones as ProjectMilestoneTemplate[]) ?? [];
  const deliverables = (template.deliverables as ProjectDeliverableTemplate[]) ?? [];
  const [project] = await db.insert(projects).values({ clientAccountId: parsed.data.clientAccountId, name: parsed.data.name, projectType: template.name, projectTemplateId: template.id }).returning({ id: projects.id });
  if (milestones.length) await db.insert(projectMilestones).values(milestones.map((milestone, sortOrder) => ({ projectId: project.id, title: milestone.title, sortOrder })));
  if (deliverables.length) await db.insert(projectDeliverables).values(deliverables.map((deliverable) => ({ projectId: project.id, type: deliverable.type, title: deliverable.title, description: deliverable.description ?? null, standard: deliverable.standard })));
  await auditLog({ actorUserId: actor.id, action: "project.created", entityType: "project", entityId: project.id, clientAccountId: client.id, metadata: { projectTemplateId: template.id, projectType: template.name } });
  revalidatePath("/agency/projects");
  revalidatePath("/portal/projects");
}

export async function updateProjectStatus(formData: FormData): Promise<void> {
  const actor = await requireManager();
  const projectId = String(formData.get("projectId") || "");
  const status = String(formData.get("status") || "active");
  if (!projectId || !["active", "paused", "completed"].includes(status)) return;
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) return;
  await db.update(projects).set({ status }).where(eq(projects.id, projectId));
  await auditLog({ actorUserId: actor.id, action: "project.status_updated", entityType: "project", entityId: projectId, clientAccountId: project.clientAccountId, metadata: { status } });
  revalidatePath(`/agency/projects/${projectId}`);
  revalidatePath("/agency/projects");
  revalidatePath("/portal/projects");
}

export async function updateMilestone(formData: FormData): Promise<void> {
  const actor = await requireManager();
  const milestoneId = String(formData.get("milestoneId") || "");
  const projectId = String(formData.get("projectId") || "");
  const title = String(formData.get("title") || "").trim();
  const status = String(formData.get("status") || "open");
  const dueDate = String(formData.get("dueDate") || "");
  const assignedToUserId = String(formData.get("assignedToUserId") || "") || null;
  if (!milestoneId || !projectId || title.length < 2 || !["open", "in_progress", "blocked", "done"].includes(status)) return;
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) return;
  await db.update(projectMilestones).set({ title, status: status as "open" | "in_progress" | "blocked" | "done", dueDate: dueDate ? new Date(`${dueDate}T12:00:00`) : null, assignedToUserId }).where(and(eq(projectMilestones.id, milestoneId), eq(projectMilestones.projectId, projectId)));
  await auditLog({ actorUserId: actor.id, action: "project.milestone_updated", entityType: "project_milestone", entityId: milestoneId, clientAccountId: project.clientAccountId, metadata: { projectId, title, status, dueDate, assignedToUserId } });
  revalidatePath(`/agency/projects/${projectId}`);
  revalidatePath("/agency/projects");
  revalidatePath("/portal/projects");
}

export async function addMilestone(formData: FormData): Promise<void> {
  const actor = await requireManager();
  const projectId = String(formData.get("projectId") || "");
  const title = String(formData.get("title") || "").trim();
  const dueDate = String(formData.get("dueDate") || "");
  if (!projectId || title.length < 2) return;
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId), with: { milestones: true } });
  if (!project) return;
  const [milestone] = await db.insert(projectMilestones).values({ projectId, title, sortOrder: project.milestones.length, dueDate: dueDate ? new Date(`${dueDate}T12:00:00`) : null }).returning({ id: projectMilestones.id });
  await auditLog({ actorUserId: actor.id, action: "project.milestone_created", entityType: "project_milestone", entityId: milestone.id, clientAccountId: project.clientAccountId, metadata: { projectId, title, dueDate } });
  revalidatePath(`/agency/projects/${projectId}`);
}

export async function deleteMilestone(formData: FormData): Promise<void> {
  const actor = await requireManager();
  const milestoneId = String(formData.get("milestoneId") || "");
  const projectId = String(formData.get("projectId") || "");
  if (!milestoneId || !projectId) return;
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) return;
  await db.delete(projectMilestones).where(and(eq(projectMilestones.id, milestoneId), eq(projectMilestones.projectId, projectId)));
  await auditLog({ actorUserId: actor.id, action: "project.milestone_deleted", entityType: "project_milestone", entityId: milestoneId, clientAccountId: project.clientAccountId, metadata: { projectId } });
  revalidatePath(`/agency/projects/${projectId}`);
  revalidatePath("/agency/projects");
  revalidatePath("/portal/projects");
}

export async function addProjectAccountManager(formData: FormData): Promise<void> {
  const actor = await requireManager();
  const projectId = String(formData.get("projectId") || "");
  const userId = String(formData.get("userId") || "");
  if (!projectId || !userId) return;
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) return;
  await db.insert(projectAccountManagerAssignments).values({ projectId, userId }).onConflictDoNothing();
  await auditLog({ actorUserId: actor.id, action: "project.am_assigned", entityType: "project", entityId: projectId, clientAccountId: project.clientAccountId, metadata: { userId } });
  revalidatePath(`/agency/projects/${projectId}`);
}

export async function removeProjectAccountManager(formData: FormData): Promise<void> {
  const actor = await requireManager();
  const assignmentId = String(formData.get("assignmentId") || "");
  const projectId = String(formData.get("projectId") || "");
  if (!assignmentId || !projectId) return;
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) return;
  await db.delete(projectAccountManagerAssignments).where(eq(projectAccountManagerAssignments.id, assignmentId));
  await auditLog({ actorUserId: actor.id, action: "project.am_removed", entityType: "project", entityId: projectId, clientAccountId: project.clientAccountId });
  revalidatePath(`/agency/projects/${projectId}`);
}

export async function linkProjectDeliverable(formData: FormData): Promise<void> {
  const actor = await requireManager();
  const deliverableId = String(formData.get("deliverableId") || "");
  const projectId = String(formData.get("projectId") || "");
  const itemId = String(formData.get("itemId") || "") || null;
  const deliverable = await db.query.projectDeliverables.findFirst({ where: and(eq(projectDeliverables.id, deliverableId), eq(projectDeliverables.projectId, projectId)) });
  if (!deliverable) return;
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) return;
  const column = deliverable.type === "design" ? { designAssetId: itemId } : deliverable.type === "content" ? { contentItemId: itemId } : { documentId: itemId };
  await db.update(projectDeliverables).set(column).where(eq(projectDeliverables.id, deliverableId));
  await auditLog({ actorUserId: actor.id, action: "project.deliverable_linked", entityType: "project_deliverable", entityId: deliverableId, clientAccountId: project.clientAccountId, metadata: { itemId } });
  revalidatePath(`/agency/projects/${projectId}`);
}
