"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { clientAccounts, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";
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
