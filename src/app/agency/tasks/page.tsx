import { and, asc, eq, inArray, or } from "drizzle-orm";
import { ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { CreatePanel } from "@/components/create-panel";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { db } from "@/db";
import { clientAccounts, projects, savedTaskViews, tasks, users } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { createTask, saveTaskView } from "./actions";
import { TaskFilterSelect } from "./task-filter-select";
import { TaskList, type TaskRow } from "./task-list";

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
const SORT_OPTIONS = [
  { value: "due", label: "Sort: due date" },
  { value: "priority", label: "Sort: priority" },
  { value: "status", label: "Sort: status" },
];
const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const STATUS_RANK: Record<string, number> = { open: 0, in_progress: 1, blocked: 2, done: 3 };

function dueLabel(dueDate: Date | null, status: string): TaskRow["dueLabel"] {
  if (!dueDate || status === "done") return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 1) return "soon";
  return null;
}

export default async function AgencyTasksPage({ searchParams }: { searchParams: Promise<{ assignee?: string; clientId?: string; projectId?: string; status?: string; priority?: string; sort?: string }> }) {
  const user = await requireAgencyUser();
  const canManage = user.role === "admin" || user.role === "account_manager";
  const { assignee = "me", clientId = "", projectId = "", status = "open_items", priority = "all", sort = "due" } = await searchParams;

  const [clients, team, allProjects, loggedTime, savedViews, myAssignments] = await Promise.all([
    db.query.clientAccounts.findMany({ orderBy: asc(clientAccounts.name) }),
    db.query.users.findMany({ where: inArray(users.role, ["admin", "account_manager", "content_writer"]) }),
    db.query.projects.findMany({ orderBy: asc(projects.name) }),
    db.query.timeEntries.findMany({ columns: { taskId: true, durationSeconds: true } }),
    db.query.savedTaskViews.findMany({ where: eq(savedTaskViews.userId, user.id), orderBy: (view, { asc }) => [asc(view.name)] }),
    db.query.taskAssignments.findMany({ where: (assignment, { eq }) => eq(assignment.userId, user.id), columns: { taskId: true } }),
  ]);
  const timeByTask = new Map<string, number>();
  for (const entry of loggedTime) if (entry.taskId) timeByTask.set(entry.taskId, (timeByTask.get(entry.taskId) ?? 0) + entry.durationSeconds);
  const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? "Unknown client";
  const projectName = (id: string | null) => (id ? (allProjects.find((project) => project.id === id)?.name ?? "Unknown project") : null);

  const conditions = [];
  if (assignee === "me") {
    const assignedTaskIds = myAssignments.map((assignment) => assignment.taskId);
    conditions.push(assignedTaskIds.length ? or(inArray(tasks.id, assignedTaskIds), eq(tasks.assignedToUserId, user.id))! : eq(tasks.assignedToUserId, user.id));
  }
  if (clientId) conditions.push(eq(tasks.clientAccountId, clientId));
  if (projectId) conditions.push(eq(tasks.projectId, projectId));
  if (status === "open_items") conditions.push(inArray(tasks.status, ["open", "in_progress", "blocked"]));
  else if (status !== "all") conditions.push(eq(tasks.status, status as "open" | "in_progress" | "blocked" | "done"));
  if (priority !== "all") conditions.push(eq(tasks.priority, priority as "low" | "medium" | "high" | "urgent"));

  const taskList = await db.query.tasks.findMany({ where: conditions.length ? and(...conditions) : undefined, orderBy: asc(tasks.dueDate) });
  const assignments = taskList.length ? await db.query.taskAssignments.findMany({ where: (assignment, { inArray }) => inArray(assignment.taskId, taskList.map((task) => task.id)) }) : [];
  const sorted = [...taskList].sort((a, b) => {
    if (sort === "priority") return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (sort === "status") return STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.getTime() - b.dueDate.getTime();
  });
  const rows: TaskRow[] = sorted.map((task) => {
    const assignedToUserIds = assignments.filter((assignment) => assignment.taskId === task.id).map((assignment) => assignment.userId);
    const effectiveAssigneeIds = assignedToUserIds.length ? assignedToUserIds : task.assignedToUserId ? [task.assignedToUserId] : [];
    return ({
    id: task.id,
    title: task.title,
    clientAccountId: task.clientAccountId,
    projectId: task.projectId,
    clientName: clientName(task.clientAccountId),
    projectName: projectName(task.projectId),
    meta: `${clientName(task.clientAccountId)}${projectName(task.projectId) ? ` · ${projectName(task.projectId)}` : ""}`,
    priority: task.priority,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    status: task.status,
    assignedToUserIds: effectiveAssigneeIds,
    assigneeNames: effectiveAssigneeIds.map((id) => team.find((member) => member.id === id)?.name || team.find((member) => member.id === id)?.email || "Unknown"),
    timeSeconds: timeByTask.get(task.id) ?? 0,
    dueLabel: dueLabel(task.dueDate, task.status),
    });
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Tasks" description="Everything the team needs to do, in one place." />

      {canManage ? (
        <CreatePanel title="New task"><Card>
          <CardHeader><CardTitle className="text-base">Create a task</CardTitle><CardDescription>Tasks appear here and in the client portal as outstanding items.</CardDescription></CardHeader>
          <CardContent>
            <form action={createTask} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="task-client">Client</Label><Select name="clientAccountId" required><SelectTrigger id="task-client"><SelectValue placeholder="Choose a client" /></SelectTrigger><SelectContent>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="task-project">Project (optional)</Label><Select name="projectId"><SelectTrigger id="task-project"><SelectValue placeholder="No project" /></SelectTrigger><SelectContent>{allProjects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="task-title">Task title</Label><Input id="task-title" name="title" required /></div>
              <fieldset className="space-y-2"><legend className="text-sm font-medium">Assignees</legend><div className="grid max-h-36 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">{team.map((member) => <label key={member.id} className="flex items-center gap-2 text-sm"><Checkbox name="assignedToUserIds" value={member.id} />{member.name || member.email}</label>)}</div></fieldset>
              <div className="space-y-2 md:col-span-2"><Label htmlFor="task-description">Description</Label><Textarea id="task-description" name="description" /></div>
              <div className="space-y-2"><Label htmlFor="task-priority">Priority</Label><Select name="priority" defaultValue="medium"><SelectTrigger id="task-priority"><SelectValue /></SelectTrigger><SelectContent>{["low", "medium", "high", "urgent"].map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="task-due">Due date</Label><Input id="task-due" name="dueDate" type="date" /></div>
              <div className="space-y-2"><Label htmlFor="task-recurrence">Repeat</Label><Select name="recurrenceRule"><SelectTrigger id="task-recurrence"><SelectValue placeholder="Does not repeat" /></SelectTrigger><SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent></Select></div>
              <div><Button type="submit">Create task</Button></div>
            </form>
          </CardContent>
        </Card></CreatePanel>
      ) : null}

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><CardTitle className="text-base">Task queue</CardTitle><CardDescription>{rows.length} matching task{rows.length === 1 ? "" : "s"}.</CardDescription></div>
            <div className="flex flex-wrap gap-2">
              {savedViews.map((view) => { const filters = view.filters as Record<string, string>; const query = new URLSearchParams(filters).toString(); return <Link key={view.id} href={`/agency/tasks?${query}`} className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted">{view.name}</Link>; })}
              <TaskFilterSelect paramKey="assignee" placeholder="My tasks" options={[{ value: "me", label: "My tasks" }, { value: "all", label: "All tasks" }]} />
              <TaskFilterSelect paramKey="clientId" placeholder="All clients" options={[{ value: "", label: "All clients" }, ...clients.map((client) => ({ value: client.id, label: client.name }))]} />
              <TaskFilterSelect paramKey="projectId" placeholder="All projects" options={[{ value: "", label: "All projects" }, ...allProjects.map((project) => ({ value: project.id, label: project.name }))]} />
              <TaskFilterSelect paramKey="status" placeholder="Open (not done)" options={STATUS_OPTIONS} />
              <TaskFilterSelect paramKey="priority" placeholder="All priorities" options={PRIORITY_OPTIONS} />
              <TaskFilterSelect paramKey="sort" placeholder="Sort: due date" options={SORT_OPTIONS} />
              <form action={saveTaskView} className="flex gap-1"><Input name="name" placeholder="Save view as…" className="h-9 w-32" /><input type="hidden" name="filters" value={JSON.stringify({ assignee, clientId, projectId, status, priority, sort })} /><Button type="submit" size="sm" variant="outline">Save view</Button></form>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState icon={ListTodo} title="No matching tasks" description="Try a different filter, or create a task above." />
          ) : (
            <TaskList rows={rows} team={team} currentUserId={user.id} canManage={canManage} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

