"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { accountManagerAssignments, clientAccounts, onboardingSubmissions, users } from "@/db/schema";
import { requireManager } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";

const clientSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  password: z.string().min(8),
  managerId: z.string().optional(),
  clientTypeId: z.string().optional(),
});

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function createClient(formData: FormData): Promise<void> {
  const actor = await requireManager();
  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    managerId: formData.get("managerId") || undefined,
    clientTypeId: formData.get("clientTypeId") || undefined,
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
    clientTypeId: parsed.data.clientTypeId || null,
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

export async function resetClientOnboarding(formData: FormData): Promise<void> {
  const actor = await requireManager();
  const clientAccountId = String(formData.get("clientAccountId") || "");
  if (!clientAccountId) return;
  await db.delete(onboardingSubmissions).where(eq(onboardingSubmissions.clientAccountId, clientAccountId));
  await db.update(clientAccounts).set({ status: "onboarding", onboardingCompletedAt: null }).where(eq(clientAccounts.id, clientAccountId));
  await auditLog({ actorUserId: actor.id, action: "client.onboarding_reset", entityType: "client_account", entityId: clientAccountId, clientAccountId });
  revalidatePath("/agency/clients");
  revalidatePath(`/agency/clients/${clientAccountId}`);
  revalidatePath("/portal");
  revalidatePath("/portal/onboarding");
}

export async function addAccountManager(formData: FormData): Promise<void> {
  const actor = await requireManager();
  const clientAccountId = String(formData.get("clientAccountId") || "");
  const userId = String(formData.get("userId") || "");
  if (!clientAccountId || !userId) return;
  await db.insert(accountManagerAssignments).values({ clientAccountId, userId }).onConflictDoNothing();
  await auditLog({ actorUserId: actor.id, action: "client.am_assigned", entityType: "client_account", entityId: clientAccountId, clientAccountId, metadata: { userId } });
  revalidatePath(`/agency/clients/${clientAccountId}`);
}

export async function removeAccountManager(formData: FormData): Promise<void> {
  const actor = await requireManager();
  const assignmentId = String(formData.get("assignmentId") || "");
  const clientAccountId = String(formData.get("clientAccountId") || "");
  if (!assignmentId) return;
  await db.delete(accountManagerAssignments).where(eq(accountManagerAssignments.id, assignmentId));
  await auditLog({ actorUserId: actor.id, action: "client.am_removed", entityType: "client_account", entityId: clientAccountId, clientAccountId });
  revalidatePath(`/agency/clients/${clientAccountId}`);
}

const clientDetailsStatuses = ["prospect", "onboarding", "active", "paused"] as const;

export async function updateClientDetails(formData: FormData): Promise<void> {
  const actor = await requireManager();
  const clientAccountId = String(formData.get("clientAccountId") || "");
  if (!clientAccountId) return;
  const statusInput = String(formData.get("status") || "");
  const status = (clientDetailsStatuses as readonly string[]).includes(statusInput) ? (statusInput as (typeof clientDetailsStatuses)[number]) : undefined;
  const clientTypeId = String(formData.get("clientTypeId") || "") || null;
  await db.update(clientAccounts).set({ ...(status ? { status } : {}), clientTypeId }).where(eq(clientAccounts.id, clientAccountId));
  await auditLog({ actorUserId: actor.id, action: "client.updated", entityType: "client_account", entityId: clientAccountId, clientAccountId, metadata: { status, clientTypeId } });
  revalidatePath(`/agency/clients/${clientAccountId}`);
  revalidatePath("/agency/clients");
}
