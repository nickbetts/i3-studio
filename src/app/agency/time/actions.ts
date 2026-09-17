"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { activeTimers, clientTimeBudgets, projects, tasks, timeEntries } from "@/db/schema";
import { auditLog } from "@/lib/audit";
import { requireAgencyUser, requireManager } from "@/lib/auth-helpers";

const timerInput = z.object({
  clientAccountId: z.string().min(1),
  projectId: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
  note: z.string().trim().max(500).optional(),
});

async function validateTimerSelection(input: z.infer<typeof timerInput>) {
  const projectId = input.projectId || null;
  const taskId = input.taskId || null;
  if (projectId) {
    const project = await db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.clientAccountId, input.clientAccountId)) });
    if (!project) return false;
  }
  if (taskId) {
    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
    if (!task || task.clientAccountId !== input.clientAccountId || (projectId && task.projectId !== projectId)) return false;
  }
  return true;
}

export async function startTimer(input: { clientAccountId: string; projectId?: string | null; taskId?: string | null; note?: string }): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireAgencyUser();
  const parsed = timerInput.safeParse(input);
  if (!parsed.success || !await validateTimerSelection(parsed.data)) return { ok: false, error: "Choose a valid client, project and task." };
  const existing = await db.query.activeTimers.findFirst({ where: eq(activeTimers.userId, actor.id) });
  if (existing) return { ok: false, error: "Stop your current timer before starting another one." };
  const [timer] = await db.insert(activeTimers).values({ userId: actor.id, clientAccountId: parsed.data.clientAccountId, projectId: parsed.data.projectId || null, taskId: parsed.data.taskId || null, note: parsed.data.note || null }).returning({ id: activeTimers.id });
  await auditLog({ actorUserId: actor.id, action: "time.started", entityType: "time_entry", entityId: timer.id, clientAccountId: parsed.data.clientAccountId, metadata: { projectId: parsed.data.projectId || null, taskId: parsed.data.taskId || null } });
  revalidatePath("/agency/time");
  revalidatePath("/agency/tasks");
  return { ok: true };
}

export async function stopTimer(): Promise<{ ok: boolean; error?: string; durationSeconds?: number }> {
  const actor = await requireAgencyUser();
  const active = await db.query.activeTimers.findFirst({ where: eq(activeTimers.userId, actor.id) });
  if (!active) return { ok: false, error: "No timer is running." };
  const stoppedAt = new Date();
  const durationSeconds = Math.max(1, Math.round((stoppedAt.getTime() - active.startedAt.getTime()) / 1000));
  await db.delete(activeTimers).where(eq(activeTimers.id, active.id));
  const [entry] = await db.insert(timeEntries).values({ userId: actor.id, clientAccountId: active.clientAccountId, projectId: active.projectId, taskId: active.taskId, startedAt: active.startedAt, stoppedAt, durationSeconds, note: active.note }).returning({ id: timeEntries.id });
  await auditLog({ actorUserId: actor.id, action: "time.stopped", entityType: "time_entry", entityId: entry.id, clientAccountId: active.clientAccountId, metadata: { durationSeconds, projectId: active.projectId, taskId: active.taskId } });
  revalidatePath("/agency/time");
  revalidatePath("/agency/tasks");
  return { ok: true, durationSeconds };
}

export async function setClientTimeBudget(formData: FormData): Promise<void> {
  const actor = await requireManager();
  const clientAccountId = String(formData.get("clientAccountId") || "");
  const periodStart = new Date(`${String(formData.get("periodStart") || "")}T00:00:00`);
  const periodEnd = new Date(`${String(formData.get("periodEnd") || "")}T23:59:59.999`);
  const hours = Number(formData.get("hours"));
  if (!clientAccountId || Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodEnd <= periodStart || !Number.isFinite(hours) || hours < 0 || hours > 10000) return;
  await db.insert(clientTimeBudgets).values({ clientAccountId, periodStart, periodEnd, allocatedSeconds: Math.round(hours * 3600), createdByUserId: actor.id, updatedAt: new Date() }).onConflictDoUpdate({ target: [clientTimeBudgets.clientAccountId, clientTimeBudgets.periodStart], set: { periodEnd, allocatedSeconds: Math.round(hours * 3600), updatedAt: new Date() } });
  await auditLog({ actorUserId: actor.id, action: "time.budget_updated", entityType: "client_account", entityId: clientAccountId, clientAccountId, metadata: { periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString(), hours } });
  revalidatePath("/agency/time");
  revalidatePath("/agency/clients");
}

export async function deleteClientTimeBudget(formData: FormData): Promise<void> {
  const actor = await requireManager();
  const budgetId = String(formData.get("budgetId") || "");
  if (!budgetId) return;
  await db.delete(clientTimeBudgets).where(eq(clientTimeBudgets.id, budgetId));
  await auditLog({ actorUserId: actor.id, action: "time.budget_deleted", entityType: "client_time_budget", entityId: budgetId });
  revalidatePath("/agency/time");
}
