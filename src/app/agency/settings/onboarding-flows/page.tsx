import { asc, eq } from "drizzle-orm";
import { ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { CreatePanel } from "@/components/create-panel";
import { EmptyState } from "@/components/empty-state";
import { ConfirmButton } from "@/components/confirm-button";
import { db } from "@/db";
import { clientTypes, onboardingFlows } from "@/db/schema";
import { requireAgencyPermission } from "@/lib/permissions";
import type { OnboardingFlowStep } from "@/lib/onboarding-flow";
import { archiveOnboardingFlow, createOnboardingFlow, duplicateOnboardingFlow } from "./actions";
import { OnboardingFlowEditor } from "./onboarding-flow-editor";

export default async function OnboardingFlowsPage() {
  await requireAgencyPermission("manage_settings");
  const [flows, types] = await Promise.all([
    db.query.onboardingFlows.findMany({ where: eq(onboardingFlows.archived, false), orderBy: asc(onboardingFlows.name) }),
    db.query.clientTypes.findMany({ where: eq(clientTypes.archived, false), orderBy: asc(clientTypes.label) }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Onboarding flows" description="Build the questions clients answer during onboarding, per client type." breadcrumbs={[{ label: "Settings", href: "/agency/settings" }, { label: "Onboarding flows" }]} />

      <CreatePanel title="New onboarding flow"><Card>
        <CardHeader>
          <CardTitle className="text-base">New onboarding flow</CardTitle>
          <CardDescription>Starts empty; add steps and questions below after creating it.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createOnboardingFlow} className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="of-name">Name</Label>
              <Input id="of-name" name="name" placeholder="e.g. Charity onboarding" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="of-client-type">Client type</Label>
              <Select name="clientTypeId" defaultValue="">
                <SelectTrigger id="of-client-type"><SelectValue placeholder="Default flow" /></SelectTrigger>
                <SelectContent>
                  {types.map((type) => <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end"><Button type="submit">Create flow</Button></div>
          </form>
        </CardContent>
      </Card></CreatePanel>

      {flows.length === 0 ? (
        <EmptyState icon={ListChecks} title="No onboarding flows yet" description="Create your first flow above." />
      ) : (
        flows.map((flow) => (
          <Card key={flow.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">{flow.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <form action={duplicateOnboardingFlow}><input type="hidden" name="flowId" value={flow.id} /><Button type="submit" variant="ghost" size="sm">Duplicate</Button></form>
                  <ConfirmButton action={archiveOnboardingFlow} hidden={{ flowId: flow.id }} label="Archive" title="Archive this onboarding flow?" description="Clients who already answered it keep their answers; the flow is hidden from new clients." confirmLabel="Archive" variant="ghost" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <OnboardingFlowEditor
                flowId={flow.id}
                name={flow.name}
                clientTypeId={flow.clientTypeId}
                steps={(flow.steps as OnboardingFlowStep[]) ?? []}
                clientTypes={types}
              />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
