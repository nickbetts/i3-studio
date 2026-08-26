import { and, eq, inArray } from "drizzle-orm";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { accountManagerAssignments, documents, tasks, users } from "@/db/schema";
import { requireClientUser } from "@/lib/auth-helpers";

function initials(v: string) {
  const parts = v.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default async function PortalDashboardPage() {
  const user = await requireClientUser();
  const clientAccountId = user.clientAccountId;

  const assignments = await db
    .select({ id: users.id, name: users.name, email: users.email, title: users.title })
    .from(accountManagerAssignments)
    .innerJoin(users, eq(accountManagerAssignments.userId, users.id))
    .where(eq(accountManagerAssignments.clientAccountId, clientAccountId));

  const openTasks = await db
    .select({ id: tasks.id, title: tasks.title, priority: tasks.priority, dueDate: tasks.dueDate })
    .from(tasks)
    .where(and(eq(tasks.clientAccountId, clientAccountId), inArray(tasks.status, ["open", "in_progress"])));

  const pendingDocs = await db
    .select({ id: documents.id, title: documents.title, kind: documents.kind })
    .from(documents)
    .where(and(eq(documents.clientAccountId, clientAccountId), eq(documents.status, "pending")));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Your account managers and outstanding items.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your account managers</CardTitle>
            <CardDescription>Your points of contact at i3 Studio.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No managers assigned yet.</p>
            ) : (
              assignments.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <Avatar className="size-9">
                    <AvatarFallback>{initials(m.name || m.email)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{m.name || m.email}</div>
                    <div className="truncate text-xs text-muted-foreground">{m.title || m.email}</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Outstanding tasks</CardTitle>
            <CardDescription>Items the team needs from you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {openTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing outstanding. 🎉</p>
            ) : (
              openTasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm">{t.title}</span>
                  <Badge variant="secondary" className="capitalize">
                    {t.priority}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Awaiting your review</CardTitle>
            <CardDescription>Files and designs to approve.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing to review right now.</p>
            ) : (
              pendingDocs.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm">{d.title}</span>
                  <Badge variant="outline" className="capitalize">
                    {d.kind}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
