"use server";

import bcrypt from "bcryptjs";
import { put } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { clientAccounts, users } from "@/db/schema";
import { requireAdmin, requireAgencyUser } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";

const teammateSchema = z.object({ name: z.string().trim().min(2), email: z.string().trim().email(), password: z.string().min(8), role: z.enum(["admin", "account_manager"]) });
const tabs = ["dashboard", "projects", "approvals", "designs", "support"] as const;

export async function createTeammate(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const parsed = teammateSchema.safeParse({ name: formData.get("name"), email: formData.get("email"), password: formData.get("password"), role: formData.get("role") || "account_manager" });
  if (!parsed.success) return;
  const email = parsed.data.email.toLowerCase();
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) return;
  await db.insert(users).values({ name: parsed.data.name, email, passwordHash: await bcrypt.hash(parsed.data.password, 10), role: parsed.data.role, status: "active" });
  await auditLog({ actorUserId: actor.id, action: "teammate.created", entityType: "user", metadata: { email, role: parsed.data.role } });
  revalidatePath("/agency/settings");
}

export type AvatarState = { error?: string; success?: string };

export async function updateUserAvatar(_prev: AvatarState, formData: FormData): Promise<AvatarState> {
  const actor = await requireAgencyUser();
  const userId = String(formData.get("userId") || "");
  const file = formData.get("file");
  if (!userId) return { error: "Missing user." };
  if (actor.role !== "admin" && actor.id !== userId) return { error: "You can only change your own photo." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image." };
  if (!file.type.startsWith("image/")) return { error: "Only image files are supported." };
  if (file.size > 5 * 1024 * 1024) return { error: "Image must be under 5MB." };
  try {
    const blob = await put(`avatars/${userId}-${Date.now()}-${file.name}`, file, { access: "public", addRandomSuffix: false });
    await db.update(users).set({ image: blob.url }).where(eq(users.id, userId));
    await auditLog({ actorUserId: actor.id, action: "user.avatar_updated", entityType: "user", entityId: userId });
    revalidatePath("/agency/settings");
    revalidatePath("/agency/calendar");
    return { success: "Photo updated." };
  } catch (error) {
    console.error("updateUserAvatar failed", error);
    return { error: "Upload failed. Please try again." };
  }
}

export async function updateUserAccess(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const userId = String(formData.get("userId") || "");
  const role = String(formData.get("role") || "account_manager");
  const allowed = tabs.filter((tab) => formData.get(`tab-${tab}`) === "on");
  if (!userId || !["admin", "account_manager", "client"].includes(role)) return;
  await db.update(users).set({ role: role as "admin" | "account_manager" | "client", permissions: { tabs: allowed } }).where(eq(users.id, userId));
  await auditLog({ actorUserId: actor.id, action: "user.access_updated", entityType: "user", entityId: userId, metadata: { role, tabs: allowed } });
  revalidatePath("/agency/settings");
}

export async function updateClientTabs(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const clientAccountId = String(formData.get("clientAccountId") || "");
  const visibleTabs = tabs.filter((tab) => formData.get(`client-tab-${tab}`) === "on");
  if (!clientAccountId) return;
  await db.update(clientAccounts).set({ visibleTabs }).where(eq(clientAccounts.id, clientAccountId));
  await auditLog({ actorUserId: actor.id, action: "client.portal_tabs_updated", entityType: "client_account", entityId: clientAccountId, clientAccountId, metadata: { visibleTabs } });
  revalidatePath("/agency/settings");
}

export async function createClientUser(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const clientAccountId = String(formData.get("clientAccountId") || "");
  const parsed = z.object({ name: z.string().trim().min(2), email: z.string().trim().email(), password: z.string().min(8), clientRole: z.string().trim().min(2) }).safeParse({ name: formData.get("name"), email: formData.get("email"), password: formData.get("password"), clientRole: formData.get("clientRole") });
  if (!clientAccountId || !parsed.success) return;
  const existing = await db.query.users.findFirst({ where: eq(users.email, parsed.data.email.toLowerCase()) });
  if (existing) return;
  await db.insert(users).values({ name: parsed.data.name, email: parsed.data.email.toLowerCase(), passwordHash: await bcrypt.hash(parsed.data.password, 10), role: "client", status: "active", clientAccountId, clientRole: parsed.data.clientRole });
  await auditLog({ actorUserId: actor.id, action: "client_user.created", entityType: "user", clientAccountId, metadata: { email: parsed.data.email.toLowerCase(), clientRole: parsed.data.clientRole } });
  revalidatePath("/agency/settings");
}

export async function updateClientUser(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const userId = String(formData.get("userId") || "");
  const clientAccountId = String(formData.get("clientAccountId") || "");
  const clientRole = String(formData.get("clientRole") || "").trim();
  const status = String(formData.get("status") || "active");
  if (!userId || !clientAccountId || !clientRole || !["active", "disabled"].includes(status)) return;
  await db.update(users).set({ clientRole, status: status as "active" | "disabled" }).where(eq(users.id, userId));
  await auditLog({ actorUserId: actor.id, action: "client_user.updated", entityType: "user", entityId: userId, clientAccountId, metadata: { clientRole, status } });
  revalidatePath("/agency/settings");
}

export async function removeClientUser(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const userId = String(formData.get("userId") || "");
  const clientAccountId = String(formData.get("clientAccountId") || "");
  if (!userId || !clientAccountId) return;
  await db.delete(users).where(eq(users.id, userId));
  await auditLog({ actorUserId: actor.id, action: "client_user.removed", entityType: "user", entityId: userId, clientAccountId });
  revalidatePath("/agency/settings");
}

export async function removeClientAccount(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const clientAccountId = String(formData.get("clientAccountId") || "");
  if (!clientAccountId) return;
  await db.delete(clientAccounts).where(eq(clientAccounts.id, clientAccountId));
  await auditLog({ actorUserId: actor.id, action: "client_account.removed", entityType: "client_account", entityId: clientAccountId, clientAccountId });
  revalidatePath("/agency/settings");
  revalidatePath("/agency/clients");
}
