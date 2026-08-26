import { desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/db";
import { clientAccounts, projects } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { createProject } from "./actions";

export default async function AgencyProjectsPage() {
  await requireAgencyUser();
  const [clients, projectList] = await Promise.all([db.query.clientAccounts.findMany({ orderBy: desc(clientAccounts.name) }), db.query.projects.findMany({ orderBy: desc(projects.createdAt), with: { milestones: true } })]);
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">Projects</h1><p className="text-muted-foreground">Start a delivery workspace from a project template.</p></div><Card><CardHeader><CardTitle className="text-base">New project</CardTitle><CardDescription>Templates create a first-pass delivery plan for each project type.</CardDescription></CardHeader><CardContent><form action={createProject} className="grid gap-4 md:grid-cols-3"><div className="space-y-2"><Label htmlFor="project-client">Client</Label><Select name="clientAccountId" required><SelectTrigger id="project-client"><SelectValue placeholder="Choose a client" /></SelectTrigger><SelectContent>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="project-name">Project name</Label><Input id="project-name" name="name" required /></div><div className="space-y-2"><Label htmlFor="project-type">Template</Label><Select name="projectType" defaultValue="brochure_site"><SelectTrigger id="project-type"><SelectValue /></SelectTrigger><SelectContent>{[["brochure_site", "Brochure site"], ["charity_site", "Charity site"], ["ecommerce", "Ecommerce"], ["campaign", "Campaign"]].map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div><Button type="submit">Create workspace</Button></div></form></CardContent></Card><div className="grid gap-4 lg:grid-cols-2">{projectList.length === 0 ? <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">No project workspaces yet.</p></CardContent></Card> : projectList.map((project) => <Card key={project.id}><CardHeader><CardTitle className="text-base">{project.name}</CardTitle><CardDescription className="capitalize">{project.projectType.replace("_", " ")}</CardDescription></CardHeader><CardContent><ol className="space-y-2">{project.milestones.sort((a, b) => a.sortOrder - b.sortOrder).map((milestone) => <li key={milestone.id} className="flex items-center gap-2 text-sm"><span className="size-2 rounded-full bg-primary" />{milestone.title}</li>)}</ol></CardContent></Card>)}</div></div>;
}
