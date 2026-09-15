"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { projectMilestones, projects } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";
import { and, eq } from "drizzle-orm";

const schema = z.object({ clientAccountId: z.string().min(1), name: z.string().trim().min(2), projectType: z.enum(["brochure_site", "charity_site", "ecommerce", "campaign"]) });
const templates: Record<string, string[]> = {
  brochure_site: ["Discovery", "Design approval", "Build", "Content", "Launch"],
  charity_site: ["Discovery", "Homepage and key pages", "Fundraising templates", "Content migration", "Launch"],
  ecommerce: ["Discovery", "UX and design approval", "Catalogue and checkout", "Content and products", "Launch"],
  campaign: ["Brief", "Creative approval", "Build", "Review", "Launch"],
};

export async function createProject(formData: FormData): Promise<void> {
  const actor = await requireAgencyUser();
  const parsed = schema.safeParse({ clientAccountId: formData.get("clientAccountId"), name: formData.get("name"), projectType: formData.get("projectType") || "brochure_site" });
  if (!parsed.success) return;
  const client = await db.query.clientAccounts.findFirst({ where: (account, { eq }) => eq(account.id, parsed.data.clientAccountId) });
  if (!client) return;
  const [project] = await db.insert(projects).values(parsed.data).returning({ id: projects.id });
  await db.insert(projectMilestones).values(templates[parsed.data.projectType].map((title, sortOrder) => ({ projectId: project.id, title, sortOrder })));
  await auditLog({ actorUserId: actor.id, action: "project.created", entityType: "project", entityId: project.id, clientAccountId: client.id, metadata: { projectType: parsed.data.projectType } });
  revalidatePath("/agency/projects");
  revalidatePath("/portal/projects");
}

export async function updateProjectStatus(formData: FormData): Promise<void> {
  const actor = await requireAgencyUser();
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
  const actor = await requireAgencyUser();
  const milestoneId = String(formData.get("milestoneId") || "");
  const projectId = String(formData.get("projectId") || "");
  const title = String(formData.get("title") || "").trim();
  const status = String(formData.get("status") || "open");
  const dueDate = String(formData.get("dueDate") || "");
  if (!milestoneId || !projectId || title.length < 2 || !["open", "in_progress", "blocked", "done"].includes(status)) return;
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) return;
  await db.update(projectMilestones).set({ title, status: status as "open" | "in_progress" | "blocked" | "done", dueDate: dueDate ? new Date(`${dueDate}T12:00:00`) : null }).where(and(eq(projectMilestones.id, milestoneId), eq(projectMilestones.projectId, projectId)));
  await auditLog({ actorUserId: actor.id, action: "project.milestone_updated", entityType: "project_milestone", entityId: milestoneId, clientAccountId: project.clientAccountId, metadata: { projectId, title, status, dueDate } });
  revalidatePath(`/agency/projects/${projectId}`);
  revalidatePath("/agency/projects");
  revalidatePath("/portal/projects");
}

export async function addMilestone(formData: FormData): Promise<void> {
  const actor = await requireAgencyUser();
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
  const actor = await requireAgencyUser();
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
