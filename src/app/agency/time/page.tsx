import { asc } from "drizzle-orm";
import Link from "next/link";
import { Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { projects, tasks } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { setClientTimeBudget } from "./actions";
import { formatLoggedTime } from "@/lib/time-format";
import { getTimeReport } from "@/lib/time-report";
import { BudgetProgress } from "@/components/budget-progress";
import { MonthNavigation } from "@/components/month-navigation";

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
      <Card>
        <CardHeader><CardTitle className="text-base">Client allocations</CardTitle><CardDescription>{period.label}</CardDescription></CardHeader>
        <CardContent className="divide-y divide-border">
          {rows.map(({ client, budget, spent, start, end }) => {
            return (
              <article key={client.id} className="grid gap-5 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <div className="min-w-0"><Link href={`/agency/clients/${client.id}`} className="font-semibold hover:text-primary">{client.name}</Link><p className="mt-1 text-xs text-muted-foreground">{budget ? "Delivery allocation" : "Allocation not configured"}</p></div>
                <div className="min-w-0 space-y-4">
                <BudgetProgress label={client.name} allocated={budget?.allocatedSeconds ?? null} spent={spent} start={start} end={end} />
                {canManage ? (
                  <details><summary className="w-fit cursor-pointer text-xs text-muted-foreground hover:text-foreground">{budget ? "Edit allocation" : "Set allocation"}</summary>
                  <form action={setClientTimeBudget} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                    <input type="hidden" name="clientAccountId" value={client.id} />
                    <div className="space-y-1"><Label htmlFor={`budget-hours-${client.id}`} className="text-xs">Allocated hours</Label><Input id={`budget-hours-${client.id}`} name="hours" type="number" min="0" max="10000" step="0.25" required defaultValue={budget ? budget.allocatedSeconds / 3600 : ""} placeholder="e.g. 20" /></div>
                    <div className="space-y-1"><Label htmlFor={`budget-start-${client.id}`} className="text-xs">Period starts</Label><Input id={`budget-start-${client.id}`} name="periodStart" type="date" defaultValue={dateInput(start)} required /></div>
                    <div className="space-y-1"><Label htmlFor={`budget-end-${client.id}`} className="text-xs">Period ends</Label><Input id={`budget-end-${client.id}`} name="periodEnd" type="date" defaultValue={dateInput(end)} required /></div>
                    <Button type="submit" size="sm">Save allocation</Button>
                  </form>
                  </details>
                ) : null}
                </div>
              </article>
            );
          })}
          {rows.length === 0 ? <EmptyState icon={Clock3} title="No clients yet" description="Create a client before allocating time." /> : null}
        </CardContent>
      </Card>
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
