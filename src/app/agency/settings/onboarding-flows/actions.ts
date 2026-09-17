"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { onboardingFlows } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";
import type { OnboardingFlowStep } from "@/lib/onboarding-flow";

export async function createOnboardingFlow(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return;
  const clientTypeId = String(formData.get("clientTypeId") ?? "") || null;
  const [row] = await db.insert(onboardingFlows).values({ name, clientTypeId, createdByUserId: actor.id }).onConflictDoNothing({ target: onboardingFlows.name }).returning({ id: onboardingFlows.id });
  if (!row) return;
  await auditLog({ actorUserId: actor.id, action: "onboarding_flow.created", entityType: "onboarding_flow", entityId: row.id, metadata: { name } });
  revalidatePath("/agency/settings/onboarding-flows");
}

export async function saveOnboardingFlow(flowId: string, name: string, clientTypeId: string | null, steps: OnboardingFlowStep[]): Promise<void> {
  const actor = await requireAdmin();
  if (!flowId || name.trim().length < 2) return;
  await db.update(onboardingFlows).set({ name: name.trim(), clientTypeId, steps, updatedAt: new Date() }).where(eq(onboardingFlows.id, flowId));
  await auditLog({ actorUserId: actor.id, action: "onboarding_flow.updated", entityType: "onboarding_flow", entityId: flowId, metadata: { stepCount: steps.length } });
  revalidatePath("/agency/settings/onboarding-flows");
}

export async function archiveOnboardingFlow(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const flowId = String(formData.get("flowId") ?? "");
  if (!flowId) return;
  await db.update(onboardingFlows).set({ archived: true }).where(eq(onboardingFlows.id, flowId));
  await auditLog({ actorUserId: actor.id, action: "onboarding_flow.archived", entityType: "onboarding_flow", entityId: flowId });
  revalidatePath("/agency/settings/onboarding-flows");
}

export async function duplicateOnboardingFlow(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const flowId = String(formData.get("flowId") ?? "");
  const original = await db.query.onboardingFlows.findFirst({ where: eq(onboardingFlows.id, flowId) });
  if (!original) return;
  let name = `${original.name} (copy)`;
  for (let attempt = 2; await db.query.onboardingFlows.findFirst({ where: eq(onboardingFlows.name, name) }); attempt++) name = `${original.name} (copy ${attempt})`;
  const [row] = await db.insert(onboardingFlows).values({ name, clientTypeId: original.clientTypeId, steps: original.steps, createdByUserId: actor.id }).returning({ id: onboardingFlows.id });
  await auditLog({ actorUserId: actor.id, action: "onboarding_flow.duplicated", entityType: "onboarding_flow", entityId: row.id, metadata: { sourceId: flowId } });
  revalidatePath("/agency/settings/onboarding-flows");
}
