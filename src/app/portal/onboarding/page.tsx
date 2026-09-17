import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { clientAccounts, onboardingSubmissions } from "@/db/schema";
import { requireClientUser } from "@/lib/auth-helpers";
import { resolveOnboardingFlow } from "@/lib/onboarding-flow-server";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  const user = await requireClientUser();

  const account = await db.query.clientAccounts.findFirst({
    where: eq(clientAccounts.id, user.clientAccountId),
  });
  if (account?.onboardingCompletedAt) redirect("/portal");

  const submission = await db.query.onboardingSubmissions.findFirst({
    where: eq(onboardingSubmissions.clientAccountId, user.clientAccountId),
  });
  const flow = await resolveOnboardingFlow(user.clientAccountId);

  const initialData = (submission?.data ?? {}) as Record<string, unknown>;
  const initialStep = submission?.currentStep ?? 0;

  return (
    <div className="flex flex-1 items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-2xl space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Welcome to i3 Studio</h1>
          <p className="text-muted-foreground">
            Let&apos;s get {account?.name ? account.name : "your account"} set up. This takes a few minutes.
          </p>
        </div>
        <div className="flex justify-center">
          <OnboardingWizard flowId={flow.id} steps={flow.steps} initialData={initialData} initialStep={initialStep} />
        </div>
      </div>
    </div>
  );
}

