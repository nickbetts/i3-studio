import { and, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { FileCheck2, Image as ImageIcon, PenLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { ArticlePreview } from "@/components/content/article-preview";
import { WorkflowActions } from "@/components/content/workflow-actions";
import { db } from "@/db";
import { contentComments, contentItems, designAssets, documents, users } from "@/db/schema";
import { requireClientUser } from "@/lib/auth-helpers";
import { CONTENT_STATUS_LABELS, type ContentField, type ContentStatus } from "@/lib/content";
import { DecisionForm } from "./decision-form";
import { DesignCanvasDialog } from "@/components/design-review/design-canvas-dialog";

export default async function PortalApprovalsPage() {
  const user = await requireClientUser();

  const [files, designs, content] = await Promise.all([
    db.query.documents.findMany({ where: eq(documents.clientAccountId, user.clientAccountId), orderBy: desc(documents.createdAt) }),
    db.query.designAssets.findMany({ where: eq(designAssets.clientAccountId, user.clientAccountId), orderBy: desc(designAssets.createdAt), with: { annotations: { with: { comments: true } } } }),
    db.query.contentItems.findMany({
      where: and(eq(contentItems.clientAccountId, user.clientAccountId), inArray(contentItems.status, ["pending_client", "client_changes", "approved", "published"])),
      orderBy: desc(contentItems.updatedAt),
    }),
  ]);

  const templateIds = [...new Set(content.map((item) => item.templateId).filter((id): id is string => Boolean(id)))];
  const templates = templateIds.length ? await db.query.contentTemplates.findMany({ where: (row, { inArray: inA }) => inA(row.id, templateIds) }) : [];
  const fieldsFor = (templateId: string | null) => (templates.find((t) => t.id === templateId)?.fields as ContentField[]) ?? [];

  const contentComments_ = content.length
    ? await db
        .select({ id: contentComments.id, contentItemId: contentComments.contentItemId, fieldKey: contentComments.fieldKey, quote: contentComments.quote, body: contentComments.body, resolved: contentComments.resolved, createdAt: contentComments.createdAt, authorName: users.name, authorRole: users.role })
        .from(contentComments)
        .leftJoin(users, eq(contentComments.authorUserId, users.id))
        .where(inArray(contentComments.contentItemId, content.map((item) => item.id)))
    : [];
  const commentsFor = (itemId: string) => contentComments_.filter((comment) => comment.contentItemId === itemId);

  const filesPending = files.filter((f) => f.status === "pending").length;
  const designsPending = designs.filter((d) => d.status === "pending").length;
  const contentPending = content.filter((c) => c.status === "pending_client").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Approvals" description="Review files, designs and content your team has shared, all in one place." />
      <Tabs defaultValue="files">
        <TabsList>
          <TabsTrigger value="files"><FileCheck2 />Files{filesPending > 0 ? <Badge variant="secondary" className="ml-1">{filesPending}</Badge> : null}</TabsTrigger>
          <TabsTrigger value="designs"><ImageIcon />Designs{designsPending > 0 ? <Badge variant="secondary" className="ml-1">{designsPending}</Badge> : null}</TabsTrigger>
          <TabsTrigger value="content"><PenLine />Content{contentPending > 0 ? <Badge variant="secondary" className="ml-1">{contentPending}</Badge> : null}</TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="space-y-4 pt-2">
          {files.length === 0 ? (
            <EmptyState icon={FileCheck2} title="Nothing to review" description="Files shared for approval will appear here." />
          ) : (
            files.map((file) => (
              <Card key={file.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{file.title}</CardTitle>
                      <CardDescription>{file.description || file.fileName}</CardDescription>
                    </div>
                    <StatusBadge status={file.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <a className="text-sm underline underline-offset-4" href={file.fileUrl} target="_blank" rel="noreferrer">Open {file.fileName}</a>
                  {file.status === "pending" ? <DecisionForm documentId={file.id} /> : <p className="text-sm text-muted-foreground">This item has been {file.status.replace("_", " ")}.</p>}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="designs" className="pt-2">
          {designs.length === 0 ? (
            <EmptyState icon={ImageIcon} title="Nothing to review" description="Designs shared for review will appear here." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {designs.map((design) => (
                <DesignCanvasDialog key={design.id} designId={design.id} imageUrl={design.imageUrl} title={design.title} status={design.status} annotations={design.annotations} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="content" className="space-y-4 pt-2">
          {content.length === 0 ? (
            <EmptyState icon={PenLine} title="Nothing to review" description="Blog posts and page copy sent for approval will appear here." />
          ) : (
            content.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{item.title}</CardTitle>
                      <CardDescription><Link href={`/portal/content/${item.id}`} className="underline underline-offset-4">Open full page with comments &amp; history</Link></CardDescription>
                    </div>
                    <StatusBadge status={item.status} label={CONTENT_STATUS_LABELS[item.status as ContentStatus]} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ArticlePreview itemId={item.id} fields={fieldsFor(item.templateId)} data={(item.data as Record<string, unknown>) ?? {}} comments={commentsFor(item.id)} />
                  {item.status === "pending_client" ? <WorkflowActions itemId={item.id} mode="client" /> : null}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
