import { desc, eq } from "drizzle-orm";
import { FileStack } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ConfirmButton } from "@/components/confirm-button";
import { db } from "@/db";
import { contentTemplates } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import type { ContentField } from "@/lib/content";
import { archiveTemplate, createTemplate } from "../actions";
import { TemplateEditor } from "./template-editor";

export default async function ContentTemplatesPage() {
  await requireAgencyUser();
  const templates = await db.query.contentTemplates.findMany({ where: eq(contentTemplates.archived, false), orderBy: desc(contentTemplates.createdAt) });

  return (
    <div className="space-y-6">
      <PageHeader title="Content templates" description="Define the fields writers fill in for each content type." breadcrumbs={[{ label: "Content", href: "/agency/content" }, { label: "Templates" }]} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New template</CardTitle>
          <CardDescription>Starts from a sensible default field set you can then customise.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createTemplate} className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="tpl-name">Name</Label>
              <Input id="tpl-name" name="name" placeholder="e.g. Blog post" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-type">Base</Label>
              <Select name="contentType" defaultValue="blog">
                <SelectTrigger id="tpl-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="blog">Blog post</SelectItem>
                  <SelectItem value="webpage">Web page copy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end"><Button type="submit">Create template</Button></div>
          </form>
        </CardContent>
      </Card>

      {templates.length === 0 ? (
        <EmptyState icon={FileStack} title="No templates yet" description="Create your first template above." />
      ) : (
        templates.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">{template.name}</CardTitle>
                <ConfirmButton action={archiveTemplate} hidden={{ templateId: template.id }} label="Archive" title="Archive this template?" description="Existing content keeps its fields; the template is hidden from new content." confirmLabel="Archive" variant="ghost" />
              </div>
            </CardHeader>
            <CardContent>
              <TemplateEditor templateId={template.id} name={template.name} fields={(template.fields as ContentField[]) ?? []} />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
