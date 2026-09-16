import type { ContentStatus } from "./content";

type Actor = { id: string; role: string; clientAccountId?: string | null };
type Item = { status: ContentStatus; clientAccountId: string; assignedToUserId: string | null; createdByUserId: string | null };
export const editableContentStates: ContentStatus[] = ["draft", "am_changes", "client_changes"];
export const clientContentStates: ContentStatus[] = ["pending_client", "client_changes", "approved", "published"];

export function canEditContent(actor: Actor, item: Item) {
  return editableContentStates.includes(item.status) && (actor.role === "admin" || actor.role === "account_manager" || (actor.role === "content_writer" && (item.assignedToUserId === actor.id || (!item.assignedToUserId && item.createdByUserId === actor.id))));
}

export function canReadContent(actor: Actor, item: Item) {
  if (actor.role === "client") return actor.clientAccountId === item.clientAccountId && clientContentStates.includes(item.status);
  return ["admin", "account_manager", "content_writer"].includes(actor.role);
}

export function canReviewContent(actor: Actor, item: Item, submitterId: string | null) {
  return ["admin", "account_manager"].includes(actor.role) && item.status === "pending_am" && !!submitterId && actor.id !== submitterId;
}