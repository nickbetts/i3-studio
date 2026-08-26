"use server";

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { accountManagerAssignments, clientAccounts, tasks, users } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";

const clientSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  password: z.string().min(8),
  managerId: z.string().optional(),
});

const taskSchema = z.object({
  clientAccountId: z.string().min(1),
  title: z.string().trim().min(2),
  description: z.string().trim().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  dueDate: z.string().optional(),
});

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function createClient(formData: FormData): Promise<void> {
  const actor = await requireAgencyUser();
  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    managerId: formData.get("managerId") || undefined,
  });
  if (!parsed.success) return;

  const email = parsed.data.email.toLowerCase();
  const existingUser = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existingUser) return;

  const organization = await db.query.organizations.findFirst();
  if (!organization) return;

  const baseSlug = slugify(parsed.data.name) || `client-${Date.now()}`;
  const [account] = await db.insert(clientAccounts).values({
    organizationId: organization.id,
    name: parsed.data.name,
    slug: `${baseSlug}-${Date.now().toString(36)}`,
    status: "onboarding",
  }).returning({ id: clientAccounts.id });

  await db.insert(users).values({
    email,
    name: parsed.data.name,
    passwordHash: await bcrypt.hash(parsed.data.password, 10),
    role: "client",
    status: "active",
    clientAccountId: account.id,
  });

  const managerId = actor.role === "account_manager" ? actor.id : parsed.data.managerId;
  if (managerId) await db.insert(accountManagerAssignments).values({ clientAccountId: account.id, userId: managerId });

  await auditLog({ actorUserId: actor.id, action: "client.created", entityType: "client_account", entityId: account.id });
  revalidatePath("/agency/clients");
}

export async function createTask(formData: FormData): Promise<void> {
  const actor = await requireAgencyUser();
  const parsed = taskSchema.safeParse({
    clientAccountId: formData.get("clientAccountId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    priority: formData.get("priority") || "medium",
    dueDate: formData.get("dueDate") || undefined,
  });
  if (!parsed.success) return;

  const [task] = await db.insert(tasks).values({
    clientAccountId: parsed.data.clientAccountId,
    title: parsed.data.title,
    description: parsed.data.description,
    priority: parsed.data.priority,
    dueDate: parsed.data.dueDate ? new Date(`${parsed.data.dueDate}T12:00:00`) : null,
    createdByUserId: actor.id,
  }).returning({ id: tasks.id });

  await auditLog({ actorUserId: actor.id, action: "task.created", entityType: "task", entityId: task.id, clientAccountId: parsed.data.clientAccountId });
  revalidatePath("/agency/clients");
  revalidatePath("/portal");
}

export async function updateTaskStatus(taskId: string, status: "open" | "in_progress" | "blocked" | "done"): Promise<void> {
  const actor = await requireAgencyUser();
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!task) return;
  await db.update(tasks).set({ status, updatedAt: new Date() }).where(and(eq(tasks.id, taskId), eq(tasks.clientAccountId, task.clientAccountId)));
  await auditLog({ actorUserId: actor.id, action: "task.status_updated", entityType: "task", entityId: taskId, clientAccountId: task.clientAccountId, metadata: { status } });
  revalidatePath("/agency/clients");
  revalidatePath("/portal");
}
