import { and, desc, eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { ConfirmButton } from "@/components/confirm-button";
import { UploadForm } from "@/components/upload-form";
import { db } from "@/db";
import { accountManagerAssignments, clientAccounts, onboardingSubmissions, referenceFiles, tasks, users } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { uploadDocument } from "@/app/agency/files/actions";
import { uploadReference } from "@/app/portal/(app)/files/actions";
import { resetClientOnboarding } from "../actions";

export default async function AgencyClientDashboardPage({ params }: { params: Promise<{ clientId: string }> }) {
  await requireAgencyUser();
  const { clientId } = await params;
  const client = await db.query.clientAccounts.findFirst({ where: eq(clientAccounts.id, clientId) });
  if (!client) return <Card><CardContent className="pt-6">Client not found.</CardContent></Card>;
  const [submission, managers, clientTasks, references] = await Promise.all([
    db.query.onboardingSubmissions.findFirst({ where: eq(onboardingSubmissions.clientAccountId, clientId) }),
    db.select({ name: users.name, email: users.email }).from(accountManagerAssignments).innerJoin(users, eq(accountManagerAssignments.userId, users.id)).where(eq(accountManagerAssignments.clientAccountId, clientId)),
    db.query.tasks.findMany({ where: and(eq(tasks.clientAccountId, clientId), eq(tasks.status, "open")) }),
    db.query.referenceFiles.findMany({ where: eq(referenceFiles.clientAccountId, clientId), orderBy: desc(referenceFiles.createdAt) }),
  ]);
  const onboardingData = submission?.data && typeof submission.data === "object" ? Object.entries(submission.data as Record<string, unknown>) : [];
  return <div className="space-y-6"><PageHeader title={client.name} description={`Internal client dashboard · ${client.status.charAt(0).toUpperCase()}${client.status.slice(1)}`} breadcrumbs={[{ label: "Clients", href: "/agency/clients" }, { label: client.name }]} actions={<ConfirmButton action={resetClientOnboarding} hidden={{ clientAccountId: client.id }} label="Reset onboarding" title="Reset onboarding?" description="This clears the client's submitted answers and sends them back through the onboarding wizard." confirmLabel="Reset" variant="outline" />} /><div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">Onboarding information</CardTitle><CardDescription>Everything the client has submitted through the wizard.</CardDescription></CardHeader><CardContent className="space-y-3">{onboardingData.length === 0 ? <p className="text-sm text-muted-foreground">No onboarding answers yet.</p> : onboardingData.map(([key, value]) => <div key={key} className="border-b pb-2 last:border-0"><p className="text-xs font-medium capitalize text-muted-foreground">{key.replace(/([A-Z])/g, " $1")}</p><p className="whitespace-pre-wrap text-sm">{typeof value === "boolean" ? (value ? "Yes" : "No") : String(value ?? "")}</p></div>)}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">Account overview</CardTitle><CardDescription>Internal-only context for this client.</CardDescription></CardHeader><CardContent className="space-y-4"><div><p className="text-xs text-muted-foreground">Account managers</p>{managers.length === 0 ? <p className="text-sm">None assigned</p> : managers.map((manager) => <p key={manager.email} className="text-sm">{manager.name || manager.email}</p>)}</div><div><p className="text-xs text-muted-foreground">Open tasks</p><p className="text-2xl font-semibold">{clientTasks.length}</p></div></CardContent></Card></div><Card><CardHeader><CardTitle className="text-base">Upload for client approval</CardTitle><CardDescription>This upload is performed by the agency and appears in the client&apos;s Approvals area.</CardDescription></CardHeader><CardContent><UploadForm action={uploadDocument} fixedClientId={client.id} kind="document" submitLabel="Upload for approval" /></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Reference files</CardTitle><CardDescription>Files the client shared, plus anything the team adds for them.</CardDescription></CardHeader><CardContent className="space-y-4"><UploadForm action={uploadReference} fixedClientId={client.id} kind="reference" submitLabel="Upload reference" />{references.length === 0 ? <p className="text-sm text-muted-foreground">No reference files yet.</p> : <div className="divide-y divide-border/60">{references.map((ref) => <div key={ref.id} className="flex items-center justify-between gap-3 py-2"><div className="min-w-0"><a href={ref.fileUrl} target="_blank" rel="noreferrer" className="truncate text-sm font-medium underline-offset-4 hover:underline">{ref.title}</a><p className="truncate text-xs text-muted-foreground">{ref.fileName}</p></div></div>)}</div>}</CardContent></Card></div>;
}
