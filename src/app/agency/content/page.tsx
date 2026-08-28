import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { FileText, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/db";
import { clientAccounts, contentItems, contentTemplates } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { CONTENT_STATUS_LABELS, type ContentStatus } from "@/lib/content";
import { createContentItem } from "./actions";

export default async function AgencyContentPage() {
  await requireAgencyUser();
  const [clients, templates, team, items] = await Promise.all([
    db.query.clientAccounts.findMany({ orderBy: desc(clientAccounts.name) }),
    db.query.contentTemplates.findMany({ where: eq(contentTemplates.archived, false), orderBy: desc(contentTemplates.createdAt) }),
    db.query.users.findMany({ where: (row, { inArray: inA }) => inA(row.role, ["admin", "account_manager", "content_writer"]) }),
    db.query.contentItems.findMany({ orderBy: desc(contentItems.updatedAt) }),
  ]);
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "Unknown client";
  const assigneeName = (id: string | null) => (id ? team.find((t) => t.id === id)?.name ?? "—" : "Unassigned");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content"
        description="Draft blog posts and page copy, then move them through review and client approval."
        actions={<Button variant="outline" asChild><Link href="/agency/content/templates">Templates</Link></Button>}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New content</CardTitle>
          <CardDescription>Pick a template and assign a writer to start a draft.</CardDescription>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Create a <Link href="/agency/content/templates" className="text-primary underline">template</Link> first.</p>
          ) : (
            <form action={createContentItem} className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="c-title">Title</Label>
                <Input id="c-title" name="title" placeholder="Working title" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-client">Client</Label>
                <Select name="clientAccountId" required>
                  <SelectTrigger id="c-client"><SelectValue placeholder="Choose" /></SelectTrigger>
                  <SelectContent>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-template">Template</Label>
                <Select name="templateId" required>
                  <SelectTrigger id="c-template"><SelectValue placeholder="Choose" /></SelectTrigger>
                  <SelectContent>{templates.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="c-assignee">Assign to</Label>
                <Select name="assignedToUserId">
                  <SelectTrigger id="c-assignee"><SelectValue placeholder="Me" /></SelectTrigger>
                  <SelectContent>{team.map((member) => <SelectItem key={member.id} value={member.id}>{member.name || member.email}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-end md:col-span-2"><Button type="submit">Create draft</Button></div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">All content</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState icon={PenLine} title="No content yet" description="Create a draft above to get started." />
          ) : (
            <div className="divide-y divide-border/60">
              {items.map((item) => (
                <Link key={item.id} href={`/agency/content/${item.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 transition-colors hover:bg-muted/30">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><FileText className="size-4" /></span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{clientName(item.clientAccountId)} · {assigneeName(item.assignedToUserId)} · updated {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}</p>
                    </div>
                  </div>
                  <StatusBadge status={item.status} label={CONTENT_STATUS_LABELS[item.status as ContentStatus]} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
