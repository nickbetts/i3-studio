"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { savedTaskViews, taskActivities, taskComments, taskDependencies, tasks } from "@/db/schema";
import { requireAgencyUser, requireManager } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";
import { consumeUpload, verifiedUpload } from "@/lib/upload-server";

const taskSchema = z.object({
  clientAccountId: z.string().min(1),
  projectId: z.string().optional(),
  title: z.string().trim().min(2),
  description: z.string().trim().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  assignedToUserId: z.string().optional(),
  dueDate: z.string().optional(),
  recurrenceRule: z.enum(["daily", "weekly", "monthly"]).optional(),
});

async function recordActivity(taskId: string, actorUserId: string, action: string, metadata?: Record<string, unknown>) {
  await db.insert(taskActivities).values({ taskId, actorUserId, action, metadata });
}

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
    recurrenceRule: formData.get("recurrenceRule") || undefined,
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
    recurrenceRule: parsed.data.recurrenceRule || null,
    recurrenceNextDate: parsed.data.recurrenceRule && parsed.data.dueDate ? new Date(`${parsed.data.dueDate}T12:00:00`) : null,
  }).returning({ id: tasks.id });

  await recordActivity(task.id, actor.id, "created");
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
  await recordActivity(taskId, actor.id, "status_changed", { status });
  if (status === "done" && task.recurrenceRule && task.dueDate) {
    const nextDue = new Date(task.dueDate);
    if (task.recurrenceRule === "daily") nextDue.setDate(nextDue.getDate() + 1);
    if (task.recurrenceRule === "weekly") nextDue.setDate(nextDue.getDate() + 7);
    if (task.recurrenceRule === "monthly") nextDue.setMonth(nextDue.getMonth() + 1);
    const [nextTask] = await db.insert(tasks).values({ clientAccountId: task.clientAccountId, projectId: task.projectId, parentTaskId: task.parentTaskId, title: task.title, description: task.description, priority: task.priority, assignedToUserId: task.assignedToUserId, createdByUserId: actor.id, dueDate: nextDue, recurrenceRule: task.recurrenceRule, recurrenceNextDate: nextDue, checklist: task.checklist }).returning({ id: tasks.id });
    await recordActivity(nextTask.id, actor.id, "created_from_recurrence", { sourceTaskId: taskId });
  }
  await auditLog({ actorUserId: actor.id, action: "task.status_updated", entityType: "task", entityId: taskId, clientAccountId: task.clientAccountId, metadata: { status } });
  revalidatePath("/agency/tasks");
  revalidatePath("/portal");
}

export async function updateTaskAssignee(taskId: string, assignedToUserId: string | null): Promise<void> {
  const actor = await requireManager();
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!task) return;
  await db.update(tasks).set({ assignedToUserId, updatedAt: new Date() }).where(eq(tasks.id, taskId));
  await recordActivity(taskId, actor.id, "assignee_changed", { assignedToUserId });
  await auditLog({ actorUserId: actor.id, action: "task.assignee_updated", entityType: "task", entityId: taskId, clientAccountId: task.clientAccountId, metadata: { assignedToUserId } });
  revalidatePath("/agency/tasks");
}

export async function updateTaskDetails(taskId: string, patch: { title: string; description: string; priority: "low" | "medium" | "high" | "urgent"; dueDate: string; recurrenceRule?: "daily" | "weekly" | "monthly" | null }): Promise<void> {
  const access = await requireTaskAccess(taskId);
  if (!access) return;
  const { actor, task } = access;
  if (patch.title.trim().length < 2) return;
  await db.update(tasks).set({
    title: patch.title.trim(),
    description: patch.description.trim() || null,
    priority: patch.priority,
    dueDate: patch.dueDate ? new Date(`${patch.dueDate}T12:00:00`) : null,
    recurrenceRule: patch.recurrenceRule ?? null,
    updatedAt: new Date(),
  }).where(eq(tasks.id, taskId));
  await recordActivity(taskId, actor.id, "updated");
  await auditLog({ actorUserId: actor.id, action: "task.updated", entityType: "task", entityId: taskId, clientAccountId: task.clientAccountId });
  revalidatePath("/agency/tasks");
  revalidatePath("/portal");
}

