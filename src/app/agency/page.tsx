import { count, eq } from "drizzle-orm";
import { FolderKanban, LifeBuoy, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { clientAccounts, tasks, tickets } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";

export default async function AgencyDashboardPage() {
  const user = await requireAgencyUser();

  const [clientCount] = await db.select({ value: count() }).from(clientAccounts);
  const [openTasks] = await db.select({ value: count() }).from(tasks).where(eq(tasks.status, "open"));
  const [openTickets] = await db.select({ value: count() }).from(tickets).where(eq(tickets.status, "open"));

  const stats = [
    { label: "Clients", value: clientCount?.value ?? 0, description: "Total client accounts", icon: Users, tint: "text-chart-2 bg-chart-2/10" },
    { label: "Open tasks", value: openTasks?.value ?? 0, description: "Needs awaiting action", icon: FolderKanban, tint: "text-primary bg-primary/10" },
    { label: "Open tickets", value: openTickets?.value ?? 0, description: "Support requests", icon: LifeBuoy, tint: "text-chart-4 bg-chart-4/10" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back{user.name ? `, ${user.name}` : ""}</h1>
        <p className="mt-1 text-muted-foreground">Here is an overview of your agency workspace.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label} className="transition-colors hover:border-primary/40">
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
        ))}
      </div>
    </div>
  );
}
