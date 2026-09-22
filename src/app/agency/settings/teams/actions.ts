"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { teamMembers, teams } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/audit";

const teamSchema = z.object({ name: z.string().trim().min(2), description: z.string().trim().optional(), clientAccountId: z.string().optional() });

export async function createTeam(formData: FormData): Promise<void> {
  const actor = await requireAgencyUser();
  await requirePermission(actor, "manage_teams");
  const parsed = teamSchema.safeParse({ name: formData.get("name"), description: formData.get("description") || undefined, clientAccountId: formData.get("clientAccountId") || undefined });
  if (!parsed.success) return;
  const [team] = await db.insert(teams).values({ name: parsed.data.name, description: parsed.data.description, clientAccountId: parsed.data.clientAccountId || null, createdByUserId: actor.id }).returning({ id: teams.id });
  await auditLog({ actorUserId: actor.id, action: "team.created", entityType: "team", entityId: team.id, clientAccountId: parsed.data.clientAccountId || null, metadata: { name: parsed.data.name } });
  revalidatePath("/agency/settings/teams");
}

export async function setTeamArchived(formData: FormData): Promise<void> {
  const actor = await requireAgencyUser();
  await requirePermission(actor, "manage_teams");
  const teamId = String(formData.get("teamId") || "");
  const archived = formData.get("archived") === "true";
  if (!teamId) return;
  await db.update(teams).set({ archived }).where(eq(teams.id, teamId));
  await auditLog({ actorUserId: actor.id, action: archived ? "team.archived" : "team.restored", entityType: "team", entityId: teamId });
  revalidatePath("/agency/settings/teams");
}

export async function addTeamMember(formData: FormData): Promise<void> {
  const actor = await requireAgencyUser();
  await requirePermission(actor, "manage_teams");
  const teamId = String(formData.get("teamId") || "");
  const userId = String(formData.get("userId") || "");
  if (!teamId || !userId) return;
  await db.insert(teamMembers).values({ teamId, userId }).onConflictDoNothing();
  await auditLog({ actorUserId: actor.id, action: "team.member_added", entityType: "team", entityId: teamId, metadata: { userId } });
  revalidatePath("/agency/settings/teams");
}

export async function removeTeamMember(formData: FormData): Promise<void> {
  const actor = await requireAgencyUser();
  await requirePermission(actor, "manage_teams");
  const teamId = String(formData.get("teamId") || "");
  const userId = String(formData.get("userId") || "");
  if (!teamId || !userId) return;
  await db.delete(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
  await auditLog({ actorUserId: actor.id, action: "team.member_removed", entityType: "team", entityId: teamId, metadata: { userId } });
  revalidatePath("/agency/settings/teams");
}
