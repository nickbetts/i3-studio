import { asc, eq } from "drizzle-orm";
import { LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { CreatePanel } from "@/components/create-panel";
import { EmptyState } from "@/components/empty-state";
import { ConfirmButton } from "@/components/confirm-button";
import { db } from "@/db";
import { clientTypes, projectTemplates } from "@/db/schema";
import { requireAgencyPermission } from "@/lib/permissions";
import type { ProjectDeliverableTemplate, ProjectMilestoneTemplate } from "@/lib/project-templates";
import { archiveProjectTemplate, createProjectTemplate, duplicateProjectTemplate } from "./actions";
import { ProjectTemplateEditor } from "./project-template-editor";

export default async function ProjectTemplatesPage() {
  await requireAgencyPermission("edit_project_templates");
  const [templates, types] = await Promise.all([
    db.query.projectTemplates.findMany({ where: eq(projectTemplates.archived, false), orderBy: asc(projectTemplates.name) }),
    db.query.clientTypes.findMany({ where: eq(clientTypes.archived, false), orderBy: asc(clientTypes.label) }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Project templates" description="Define the milestones and required designs/content for each project type." breadcrumbs={[{ label: "Settings", href: "/agency/settings" }, { label: "Project templates" }]} />

      <CreatePanel title="New project template"><Card>
        <CardHeader>
          <CardTitle className="text-base">New project template</CardTitle>
          <CardDescription>Starts empty; add milestones and required deliverables below after creating it.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createProjectTemplate} className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="pt-name">Name</Label>
              <Input id="pt-name" name="name" placeholder="e.g. Charity site" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pt-client-type">Client type</Label>
              <Select name="clientTypeId" defaultValue="">
                <SelectTrigger id="pt-client-type"><SelectValue placeholder="No specific client type" /></SelectTrigger>
                <SelectContent>
                  {types.map((type) => <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end"><Button type="submit">Create template</Button></div>
          </form>
        </CardContent>
      </Card></CreatePanel>

      {templates.length === 0 ? (
        <EmptyState icon={LayoutTemplate} title="No project templates yet" description="Create your first template above." />
      ) : (
        templates.map((template) => (
          <Card key={template.id} data-testid={`project-template-${template.id}`}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">{template.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <form action={duplicateProjectTemplate}><input type="hidden" name="templateId" value={template.id} /><Button type="submit" variant="ghost" size="sm">Duplicate</Button></form>
                  <ConfirmButton action={archiveProjectTemplate} hidden={{ templateId: template.id }} label="Archive" title="Archive this project template?" description="Existing projects keep their milestones/deliverables; the template is hidden from new projects." confirmLabel="Archive" variant="ghost" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ProjectTemplateEditor
                templateId={template.id}
                name={template.name}
                clientTypeId={template.clientTypeId}
                milestones={(template.milestones as ProjectMilestoneTemplate[]) ?? []}
                deliverables={(template.deliverables as ProjectDeliverableTemplate[]) ?? []}
                clientTypes={types}
              />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
