import { asc, desc, eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { ContentReview } from "@/components/content/content-review";
import { ContentTimeline } from "@/components/content/content-timeline";
import { ContentComments } from "@/components/content/content-comments";
import { WorkflowActions } from "@/components/content/workflow-actions";
import { db } from "@/db";
import { clientAccounts, contentComments, contentEvents, contentItems, contentTemplates, contentVersions, users } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { CONTENT_STATUS_LABELS, type ContentField, type ContentStatus } from "@/lib/content";
import { ContentEditor } from "../content-editor";

export default async function AgencyContentItemPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAgencyUser();
  const { id } = await params;
  const item = await db.query.contentItems.findFirst({ where: eq(contentItems.id, id) });
  if (!item) return <Card><CardContent className="pt-6">Content not found.</CardContent></Card>;

  const [template, client, events, comments, versions] = await Promise.all([
    item.templateId ? db.query.contentTemplates.findFirst({ where: eq(contentTemplates.id, item.templateId) }) : null,
    db.query.clientAccounts.findFirst({ where: eq(clientAccounts.id, item.clientAccountId) }),
    db.select({ id: contentEvents.id, type: contentEvents.type, note: contentEvents.note, createdAt: contentEvents.createdAt, actorName: users.name, actorRole: users.role }).from(contentEvents).leftJoin(users, eq(contentEvents.actorUserId, users.id)).where(eq(contentEvents.contentItemId, id)).orderBy(asc(contentEvents.createdAt)),
    db.select({ id: contentComments.id, fieldKey: contentComments.fieldKey, quote: contentComments.quote, body: contentComments.body, resolved: contentComments.resolved, createdAt: contentComments.createdAt, authorName: users.name, authorRole: users.role }).from(contentComments).leftJoin(users, eq(contentComments.authorUserId, users.id)).where(eq(contentComments.contentItemId, id)).orderBy(desc(contentComments.createdAt)),
    db.select({ version: contentVersions.version, data: contentVersions.data, note: contentVersions.note, createdAt: contentVersions.createdAt, authorName: users.name }).from(contentVersions).leftJoin(users, eq(contentVersions.authorUserId, users.id)).where(eq(contentVersions.contentItemId, id)).orderBy(desc(contentVersions.version)),
  ]);

  const fields = (template?.fields as ContentField[]) ?? [];
  const data = (item.data as Record<string, unknown>) ?? {};
  const versionRows = versions.map((version) => ({ ...version, data: (version.data as Record<string, unknown>) ?? {} }));
  const canEdit = ["draft", "am_changes", "client_changes"].includes(item.status);
  const canAmDecide = (actor.role === "admin" || actor.role === "account_manager") && item.status === "pending_am";
  const canPublish = (actor.role === "admin" || actor.role === "account_manager") && item.status === "approved";

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.title}
        description={`${client?.name ?? "Client"} · ${CONTENT_STATUS_LABELS[item.status as ContentStatus]}`}
        breadcrumbs={[{ label: "Content", href: "/agency/content" }, { label: item.title }]}
        actions={<StatusBadge status={item.status} label={CONTENT_STATUS_LABELS[item.status as ContentStatus]} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{canEdit ? "Edit content" : "Content"}</CardTitle>
              {canEdit ? <CardDescription>Save drafts as you go, then submit for account-manager review.</CardDescription> : null}
            </CardHeader>
            <CardContent>
              {canEdit ? <ContentEditor itemId={item.id} fields={fields} initialData={data} canSubmit /> : <ContentReview itemId={item.id} fields={fields} currentData={data} versions={versionRows} comments={comments} />}
            </CardContent>
          </Card>

          {canAmDecide || canPublish ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{canPublish ? "Publish" : "Account manager review"}</CardTitle>
                <CardDescription>{canPublish ? "Client has approved this content." : "Approve to send to the client, or request changes from the writer."}</CardDescription>
              </CardHeader>
              <CardContent><WorkflowActions itemId={item.id} mode={canPublish ? "publish" : "am"} /></CardContent>
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
            <CardContent><ContentComments itemId={item.id} fields={fields} comments={comments} canDelete={actor.role === "admin"} /></CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
