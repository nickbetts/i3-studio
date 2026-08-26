import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/db";
import { accountManagerAssignments, clientAccounts, onboardingSubmissions, tasks, users } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { uploadDocument } from "@/app/agency/files/actions";
import { resetClientOnboarding } from "../actions";

export default async function AgencyClientDashboardPage({ params }: { params: Promise<{ clientId: string }> }) {
  await requireAgencyUser();
  const { clientId } = await params;
  const client = await db.query.clientAccounts.findFirst({ where: eq(clientAccounts.id, clientId) });
  if (!client) return <Card><CardContent className="pt-6">Client not found.</CardContent></Card>;
  const [submission, managers, clientTasks] = await Promise.all([
    db.query.onboardingSubmissions.findFirst({ where: eq(onboardingSubmissions.clientAccountId, clientId) }),
    db.select({ name: users.name, email: users.email }).from(accountManagerAssignments).innerJoin(users, eq(accountManagerAssignments.userId, users.id)).where(eq(accountManagerAssignments.clientAccountId, clientId)),
    db.query.tasks.findMany({ where: and(eq(tasks.clientAccountId, clientId), eq(tasks.status, "open")) }),
  ]);
  const onboardingData = submission?.data && typeof submission.data === "object" ? Object.entries(submission.data as Record<string, unknown>) : [];
  return <div className="space-y-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><Button variant="ghost" size="sm" asChild><Link href="/agency/clients">Back to clients</Link></Button><h1 className="mt-2 text-2xl font-semibold">{client.name}</h1><p className="text-muted-foreground">Internal client dashboard · <span className="capitalize">{client.status}</span></p></div><form action={resetClientOnboarding}><input type="hidden" name="clientAccountId" value={client.id} /><Button type="submit" variant="outline">Reset onboarding</Button></form></div><div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">Onboarding information</CardTitle><CardDescription>Everything the client has submitted through the wizard.</CardDescription></CardHeader><CardContent className="space-y-3">{onboardingData.length === 0 ? <p className="text-sm text-muted-foreground">No onboarding answers yet.</p> : onboardingData.map(([key, value]) => <div key={key} className="border-b pb-2 last:border-0"><p className="text-xs font-medium capitalize text-muted-foreground">{key.replace(/([A-Z])/g, " $1")}</p><p className="whitespace-pre-wrap text-sm">{typeof value === "boolean" ? (value ? "Yes" : "No") : String(value ?? "")}</p></div>)}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">Account overview</CardTitle><CardDescription>Internal-only context for this client.</CardDescription></CardHeader><CardContent className="space-y-4"><div><p className="text-xs text-muted-foreground">Account managers</p>{managers.length === 0 ? <p className="text-sm">None assigned</p> : managers.map((manager) => <p key={manager.email} className="text-sm">{manager.name || manager.email}</p>)}</div><div><p className="text-xs text-muted-foreground">Open tasks</p><p className="text-2xl font-semibold">{clientTasks.length}</p></div></CardContent></Card></div><Card><CardHeader><CardTitle className="text-base">Upload for client approval</CardTitle><CardDescription>This upload is performed by the agency and appears in the client&apos;s Approvals area.</CardDescription></CardHeader><CardContent><form action={uploadDocument} className="grid gap-4 md:grid-cols-2"><input type="hidden" name="clientAccountId" value={client.id} /><div className="space-y-2"><Label htmlFor="client-file-title">Title</Label><Input id="client-file-title" name="title" required /></div><div className="space-y-2"><Label htmlFor="client-file">File</Label><Input id="client-file" name="file" type="file" required /></div><div className="space-y-2 md:col-span-2"><Label htmlFor="client-file-description">Description</Label><Textarea id="client-file-description" name="description" /></div><div><Button type="submit">Upload for approval</Button></div></form></CardContent></Card></div>;
}
