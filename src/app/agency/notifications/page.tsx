import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { getNotifications, markAllNotificationsReadForUser } from "@/lib/notifications";
import { markAllRead } from "./actions";

export default async function AgencyNotificationsPage() {
  const actor = await requireAgencyUser();
  const notificationList = await getNotifications(actor.id);
  const unreadIds = new Set(notificationList.filter((notification) => !notification.readAt).map((notification) => notification.id));
  await markAllNotificationsReadForUser(actor.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Mentions and updates addressed to you."
        actions={unreadIds.size > 0 ? <form action={markAllRead}><Button type="submit" variant="outline" size="sm">Mark all as read</Button></form> : null}
      />
      <Card>
        <CardHeader><CardTitle className="text-base">All notifications</CardTitle><CardDescription>{notificationList.length} total</CardDescription></CardHeader>
        <CardContent>
          {notificationList.length === 0 ? (
            <EmptyState icon={Bell} title="No notifications yet" description="Mention someone in a comment and it'll show up here for them." />
          ) : (
            <div className="divide-y divide-border/60">
              {notificationList.map((notification) => (
                <a key={notification.id} href={notification.linkUrl ?? "#"} className="flex items-start justify-between gap-3 py-3 transition-colors hover:bg-muted/30">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {unreadIds.has(notification.id) ? <span className="size-1.5 shrink-0 rounded-full bg-primary" /> : null}
                      {notification.title}
                    </p>
                    {notification.body ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{notification.body}</p> : null}
                  </div>
                  <Badge variant="outline" className="shrink-0">{notification.createdAt.toLocaleDateString()}</Badge>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
