import { and, asc, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { ConfirmButton } from "@/components/confirm-button";
import { CreatePanel } from "@/components/create-panel";
import { UploadForm } from "@/components/upload-form";
import { db } from "@/db";
import { accountManagerAssignments, clientAccounts, clientTypes, clientWatchers, onboardingSubmissions, projects, referenceFiles, taskAssignments, tasks, tickets, timeEntries, users } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/permissions";
import { uploadDocument } from "@/app/agency/files/actions";
import { uploadReference } from "@/app/portal/(app)/files/actions";
import { addAccountManager, addClientWatcher, removeAccountManager, removeClientWatcher, resetClientOnboarding, updateClientDetails } from "../actions";
import { TaskList, type TaskRow } from "@/app/agency/tasks/task-list";
import { taskDueLabel } from "@/lib/task-display";
import { getTimeReport } from "@/lib/time-report";
import { getClientSentiment } from "@/lib/client-sentiment";
import { ClientBudgetOverview } from "./client-budget-overview";
import { SupportInbox, type Ticket } from "@/app/agency/support/support-inbox";

const AVATAR_TONES = ["from-cyan-500 to-blue-600", "from-emerald-500 to-teal-700", "from-fuchsia-500 to-violet-700", "from-amber-400 to-orange-600", "from-rose-500 to-pink-700", "from-lime-500 to-emerald-700"];

function avatarInitials(value: string) {
  const parts = value.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || value.slice(0, 2).toUpperCase();
}

function avatarTone(id: string) {
  return AVATAR_TONES[[...id].reduce((total, character) => total + character.charCodeAt(0), 0) % AVATAR_TONES.length];
}

export default async function AgencyClientDashboardPage({ params }: { params: Promise<{ clientId: string }> }) {
  const actor = await requireAgencyUser();
  const canManageTasks = await hasPermission(actor, "edit_tasks");
  const { clientId } = await params;
  const client = await db.query.clientAccounts.findFirst({ where: eq(clientAccounts.id, clientId) });
  if (!client) return <Card><CardContent className="pt-6">Client not found.</CardContent></Card>;
  const sentimentRangeEnd = new Date();
  const sentimentRangeStart = new Date(sentimentRangeEnd.getTime() - 90 * 24 * 60 * 60 * 1000);
  const [submission, managers, allManagers, types, clientTasks, references, clientProjects, team, clientTimeEntries, timeReport, clientTicketList, watchers, sentiment] = await Promise.all([
    db.query.onboardingSubmissions.findFirst({ where: eq(onboardingSubmissions.clientAccountId, clientId) }),
    db.select({ id: accountManagerAssignments.id, userId: users.id, name: users.name, email: users.email, image: users.image }).from(accountManagerAssignments).innerJoin(users, eq(accountManagerAssignments.userId, users.id)).where(eq(accountManagerAssignments.clientAccountId, clientId)),
    db.query.users.findMany({ where: eq(users.role, "account_manager") }),
    db.query.clientTypes.findMany({ where: eq(clientTypes.archived, false), orderBy: asc(clientTypes.label) }),
    db.query.tasks.findMany({ where: and(eq(tasks.clientAccountId, clientId), inArray(tasks.status, ["open", "in_progress", "blocked"])) }),
    db.query.referenceFiles.findMany({ where: eq(referenceFiles.clientAccountId, clientId), orderBy: desc(referenceFiles.createdAt) }),
    db.query.projects.findMany({ where: eq(projects.clientAccountId, clientId), orderBy: desc(projects.createdAt) }),
    db.query.users.findMany({ where: inArray(users.role, ["admin", "account_manager", "content_writer"]) }),
    db.query.timeEntries.findMany({ where: eq(timeEntries.clientAccountId, clientId), columns: { taskId: true, durationSeconds: true } }),
    getTimeReport(undefined, false, clientId),
    db.query.tickets.findMany({ where: eq(tickets.clientAccountId, clientId), orderBy: desc(tickets.updatedAt), with: { messages: { orderBy: (message, { asc }) => [asc(message.createdAt)] } } }),
    db.query.clientWatchers.findMany({ where: eq(clientWatchers.clientAccountId, clientId) }),
    getClientSentiment(clientId, sentimentRangeStart, sentimentRangeEnd),
  ]);
  const onboardingData = submission?.data && typeof submission.data === "object" ? Object.entries(submission.data as Record<string, unknown>) : [];
  const assignedManagerIds = new Set(managers.map((manager) => manager.userId));
  const availableManagers = allManagers.filter((manager) => !assignedManagerIds.has(manager.id));
  const watcherUserIds = new Set(watchers.map((watcher) => watcher.userId));
  const availableWatcherStaff = team.filter((member) => !watcherUserIds.has(member.id) && !assignedManagerIds.has(member.id));
  const taskAssignmentRows = clientTasks.length ? await db.query.taskAssignments.findMany({ where: inArray(taskAssignments.taskId, clientTasks.map((task) => task.id)) }) : [];
  const timeByTask = new Map<string, number>();
  for (const entry of clientTimeEntries) if (entry.taskId) timeByTask.set(entry.taskId, (timeByTask.get(entry.taskId) ?? 0) + entry.durationSeconds);
  const projectName = new Map(clientProjects.map((project) => [project.id, project.name]));
  const taskRows: TaskRow[] = clientTasks.map((task) => {
    const assignmentIds = taskAssignmentRows.filter((assignment) => assignment.taskId === task.id).map((assignment) => assignment.userId);
    const assignedToUserIds = assignmentIds.length ? assignmentIds : task.assignedToUserId ? [task.assignedToUserId] : [];
    return { id: task.id, title: task.title, clientAccountId: client.id, projectId: task.projectId, clientName: client.name, projectName: task.projectId ? projectName.get(task.projectId) ?? null : null, meta: task.projectId ? projectName.get(task.projectId) ?? "Unknown project" : "Client task", priority: task.priority, dueDate: task.dueDate?.toISOString() ?? null, status: task.status, assignedToUserIds, assigneeNames: assignedToUserIds.map((id) => team.find((member) => member.id === id)?.name || team.find((member) => member.id === id)?.email || "Unknown"), assignedTeamId: task.assignedTeamId, timeSeconds: timeByTask.get(task.id) ?? 0, dueLabel: taskDueLabel(task.dueDate, task.status) };
  });
  const budgetRow = timeReport.rows[0];
  const clientTickets: Ticket[] = clientTicketList.map((ticket) => ({ id: ticket.id, subject: ticket.subject, status: ticket.status, priority: ticket.priority, clientName: client.name, clientAccountId: client.id, assigneeName: team.find((member) => member.id === ticket.assignedToUserId)?.name ?? null, assignedTeamId: ticket.assignedTeamId, updatedAt: ticket.updatedAt, messages: ticket.messages }));
  const resources = (
    <>
      <Card>
        <CardHeader><CardTitle className="text-base">Projects</CardTitle><CardDescription>{clientProjects.length} for this client</CardDescription></CardHeader>
        <CardContent>
          {clientProjects.length === 0 ? <p className="text-sm text-muted-foreground">No projects yet.</p> : (
            <div className="divide-y divide-border/60">
              {clientProjects.map((project) => (
                <div key={project.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/agency/projects/${project.id}`} className="min-w-0 text-sm font-medium underline-offset-4 hover:underline">{project.name}</Link>
                  <Badge variant="outline" className="capitalize">{project.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Files</CardTitle><CardDescription>{references.length} reference file{references.length === 1 ? "" : "s"}</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <CreatePanel title="Upload for client approval"><UploadForm action={uploadDocument} fixedClientId={client.id} kind="document" submitLabel="Upload for approval" /></CreatePanel>
          <CreatePanel title="Add reference file"><UploadForm action={uploadReference} fixedClientId={client.id} kind="reference" submitLabel="Upload reference" /></CreatePanel>
          {references.length === 0 ? <p className="text-sm text-muted-foreground">No reference files yet.</p> : (
            <div className="divide-y divide-border/60">
              {references.map((ref) => (
                <div key={ref.id} className="min-w-0 py-2">
                  <a href={`/api/files/reference/${ref.id}`} className="block truncate text-sm font-medium underline-offset-4 hover:underline" title={ref.title}>{ref.title}</a>
                  <p className="truncate text-xs text-muted-foreground">{ref.fileName}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );

  return (
    <div className="client-overview space-y-6">
      <PageHeader
        title={client.name}
        description={`Internal client dashboard · ${client.status.charAt(0).toUpperCase()}${client.status.slice(1)}`}
        breadcrumbs={[{ label: "Clients", href: "/agency/clients" }, { label: client.name }]}
        actions={
          <div className="flex flex-wrap gap-2">
            {actor.role === "admin" ? (
              <Button asChild variant="outline">
                <a href={`/api/reports/client-export/${client.id}`}>Export data (DSAR)</a>
              </Button>
            ) : null}
            <ConfirmButton action={resetClientOnboarding} hidden={{ clientAccountId: client.id }} label="Reset onboarding" title="Reset onboarding?" description="This clears the client's submitted answers and sends them back through the onboarding wizard." confirmLabel="Reset" variant="outline" />
          </div>
        }
      />

      <div className="client-overview-columns grid items-start gap-8 min-[1440px]:grid-cols-[minmax(0,1fr)_18rem]">
        <aside aria-label="Client context" className="client-context client-overview-column order-2 min-w-0 space-y-6 min-[1440px]:col-start-2 min-[1440px]:row-start-1">
        <Card>
          <CardHeader><CardTitle className="text-base">Account overview</CardTitle><CardDescription>Internal-only context for this client.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <form action={updateClientDetails} className="grid gap-3">
              <input type="hidden" name="clientAccountId" value={client.id} />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Client type</p>
                <Select name="clientTypeId" defaultValue={client.clientTypeId ?? ""}>
                  <SelectTrigger aria-label="Client type"><SelectValue placeholder="No client type" /></SelectTrigger>
                  <SelectContent>{types.map((type) => <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Status</p>
                <Select name="status" defaultValue={client.status}>
                  <SelectTrigger aria-label="Client status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Button type="submit" size="sm" variant="outline">Save details</Button></div>
            </form>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Account managers</p>
              {managers.length === 0 ? <p className="text-sm">None assigned</p> : managers.map((manager) => (
                <div key={manager.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Avatar size="sm">
                      {manager.image ? <AvatarImage src={manager.image} alt={manager.name || manager.email} /> : null}
                      <AvatarFallback className={`bg-linear-to-br ${avatarTone(manager.userId)} text-[10px] font-semibold text-white`}>{avatarInitials(manager.name || manager.email)}</AvatarFallback>
                    </Avatar>
                    <p className="text-sm">{manager.name || manager.email}</p>
                  </div>
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
                    <SelectTrigger className="min-w-0 flex-1" aria-label="Add account manager"><SelectValue placeholder="Add account manager" /></SelectTrigger>
                    <SelectContent>{availableManagers.map((manager) => <SelectItem key={manager.id} value={manager.id}>{manager.name || manager.email}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button type="submit" size="sm" variant="outline">Add</Button>
                </form>
              ) : null}
            </div>

          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div><CardTitle className="flex items-center gap-2 text-base">Client sentiment <Badge variant="outline">Coming soon</Badge></CardTitle><CardDescription>Last 90 days · from comments, tickets & file decisions</CardDescription></div>
              {sentiment.index !== null ? (
                <Badge variant={sentiment.label === "positive" ? "secondary" : sentiment.label === "at_risk" ? "destructive" : "outline"} className="font-mono text-sm tabular-nums">{sentiment.index}/100</Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {sentiment.index === null ? (
              <p className="text-sm text-muted-foreground">No client comments, decisions or project updates recorded yet.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="capitalize">Trend: {sentiment.trend.replace("_", " ")}</span>
                  <span>·</span>
                  <span>{sentiment.signalCount} signal{sentiment.signalCount === 1 ? "" : "s"}</span>
                  <span>·</span>
                  <span>{sentiment.breakdown.positive} positive / {sentiment.breakdown.neutral} neutral / {sentiment.breakdown.at_risk} at risk</span>
                </div>
                {sentiment.recentSignals.length > 0 ? (
                  <div className="space-y-2">
                    {sentiment.recentSignals.map((signal, index) => (
                      <div key={index} className="border-b pb-2 text-sm last:border-0">
                        <p className="truncate text-muted-foreground">&ldquo;{signal.excerpt}&rdquo;</p>
                        <p className="text-xs text-muted-foreground">{signal.source.replace(/_/g, " ")} · {signal.createdAt.toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Watchers</CardTitle><CardDescription>Give a staff member visibility on this client&apos;s tickets or tasks without assigning them.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {watchers.length === 0 ? <p className="text-sm text-muted-foreground">No watchers yet.</p> : watchers.map((watcher) => {
              const member = team.find((person) => person.id === watcher.userId);
              return (
                <div key={watcher.id} className="flex items-center justify-between gap-2 text-sm">
                  <div>
                    <p>{member?.name || member?.email || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{[watcher.notifyTickets ? "Tickets" : null, watcher.notifyTasks ? "Tasks" : null].filter(Boolean).join(" · ") || "No notifications"}</p>
                  </div>
                  <form action={removeClientWatcher}>
                    <input type="hidden" name="watcherId" value={watcher.id} />
                    <input type="hidden" name="clientAccountId" value={client.id} />
                    <Button type="submit" variant="ghost" size="sm">Remove</Button>
                  </form>
                </div>
              );
            })}
            {availableWatcherStaff.length > 0 ? (
              <form action={addClientWatcher} className="space-y-2 pt-1">
                <input type="hidden" name="clientAccountId" value={client.id} />
                <Select name="userId">
                  <SelectTrigger aria-label="Add watcher"><SelectValue placeholder="Add watcher" /></SelectTrigger>
                  <SelectContent>{availableWatcherStaff.map((member) => <SelectItem key={member.id} value={member.id}>{member.name || member.email}</SelectItem>)}</SelectContent>
                </Select>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm"><Checkbox name="notifyTickets" value="on" defaultChecked />Notify on tickets</label>
                  <label className="flex items-center gap-2 text-sm"><Checkbox name="notifyTasks" value="on" />Notify on tasks</label>
                </div>
                <Button type="submit" size="sm" variant="outline">Add watcher</Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
        {resources}
        <details className="group border-t border-border pt-4">
          <summary className="cursor-pointer text-sm font-semibold">Onboarding information <span className="ml-2 text-xs font-normal text-muted-foreground">{onboardingData.length} answers</span></summary>
          <dl className="mt-4 space-y-3">
            {onboardingData.length === 0 ? <p className="text-sm text-muted-foreground">No onboarding answers yet.</p> : onboardingData.map(([key, value]) => (
              <div key={key} className="border-b pb-2 last:border-0">
                <dt className="text-xs font-medium capitalize text-muted-foreground">{key.replace(/([A-Z])/g, " $1")}</dt>
                <dd className="mt-1 whitespace-pre-wrap wrap-break-word text-sm">{typeof value === "boolean" ? (value ? "Yes" : "No") : String(value ?? "")}</dd>
              </div>
            ))}
          </dl>
        </details>
        </aside>

      <div className="client-overview-column order-1 min-w-0 space-y-6 min-[1440px]:col-start-1 min-[1440px]:row-start-1" data-testid="client-work-column">
      <Card data-testid="client-support-section">
        <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">Support</CardTitle><CardDescription>{clientTickets.length} ticket{clientTickets.length === 1 ? "" : "s"} for this client.</CardDescription></div><Button variant="outline" size="sm" asChild><Link href={`/agency/support?clientId=${client.id}`}>Open support inbox</Link></Button></div></CardHeader>
        <CardContent><SupportInbox tickets={clientTickets} staff={team} /></CardContent>
      </Card>
      <Card data-testid="client-task-section">
        <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">Tasks</CardTitle><CardDescription>{taskRows.length} open task{taskRows.length === 1 ? "" : "s"} for this client.</CardDescription></div><Button variant="outline" size="sm" asChild><Link href={`/agency/tasks?assignee=all&clientId=${client.id}`}>Open task workspace</Link></Button></div></CardHeader>
        <CardContent>{taskRows.length ? <TaskList rows={taskRows} team={team} currentUserId={actor.id} canManage={canManageTasks} /> : <p className="text-sm text-muted-foreground">No open tasks for this client.</p>}</CardContent>
      </Card>

      <Card data-testid="client-budget-section">
        <CardHeader><CardTitle className="text-base">Time & budgets</CardTitle><CardDescription>Monthly delivery usage and service allocations.</CardDescription></CardHeader>
        <CardContent>{budgetRow ? <ClientBudgetOverview clientId={client.id} periodLabel={timeReport.period.label} start={budgetRow.start} end={budgetRow.end} totalAllocatedSeconds={budgetRow.budget?.allocatedSeconds ?? budgetRow.serviceAllocations.reduce((total, allocation) => total + allocation.allocatedSeconds, 0)} serviceAllocations={budgetRow.serviceAllocations} serviceSpent={budgetRow.serviceSpent} /> : <p className="text-sm text-muted-foreground">No allocation data available.</p>}</CardContent>
      </Card>

    </div>
    </div>
    </div>
  );
}

