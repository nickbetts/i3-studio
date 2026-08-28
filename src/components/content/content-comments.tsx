"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addContentComment, deleteContentComment, resolveContentComment } from "@/app/agency/content/actions";
import type { ContentField } from "@/lib/content";

const AGENCY_ROLES = ["admin", "account_manager", "content_writer"];

export type CommentRow = {
  id: string;
  fieldKey: string | null;
  quote: string | null;
  body: string;
  resolved: boolean;
  createdAt: string | Date;
  authorName: string | null;
  authorRole: string | null;
};

// Briefly rings a target element so a cross-reference (mark <-> sidebar comment) is easy to spot.
function flash(el: Element | null) {
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("ring-2", "ring-primary", "bg-primary/5");
  window.setTimeout(() => el.classList.remove("ring-2", "ring-primary", "bg-primary/5"), 1500);
}

export function ContentComments({ itemId, fields, comments, canDelete = false }: { itemId: string; fields: ContentField[]; comments: CommentRow[]; canDelete?: boolean }) {
  const [body, setBody] = useState("");
  const [fieldKey, setFieldKey] = useState("general");
  const [pending, start] = useTransition();

  const fieldLabel = (key: string | null) => (key ? fields.find((f) => f.key === key)?.label ?? key : null);

  const add = () =>
    start(async () => {
      await addContentComment(itemId, { fieldKey: fieldKey === "general" ? null : fieldKey, body });
      setBody("");
      toast.success("Comment added");
    });

  function remove(commentId: string) {
    if (!window.confirm("Delete this comment? This cannot be undone.")) return;
    const formData = new FormData();
    formData.set("commentId", commentId);
    start(async () => {
      await deleteContentComment(formData);
      toast.success("Comment deleted");
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-md border p-3">
        <Select value={fieldKey} onValueChange={setFieldKey}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="general">General comment</SelectItem>
            {fields.map((field) => <SelectItem key={field.key} value={field.key}>On: {field.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Leave a comment or red-line note…" rows={3} />
        <Button size="sm" onClick={add} disabled={pending || body.trim().length === 0}>Add comment</Button>
      </div>

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => {
            const isAgency = AGENCY_ROLES.includes(comment.authorRole ?? "");
            return (
              <li
                key={comment.id}
                id={`comment-${comment.id}`}
                onClick={() => comment.quote && flash(document.querySelector(`mark[data-comment-id="${comment.id}"]`))}
                className={`group/comment relative rounded-md p-3 ring-1 ring-inset transition-colors ${comment.resolved ? "opacity-60" : ""} ${
                  isAgency ? "bg-primary/10 ring-primary/25" : "bg-muted ring-border"
                } ${comment.quote ? "cursor-pointer" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{comment.authorName || "User"}</span>
                  <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}</span>
                </div>
                {comment.quote ? (
                  <blockquote className="mt-1.5 rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-600 italic dark:text-amber-400">&ldquo;{comment.quote}&rdquo;</blockquote>
                ) : comment.fieldKey ? (
                  <p className="mt-0.5 text-xs text-primary">On: {fieldLabel(comment.fieldKey)}</p>
                ) : null}
                <p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>
                <div className="mt-2 flex items-center justify-between">
                  <form action={resolveContentComment} onClick={(event) => event.stopPropagation()}>
                    <input type="hidden" name="commentId" value={comment.id} />
                    <Button type="submit" size="sm" variant="ghost">{comment.resolved ? "Reopen" : "Mark resolved"}</Button>
                  </form>
                  {canDelete ? (
                    <button
                      type="button"
                      aria-label="Delete comment"
                      onClick={(event) => {
                        event.stopPropagation();
                        remove(comment.id);
                      }}
                      className="rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-black/10 hover:text-destructive group-hover/comment:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
