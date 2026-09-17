import { desc } from "drizzle-orm";
import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { CreatePanel } from "@/components/create-panel";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Pagination } from "@/components/pagination";
import { SearchInput } from "@/components/search-input";
import { db } from "@/db";
import { clientAccounts, projects } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { createProject } from "./actions";

const PAGE_SIZE = 12;

export default async function AgencyProjectsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAgencyUser();
  const { q, page } = await searchParams;
  const [clients, projectList, templates] = await Promise.all([
    db.query.clientAccounts.findMany({ orderBy: desc(clientAccounts.name) }),
    db.query.projects.findMany({ orderBy: desc(projects.createdAt), with: { milestones: true } }),
    db.query.projectTemplates.findMany({ where: (template, { eq }) => eq(template.archived, false), orderBy: (template, { asc }) => asc(template.name) }),
  ]);
  const clientName = (id: string) => clients.find((client) => client.id === id)?.name ?? "Unknown client";
  const query = (q ?? "").toLowerCase();
  const filtered = projectList.filter((project) => !query || project.name.toLowerCase().includes(query) || clientName(project.clientAccountId).toLowerCase().includes(query));
  const currentPage = Math.max(1, Number(page) || 1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader title="Projects" description="Start a delivery workspace from a project template." />
      <CreatePanel title="New project"><Card>
        <CardHeader><CardTitle className="text-base">New project</CardTitle><CardDescription>Templates create a first-pass delivery plan for each project type.</CardDescription></CardHeader>
        <CardContent>
          <form action={createProject} className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2"><Label htmlFor="project-client">Client</Label><Select name="clientAccountId" required><SelectTrigger id="project-client"><SelectValue placeholder="Choose a client" /></SelectTrigger><SelectContent>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="project-name">Project name</Label><Input id="project-name" name="name" required /></div>
            <div className="space-y-2"><Label htmlFor="project-template">Template</Label><Select name="projectTemplateId" defaultValue={templates[0]?.id}><SelectTrigger id="project-template"><SelectValue placeholder="Choose a template" /></SelectTrigger><SelectContent>{templates.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Button type="submit">Create workspace</Button></div>
          </form>
        </CardContent>
      </Card></CreatePanel>

      <Card>
        <CardHeader className="gap-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="text-base">Project workspaces</CardTitle><CardDescription>{filtered.length} matching project{filtered.length === 1 ? "" : "s"}.</CardDescription></div><SearchInput placeholder="Search projects…" /></div></CardHeader>
        <CardContent>
          {pageItems.length === 0 ? <EmptyState icon={FolderKanban} title="No projects found" description={query ? "Try a different project or client search." : "Create a workspace above to plan milestones and track delivery."} /> : <div className="grid gap-4 lg:grid-cols-2">{pageItems.map((project) => { const milestones = [...project.milestones].sort((a, b) => a.sortOrder - b.sortOrder); const total = milestones.length; const done = milestones.filter((milestone) => milestone.status === "done").length; const percent = total ? Math.round((done / total) * 100) : 0; return <Card key={project.id} className="transition-colors hover:border-primary/40"><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base"><Link href={`/agency/projects/${project.id}`} className="hover:text-primary">{project.name}</Link></CardTitle><CardDescription>{clientName(project.clientAccountId)} · {project.projectType}</CardDescription></div><StatusBadge status={project.status} /></div></CardHeader><CardContent className="space-y-3"><div className="space-y-1.5"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>Progress</span><span>{done}/{total} milestones</span></div><Progress value={percent} /></div><Button variant="outline" size="sm" asChild><Link href={`/agency/projects/${project.id}`}>Open workspace</Link></Button></CardContent></Card>; })}</div>}
          <Pagination page={currentPage} totalPages={totalPages} />
        </CardContent>
      </Card>
    </div>
  );
}
