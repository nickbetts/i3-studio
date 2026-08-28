import { formatDistanceToNow } from "date-fns";
import { CONTENT_EVENT_LABELS, roleLabel } from "@/lib/content";

export type TimelineEvent = { id: string; type: string; note: string | null; createdAt: string | Date; actorName: string | null; actorRole: string | null };

export function ContentTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <ol className="space-y-4">
      {events.map((event) => (
        <li key={event.id} className="flex gap-3">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{CONTENT_EVENT_LABELS[event.type] ?? event.type}</p>
            <p className="text-xs text-muted-foreground">{event.actorName || "System"} · {roleLabel(event.actorRole)} · {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}</p>
            {event.note ? <p className="mt-1 whitespace-pre-wrap text-sm">{event.note}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
