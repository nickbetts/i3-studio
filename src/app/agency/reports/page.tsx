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
import { getOperationsReport } from "@/lib/operations-report";
import { getSentimentOverview } from "@/lib/client-sentiment";
import { getTimeReport } from "@/lib/time-report";
import { budgetUsage } from "@/lib/time-budget";
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

  const [[clients], [tasksOpen], [docsPending], [ticketsOpen], audit, performance, operations, timeReport, sentiment] = await Promise.all([
    db.select({ value: count() }).from(clientAccounts),
    db.select({ value: count() }).from(tasks).where(eq(tasks.status, "open")),
    db.select({ value: count() }).from(documents).where(eq(documents.status, "pending")),
    db.select({ value: count() }).from(tickets).where(eq(tickets.status, "open")),
    db.query.auditLogs.findMany({ where: conditions.length ? and(...conditions) : undefined, orderBy: desc(auditLogs.createdAt), limit: 25 }),
    getStaffPerformanceReport(rangeStart, rangeEnd),
    getOperationsReport(rangeStart, rangeEnd),
    getTimeReport(undefined, false),
    getSentimentOverview(rangeStart, rangeEnd),
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

  const clientBudgetRows = timeReport.rows
    .map((row) => ({ client: row.client, usage: budgetUsage(row.budget?.allocatedSeconds ?? null, row.spent, row.start, row.end) }))
    .filter((row) => row.usage.allocated !== null)
    .sort((a, b) => b.usage.usedPercent - a.usage.usedPercent);

  return (
    <div className="space-y-6">
      <PageHeader title="Reports & activity" description="A concise view of operational workload and recorded changes." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => <Card key={metric.label}><CardHeader className="pb-2"><CardDescription>{metric.label}</CardDescription><CardTitle className="text-3xl">{metric.value}</CardTitle></CardHeader></Card>)}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><CardTitle className="flex items-center gap-2 text-base">Client sentiment <Badge variant="outline">Coming soon</Badge></CardTitle><CardDescription>{rangeLabel} · derived from client comments on tickets, designs & content, plus explicit project updates and file decisions</CardDescription></div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Overall</p>
              <p className="text-3xl font-semibold">{sentiment.overallIndex ?? "—"}{sentiment.overallIndex !== null ? <span className="text-sm font-normal text-muted-foreground">/100</span> : null}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sentiment.clients.every((row) => row.signalCount === 0) ? (
            <p className="text-sm text-muted-foreground">No client comments, decisions or project updates recorded in this range yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead>Trend</TableHead>
                    <TableHead className="text-right">Signals</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sentiment.clients.filter((row) => row.signalCount > 0).map((row) => (
                    <TableRow key={row.clientAccountId}>
                      <TableCell><a href={`/agency/clients/${row.clientAccountId}`} className="font-medium hover:underline">{row.clientName}</a></TableCell>
                      <TableCell className="text-right">
                        <Badge variant={row.label === "positive" ? "secondary" : row.label === "at_risk" ? "destructive" : "outline"} className="font-mono tabular-nums">{row.index}</Badge>
                      </TableCell>
                      <TableCell className="text-sm capitalize text-muted-foreground">{row.trend.replace("_", " ")}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.signalCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
        <CardHeader><CardTitle className="text-base">Client budget health</CardTitle><CardDescription>This month · time spent vs. allocated hours</CardDescription></CardHeader>
        <CardContent>
          {clientBudgetRows.length === 0 ? <p className="text-sm text-muted-foreground">No clients have a time budget set for this month.</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Spent</TableHead>
                    <TableHead className="text-right">Allocated</TableHead>
                    <TableHead className="text-right">Used</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientBudgetRows.map(({ client, usage }) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{formatDuration(usage.spent)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{formatDuration(usage.allocated)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{Math.round(usage.usedPercent)}%</TableCell>
                      <TableCell>
                        <Badge variant={usage.state === "over" ? "destructive" : usage.state === "exhausted" || usage.state === "near" ? "outline" : "secondary"} className="capitalize">
                          {usage.state === "over" ? `${Math.round(usage.over / 60)}m over` : usage.state}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Content pipeline</CardDescription><CardTitle className="text-base">{rangeLabel}</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Published in range: <span className="font-semibold">{operations.contentPipeline.publishedInRange}</span></p>
            <p>Avg cycle time: <span className="font-mono font-semibold">{formatDuration(operations.contentPipeline.avgCycleSeconds)}</span></p>
            <div className="flex flex-wrap gap-1 pt-1">
              {operations.contentPipeline.statusCounts.map((row) => <Badge key={row.status} variant="outline" className="capitalize">{row.status.replace(/_/g, " ")}: {row.count}</Badge>)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Document approvals</CardDescription><CardTitle className="text-base">{rangeLabel}</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Pending now: <span className="font-semibold">{operations.approvalPipeline.pendingCount}</span></p>
            <p>Decided in range: <span className="font-semibold">{operations.approvalPipeline.decidedInRange}</span></p>
            <p>Avg turnaround: <span className="font-mono font-semibold">{formatDuration(operations.approvalPipeline.avgTurnaroundSeconds)}</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Task SLA</CardDescription><CardTitle className="text-base">{rangeLabel}</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Overdue now: <span className="font-semibold">{operations.taskSla.overdueCount}</span></p>
            <p>Completed in range: <span className="font-semibold">{operations.taskSla.completedInRange}</span></p>
            <p>Avg cycle time: <span className="font-mono font-semibold">{formatDuration(operations.taskSla.avgCycleSeconds)}</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Project delivery</CardDescription><CardTitle className="text-base">Current snapshot</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Active projects: <span className="font-semibold">{operations.projectDelivery.activeProjects}</span></p>
            <p>Overdue milestones: <span className="font-semibold">{operations.projectDelivery.overdueMilestones}</span></p>
            <p>Due within 7 days: <span className="font-semibold">{operations.projectDelivery.dueSoonMilestones}</span></p>
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


