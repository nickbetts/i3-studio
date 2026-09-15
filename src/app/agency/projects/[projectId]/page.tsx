import { eq } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle, Plus } from "lucide-react";
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
import { clientAccounts, projects } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { addMilestone, deleteMilestone, updateMilestone, updateProjectStatus } from "../actions";

export default async function AgencyProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  await requireAgencyUser();
  const { projectId } = await params;
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId), with: { milestones: true } });
  if (!project) return <Card><CardContent className="pt-6">Project not found.</CardContent></Card>;
  const client = await db.query.clientAccounts.findFirst({ where: eq(clientAccounts.id, project.clientAccountId) });
  const milestones = [...project.milestones].sort((a, b) => a.sortOrder - b.sortOrder);
  const done = milestones.filter((milestone) => milestone.status === "done").length;
  const percent = milestones.length ? Math.round((done / milestones.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title={project.name} description={`${client?.name ?? "Unknown client"} · ${project.projectType.replace(/_/g, " ")}`} breadcrumbs={[{ label: "Projects", href: "/agency/projects" }, { label: project.name }]} actions={<StatusBadge status={project.status} />} />
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
        <CardHeader>
          <CardTitle className="text-base">Delivery plan</CardTitle>
          <CardDescription>{done} of {milestones.length} milestones complete.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Progress value={percent} />
          <div className="space-y-3">
            {milestones.map((milestone) => (
              <form key={milestone.id} action={updateMilestone} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[auto_1fr_150px_150px_auto] md:items-end">
                <input type="hidden" name="milestoneId" value={milestone.id} />
                <input type="hidden" name="projectId" value={project.id} />
                <span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground md:mb-0.5">{milestone.status === "done" ? <CheckCircle2 className="size-4 text-emerald-400" /> : <Circle className="size-4" />}</span>
                <div className="space-y-1"><Label className="text-xs">Milestone</Label><Input name="title" defaultValue={milestone.title} required /></div>
                <div className="space-y-1"><Label className="text-xs">Status</Label><Select name="status" defaultValue={milestone.status}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["open", "in_progress", "blocked", "done"].map((status) => <SelectItem key={status} value={status} className="capitalize">{status.replace("_", " ")}</SelectItem>)}</SelectContent></Select></div>
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
