import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { clientAccounts, onboardingFlows, onboardingSubmissions } from "@/db/schema";
import type { OnboardingFlowStep } from "./onboarding-flow";

type ResolvedFlow = { id: string; steps: OnboardingFlowStep[] };

// Resolution order: the flow already locked in for this client's submission, then the
// flow matching their client type, then the default (clientTypeId null) fallback flow.
export async function resolveOnboardingFlow(clientAccountId: string): Promise<ResolvedFlow> {
  const submission = await db.query.onboardingSubmissions.findFirst({ where: eq(onboardingSubmissions.clientAccountId, clientAccountId) });
  if (submission?.onboardingFlowId) {
    const flow = await db.query.onboardingFlows.findFirst({ where: eq(onboardingFlows.id, submission.onboardingFlowId) });
    if (flow) return { id: flow.id, steps: (flow.steps as OnboardingFlowStep[]) ?? [] };
  }
  const client = await db.query.clientAccounts.findFirst({ where: eq(clientAccounts.id, clientAccountId) });
  if (client?.clientTypeId) {
    const typed = await db.query.onboardingFlows.findFirst({ where: and(eq(onboardingFlows.clientTypeId, client.clientTypeId), eq(onboardingFlows.archived, false)) });
    if (typed) return { id: typed.id, steps: (typed.steps as OnboardingFlowStep[]) ?? [] };
  }
  const fallback = await db.query.onboardingFlows.findFirst({ where: and(isNull(onboardingFlows.clientTypeId), eq(onboardingFlows.archived, false)) });
  return fallback ? { id: fallback.id, steps: (fallback.steps as OnboardingFlowStep[]) ?? [] } : { id: "", steps: [] };
}

export async function getFlowSteps(flowId: string): Promise<OnboardingFlowStep[]> {
  if (!flowId) return [];
  const flow = await db.query.onboardingFlows.findFirst({ where: eq(onboardingFlows.id, flowId) });
  return (flow?.steps as OnboardingFlowStep[]) ?? [];
}
