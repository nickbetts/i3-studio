import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { CreatePanel } from "@/components/create-panel";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { SearchInput } from "@/components/search-input";
import { TaskFilterSelect } from "@/app/agency/tasks/task-filter-select";
import { db } from "@/db";
import { clientAccounts, contentItems, contentTemplates } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { CONTENT_STATUS_LABELS, type ContentStatus } from "@/lib/content";
import { createContentItem } from "./actions";

export default async function AgencyContentPage({ searchParams }: { searchParams: Promise<{ q?: string; clientId?: string; status?: string; assignedTo?: string }> }) {
  await requireAgencyUser();
  const { q, clientId, status, assignedTo } = await searchParams;
  const [clients, templates, team, items] = await Promise.all([
    db.query.clientAccounts.findMany({ orderBy: desc(clientAccounts.name) }),
    db.query.contentTemplates.findMany({ where: eq(contentTemplates.archived, false), orderBy: desc(contentTemplates.createdAt) }),
    db.query.users.findMany({ where: (row, { inArray: inA }) => inA(row.role, ["admin", "account_manager", "content_writer"]) }),
    db.query.contentItems.findMany({ orderBy: desc(contentItems.updatedAt) }),
  ]);
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "Unknown client";
  const assigneeName = (id: string | null) => (id ? team.find((t) => t.id === id)?.name ?? "—" : "Unassigned");
  const query = (q ?? "").toLowerCase();
  const filteredItems = items.filter(
    (item) =>
      (!clientId || item.clientAccountId === clientId) &&
      (!status || item.status === status) &&
      (!assignedTo || (assignedTo === "unassigned" ? !item.assignedToUserId : item.assignedToUserId === assignedTo)) &&
      (!query || item.title.toLowerCase().includes(query) || clientName(item.clientAccountId).toLowerCase().includes(query)),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content"
        description="Draft blog posts and page copy, then move them through review and client approval."
        actions={<Button variant="outline" asChild><Link href="/agency/content/templates">Templates</Link></Button>}
      />
      <CreatePanel title="New content"><Card>
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
      </Card></CreatePanel>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">All content</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput placeholder="Search content…" />
              <TaskFilterSelect paramKey="clientId" placeholder="All clients" options={[{ value: "", label: "All clients" }, ...clients.map((client) => ({ value: client.id, label: client.name }))]} />
              <TaskFilterSelect paramKey="status" placeholder="All statuses" options={[{ value: "", label: "All statuses" }, ...Object.entries(CONTENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))]} />
              <TaskFilterSelect paramKey="assignedTo" placeholder="Anyone" options={[{ value: "", label: "Anyone" }, { value: "unassigned", label: "Unassigned" }, ...team.map((member) => ({ value: member.id, label: member.name || member.email }))]} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <EmptyState icon={PenLine} title="No content found" description={q || clientId || status || assignedTo ? "Try adjusting your search or filters." : "Create a draft above to get started."} />
          ) : (
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="max-w-72 whitespace-normal">
                        <Link href={`/agency/content/${item.id}`} className="font-medium hover:underline">{item.title}</Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{clientName(item.clientAccountId)}</TableCell>
                      <TableCell className="text-muted-foreground">{assigneeName(item.assignedToUserId)}</TableCell>
                      <TableCell><StatusBadge status={item.status} label={CONTENT_STATUS_LABELS[item.status as ContentStatus]} /></TableCell>
                      <TableCell className="text-muted-foreground">{formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
