import { count, eq } from "drizzle-orm";
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
    { label: "Clients", value: clientCount?.value ?? 0, description: "Total client accounts" },
    { label: "Open tasks", value: openTasks?.value ?? 0, description: "Needs awaiting action" },
    { label: "Open tickets", value: openTickets?.value ?? 0, description: "Support requests" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back{user.name ? `, ${user.name}` : ""}</h1>
        <p className="text-muted-foreground">Here is an overview of your agency workspace.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-3xl">{s.value}</CardTitle>
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
