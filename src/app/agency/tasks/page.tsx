import { and, asc, eq, inArray } from "drizzle-orm";
import { ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { db } from "@/db";
import { clientAccounts, projects, tasks, users } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { createTask } from "./actions";
import { TaskAssignee } from "./task-assignee";
import { TaskFilterSelect } from "./task-filter-select";
import { TaskStatus } from "./task-status";

const STATUS_OPTIONS = [
  { value: "open_items", label: "Open (not done)" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "all", label: "All statuses" },
];
const PRIORITY_OPTIONS = [
  { value: "all", label: "All priorities" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

function dueBadge(dueDate: Date | null, status: string) {
  if (!dueDate || status === "done") return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return <Badge variant="destructive">Overdue</Badge>;
  if (diffDays <= 1) return <Badge className="bg-amber-500 text-white dark:bg-amber-600">Due soon</Badge>;
  return null;
}

export default async function AgencyTasksPage({ searchParams }: { searchParams: Promise<{ assignee?: string; clientId?: string; projectId?: string; status?: string; priority?: string }> }) {
  const user = await requireAgencyUser();
  const { assignee = "me", clientId = "", projectId = "", status = "open_items", priority = "all" } = await searchParams;

  const [clients, team, allProjects] = await Promise.all([
    db.query.clientAccounts.findMany({ orderBy: asc(clientAccounts.name) }),
    db.query.users.findMany({ where: inArray(users.role, ["admin", "account_manager", "content_writer"]) }),
    db.query.projects.findMany({ orderBy: asc(projects.name) }),
  ]);
  const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? "Unknown client";
  const projectName = (id: string | null) => (id ? (allProjects.find((project) => project.id === id)?.name ?? "Unknown project") : null);

  const conditions = [];
  if (assignee === "me") conditions.push(eq(tasks.assignedToUserId, user.id));
  if (clientId) conditions.push(eq(tasks.clientAccountId, clientId));
  if (projectId) conditions.push(eq(tasks.projectId, projectId));
  if (status === "open_items") conditions.push(inArray(tasks.status, ["open", "in_progress", "blocked"]));
  else if (status !== "all") conditions.push(eq(tasks.status, status as "open" | "in_progress" | "blocked" | "done"));
  if (priority !== "all") conditions.push(eq(tasks.priority, priority as "low" | "medium" | "high" | "urgent"));

  const taskList = await db.query.tasks.findMany({ where: conditions.length ? and(...conditions) : undefined, orderBy: asc(tasks.dueDate) });

  return (
    <div className="space-y-6">
      <PageHeader title="Tasks" description="Everything the team needs to do, in one place." />

      <Card>
        <CardHeader><CardTitle className="text-base">Create a task</CardTitle><CardDescription>Tasks appear here and in the client portal as outstanding items.</CardDescription></CardHeader>
        <CardContent>
          <form action={createTask} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="task-client">Client</Label><Select name="clientAccountId" required><SelectTrigger id="task-client"><SelectValue placeholder="Choose a client" /></SelectTrigger><SelectContent>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="task-project">Project (optional)</Label><Select name="projectId"><SelectTrigger id="task-project"><SelectValue placeholder="No project" /></SelectTrigger><SelectContent>{allProjects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="task-title">Task title</Label><Input id="task-title" name="title" required /></div>
            <div className="space-y-2"><Label htmlFor="task-assignee">Assignee</Label><Select name="assignedToUserId"><SelectTrigger id="task-assignee"><SelectValue placeholder="Unassigned" /></SelectTrigger><SelectContent>{team.map((member) => <SelectItem key={member.id} value={member.id}>{member.name || member.email}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 md:col-span-2"><Label htmlFor="task-description">Description</Label><Textarea id="task-description" name="description" /></div>
            <div className="space-y-2"><Label htmlFor="task-priority">Priority</Label><Select name="priority" defaultValue="medium"><SelectTrigger id="task-priority"><SelectValue /></SelectTrigger><SelectContent>{["low", "medium", "high", "urgent"].map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="task-due">Due date</Label><Input id="task-due" name="dueDate" type="date" /></div>
            <div><Button type="submit">Create task</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><CardTitle className="text-base">Task queue</CardTitle><CardDescription>{taskList.length} matching task{taskList.length === 1 ? "" : "s"}.</CardDescription></div>
            <div className="flex flex-wrap gap-2">
              <TaskFilterSelect paramKey="assignee" placeholder="My tasks" options={[{ value: "me", label: "My tasks" }, { value: "all", label: "All tasks" }]} />
              <TaskFilterSelect paramKey="clientId" placeholder="All clients" options={[{ value: "", label: "All clients" }, ...clients.map((client) => ({ value: client.id, label: client.name }))]} />
              <TaskFilterSelect paramKey="projectId" placeholder="All projects" options={[{ value: "", label: "All projects" }, ...allProjects.map((project) => ({ value: project.id, label: project.name }))]} />
              <TaskFilterSelect paramKey="status" placeholder="Open (not done)" options={STATUS_OPTIONS} />
              <TaskFilterSelect paramKey="priority" placeholder="All priorities" options={PRIORITY_OPTIONS} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {taskList.length === 0 ? (
            <EmptyState icon={ListTodo} title="No matching tasks" description="Try a different filter, or create a task above." />
          ) : taskList.map((task) => (
            <div key={task.id} data-testid={`task-${task.id}`} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-0">
              <div>
                <p className="font-medium">{task.title}</p>
                <p className="text-xs capitalize text-muted-foreground">
                  {clientName(task.clientAccountId)}{projectName(task.projectId) ? ` · ${projectName(task.projectId)}` : ""} · {task.priority}{task.dueDate ? ` · due ${task.dueDate.toLocaleDateString()}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {dueBadge(task.dueDate, task.status)}
                <TaskAssignee taskId={task.id} assignedToUserId={task.assignedToUserId} team={team} />
                <TaskStatus taskId={task.id} value={task.status} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
