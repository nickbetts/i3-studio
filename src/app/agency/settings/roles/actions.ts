"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { customRoles, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";
import { PERMISSION_KEYS } from "@/lib/permissions";
import { auditLog } from "@/lib/audit";

// Custom role management is admin-only: it defines the ceiling of what any staff member can do.
const roleSchema = z.object({ name: z.string().trim().min(2), description: z.string().trim().optional() });

function permissionsFromForm(formData: FormData) {
  return PERMISSION_KEYS.filter((key) => formData.get(`perm-${key}`) === "on");
}

export async function createCustomRole(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const parsed = roleSchema.safeParse({ name: formData.get("name"), description: formData.get("description") || undefined });
  if (!parsed.success) return;
  const permissions = permissionsFromForm(formData);
  const [role] = await db.insert(customRoles).values({ name: parsed.data.name, description: parsed.data.description, permissions, createdByUserId: actor.id }).returning({ id: customRoles.id });
  await auditLog({ actorUserId: actor.id, action: "custom_role.created", entityType: "custom_role", entityId: role.id, metadata: { name: parsed.data.name, permissions } });
  revalidatePath("/agency/settings/roles");
}

export async function updateCustomRole(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const roleId = String(formData.get("roleId") || "");
  if (!roleId) return;
  const permissions = permissionsFromForm(formData);
  await db.update(customRoles).set({ permissions, updatedAt: new Date() }).where(eq(customRoles.id, roleId));
  await auditLog({ actorUserId: actor.id, action: "custom_role.updated", entityType: "custom_role", entityId: roleId, metadata: { permissions } });
  revalidatePath("/agency/settings/roles");
}

export async function deleteCustomRole(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const roleId = String(formData.get("roleId") || "");
  if (!roleId) return;
  await db.update(users).set({ customRoleId: null }).where(eq(users.customRoleId, roleId));
  await db.delete(customRoles).where(eq(customRoles.id, roleId));
  await auditLog({ actorUserId: actor.id, action: "custom_role.deleted", entityType: "custom_role", entityId: roleId });
  revalidatePath("/agency/settings/roles");
  revalidatePath("/agency/settings");
}

export async function assignCustomRole(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const userId = String(formData.get("userId") || "");
  const roleId = String(formData.get("customRoleId") || "") || null;
  if (!userId) return;
  await db.update(users).set({ customRoleId: roleId }).where(eq(users.id, userId));
  await auditLog({ actorUserId: actor.id, action: "user.custom_role_assigned", entityType: "user", entityId: userId, metadata: { roleId } });
  revalidatePath("/agency/settings/roles");
  revalidatePath("/agency/settings");
}
