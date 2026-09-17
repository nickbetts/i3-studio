import { and, eq, gte, lte } from "drizzle-orm";
import { Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { clientTimeBudgets, projects, timeEntries } from "@/db/schema";
import { requireClientUser } from "@/lib/auth-helpers";

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export default async function PortalTimePage() {
  const user = await requireClientUser();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const [budget, entries, projectRows] = await Promise.all([
    db.query.clientTimeBudgets.findFirst({ where: and(eq(clientTimeBudgets.clientAccountId, user.clientAccountId), lte(clientTimeBudgets.periodStart, now), gte(clientTimeBudgets.periodEnd, now)) }),
    db.query.timeEntries.findMany({ where: and(eq(timeEntries.clientAccountId, user.clientAccountId), gte(timeEntries.startedAt, start), lte(timeEntries.startedAt, end)), orderBy: (entry, { desc }) => [desc(entry.startedAt)] }),
    db.query.projects.findMany({ where: eq(projects.clientAccountId, user.clientAccountId), orderBy: (project, { asc }) => [asc(project.name)] }),
  ]);
  const projectNames = new Map(projectRows.map((project) => [project.id, project.name]));
  const spent = entries.reduce((total, entry) => total + entry.durationSeconds, 0);
  const remaining = (budget?.allocatedSeconds ?? 0) - spent;
  return <div className="space-y-6"><PageHeader title="Delivery time" description="A transparent view of time logged against your current allocation." /><Card><CardHeader><CardTitle className="text-base">Current period</CardTitle><CardDescription>{start.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Logged</p><p className="text-2xl font-semibold">{formatDuration(spent)}</p></div><div><p className="text-xs text-muted-foreground">Allocated</p><p className="text-2xl font-semibold">{budget ? formatDuration(budget.allocatedSeconds) : "Not set"}</p></div><div><p className="text-xs text-muted-foreground">Remaining</p><p className="text-2xl font-semibold">{budget ? formatDuration(Math.max(0, remaining)) : "—"}</p>{budget ? <Badge variant={remaining < 0 ? "destructive" : "secondary"}>{remaining < 0 ? "Over allocation" : "On track"}</Badge> : null}</div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Recent logged work</CardTitle></CardHeader><CardContent>{entries.length === 0 ? <EmptyState icon={Clock3} title="No time logged yet" description="Your team has not logged delivery time this period." /> : <div className="space-y-2">{entries.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 border-b py-3 last:border-0"><div><p className="font-medium">{entry.taskId ? "Task work" : "Delivery work"}</p><p className="text-xs text-muted-foreground">{entry.projectId ? projectNames.get(entry.projectId) ?? "Project" : "General client work"} · {entry.startedAt.toLocaleDateString()}</p></div><Badge variant="outline" className="font-mono">{formatDuration(entry.durationSeconds)}</Badge></div>)}</div>}</CardContent></Card></div>;
}
