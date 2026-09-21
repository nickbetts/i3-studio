import { and, asc, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { ConfirmButton } from "@/components/confirm-button";
import { CreatePanel } from "@/components/create-panel";
import { UploadForm } from "@/components/upload-form";
import { db } from "@/db";
import { accountManagerAssignments, clientAccounts, clientTypes, onboardingSubmissions, projects, referenceFiles, taskAssignments, tasks, timeEntries, users } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { uploadDocument } from "@/app/agency/files/actions";
import { uploadReference } from "@/app/portal/(app)/files/actions";
import { addAccountManager, removeAccountManager, resetClientOnboarding, updateClientDetails } from "../actions";
import { TaskList, type TaskRow } from "@/app/agency/tasks/task-list";
import { taskDueLabel } from "@/lib/task-display";
import { getTimeReport } from "@/lib/time-report";
import { ClientBudgetOverview } from "./client-budget-overview";

export default async function AgencyClientDashboardPage({ params }: { params: Promise<{ clientId: string }> }) {
  const actor = await requireAgencyUser();
  const { clientId } = await params;
  const client = await db.query.clientAccounts.findFirst({ where: eq(clientAccounts.id, clientId) });
  if (!client) return <Card><CardContent className="pt-6">Client not found.</CardContent></Card>;
  const [submission, managers, allManagers, types, clientTasks, references, clientProjects, team, clientTimeEntries, timeReport] = await Promise.all([
    db.query.onboardingSubmissions.findFirst({ where: eq(onboardingSubmissions.clientAccountId, clientId) }),
    db.select({ id: accountManagerAssignments.id, userId: users.id, name: users.name, email: users.email }).from(accountManagerAssignments).innerJoin(users, eq(accountManagerAssignments.userId, users.id)).where(eq(accountManagerAssignments.clientAccountId, clientId)),
    db.query.users.findMany({ where: eq(users.role, "account_manager") }),
    db.query.clientTypes.findMany({ where: eq(clientTypes.archived, false), orderBy: asc(clientTypes.label) }),
    db.query.tasks.findMany({ where: and(eq(tasks.clientAccountId, clientId), inArray(tasks.status, ["open", "in_progress", "blocked"])) }),
    db.query.referenceFiles.findMany({ where: eq(referenceFiles.clientAccountId, clientId), orderBy: desc(referenceFiles.createdAt) }),
    db.query.projects.findMany({ where: eq(projects.clientAccountId, clientId), orderBy: desc(projects.createdAt) }),
    db.query.users.findMany({ where: inArray(users.role, ["admin", "account_manager", "content_writer"]) }),
    db.query.timeEntries.findMany({ where: eq(timeEntries.clientAccountId, clientId), columns: { taskId: true, durationSeconds: true } }),
    getTimeReport(undefined, false, clientId),
  ]);
  const onboardingData = submission?.data && typeof submission.data === "object" ? Object.entries(submission.data as Record<string, unknown>) : [];
  const assignedManagerIds = new Set(managers.map((manager) => manager.userId));
  const availableManagers = allManagers.filter((manager) => !assignedManagerIds.has(manager.id));
  const taskAssignmentRows = clientTasks.length ? await db.query.taskAssignments.findMany({ where: inArray(taskAssignments.taskId, clientTasks.map((task) => task.id)) }) : [];
  const timeByTask = new Map<string, number>();
  for (const entry of clientTimeEntries) if (entry.taskId) timeByTask.set(entry.taskId, (timeByTask.get(entry.taskId) ?? 0) + entry.durationSeconds);
  const projectName = new Map(clientProjects.map((project) => [project.id, project.name]));
  const taskRows: TaskRow[] = clientTasks.map((task) => {
    const assignmentIds = taskAssignmentRows.filter((assignment) => assignment.taskId === task.id).map((assignment) => assignment.userId);
    const assignedToUserIds = assignmentIds.length ? assignmentIds : task.assignedToUserId ? [task.assignedToUserId] : [];
    return { id: task.id, title: task.title, clientAccountId: client.id, projectId: task.projectId, clientName: client.name, projectName: task.projectId ? projectName.get(task.projectId) ?? null : null, meta: task.projectId ? projectName.get(task.projectId) ?? "Unknown project" : "Client task", priority: task.priority, dueDate: task.dueDate?.toISOString() ?? null, status: task.status, assignedToUserIds, assigneeNames: assignedToUserIds.map((id) => team.find((member) => member.id === id)?.name || team.find((member) => member.id === id)?.email || "Unknown"), timeSeconds: timeByTask.get(task.id) ?? 0, dueLabel: taskDueLabel(task.dueDate, task.status) };
  });
  const budgetRow = timeReport.rows[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.name}
        description={`Internal client dashboard · ${client.status.charAt(0).toUpperCase()}${client.status.slice(1)}`}
        breadcrumbs={[{ label: "Clients", href: "/agency/clients" }, { label: client.name }]}
        actions={
          <div className="flex gap-2">
            {actor.role === "admin" ? (
              <Button asChild variant="outline">
                <a href={`/api/reports/client-export/${client.id}`}>Export data (DSAR)</a>
              </Button>
            ) : null}
            <ConfirmButton action={resetClientOnboarding} hidden={{ clientAccountId: client.id }} label="Reset onboarding" title="Reset onboarding?" description="This clears the client's submitted answers and sends them back through the onboarding wizard." confirmLabel="Reset" variant="outline" />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Onboarding information</CardTitle><CardDescription>Everything the client has submitted through the wizard.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {onboardingData.length === 0 ? <p className="text-sm text-muted-foreground">No onboarding answers yet.</p> : onboardingData.map(([key, value]) => (
              <div key={key} className="border-b pb-2 last:border-0">
                <p className="text-xs font-medium capitalize text-muted-foreground">{key.replace(/([A-Z])/g, " $1")}</p>
                <p className="whitespace-pre-wrap text-sm">{typeof value === "boolean" ? (value ? "Yes" : "No") : String(value ?? "")}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Account overview</CardTitle><CardDescription>Internal-only context for this client.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <form action={updateClientDetails} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="clientAccountId" value={client.id} />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Client type</p>
                <Select name="clientTypeId" defaultValue={client.clientTypeId ?? ""}>
                  <SelectTrigger><SelectValue placeholder="No client type" /></SelectTrigger>
                  <SelectContent>{types.map((type) => <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Status</p>
                <Select name="status" defaultValue={client.status}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2"><Button type="submit" size="sm" variant="outline">Save details</Button></div>
            </form>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Account managers</p>
              {managers.length === 0 ? <p className="text-sm">None assigned</p> : managers.map((manager) => (
                <div key={manager.id} className="flex items-center justify-between gap-2">
                  <p className="text-sm">{manager.name || manager.email}</p>
                  <form action={removeAccountManager}>
                    <input type="hidden" name="assignmentId" value={manager.id} />
                    <input type="hidden" name="clientAccountId" value={client.id} />
                    <Button type="submit" variant="ghost" size="sm">Remove</Button>
                  </form>
                </div>
              ))}
              {availableManagers.length > 0 ? (
                <form action={addAccountManager} className="flex items-center gap-2 pt-1">
                  <input type="hidden" name="clientAccountId" value={client.id} />
                  <Select name="userId">
                    <SelectTrigger className="flex-1" aria-label="Add account manager"><SelectValue placeholder="Add account manager" /></SelectTrigger>
                    <SelectContent>{availableManagers.map((manager) => <SelectItem key={manager.id} value={manager.id}>{manager.name || manager.email}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button type="submit" size="sm" variant="outline">Add</Button>
                </form>
              ) : null}
            </div>

          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">Time & budgets</CardTitle><CardDescription>Current monthly allocation and delivery usage for this client.</CardDescription></div></div></CardHeader>
        <CardContent>{budgetRow ? <ClientBudgetOverview clientId={client.id} periodLabel={timeReport.period.label} start={budgetRow.start} end={budgetRow.end} totalAllocatedSeconds={budgetRow.budget?.allocatedSeconds ?? budgetRow.serviceAllocations.reduce((total, allocation) => total + allocation.allocatedSeconds, 0)} serviceAllocations={budgetRow.serviceAllocations} serviceSpent={budgetRow.serviceSpent} /> : <p className="text-sm text-muted-foreground">No allocation data available.</p>}</CardContent>
      </Card>

      <Card>
        <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">Tasks</CardTitle><CardDescription>{taskRows.length} open task{taskRows.length === 1 ? "" : "s"} for this client.</CardDescription></div><Button variant="outline" size="sm" asChild><Link href={`/agency/tasks?assignee=all&clientId=${client.id}`}>Open task workspace</Link></Button></div></CardHeader>
        <CardContent>{taskRows.length ? <TaskList rows={taskRows} team={team} currentUserId={actor.id} canManage={actor.role === "admin" || actor.role === "account_manager"} /> : <p className="text-sm text-muted-foreground">No open tasks for this client.</p>}</CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Projects</CardTitle><CardDescription>{clientProjects.length} project{clientProjects.length === 1 ? "" : "s"} for this client.</CardDescription></CardHeader>
        <CardContent>
          {clientProjects.length === 0 ? <p className="text-sm text-muted-foreground">No projects yet.</p> : (
            <div className="divide-y divide-border/60">
              {clientProjects.map((project) => (
                <div key={project.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/agency/projects/${project.id}`} className="text-sm font-medium underline-offset-4 hover:underline">{project.name}</Link>
                  <Badge variant="outline" className="capitalize">{project.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreatePanel title="Upload for client approval"><Card>
        <CardHeader><CardTitle className="text-base">Upload for client approval</CardTitle><CardDescription>This upload is performed by the agency and appears in the client&apos;s Approvals area.</CardDescription></CardHeader>
        <CardContent><UploadForm action={uploadDocument} fixedClientId={client.id} kind="document" submitLabel="Upload for approval" /></CardContent>
      </Card></CreatePanel>

      <Card>
        <CardHeader><CardTitle className="text-base">Reference files</CardTitle><CardDescription>Files the client shared, plus anything the team adds for them.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <CreatePanel title="Add reference file"><UploadForm action={uploadReference} fixedClientId={client.id} kind="reference" submitLabel="Upload reference" /></CreatePanel>
          {references.length === 0 ? <p className="text-sm text-muted-foreground">No reference files yet.</p> : (
            <div className="divide-y divide-border/60">
              {references.map((ref) => (
                <div key={ref.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <a href={`/api/files/reference/${ref.id}`} className="truncate text-sm font-medium underline-offset-4 hover:underline">{ref.title}</a>
                    <p className="truncate text-xs text-muted-foreground">{ref.fileName}</p>
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

