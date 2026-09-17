import { and, asc, gte, lte } from "drizzle-orm";
import { Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { clientAccounts, clientTimeBudgets, projects, tasks, timeEntries } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { setClientTimeBudget } from "./actions";
import { formatLoggedTime } from "@/lib/time-format";

function monthBounds() {
  const now = new Date();
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999) };
}

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function AgencyTimePage() {
  const user = await requireAgencyUser();
  const canManage = user.role === "admin" || user.role === "account_manager";
  const { start, end } = monthBounds();
  const [clients, budgets, entries, team, projectsList, tasksList] = await Promise.all([
    db.query.clientAccounts.findMany({ orderBy: asc(clientAccounts.name) }),
    db.query.clientTimeBudgets.findMany({ where: and(gte(clientTimeBudgets.periodStart, start), lte(clientTimeBudgets.periodStart, end)) }),
    db.query.timeEntries.findMany({ where: and(gte(timeEntries.startedAt, start), lte(timeEntries.startedAt, end)), orderBy: (entry, { desc }) => [desc(entry.startedAt)] }),
    db.query.users.findMany({ where: (row, { inArray }) => inArray(row.role, ["admin", "account_manager", "content_writer"]) }),
    db.query.projects.findMany({ orderBy: asc(projects.name) }),
    db.query.tasks.findMany({ orderBy: asc(tasks.title) }),
  ]);
  const budgetByClient = new Map(budgets.map((budget) => [budget.clientAccountId, budget]));
  const spentByClient = new Map<string, number>();
  for (const entry of entries) spentByClient.set(entry.clientAccountId, (spentByClient.get(entry.clientAccountId) ?? 0) + entry.durationSeconds);
  const clientName = new Map(clients.map((client) => [client.id, client.name]));
  const projectName = new Map(projectsList.map((project) => [project.id, project.name]));
  const taskName = new Map(tasksList.map((task) => [task.id, task.title]));
  const userName = new Map(team.map((member) => [member.id, member.name || member.email]));

  return (
    <div className="space-y-6">
      <PageHeader title="Time tracking" description="See logged delivery time by client and manage each client's monthly allocation." />
      <Card>
        <CardHeader><CardTitle className="text-base">Client allocations</CardTitle><CardDescription>{start.toLocaleDateString(undefined, { month: "long", year: "numeric" })}. Logged time is counted when a timer is stopped.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {clients.map((client) => {
            const budget = budgetByClient.get(client.id);
            const spent = spentByClient.get(client.id) ?? 0;
            const allocated = budget?.allocatedSeconds ?? 0;
            const remaining = allocated - spent;
            return (
              <div key={client.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="font-medium">{client.name}</p><p className="text-xs text-muted-foreground">{formatLoggedTime(spent)} spent{budget ? ` · ${formatLoggedTime(Math.max(0, remaining))} remaining` : " · no allocation set"}</p></div>
                  {budget ? <Badge variant={remaining < 0 ? "destructive" : "secondary"}>{remaining < 0 ? `${formatLoggedTime(Math.abs(remaining))} over` : `${Math.round((spent / Math.max(allocated, 1)) * 100)}% used`}</Badge> : null}
                </div>
                {canManage ? (
                  <form action={setClientTimeBudget} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                    <input type="hidden" name="clientAccountId" value={client.id} />
                    <div className="space-y-1"><Label htmlFor={`budget-hours-${client.id}`} className="text-xs">Allocated hours</Label><Input id={`budget-hours-${client.id}`} name="hours" type="number" min="0" step="0.25" defaultValue={budget ? budget.allocatedSeconds / 3600 : ""} placeholder="e.g. 20" /></div>
                    <div className="space-y-1"><Label htmlFor={`budget-start-${client.id}`} className="text-xs">Period starts</Label><Input id={`budget-start-${client.id}`} name="periodStart" type="date" defaultValue={dateInput(start)} required /></div>
                    <div className="space-y-1"><Label htmlFor={`budget-end-${client.id}`} className="text-xs">Period ends</Label><Input id={`budget-end-${client.id}`} name="periodEnd" type="date" defaultValue={dateInput(end)} required /></div>
                    <Button type="submit" size="sm">Save allocation</Button>
                  </form>
                ) : null}
              </div>
            );
          })}
          {clients.length === 0 ? <EmptyState icon={Clock3} title="No clients yet" description="Create a client before allocating time." /> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Logged time this month</CardTitle><CardDescription>{entries.length} time {entries.length === 1 ? "entry" : "entries"}.</CardDescription></CardHeader>
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
