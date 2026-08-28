import { and, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { FileText, PenLine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/db";
import { contentItems } from "@/db/schema";
import { requireClientUser } from "@/lib/auth-helpers";
import { CONTENT_STATUS_LABELS, type ContentStatus } from "@/lib/content";

export default async function PortalContentPage() {
  const user = await requireClientUser();
  const items = await db.query.contentItems.findMany({
    where: and(eq(contentItems.clientAccountId, user.clientAccountId), inArray(contentItems.status, ["pending_client", "client_changes", "approved", "published"])),
    orderBy: desc(contentItems.updatedAt),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Content" description="Review and approve blog posts and page copy your team has prepared." />
      <Card>
        <CardHeader><CardTitle className="text-base">For your review</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState icon={PenLine} title="Nothing to review yet" description="When your team sends content for approval it will appear here." />
          ) : (
            <div className="divide-y divide-border/60">
              {items.map((item) => (
                <Link key={item.id} href={`/portal/content/${item.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 transition-colors hover:bg-muted/30">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><FileText className="size-4" /></span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="truncate text-xs text-muted-foreground">Updated {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}</p>
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
