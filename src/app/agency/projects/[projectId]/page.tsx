import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Progress } from "@/components/ui/progress";
import { ConfirmButton } from "@/components/confirm-button";
import { db } from "@/db";
import { clientAccounts, contentItems, designAssets, documents, projectAccountManagerAssignments, projectDeliverables, projects, users } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { addMilestone, addProjectAccountManager, deleteMilestone, linkProjectDeliverable, removeProjectAccountManager, updateMilestone, updateProjectStatus } from "../actions";

const DELIVERABLE_TYPE_LABELS: Record<string, string> = { design: "Design", content: "Content", document: "Document" };

export default async function AgencyProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  await requireAgencyUser();
  const { projectId } = await params;
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId), with: { milestones: true } });
  if (!project) return <Card><CardContent className="pt-6">Project not found.</CardContent></Card>;
  const [client, team, projectManagers, deliverables, designOptions, contentOptions, documentOptions] = await Promise.all([
    db.query.clientAccounts.findFirst({ where: eq(clientAccounts.id, project.clientAccountId) }),
    db.query.users.findMany({ where: inArray(users.role, ["admin", "account_manager", "content_writer"]) }),
    db.select({ id: projectAccountManagerAssignments.id, userId: users.id, name: users.name, email: users.email }).from(projectAccountManagerAssignments).innerJoin(users, eq(projectAccountManagerAssignments.userId, users.id)).where(eq(projectAccountManagerAssignments.projectId, projectId)),
    db.query.projectDeliverables.findMany({ where: eq(projectDeliverables.projectId, projectId) }),
    db.query.designAssets.findMany({ where: eq(designAssets.clientAccountId, project.clientAccountId) }),
    db.query.contentItems.findMany({ where: eq(contentItems.clientAccountId, project.clientAccountId) }),
    db.query.documents.findMany({ where: eq(documents.clientAccountId, project.clientAccountId) }),
  ]);
  const milestones = [...project.milestones].sort((a, b) => a.sortOrder - b.sortOrder);
  const done = milestones.filter((milestone) => milestone.status === "done").length;
  const percent = milestones.length ? Math.round((done / milestones.length) * 100) : 0;
  const assignedManagerIds = new Set(projectManagers.map((manager) => manager.userId));
  const availableManagers = team.filter((member) => !assignedManagerIds.has(member.id));
  const optionsForType = (type: string) => (type === "design" ? designOptions.map((item) => ({ id: item.id, title: item.title })) : type === "content" ? contentOptions.map((item) => ({ id: item.id, title: item.title })) : documentOptions.map((item) => ({ id: item.id, title: item.title })));
  const linkedIdFor = (deliverable: (typeof deliverables)[number]) => deliverable.designAssetId ?? deliverable.contentItemId ?? deliverable.documentId;

  return (
    <div className="space-y-6">
      <PageHeader title={project.name} description={`${client?.name ?? "Unknown client"} · ${project.projectType}`} breadcrumbs={[{ label: "Projects", href: "/agency/projects" }, { label: project.name }]} actions={<StatusBadge status={project.status} />} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild><Link href="/agency/projects"><ArrowLeft className="size-4" />Back to projects</Link></Button>
        <form action={updateProjectStatus} className="flex items-center gap-2">
          <input type="hidden" name="projectId" value={project.id} />
          <Select name="status" defaultValue={project.status}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{["active", "paused", "completed"].map((status) => <SelectItem key={status} value={status} className="capitalize">{status}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="submit" variant="outline" size="sm">Update status</Button>
        </form>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Account managers</CardTitle><CardDescription>Who at i3 owns this project.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {projectManagers.length === 0 ? <p className="text-sm text-muted-foreground">None assigned</p> : projectManagers.map((manager) => (
            <div key={manager.id} className="flex items-center justify-between gap-2">
              <p className="text-sm">{manager.name || manager.email}</p>
              <form action={removeProjectAccountManager}>
                <input type="hidden" name="assignmentId" value={manager.id} />
                <input type="hidden" name="projectId" value={project.id} />
                <Button type="submit" variant="ghost" size="sm">Remove</Button>
              </form>
            </div>
          ))}
          {availableManagers.length > 0 ? (
            <form action={addProjectAccountManager} className="flex items-center gap-2 pt-1">
              <input type="hidden" name="projectId" value={project.id} />
              <Select name="userId">
                <SelectTrigger className="flex-1" aria-label="Add account manager"><SelectValue placeholder="Add account manager" /></SelectTrigger>
                <SelectContent>{availableManagers.map((member) => <SelectItem key={member.id} value={member.id}>{member.name || member.email}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="submit" size="sm" variant="outline">Add</Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {deliverables.length > 0 ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Required deliverables</CardTitle><CardDescription>What this project&apos;s template expects, and what&apos;s been provided.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {deliverables.map((deliverable) => {
              const linkedId = linkedIdFor(deliverable);
              const options = optionsForType(deliverable.type);
              return (
                <div key={deliverable.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{DELIVERABLE_TYPE_LABELS[deliverable.type] ?? deliverable.type}</Badge>
                      {deliverable.standard ? <Badge variant="outline">Standard</Badge> : <Badge variant="outline">Optional</Badge>}
                      <p className="text-sm font-medium">{deliverable.title}</p>
                    </div>
                    {deliverable.description ? <p className="text-xs text-muted-foreground">{deliverable.description}</p> : null}
                  </div>
                  <form action={linkProjectDeliverable} className="flex items-center gap-2">
                    <input type="hidden" name="deliverableId" value={deliverable.id} />
                    <input type="hidden" name="projectId" value={project.id} />
                    <Select name="itemId" defaultValue={linkedId ?? ""}>
                      <SelectTrigger className="w-56"><SelectValue placeholder="Not started" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Not started</SelectItem>
                        {options.map((option) => <SelectItem key={option.id} value={option.id}>{option.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button type="submit" size="sm" variant="outline">Save</Button>
                  </form>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delivery plan</CardTitle>
          <CardDescription>{done} of {milestones.length} milestones complete.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Progress value={percent} />
          <div className="space-y-3">
            {milestones.map((milestone) => (
              <form key={milestone.id} action={updateMilestone} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[auto_1fr_150px_150px_150px_auto] md:items-end">
                <input type="hidden" name="milestoneId" value={milestone.id} />
                <input type="hidden" name="projectId" value={project.id} />
                <span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground md:mb-0.5">{milestone.status === "done" ? <CheckCircle2 className="size-4 text-emerald-400" /> : <Circle className="size-4" />}</span>
                <div className="space-y-1"><Label className="text-xs">Milestone</Label><Input name="title" defaultValue={milestone.title} required /></div>
                <div className="space-y-1"><Label className="text-xs">Status</Label><Select name="status" defaultValue={milestone.status}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["open", "in_progress", "blocked", "done"].map((status) => <SelectItem key={status} value={status} className="capitalize">{status.replace("_", " ")}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label className="text-xs">Assignee</Label><Select name="assignedToUserId" defaultValue={milestone.assignedToUserId ?? ""}><SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger><SelectContent><SelectItem value="">Unassigned</SelectItem>{team.map((member) => <SelectItem key={member.id} value={member.id}>{member.name || member.email}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label className="text-xs">Due date</Label><Input name="dueDate" type="date" defaultValue={milestone.dueDate ? new Date(milestone.dueDate).toISOString().slice(0, 10) : ""} /></div>
                <div className="flex gap-2"><Button type="submit" size="sm" variant="outline">Save</Button><ConfirmButton action={deleteMilestone} hidden={{ milestoneId: milestone.id, projectId: project.id }} label="Delete" title="Delete milestone?" description="This removes the milestone from the delivery plan." confirmLabel="Delete" variant="ghost" /></div>
              </form>
            ))}
          </div>
          <form action={addMilestone} className="grid gap-3 rounded-lg border border-dashed p-3 md:grid-cols-[1fr_180px_auto] md:items-end">
            <input type="hidden" name="projectId" value={project.id} />
            <div className="space-y-1"><Label className="text-xs">New milestone</Label><Input name="title" placeholder="e.g. QA review" required /></div>
            <div className="space-y-1"><Label className="text-xs">Due date</Label><Input name="dueDate" type="date" /></div>
            <Button type="submit"><Plus className="size-4" />Add milestone</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

