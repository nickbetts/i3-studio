import { and, count, desc, eq, inArray, lte } from "drizzle-orm";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Activity, CalendarClock, FileText, FolderKanban, Image as ImageIcon, LifeBuoy, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { db } from "@/db";
import { auditLogs, clientAccounts, tasks, tickets, users } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";

export default async function AgencyDashboardPage() {
  const user = await requireAgencyUser();

  const dueSoonCutoff = new Date();
  dueSoonCutoff.setDate(dueSoonCutoff.getDate() + 3);
  dueSoonCutoff.setHours(23, 59, 59, 999);

  const [[clientCount], [openTasks], [openTickets], activity, tasksDueSoon] = await Promise.all([
    db.select({ value: count() }).from(clientAccounts),
    db.select({ value: count() }).from(tasks).where(eq(tasks.status, "open")),
    db.select({ value: count() }).from(tickets).where(eq(tickets.status, "open")),
    db
      .select({ id: auditLogs.id, action: auditLogs.action, createdAt: auditLogs.createdAt, actor: users.name, actorEmail: users.email })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(6),
    db
      .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, priority: tasks.priority, clientAccountId: tasks.clientAccountId, clientName: clientAccounts.name })
      .from(tasks)
      .leftJoin(clientAccounts, eq(tasks.clientAccountId, clientAccounts.id))
      .where(and(inArray(tasks.status, ["open", "in_progress", "blocked"]), lte(tasks.dueDate, dueSoonCutoff)))
      .orderBy(tasks.dueDate)
      .limit(8),
  ]);

  const stats = [
    { label: "Clients", value: clientCount?.value ?? 0, description: "Total client accounts", href: "/agency/clients", icon: Users, tint: "text-chart-2 bg-chart-2/10" },
    { label: "Open tasks", value: openTasks?.value ?? 0, description: "Needs awaiting action", href: "/agency/tasks", icon: FolderKanban, tint: "text-primary bg-primary/10" },
    { label: "Open tickets", value: openTickets?.value ?? 0, description: "Support requests", href: "/agency/support", icon: LifeBuoy, tint: "text-chart-4 bg-chart-4/10" },
  ];

  const quickActions = [
    { label: "New client", href: "/agency/clients", icon: Plus },
    { label: "Upload file", href: "/agency/files", icon: FileText },
    { label: "Upload design", href: "/agency/designs", icon: ImageIcon },
    { label: "Open calendar", href: "/agency/calendar", icon: CalendarClock },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title={`Welcome back${user.name ? `, ${user.name}` : ""}`} description="Here is an overview of your agency workspace." />

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="block">
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription>{s.label}</CardDescription>
                  <span className={`flex size-9 items-center justify-center rounded-lg ${s.tint}`}>
                    <s.icon className="size-4" />
                  </span>
                </div>
                <CardTitle className="text-3xl tabular-nums">{s.value}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{s.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick actions</CardTitle>
            <CardDescription>Jump straight into common tasks.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <Button key={action.label} variant="outline" asChild className="justify-start gap-2">
                <Link href={action.href}><action.icon className="size-4" />{action.label}</Link>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
            <CardDescription>Latest changes across the workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <EmptyState icon={Activity} title="No activity yet" description="Actions across the workspace will show up here." />
            ) : (
              <ul className="space-y-3">
                {activity.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                      <span className="truncate capitalize">{item.action.replace(/[._]/g, " ")}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{item.actor || item.actorEmail || "System"} · {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div><CardTitle className="text-base">Tasks due soon</CardTitle><CardDescription>Open tasks due within 3 days, across all clients.</CardDescription></div>
            <Link href="/agency/tasks?assignee=all" className="text-xs underline-offset-4 hover:underline">View all tasks</Link>
          </div>
        </CardHeader>
        <CardContent>
          {tasksDueSoon.length === 0 ? (
            <EmptyState icon={FolderKanban} title="Nothing due soon" description="Tasks due in the next 3 days will show up here." />
          ) : (
            <div className="space-y-2">
              {tasksDueSoon.map((task) => (
                <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{task.clientName ?? "Unknown client"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {task.dueDate ? <Badge variant={task.dueDate < new Date() ? "destructive" : "outline"}>{task.dueDate < new Date() ? "Overdue" : `Due ${task.dueDate.toLocaleDateString()}`}</Badge> : null}
                    <Badge variant="secondary" className="capitalize">{task.priority}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

