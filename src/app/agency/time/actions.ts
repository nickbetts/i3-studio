"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { activeTimers, clientServiceAllocations, clientTimeBudgets, projects, tasks, timeEntries } from "@/db/schema";
import { auditLog } from "@/lib/audit";
import { requireAgencyUser, requireManager } from "@/lib/auth-helpers";
import { SERVICE_ALLOCATIONS, serviceAllocation } from "@/lib/service-allocations";

const timerInput = z.object({
  clientAccountId: z.string().min(1),
  projectId: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
  serviceType: z.string().optional(),
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

export async function startTimer(input: { clientAccountId: string; projectId?: string | null; taskId?: string | null; serviceType?: string; note?: string }): Promise<{ ok: boolean; error?: string; startedAt?: string }> {
  const actor = await requireAgencyUser();
  const parsed = timerInput.safeParse(input);
  if (!parsed.success || !await validateTimerSelection(parsed.data)) return { ok: false, error: "Choose a valid client, project and task." };
  const serviceType = SERVICE_ALLOCATIONS.some((service) => service.key === parsed.data.serviceType) ? parsed.data.serviceType! : "account_manager_hours";
  if (serviceAllocation(serviceType).kind !== "hours") return { ok: false, error: "Timers can only be used for hour-based services." };
  const existing = await db.query.activeTimers.findFirst({ where: eq(activeTimers.userId, actor.id) });
  if (existing) return { ok: false, error: "Stop your current timer before starting another one." };
  const [timer] = await db.insert(activeTimers).values({ userId: actor.id, clientAccountId: parsed.data.clientAccountId, projectId: parsed.data.projectId || null, taskId: parsed.data.taskId || null, serviceType, note: parsed.data.note || null }).returning({ id: activeTimers.id });
  await auditLog({ actorUserId: actor.id, action: "time.started", entityType: "time_entry", entityId: timer.id, clientAccountId: parsed.data.clientAccountId, metadata: { projectId: parsed.data.projectId || null, taskId: parsed.data.taskId || null } });
  revalidatePath("/agency/time");
  revalidatePath("/agency/tasks");
  return { ok: true, startedAt: new Date().toISOString() };
}

export async function stopTimer(): Promise<{ ok: boolean; error?: string; durationSeconds?: number; startedAt?: string }> {
  const actor = await requireAgencyUser();
  const active = await db.query.activeTimers.findFirst({ where: eq(activeTimers.userId, actor.id) });
  if (!active) return { ok: false, error: "No timer is running." };
  const stoppedAt = new Date();
  const durationSeconds = Math.max(1, Math.round((stoppedAt.getTime() - active.startedAt.getTime()) / 1000));
  await db.delete(activeTimers).where(eq(activeTimers.id, active.id));
  const [entry] = await db.insert(timeEntries).values({ userId: actor.id, clientAccountId: active.clientAccountId, projectId: active.projectId, taskId: active.taskId, serviceType: active.serviceType, startedAt: active.startedAt, stoppedAt, durationSeconds, note: active.note }).returning({ id: timeEntries.id });
  await auditLog({ actorUserId: actor.id, action: "time.stopped", entityType: "time_entry", entityId: entry.id, clientAccountId: active.clientAccountId, metadata: { durationSeconds, projectId: active.projectId, taskId: active.taskId } });
  revalidatePath("/agency/time");
  revalidatePath("/agency/tasks");
  return { ok: true, durationSeconds, startedAt: active.startedAt.toISOString() };
}

export async function setClientTimeBudget(formData: FormData): Promise<void> {
  const actor = await requireManager();
  const clientAccountId = String(formData.get("clientAccountId") || "");
  const periodStart = new Date(`${String(formData.get("periodStart") || "")}T00:00:00.000Z`);
  const periodEnd = new Date(`${String(formData.get("periodEnd") || "")}T23:59:59.999Z`);
  const hours = Number(formData.get("hours"));
  if (!clientAccountId || Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodEnd <= periodStart || !Number.isFinite(hours) || hours < 0 || hours > 10000) return;
  await db.insert(clientTimeBudgets).values({ clientAccountId, periodStart, periodEnd, allocatedSeconds: Math.round(hours * 3600), createdByUserId: actor.id, updatedAt: new Date() }).onConflictDoUpdate({ target: [clientTimeBudgets.clientAccountId, clientTimeBudgets.periodStart], set: { periodEnd, allocatedSeconds: Math.round(hours * 3600), updatedAt: new Date() } });
  await auditLog({ actorUserId: actor.id, action: "time.budget_updated", entityType: "client_account", entityId: clientAccountId, clientAccountId, metadata: { periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString(), hours } });
  revalidatePath("/agency/time");
  revalidatePath("/agency/clients");
}

export async function setClientServiceAllocations(formData: FormData): Promise<void> {
  const actor = await requireManager();
  const clientAccountId = String(formData.get("clientAccountId") || "");
  const periodStart = new Date(`${String(formData.get("periodStart") || "")}T00:00:00.000Z`);
  const periodEnd = new Date(`${String(formData.get("periodEnd") || "")}T23:59:59.999Z`);
  if (!clientAccountId || Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodEnd <= periodStart) return;
  for (const service of SERVICE_ALLOCATIONS) {
    const hours = Number(formData.get(`hours_${service.key}`) || 0);
    const quantity = Number(formData.get(`quantity_${service.key}`) || 0);
    const allocatedSeconds = service.kind === "hours" && Number.isFinite(hours) ? Math.round(Math.max(0, hours) * 3600) : 0;
    const allocatedQuantity = service.kind === "quantity" && Number.isFinite(quantity) ? Math.round(Math.max(0, quantity)) : 0;
    await db.insert(clientServiceAllocations).values({ clientAccountId, periodStart, periodEnd, serviceType: service.key, allocatedSeconds, allocatedQuantity, createdByUserId: actor.id, updatedAt: new Date() }).onConflictDoUpdate({ target: [clientServiceAllocations.clientAccountId, clientServiceAllocations.periodStart, clientServiceAllocations.serviceType], set: { periodEnd, allocatedSeconds, allocatedQuantity, updatedAt: new Date() } });
  }
  await auditLog({ actorUserId: actor.id, action: "time.service_allocations_updated", entityType: "client_account", entityId: clientAccountId, clientAccountId, metadata: { periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString() } });
  revalidatePath("/agency/time");
  revalidatePath("/portal/time");
}

export async function deleteClientTimeBudget(formData: FormData): Promise<void> {
  const actor = await requireManager();
  const budgetId = String(formData.get("budgetId") || "");
  if (!budgetId) return;
  await db.delete(clientTimeBudgets).where(eq(clientTimeBudgets.id, budgetId));
  await auditLog({ actorUserId: actor.id, action: "time.budget_deleted", entityType: "client_time_budget", entityId: budgetId });
  revalidatePath("/agency/time");
}
