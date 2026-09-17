"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { requireManager } from "@/lib/auth-helpers";
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

export async function updateTaskStatus(taskId: string, status: "open" | "in_progress" | "blocked" | "done"): Promise<void> {
  const actor = await requireManager();
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!task) return;
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
