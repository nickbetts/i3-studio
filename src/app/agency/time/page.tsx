import { asc } from "drizzle-orm";
import { Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { projects, tasks } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { setClientServiceAllocations } from "./actions";
import { formatLoggedTime } from "@/lib/time-format";
import { getTimeReport } from "@/lib/time-report";
import { MonthNavigation } from "@/components/month-navigation";
import { ServiceAllocationEditor, type AllocationClient } from "./service-allocation-editor";

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function AgencyTimePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireAgencyUser();
  const canManage = user.role === "admin" || user.role === "account_manager";
  const { month } = await searchParams;
  const { period, rows, entries, totalSeconds } = await getTimeReport(month);
  const [team, projectsList, tasksList] = await Promise.all([
    db.query.users.findMany({ where: (row, { inArray }) => inArray(row.role, ["admin", "account_manager", "content_writer"]) }),
    db.query.projects.findMany({ orderBy: asc(projects.name) }),
    db.query.tasks.findMany({ orderBy: asc(tasks.title) }),
  ]);
  const clientName = new Map(rows.map(({ client }) => [client.id, client.name]));
  const projectName = new Map(projectsList.map((project) => [project.id, project.name]));
  const taskName = new Map(tasksList.map((task) => [task.id, task.title]));
  const userName = new Map(team.map((member) => [member.id, member.name || member.email]));

  return (
    <div className="space-y-6">
      <PageHeader title="Time & budgets" description="Delivery effort and client allocations." actions={<MonthNavigation period={period} path="/agency/time" />} />
      <div className="grid grid-cols-2 gap-4 border-b pb-5 sm:grid-cols-3">
        <div><p className="text-xs text-muted-foreground">Logged this month</p><p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{formatLoggedTime(totalSeconds)}</p></div>
        <div><p className="text-xs text-muted-foreground">Clients with allocations</p><p className="mt-1 text-2xl font-semibold">{rows.filter((row) => row.budget).length}<span className="text-sm font-normal text-muted-foreground"> / {rows.length}</span></p></div>
        <div><p className="text-xs text-muted-foreground">Over budget</p><p className="mt-1 text-2xl font-semibold">{rows.filter((row) => row.budget && row.spent > row.budget.allocatedSeconds).length}</p></div>
      </div>
      {canManage ? <ServiceAllocationEditor clients={rows.map(({ client, budget, serviceAllocations, spent, start, end }) => ({ id: client.id, name: client.name, start: dateInput(start), end: dateInput(end), totalHours: (budget?.allocatedSeconds ?? serviceAllocations.filter((item) => item.allocatedSeconds > 0).reduce((total, item) => total + item.allocatedSeconds, 0)) / 3600, spentSeconds: spent, serviceAllocations })) as AllocationClient[]} action={setClientServiceAllocations} /> : null}
      <Card>
        <CardHeader><CardTitle className="text-base">Time ledger · {period.label}</CardTitle><CardDescription>{entries.length} time {entries.length === 1 ? "entry" : "entries"}.</CardDescription></CardHeader>
        <CardContent>
          {entries.length === 0 ? <EmptyState icon={Clock3} title="Nothing logged yet" description="Start a timer from anywhere in the agency area." /> : (
            <div className="space-y-2">
              {entries.map((entry) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-3 last:border-0"><div><p className="font-medium">{clientName.get(entry.clientAccountId) ?? "Unknown client"}{entry.taskId ? ` · ${taskName.get(entry.taskId) ?? "Task"}` : ""}</p><p className="text-xs text-muted-foreground">{userName.get(entry.userId) ?? "Team member"}{entry.projectId ? ` · ${projectName.get(entry.projectId) ?? "Project"}` : ""} · {entry.startedAt.toLocaleString()}</p></div><Badge variant="outline" className="font-mono tabular-nums">{formatLoggedTime(entry.durationSeconds)}</Badge></div>)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
