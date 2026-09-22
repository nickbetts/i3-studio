import { and, count, desc, eq, gte, lte } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { auditLogs, clientAccounts, documents, tasks, tickets } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function AgencyReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const actor = await requireAgencyUser();
  if (!(await hasPermission(actor, "view_reports"))) redirect("/agency");
  const { from, to } = await searchParams;
  const conditions = [];
  if (from) conditions.push(gte(auditLogs.createdAt, new Date(`${from}T00:00:00`)));
  if (to) conditions.push(lte(auditLogs.createdAt, new Date(`${to}T23:59:59`)));

  const [[clients], [tasksOpen], [docsPending], [ticketsOpen], audit] = await Promise.all([
    db.select({ value: count() }).from(clientAccounts),
    db.select({ value: count() }).from(tasks).where(eq(tasks.status, "open")),
    db.select({ value: count() }).from(documents).where(eq(documents.status, "pending")),
    db.select({ value: count() }).from(tickets).where(eq(tickets.status, "open")),
    db.query.auditLogs.findMany({ where: conditions.length ? and(...conditions) : undefined, orderBy: desc(auditLogs.createdAt), limit: 25 }),
  ]);
  const metrics = [{ label: "Client accounts", value: clients?.value ?? 0 }, { label: "Open tasks", value: tasksOpen?.value ?? 0 }, { label: "Pending approvals", value: docsPending?.value ?? 0 }, { label: "Open tickets", value: ticketsOpen?.value ?? 0 }];
  const exportHref = `/api/reports/audit-export${from || to ? `?${new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString()}` : ""}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Reports & activity" description="A concise view of operational workload and recorded changes." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => <Card key={metric.label}><CardHeader className="pb-2"><CardDescription>{metric.label}</CardDescription><CardTitle className="text-3xl">{metric.value}</CardTitle></CardHeader></Card>)}
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><CardTitle className="text-base">Audit log</CardTitle><CardDescription>Latest changes across the workspace.</CardDescription></div>
            <form className="flex flex-wrap items-end gap-2">
              <div className="space-y-1"><Label htmlFor="report-from" className="text-xs">From</Label><Input id="report-from" name="from" type="date" defaultValue={from ?? ""} className="w-36" /></div>
              <div className="space-y-1"><Label htmlFor="report-to" className="text-xs">To</Label><Input id="report-to" name="to" type="date" defaultValue={to ?? ""} className="w-36" /></div>
              <Button type="submit" variant="outline" size="sm">Filter</Button>
              <Button type="button" variant="outline" size="sm" asChild><a href={exportHref}>Export CSV</a></Button>
            </form>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {audit.length === 0 ? <p className="text-sm text-muted-foreground">No activity recorded for this range.</p> : audit.map((entry) => (
            <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-0">
              <div><p className="text-sm font-medium capitalize">{entry.action.replace(/[._]/g, " ")}</p><p className="text-xs text-muted-foreground">{entry.entityType?.replaceAll("_", " ") || "workspace"}</p></div>
              <Badge variant="outline">{entry.createdAt.toLocaleString()}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

