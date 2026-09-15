import { eq } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { requireClientUser } from "@/lib/auth-helpers";

export default async function PortalProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireClientUser();
  const { projectId } = await params;
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId), with: { milestones: true, updates: true } });
  if (!project || project.clientAccountId !== user.clientAccountId) return <Card><CardContent className="pt-6">Project not found.</CardContent></Card>;
  const milestones = [...project.milestones].sort((a, b) => a.sortOrder - b.sortOrder);
  const done = milestones.filter((milestone) => milestone.status === "done").length;
  const percent = milestones.length ? Math.round((done / milestones.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title={project.name} description={project.projectType.replace(/_/g, " ")} breadcrumbs={[{ label: "Projects", href: "/portal/projects" }, { label: project.name }]} actions={<StatusBadge status={project.status} />} />
      <Button variant="ghost" size="sm" asChild><Link href="/portal/projects"><ArrowLeft className="size-4" />Back to projects</Link></Button>
      <Card>
        <CardHeader><CardTitle className="text-base">Delivery progress</CardTitle><CardDescription>{done} of {milestones.length} milestones complete.</CardDescription></CardHeader>
        <CardContent className="space-y-5"><Progress value={percent} /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{milestones.map((milestone) => <div key={milestone.id} className="rounded-lg border p-3"><div className="flex items-center gap-2">{milestone.status === "done" ? <CheckCircle2 className="size-4 text-emerald-400" /> : <Circle className="size-4 text-muted-foreground" />}<p className="text-sm font-medium">{milestone.title}</p></div><StatusBadge status={milestone.status} className="mt-2" />{milestone.dueDate ? <p className="mt-2 text-xs text-muted-foreground">Due {new Date(milestone.dueDate).toLocaleDateString()}</p> : null}</div>)}</div></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Project updates</CardTitle><CardDescription>Notes from the delivery team.</CardDescription></CardHeader>
        <CardContent className="space-y-3">{project.updates.length === 0 ? <p className="text-sm text-muted-foreground">No updates yet.</p> : [...project.updates].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map((update) => <div key={update.id} className="border-b pb-3 last:border-0"><p className="text-sm">{update.body}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{update.updateType.replace(/_/g, " ")} · {new Date(update.createdAt).toLocaleDateString()}</p></div>)}</CardContent>
      </Card>
    </div>
  );
}
