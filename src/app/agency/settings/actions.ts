"use server";

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { clientAccounts, users } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { requireAgencyPermission } from "@/lib/permissions";
import { auditLog } from "@/lib/audit";
import { verifiedUpload, consumeUpload } from "@/lib/upload-server";

const teammateSchema = z.object({ name: z.string().trim().min(2), email: z.string().trim().email(), password: z.string().min(8), role: z.enum(["admin", "account_manager", "content_writer"]) });
const tabs = ["dashboard", "projects", "approvals", "designs", "support"] as const;

export async function createTeammate(formData: FormData): Promise<void> {
  const actor = await requireAgencyPermission("create_users");
  const parsed = teammateSchema.safeParse({ name: formData.get("name"), email: formData.get("email"), password: formData.get("password"), role: formData.get("role") || "account_manager" });
  if (!parsed.success) return;
  // Only true admins can mint another admin; a manage_users grant alone must not allow that escalation.
  if (parsed.data.role === "admin" && actor.role !== "admin") throw new Error("Only an administrator can create another admin.");
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
  if (!userId) return { error: "Missing user." };
  if (actor.role !== "admin" && actor.id !== userId) return { error: "You can only change your own photo." };
  try {
    const blob = await verifiedUpload(formData, actor.id, "avatar", userId);
    await consumeUpload(blob.pathname);
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
  const actor = await requireAgencyPermission("edit_user_access");
  const userId = String(formData.get("userId") || "");
  const role = String(formData.get("role") || "account_manager");
  const allowed = tabs.filter((tab) => formData.get(`tab-${tab}`) === "on");
  if (!userId || !["admin", "account_manager", "content_writer"].includes(role)) return;
  if (userId === actor.id && role !== "admin") throw new Error("You cannot remove your own administrator access.");
  const target = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!target || target.role === "client") throw new Error("Internal user not found.");
  // Only true admins can grant/keep the admin base role; a manage_users grant alone must not allow that escalation.
  if ((role === "admin" || target.role === "admin") && actor.role !== "admin") throw new Error("Only an administrator can change admin access.");
  await db.update(users).set({ role: role as "admin" | "account_manager" | "content_writer" | "client", permissions: { tabs: allowed } }).where(eq(users.id, userId));
  await auditLog({ actorUserId: actor.id, action: "user.access_updated", entityType: "user", entityId: userId, metadata: { role, tabs: allowed } });
  revalidatePath("/agency/settings");
}

export async function removeTeammate(formData: FormData): Promise<void> {
  const actor = await requireAgencyPermission("remove_users");
  const userId = String(formData.get("userId") || "");
  if (!userId || userId === actor.id) return;
  const target = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!target || target.role === "client") return;
  if (target.role === "admin" && actor.role !== "admin") throw new Error("Only an administrator can remove another admin.");
  await db.update(users).set({ status: "disabled" }).where(eq(users.id, userId));
  await auditLog({ actorUserId: actor.id, action: "teammate.removed", entityType: "user", entityId: userId, metadata: { email: target.email, role: target.role } });
  revalidatePath("/agency/settings");
}

export async function updateClientTabs(formData: FormData): Promise<void> {
  const actor = await requireAgencyPermission("manage_client_users");
  const clientAccountId = String(formData.get("clientAccountId") || "");
  const visibleTabs = tabs.filter((tab) => formData.get(`client-tab-${tab}`) === "on");
  if (!clientAccountId) return;
  await db.update(clientAccounts).set({ visibleTabs }).where(eq(clientAccounts.id, clientAccountId));
  await auditLog({ actorUserId: actor.id, action: "client.portal_tabs_updated", entityType: "client_account", entityId: clientAccountId, clientAccountId, metadata: { visibleTabs } });
  revalidatePath("/agency/settings");
}

export async function createClientUser(formData: FormData): Promise<void> {
  const actor = await requireAgencyPermission("manage_client_users");
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
  const actor = await requireAgencyPermission("manage_client_users");
  const userId = String(formData.get("userId") || "");
  const clientAccountId = String(formData.get("clientAccountId") || "");
  const clientRole = String(formData.get("clientRole") || "").trim();
  const status = String(formData.get("status") || "active");
  if (!userId || !clientAccountId || !clientRole || !["active", "disabled"].includes(status)) return;
  await db.update(users).set({ clientRole, status: status as "active" | "disabled" }).where(and(eq(users.id, userId), eq(users.clientAccountId, clientAccountId), eq(users.role, "client")));
  await auditLog({ actorUserId: actor.id, action: "client_user.updated", entityType: "user", entityId: userId, clientAccountId, metadata: { clientRole, status } });
  revalidatePath("/agency/settings");
}

export async function removeClientUser(formData: FormData): Promise<void> {
  const actor = await requireAgencyPermission("manage_client_users");
  const userId = String(formData.get("userId") || "");
  const clientAccountId = String(formData.get("clientAccountId") || "");
  if (!userId || !clientAccountId) return;
  await db.update(users).set({ status: "disabled" }).where(and(eq(users.id, userId), eq(users.clientAccountId, clientAccountId), eq(users.role, "client")));
  await auditLog({ actorUserId: actor.id, action: "client_user.removed", entityType: "user", entityId: userId, clientAccountId });
  revalidatePath("/agency/settings");
}

export async function removeClientAccount(formData: FormData): Promise<void> {
  const actor = await requireAgencyPermission("manage_client_users");
  const clientAccountId = String(formData.get("clientAccountId") || "");
  if (!clientAccountId) return;
  await db.update(clientAccounts).set({ status: "paused" }).where(eq(clientAccounts.id, clientAccountId));
  await db.update(users).set({ status: "disabled" }).where(and(eq(users.clientAccountId, clientAccountId), eq(users.role, "client")));
  await auditLog({ actorUserId: actor.id, action: "client_account.archived", entityType: "client_account", entityId: clientAccountId, clientAccountId });
  revalidatePath("/agency/settings");
  revalidatePath("/agency/clients");
}
