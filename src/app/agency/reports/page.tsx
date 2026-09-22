import { and, count, desc, eq, gte, lte } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { PriorityBadge } from "@/components/status-badge";
import { db } from "@/db";
import { auditLogs, clientAccounts, documents, tasks, tickets } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/permissions";
import { formatDuration, getStaffPerformanceReport } from "@/lib/staff-report";
import { redirect } from "next/navigation";

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function AgencyReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; sort?: string }> }) {
  const actor = await requireAgencyUser();
  if (!(await hasPermission(actor, "view_reports"))) redirect("/agency");
  const { from, to, sort = "time" } = await searchParams;
  const conditions = [];
  if (from) conditions.push(gte(auditLogs.createdAt, new Date(`${from}T00:00:00`)));
  if (to) conditions.push(lte(auditLogs.createdAt, new Date(`${to}T23:59:59`)));

  const now = new Date();
  const rangeEnd = to ? new Date(`${to}T23:59:59`) : now;
  const rangeStart = from ? new Date(`${from}T00:00:00`) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const rangeLabel = from || to ? `${dateInput(rangeStart)} – ${dateInput(rangeEnd)}` : "Last 30 days";

  const [[clients], [tasksOpen], [docsPending], [ticketsOpen], audit, performance] = await Promise.all([
    db.select({ value: count() }).from(clientAccounts),
    db.select({ value: count() }).from(tasks).where(eq(tasks.status, "open")),
    db.select({ value: count() }).from(documents).where(eq(documents.status, "pending")),
    db.select({ value: count() }).from(tickets).where(eq(tickets.status, "open")),
    db.query.auditLogs.findMany({ where: conditions.length ? and(...conditions) : undefined, orderBy: desc(auditLogs.createdAt), limit: 25 }),
    getStaffPerformanceReport(rangeStart, rangeEnd),
  ]);
  const metrics = [{ label: "Client accounts", value: clients?.value ?? 0 }, { label: "Open tasks", value: tasksOpen?.value ?? 0 }, { label: "Pending approvals", value: docsPending?.value ?? 0 }, { label: "Open tickets", value: ticketsOpen?.value ?? 0 }];
  const exportHref = `/api/reports/audit-export${from || to ? `?${new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString()}` : ""}`;

  const sortKey = (["time", "created", "completed", "open", "replies", "resolved", "response"] as const).includes(sort as never) ? sort : "time";
  const sorters: Record<string, (row: (typeof performance.rows)[number]) => number> = {
    time: (row) => row.timeSeconds,
    created: (row) => row.tasksCreated,
    completed: (row) => row.tasksCompleted,
    open: (row) => row.openTasksAssigned,
    replies: (row) => row.ticketsReplied,
    resolved: (row) => row.ticketsResolved,
    response: (row) => -(row.avgFirstResponseSeconds ?? Infinity),
  };
  const staffRows = [...performance.rows].sort((a, b) => sorters[sortKey](b) - sorters[sortKey](a));
  const sortLink = (key: string) => `/agency/reports?${new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}), sort: key }).toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Reports & activity" description="A concise view of operational workload and recorded changes." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => <Card key={metric.label}><CardHeader className="pb-2"><CardDescription>{metric.label}</CardDescription><CardTitle className="text-3xl">{metric.value}</CardTitle></CardHeader></Card>)}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><CardTitle className="text-base">Team performance</CardTitle><CardDescription>{rangeLabel} · click a column to sort</CardDescription></div>
            <form className="flex flex-wrap items-end gap-2">
              <div className="space-y-1"><Label htmlFor="report-from" className="text-xs">From</Label><Input id="report-from" name="from" type="date" defaultValue={from ?? ""} className="w-36" /></div>
              <div className="space-y-1"><Label htmlFor="report-to" className="text-xs">To</Label><Input id="report-to" name="to" type="date" defaultValue={to ?? ""} className="w-36" /></div>
              <input type="hidden" name="sort" value={sortKey} />
              <Button type="submit" variant="outline" size="sm">Filter</Button>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead className="text-right"><a href={sortLink("time")} className="hover:underline">Time logged</a></TableHead>
                  <TableHead className="text-right"><a href={sortLink("created")} className="hover:underline">Tasks created</a></TableHead>
                  <TableHead className="text-right"><a href={sortLink("completed")} className="hover:underline">Tasks completed</a></TableHead>
                  <TableHead className="text-right"><a href={sortLink("open")} className="hover:underline">Open tasks</a></TableHead>
                  <TableHead className="text-right"><a href={sortLink("replies")} className="hover:underline">Ticket replies</a></TableHead>
                  <TableHead className="text-right"><a href={sortLink("resolved")} className="hover:underline">Tickets resolved</a></TableHead>
                  <TableHead className="text-right"><a href={sortLink("response")} className="hover:underline">Avg first response</a></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffRows.map((row) => (
                  <TableRow key={row.userId}>
                    <TableCell>
                      <p className="font-medium">{row.name}</p>
                      <p className="text-xs capitalize text-muted-foreground">{row.role.replace("_", " ")}</p>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatDuration(row.timeSeconds)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.tasksCreated}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.tasksCompleted}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.openTasksAssigned}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.ticketsReplied}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.ticketsResolved}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatDuration(row.avgFirstResponseSeconds)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Support SLA</CardTitle><CardDescription>{rangeLabel}</CardDescription></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div><p className="text-xs text-muted-foreground">Tickets created</p><p className="text-2xl font-semibold">{performance.support.ticketsCreated}</p></div>
            <div><p className="text-xs text-muted-foreground">Tickets resolved</p><p className="text-2xl font-semibold">{performance.support.ticketsResolved}</p></div>
            <div><p className="text-xs text-muted-foreground">Avg first response</p><p className="text-2xl font-semibold font-mono">{formatDuration(performance.support.avgFirstResponseSeconds)}</p></div>
            <div><p className="text-xs text-muted-foreground">Avg resolution time</p><p className="text-2xl font-semibold font-mono">{formatDuration(performance.support.avgResolutionSeconds)}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Open tickets by priority</CardTitle><CardDescription>Current snapshot, not range-limited</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {performance.support.openByPriority.length === 0 ? <p className="text-sm text-muted-foreground">No open tickets.</p> : performance.support.openByPriority.map((row) => (
              <div key={row.priority} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0">
                <PriorityBadge priority={row.priority} />
                <span className="font-mono text-sm tabular-nums">{row.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><CardTitle className="text-base">Audit log</CardTitle><CardDescription>Latest changes across the workspace.</CardDescription></div>
            <Button type="button" variant="outline" size="sm" asChild><a href={exportHref}>Export CSV</a></Button>
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


