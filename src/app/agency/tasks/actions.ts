"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { taskComments, tasks } from "@/db/schema";
import { requireAgencyUser, requireManager } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";

const taskSchema = z.object({
  clientAccountId: z.string().min(1),
  projectId: z.string().optional(),
  title: z.string().trim().min(2),
  description: z.string().trim().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  assignedToUserId: z.string().optional(),
  dueDate: z.string().optional(),
});

export async function createTask(formData: FormData): Promise<void> {
  const actor = await requireManager();
  const parsed = taskSchema.safeParse({
    clientAccountId: formData.get("clientAccountId"),
    projectId: formData.get("projectId") || undefined,
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    priority: formData.get("priority") || "medium",
    assignedToUserId: formData.get("assignedToUserId") || undefined,
    dueDate: formData.get("dueDate") || undefined,
  });
  if (!parsed.success) return;

  const [task] = await db.insert(tasks).values({
    clientAccountId: parsed.data.clientAccountId,
    projectId: parsed.data.projectId || null,
    title: parsed.data.title,
    description: parsed.data.description,
    priority: parsed.data.priority,
    assignedToUserId: parsed.data.assignedToUserId || null,
    dueDate: parsed.data.dueDate ? new Date(`${parsed.data.dueDate}T12:00:00`) : null,
    createdByUserId: actor.id,
  }).returning({ id: tasks.id });

  await auditLog({ actorUserId: actor.id, action: "task.created", entityType: "task", entityId: task.id, clientAccountId: parsed.data.clientAccountId });
  revalidatePath("/agency/tasks");
  revalidatePath("/portal");
}

// Managers can act on any task; anyone else may only act on a task assigned to them —
// this lets writers move their own work along without granting them reassignment rights.
async function requireTaskAccess(taskId: string) {
  const actor = await requireAgencyUser();
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!task) return null;
  const isManager = actor.role === "admin" || actor.role === "account_manager";
  if (!isManager && task.assignedToUserId !== actor.id) return null;
  return { actor, task };
}

export async function updateTaskStatus(taskId: string, status: "open" | "in_progress" | "blocked" | "done"): Promise<void> {
  const access = await requireTaskAccess(taskId);
  if (!access) return;
  const { actor, task } = access;
  await db.update(tasks).set({ status, updatedAt: new Date() }).where(and(eq(tasks.id, taskId), eq(tasks.clientAccountId, task.clientAccountId)));
  await auditLog({ actorUserId: actor.id, action: "task.status_updated", entityType: "task", entityId: taskId, clientAccountId: task.clientAccountId, metadata: { status } });
  revalidatePath("/agency/tasks");
  revalidatePath("/portal");
}

export async function updateTaskAssignee(taskId: string, assignedToUserId: string | null): Promise<void> {
  const actor = await requireManager();
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!task) return;
  await db.update(tasks).set({ assignedToUserId, updatedAt: new Date() }).where(eq(tasks.id, taskId));
  await auditLog({ actorUserId: actor.id, action: "task.assignee_updated", entityType: "task", entityId: taskId, clientAccountId: task.clientAccountId, metadata: { assignedToUserId } });
  revalidatePath("/agency/tasks");
}

export async function updateTaskDetails(taskId: string, patch: { title: string; description: string; priority: "low" | "medium" | "high" | "urgent"; dueDate: string }): Promise<void> {
  const access = await requireTaskAccess(taskId);
  if (!access) return;
  const { actor, task } = access;
  if (patch.title.trim().length < 2) return;
  await db.update(tasks).set({
    title: patch.title.trim(),
    description: patch.description.trim() || null,
    priority: patch.priority,
    dueDate: patch.dueDate ? new Date(`${patch.dueDate}T12:00:00`) : null,
    updatedAt: new Date(),
  }).where(eq(tasks.id, taskId));
  await auditLog({ actorUserId: actor.id, action: "task.updated", entityType: "task", entityId: taskId, clientAccountId: task.clientAccountId });
  revalidatePath("/agency/tasks");
  revalidatePath("/portal");
}

export async function addTaskComment(taskId: string, body: string): Promise<void> {
  const access = await requireTaskAccess(taskId);
  if (!access) return;
  const { actor, task } = access;
  const trimmed = body.trim();
  if (trimmed.length < 1) return;
  await db.insert(taskComments).values({ taskId, authorUserId: actor.id, body: trimmed });
  await auditLog({ actorUserId: actor.id, action: "task.comment_added", entityType: "task", entityId: taskId, clientAccountId: task.clientAccountId });
  revalidatePath("/agency/tasks");
}

export async function deleteTaskComment(formData: FormData): Promise<void> {
  const actor = await requireAgencyUser();
  const commentId = String(formData.get("commentId") || "");
  const taskId = String(formData.get("taskId") || "");
  if (!commentId || !taskId) return;
  const comment = await db.query.taskComments.findFirst({ where: eq(taskComments.id, commentId) });
  if (!comment) return;
  const isManager = actor.role === "admin" || actor.role === "account_manager";
  if (!isManager && comment.authorUserId !== actor.id) return;
  await db.delete(taskComments).where(eq(taskComments.id, commentId));
  revalidatePath("/agency/tasks");
}

export async function bulkUpdateTasks(taskIds: string[], patch: { status?: "open" | "in_progress" | "blocked" | "done"; assignedToUserId?: string | null }): Promise<void> {
  const actor = await requireManager();
  if (taskIds.length === 0) return;
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.status) set.status = patch.status;
  if (patch.assignedToUserId !== undefined) set.assignedToUserId = patch.assignedToUserId;
  await db.update(tasks).set(set).where(inArray(tasks.id, taskIds));
  await auditLog({ actorUserId: actor.id, action: "task.bulk_updated", entityType: "task", entityId: taskIds.join(","), metadata: { count: taskIds.length, ...patch } });
  revalidatePath("/agency/tasks");
  revalidatePath("/portal");
}

export type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "blocked" | "done";
  dueDate: string | null;
  comments: { id: string; body: string; authorName: string | null; authorUserId: string | null; createdAt: string }[];
};

export async function getTaskDetail(taskId: string): Promise<TaskDetail | null> {
  await requireAgencyUser();
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!task) return null;
  const comments = await db.query.taskComments.findMany({ where: eq(taskComments.taskId, taskId), orderBy: (comment, { asc }) => [asc(comment.createdAt)], with: { author: { columns: { id: true, name: true, email: true } } } });
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
    comments: comments.map((comment) => ({ id: comment.id, body: comment.body, authorName: comment.author?.name ?? comment.author?.email ?? null, authorUserId: comment.authorUserId, createdAt: comment.createdAt.toISOString() })),
  };
}


