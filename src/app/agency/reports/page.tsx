import { count, desc, eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { auditLogs, clientAccounts, documents, tasks, tickets } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";

export default async function AgencyReportsPage() {
  await requireAgencyUser();
  const [[clients], [tasksOpen], [docsPending], [ticketsOpen], audit] = await Promise.all([db.select({ value: count() }).from(clientAccounts), db.select({ value: count() }).from(tasks).where(eq(tasks.status, "open")), db.select({ value: count() }).from(documents).where(eq(documents.status, "pending")), db.select({ value: count() }).from(tickets).where(eq(tickets.status, "open")), db.query.auditLogs.findMany({ orderBy: desc(auditLogs.createdAt), limit: 25 })]);
  const metrics = [{ label: "Client accounts", value: clients?.value ?? 0 }, { label: "Open tasks", value: tasksOpen?.value ?? 0 }, { label: "Pending approvals", value: docsPending?.value ?? 0 }, { label: "Open tickets", value: ticketsOpen?.value ?? 0 }];
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">Reports & activity</h1><p className="text-muted-foreground">A concise view of operational workload and recorded changes.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{metrics.map((metric) => <Card key={metric.label}><CardHeader className="pb-2"><CardDescription>{metric.label}</CardDescription><CardTitle className="text-3xl">{metric.value}</CardTitle></CardHeader></Card>)}</div><Card><CardHeader><CardTitle className="text-base">Audit log</CardTitle><CardDescription>Latest changes across the workspace.</CardDescription></CardHeader><CardContent className="space-y-2">{audit.length === 0 ? <p className="text-sm text-muted-foreground">No activity recorded yet.</p> : audit.map((entry) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-0"><div><p className="text-sm font-medium">{entry.action}</p><p className="text-xs text-muted-foreground">{entry.entityType || "workspace"}{entry.entityId ? ` · ${entry.entityId}` : ""}</p></div><Badge variant="outline">{entry.createdAt.toLocaleString()}</Badge></div>)}</CardContent></Card></div>;
}
