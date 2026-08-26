import { desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/db";
import { clientAccounts, tasks } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { createClient, createTask } from "./actions";
import { TaskStatus } from "./task-status";

export default async function AgencyClientsPage() {
  await requireAgencyUser();
  const [clients, managers] = await Promise.all([
    db.query.clientAccounts.findMany({ orderBy: desc(clientAccounts.createdAt) }),
    db.query.users.findMany({ where: (user, { eq }) => eq(user.role, "account_manager") }),
  ]);
  const openTasks = await db.select({ id: tasks.id, title: tasks.title, status: tasks.status, priority: tasks.priority, clientAccountId: tasks.clientAccountId, dueDate: tasks.dueDate }).from(tasks).orderBy(desc(tasks.createdAt));

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold">Clients</h1><p className="text-muted-foreground">Manage accounts, access and work requests.</p></div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader><CardTitle className="text-base">Add a client</CardTitle><CardDescription>Create an account and their first login.</CardDescription></CardHeader>
          <CardContent>
            <form action={createClient} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="client-name">Company name</Label><Input id="client-name" name="name" required /></div>
              <div className="space-y-2"><Label htmlFor="client-email">Client email</Label><Input id="client-email" name="email" type="email" required /></div>
              <div className="space-y-2"><Label htmlFor="client-password">Temporary password</Label><Input id="client-password" name="password" type="password" minLength={8} required /></div>
              <div className="space-y-2"><Label htmlFor="client-manager">Account manager</Label><Select name="managerId"><SelectTrigger id="client-manager"><SelectValue placeholder="Assign later" /></SelectTrigger><SelectContent>{managers.map((manager) => <SelectItem key={manager.id} value={manager.id}>{manager.name || manager.email}</SelectItem>)}</SelectContent></Select></div>
              <Button type="submit">Create client</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Client accounts</CardTitle><CardDescription>{clients.length} account{clients.length === 1 ? "" : "s"} in this workspace.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {clients.length === 0 ? <p className="text-sm text-muted-foreground">No clients yet.</p> : clients.map((client) => <div key={client.id} className="flex items-center justify-between rounded-md border p-3"><div><p className="font-medium">{client.name}</p><p className="text-xs text-muted-foreground">{client.slug}</p></div><Badge variant="outline" className="capitalize">{client.status}</Badge></div>)}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Create a client task</CardTitle><CardDescription>Tasks appear in the client portal as outstanding items.</CardDescription></CardHeader>
        <CardContent>
          <form action={createTask} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="task-client">Client</Label><Select name="clientAccountId" required><SelectTrigger id="task-client"><SelectValue placeholder="Choose a client" /></SelectTrigger><SelectContent>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="task-title">Task title</Label><Input id="task-title" name="title" required /></div>
            <div className="space-y-2 md:col-span-2"><Label htmlFor="task-description">Description</Label><Textarea id="task-description" name="description" /></div>
            <div className="space-y-2"><Label htmlFor="task-priority">Priority</Label><Select name="priority" defaultValue="medium"><SelectTrigger id="task-priority"><SelectValue /></SelectTrigger><SelectContent>{["low", "medium", "high", "urgent"].map((priority) => <SelectItem key={priority} value={priority} className="capitalize">{priority}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="task-due">Due date</Label><Input id="task-due" name="dueDate" type="date" /></div>
            <div><Button type="submit">Create task</Button></div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Task queue</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {openTasks.length === 0 ? <p className="text-sm text-muted-foreground">No tasks created yet.</p> : openTasks.map((task) => <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-0"><div><p className="font-medium">{task.title}</p><p className="text-xs capitalize text-muted-foreground">{clients.find((client) => client.id === task.clientAccountId)?.name ?? "Unknown client"} · {task.priority}{task.dueDate ? ` · due ${task.dueDate.toLocaleDateString()}` : ""}</p></div><TaskStatus taskId={task.id} value={task.status} /></div>)}
        </CardContent>
      </Card>
    </div>
  );
}
