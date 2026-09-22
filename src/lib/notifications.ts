import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { findMentionedUserIds } from "@/lib/mentions";

export async function createNotification(input: { userId: string; type: string; title: string; body?: string; linkUrl?: string }) {
  await db.insert(notifications).values({ userId: input.userId, type: input.type, title: input.title, body: input.body ?? null, linkUrl: input.linkUrl ?? null });
}

export type MentionCandidate = { id: string; name: string; role: string };

/** Finds @Name mentions in text against the given candidate pool and notifies everyone matched except the author. */
export async function notifyMentions(input: {
  text: string;
  candidates: MentionCandidate[];
  actorUserId: string;
  actorName: string;
  excerpt: string;
  linkUrlForRole: (role: string) => string;
}): Promise<void> {
  const mentionedIds = findMentionedUserIds(input.text, input.candidates).filter((id) => id !== input.actorUserId);
  if (!mentionedIds.length) return;
  const byId = new Map(input.candidates.map((candidate) => [candidate.id, candidate]));
  await Promise.all(
    mentionedIds.map((userId) => {
      const candidate = byId.get(userId);
      if (!candidate) return Promise.resolve();
      return createNotification({
        userId,
        type: "mention",
        title: `${input.actorName} mentioned you`,
        body: input.excerpt.slice(0, 200),
        linkUrl: input.linkUrlForRole(candidate.role),
      });
    }),
  );
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const rows = await db.query.notifications.findMany({ where: and(eq(notifications.userId, userId), isNull(notifications.readAt)), columns: { id: true } });
  return rows.length;
}

export async function getNotifications(userId: string, limit = 50) {
  return db.query.notifications.findMany({ where: eq(notifications.userId, userId), orderBy: desc(notifications.createdAt), limit });
}

export async function markAllNotificationsReadForUser(userId: string): Promise<void> {
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}

export async function markNotificationReadForUser(notificationId: string, userId: string): Promise<void> {
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}
