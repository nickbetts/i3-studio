import { asc, desc, eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { ContentReview } from "@/components/content/content-review";
import { ContentTimeline } from "@/components/content/content-timeline";
import { ContentComments } from "@/components/content/content-comments";
import { WorkflowActions } from "@/components/content/workflow-actions";
import { db } from "@/db";
import { contentComments, contentEvents, contentItems, contentTemplates, contentVersions, users } from "@/db/schema";
import { requireClientUser } from "@/lib/auth-helpers";
import { CONTENT_STATUS_LABELS, type ContentField, type ContentStatus } from "@/lib/content";

export default async function PortalContentItemPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireClientUser();
  const { id } = await params;
  const item = await db.query.contentItems.findFirst({ where: eq(contentItems.id, id) });
  if (!item || item.clientAccountId !== user.clientAccountId) return <Card><CardContent className="pt-6">Content not found.</CardContent></Card>;

  const [template, events, comments, versions] = await Promise.all([
    item.templateId ? db.query.contentTemplates.findFirst({ where: eq(contentTemplates.id, item.templateId) }) : null,
    db.select({ id: contentEvents.id, type: contentEvents.type, note: contentEvents.note, createdAt: contentEvents.createdAt, actorName: users.name, actorRole: users.role }).from(contentEvents).leftJoin(users, eq(contentEvents.actorUserId, users.id)).where(eq(contentEvents.contentItemId, id)).orderBy(asc(contentEvents.createdAt)),
    db.select({ id: contentComments.id, fieldKey: contentComments.fieldKey, quote: contentComments.quote, body: contentComments.body, resolved: contentComments.resolved, createdAt: contentComments.createdAt, authorName: users.name, authorRole: users.role }).from(contentComments).leftJoin(users, eq(contentComments.authorUserId, users.id)).where(eq(contentComments.contentItemId, id)).orderBy(desc(contentComments.createdAt)),
    db.select({ version: contentVersions.version, data: contentVersions.data, note: contentVersions.note, createdAt: contentVersions.createdAt, authorName: users.name }).from(contentVersions).leftJoin(users, eq(contentVersions.authorUserId, users.id)).where(eq(contentVersions.contentItemId, id)).orderBy(desc(contentVersions.version)),
  ]);

  const fields = (template?.fields as ContentField[]) ?? [];
  const data = (item.data as Record<string, unknown>) ?? {};
  const versionRows = versions.map((version) => ({ ...version, data: (version.data as Record<string, unknown>) ?? {} }));
  const canDecide = item.status === "pending_client";

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.title}
        description={CONTENT_STATUS_LABELS[item.status as ContentStatus]}
        breadcrumbs={[{ label: "Content", href: "/portal/content" }, { label: item.title }]}
        actions={<StatusBadge status={item.status} label={CONTENT_STATUS_LABELS[item.status as ContentStatus]} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Content</CardTitle></CardHeader>
            <CardContent><ContentReview itemId={item.id} fields={fields} currentData={data} versions={versionRows} comments={comments} /></CardContent>
          </Card>
          {canDecide ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your decision</CardTitle>
                <CardDescription>Approve to sign off, or request changes and leave red-line comments below.</CardDescription>
              </CardHeader>
              <CardContent><WorkflowActions itemId={item.id} mode="client" /></CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Activity</CardTitle><CardDescription>Every step is timestamped and attributed.</CardDescription></CardHeader>
            <CardContent><ContentTimeline events={events} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Comments &amp; red-lines</CardTitle></CardHeader>
            <CardContent><ContentComments itemId={item.id} fields={fields} comments={comments} /></CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