export async function addTaskComment(taskId: string, body: string, attachmentForm?: FormData): Promise<void> {
  const access = await requireTaskAccess(taskId);
  if (!access) return;
  const { actor, task } = access;
  const trimmed = body.trim();
  if (trimmed.length < 1) return;
  let attachment: { attachmentUrl?: string; attachmentName?: string; attachmentContentType?: string; attachmentSize?: number } = {};
  if (attachmentForm?.get("uploadedUrl")) {
    const blob = await verifiedUpload(attachmentForm, actor.id, "task_attachment", task.clientAccountId);
    await consumeUpload(blob.pathname);
    attachment = { attachmentUrl: blob.url, attachmentName: blob.fileName, attachmentContentType: blob.contentType, attachmentSize: blob.size };
  }
  await db.insert(taskComments).values({ taskId, authorUserId: actor.id, body: trimmed, ...attachment });
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

export async function createSubtask(parentTaskId: string, title: string): Promise<void> {
  const access = await requireTaskAccess(parentTaskId);
  if (!access || !title.trim()) return;
  const [subtask] = await db.insert(tasks).values({ clientAccountId: access.task.clientAccountId, projectId: access.task.projectId, parentTaskId, title: title.trim(), priority: access.task.priority, assignedToUserId: access.task.assignedToUserId, createdByUserId: access.actor.id }).returning({ id: tasks.id });
  await recordActivity(parentTaskId, access.actor.id, "subtask_created", { subtaskId: subtask.id });
  revalidatePath("/agency/tasks");
}

export async function updateChecklist(taskId: string, checklist: { id: string; label: string; done: boolean }[]): Promise<void> {
  const access = await requireTaskAccess(taskId);
  if (!access) return;
  await db.update(tasks).set({ checklist, updatedAt: new Date() }).where(eq(tasks.id, taskId));
  await recordActivity(taskId, access.actor.id, "checklist_updated", { completed: checklist.filter((item) => item.done).length, total: checklist.length });
  revalidatePath("/agency/tasks");
}

export async function addTaskDependency(taskId: string, dependsOnTaskId: string): Promise<void> {
  const access = await requireTaskAccess(taskId);
  if (!access || taskId === dependsOnTaskId) return;
  const dependency = await db.query.tasks.findFirst({ where: eq(tasks.id, dependsOnTaskId) });
  if (!dependency || dependency.clientAccountId !== access.task.clientAccountId) return;
  await db.insert(taskDependencies).values({ taskId, dependsOnTaskId, createdByUserId: access.actor.id }).onConflictDoNothing();
  await recordActivity(taskId, access.actor.id, "dependency_added", { dependsOnTaskId });
  revalidatePath("/agency/tasks");
}

export async function saveTaskView(formData: FormData): Promise<void> {
  const actor = await requireAgencyUser();
  const name = String(formData.get("name") || "").trim();
  const filters = JSON.parse(String(formData.get("filters") || "{}")) as Record<string, string>;
  if (!name || name.length > 80) return;
  await db.insert(savedTaskViews).values({ userId: actor.id, name, filters }).onConflictDoUpdate({ target: [savedTaskViews.userId, savedTaskViews.name], set: { filters } });
  revalidatePath("/agency/tasks");
}

export async function deleteTaskView(formData: FormData): Promise<void> {
  const actor = await requireAgencyUser();
  const id = String(formData.get("viewId") || "");
  if (id) await db.delete(savedTaskViews).where(and(eq(savedTaskViews.id, id), eq(savedTaskViews.userId, actor.id)));
  revalidatePath("/agency/tasks");
}

export type TaskDetail = {
  id: string;
  clientAccountId: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "blocked" | "done";
  dueDate: string | null;
  recurrenceRule: "daily" | "weekly" | "monthly" | null;
  checklist: { id: string; label: string; done: boolean }[];
  subtasks: { id: string; title: string; status: string }[];
  dependencies: { id: string; title: string; status: string }[];
  activities: { id: string; action: string; createdAt: string; actorName: string | null }[];
  comments: { id: string; body: string; authorName: string | null; authorUserId: string | null; createdAt: string; attachmentUrl: string | null; attachmentName: string | null }[];
};

export async function getTaskDetail(taskId: string): Promise<TaskDetail | null> {
  await requireAgencyUser();
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!task) return null;
  const comments = await db.query.taskComments.findMany({ where: eq(taskComments.taskId, taskId), orderBy: (comment, { asc }) => [asc(comment.createdAt)], with: { author: { columns: { id: true, name: true, email: true } } } });
  const subtasks = await db.query.tasks.findMany({ where: eq(tasks.parentTaskId, taskId), orderBy: (subtask, { asc }) => [asc(subtask.createdAt)] });
  const dependencies = await db.query.taskDependencies.findMany({ where: eq(taskDependencies.taskId, taskId), with: { dependsOnTask: true } });
  const activities = await db.query.taskActivities.findMany({ where: eq(taskActivities.taskId, taskId), orderBy: (activity, { desc }) => [desc(activity.createdAt)], with: { actor: { columns: { name: true, email: true } } } });
  return {
    id: task.id,
    clientAccountId: task.clientAccountId,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
    recurrenceRule: task.recurrenceRule as TaskDetail["recurrenceRule"],
    checklist: Array.isArray(task.checklist) ? task.checklist as TaskDetail["checklist"] : [],
    subtasks: subtasks.map((item) => ({ id: item.id, title: item.title, status: item.status })),
    dependencies: dependencies.map((item) => ({ id: item.dependsOnTask.id, title: item.dependsOnTask.title, status: item.dependsOnTask.status })),
    activities: activities.map((item) => ({ id: item.id, action: item.action, createdAt: item.createdAt.toISOString(), actorName: item.actor?.name ?? item.actor?.email ?? null })),
    comments: comments.map((comment) => ({ id: comment.id, body: comment.body, authorName: comment.author?.name ?? comment.author?.email ?? null, authorUserId: comment.authorUserId, createdAt: comment.createdAt.toISOString(), attachmentUrl: comment.attachmentUrl, attachmentName: comment.attachmentName })),
  };
}


