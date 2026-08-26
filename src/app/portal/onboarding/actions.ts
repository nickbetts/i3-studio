"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { clientAccounts, onboardingSubmissions } from "@/db/schema";
import { requireClientUser } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";
import { onboardingSchema, requiredForCompletion } from "@/lib/onboarding";

export type OnboardingActionState = { error?: string; ok?: boolean };

export async function saveOnboardingStep(
  data: Record<string, unknown>,
  currentStep: number,
): Promise<OnboardingActionState> {
  const user = await requireClientUser();
  const parsed = onboardingSchema.partial().safeParse(data);
  if (!parsed.success) return { error: "Some fields are invalid." };

  await db
    .insert(onboardingSubmissions)
    .values({
      clientAccountId: user.clientAccountId,
      data: parsed.data,
      currentStep,
    })
    .onConflictDoUpdate({
      target: onboardingSubmissions.clientAccountId,
      set: {
        // Merge new values over existing JSON so partial saves accumulate.
        data: sql`${onboardingSubmissions.data} || ${JSON.stringify(parsed.data)}::jsonb`,
        currentStep,
        updatedAt: new Date(),
      },
    });

  return { ok: true };
}

export async function completeOnboarding(data: Record<string, unknown>): Promise<OnboardingActionState> {
  const user = await requireClientUser();
  const parsed = onboardingSchema.safeParse(data);
  if (!parsed.success) return { error: "Please review the form and try again." };

  const missing = requiredForCompletion.filter((f) => !String(parsed.data[f] ?? "").trim());
  if (missing.length > 0) return { error: "Please complete all required fields before submitting." };
  if (!parsed.data.acceptedTerms) return { error: "You must confirm the information is accurate." };

  const now = new Date();

  await db
    .insert(onboardingSubmissions)
    .values({
      clientAccountId: user.clientAccountId,
      data: parsed.data,
      currentStep: 5,
      completedAt: now,
    })
    .onConflictDoUpdate({
      target: onboardingSubmissions.clientAccountId,
      set: { data: parsed.data, completedAt: now, updatedAt: now },
    });

  await db
    .update(clientAccounts)
    .set({ onboardingCompletedAt: now, status: "active" })
    .where(eq(clientAccounts.id, user.clientAccountId));

  await auditLog({
    actorUserId: user.id,
    action: "onboarding.completed",
    entityType: "client_account",
    entityId: user.clientAccountId,
    clientAccountId: user.clientAccountId,
  });

  revalidatePath("/portal");
  return { ok: true };
}
