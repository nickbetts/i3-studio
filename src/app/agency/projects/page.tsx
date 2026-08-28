import { desc } from "drizzle-orm";
import { FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/db";
import { clientAccounts, projects } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { createProject } from "./actions";

export default async function AgencyProjectsPage() {
  await requireAgencyUser();
  const [clients, projectList] = await Promise.all([
    db.query.clientAccounts.findMany({ orderBy: desc(clientAccounts.name) }),
    db.query.projects.findMany({ orderBy: desc(projects.createdAt), with: { milestones: true } }),
  ]);
  const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? "Unknown client";

  return (
    <div className="space-y-6">
      <PageHeader title="Projects" description="Start a delivery workspace from a project template." />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New project</CardTitle>
          <CardDescription>Templates create a first-pass delivery plan for each project type.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createProject} className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="project-client">Client</Label>
              <Select name="clientAccountId" required>
                <SelectTrigger id="project-client"><SelectValue placeholder="Choose a client" /></SelectTrigger>
                <SelectContent>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-name">Project name</Label>
              <Input id="project-name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-type">Template</Label>
              <Select name="projectType" defaultValue="brochure_site">
                <SelectTrigger id="project-type"><SelectValue /></SelectTrigger>
                <SelectContent>{[["brochure_site", "Brochure site"], ["charity_site", "Charity site"], ["ecommerce", "Ecommerce"], ["campaign", "Campaign"]].map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Button type="submit">Create workspace</Button></div>
          </form>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {projectList.length === 0 ? (
          <div className="lg:col-span-2">
            <EmptyState icon={FolderKanban} title="No project workspaces yet" description="Create a workspace above to plan milestones and track delivery." />
          </div>
        ) : (
          projectList.map((project) => {
            const total = project.milestones.length;
            const done = project.milestones.filter((milestone) => milestone.status === "done").length;
            const percent = total ? Math.round((done / total) * 100) : 0;
            return (
              <Card key={project.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{project.name}</CardTitle>
                      <CardDescription>{clientName(project.clientAccountId)} · <span className="capitalize">{project.projectType.replace(/_/g, " ")}</span></CardDescription>
                    </div>
                    <StatusBadge status={project.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{done}/{total} milestones</span>
                    </div>
                    <Progress value={percent} />
                  </div>
                  <ol className="space-y-2">
                    {project.milestones.sort((a, b) => a.sortOrder - b.sortOrder).map((milestone) => (
                      <li key={milestone.id} className="flex items-center gap-2 text-sm">
                        <span className={`size-2 shrink-0 rounded-full ${milestone.status === "done" ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                        <span className={milestone.status === "done" ? "text-muted-foreground line-through" : ""}>{milestone.title}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
