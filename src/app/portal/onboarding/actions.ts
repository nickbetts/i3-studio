"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { clientAccounts, onboardingSubmissions } from "@/db/schema";
import { requireClientUser } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";
import { getFlowSteps } from "@/lib/onboarding-flow-server";
import { CURRENT_TERMS_VERSION } from "@/lib/onboarding-flow";

export type OnboardingActionState = { error?: string; ok?: boolean };

// Flows are admin-defined and dynamic, so field values are stored generically rather
// than against a fixed schema; only string/boolean values are kept, and trimmed/capped.
function sanitize(data: Record<string, unknown>): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "boolean") result[key] = value;
    else if (value !== undefined && value !== null) result[key] = String(value).trim().slice(0, 5000);
  }
  return result;
}

export async function saveOnboardingStep(
  flowId: string,
  data: Record<string, unknown>,
  currentStep: number,
): Promise<OnboardingActionState> {
  const user = await requireClientUser();
  const sanitized = sanitize(data);

  await db
    .insert(onboardingSubmissions)
    .values({
      clientAccountId: user.clientAccountId,
      onboardingFlowId: flowId || null,
      data: sanitized,
      currentStep,
    })
    .onConflictDoUpdate({
      target: onboardingSubmissions.clientAccountId,
      set: {
        // Merge new values over existing JSON so partial saves accumulate.
        data: sql`${onboardingSubmissions.data} || ${JSON.stringify(sanitized)}::jsonb`,
        onboardingFlowId: flowId || null,
        currentStep,
        updatedAt: new Date(),
      },
    });

  return { ok: true };
}

export async function completeOnboarding(flowId: string, data: Record<string, unknown>): Promise<OnboardingActionState> {
  const user = await requireClientUser();
  const sanitized = sanitize(data);
  const steps = await getFlowSteps(flowId);
  const requiredFields = steps.flatMap((step) => step.fields).filter((field) => field.required);
  const missing = requiredFields.filter((field) => (field.type === "checkbox" ? sanitized[field.key] !== true : !String(sanitized[field.key] ?? "").trim()));
  if (missing.length > 0) return { error: "Please complete all required fields before submitting." };

  const now = new Date();
  // Bind the accepted terms checkbox to the policy version shown at submission time, for an auditable consent trail.
  const acceptedTerms = sanitized.acceptedTerms === true;
  const termsVersion = acceptedTerms ? CURRENT_TERMS_VERSION : null;
  const termsAcceptedAt = acceptedTerms ? now : null;

  await db
    .insert(onboardingSubmissions)
    .values({
      clientAccountId: user.clientAccountId,
      onboardingFlowId: flowId || null,
      data: sanitized,
      currentStep: Math.max(steps.length - 1, 0),
      completedAt: now,
      termsVersion,
      termsAcceptedAt,
    })
    .onConflictDoUpdate({
      target: onboardingSubmissions.clientAccountId,
      set: { data: sanitized, onboardingFlowId: flowId || null, completedAt: now, updatedAt: now, termsVersion, termsAcceptedAt },
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

