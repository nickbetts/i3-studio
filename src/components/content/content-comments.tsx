"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addContentComment, resolveContentComment } from "@/app/agency/content/actions";
import type { ContentField } from "@/lib/content";

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

export function ContentComments({ itemId, fields, comments }: { itemId: string; fields: ContentField[]; comments: CommentRow[] }) {
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
          {comments.map((comment) => (
            <li
              key={comment.id}
              id={`comment-${comment.id}`}
              onClick={() => comment.quote && flash(document.querySelector(`mark[data-comment-id="${comment.id}"]`))}
              className={`rounded-md border p-3 transition-colors ${comment.resolved ? "opacity-60" : ""} ${comment.quote ? "cursor-pointer hover:border-primary/40" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{comment.authorName || "User"}</span>
                <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}</span>
              </div>
              {comment.quote ? (
                <blockquote className="mt-1.5 rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-600 italic dark:text-amber-400">&ldquo;{comment.quote}&rdquo;</blockquote>
              ) : comment.fieldKey ? (
                <p className="mt-0.5 text-xs text-primary">On: {fieldLabel(comment.fieldKey)}</p>
              ) : null}
              <p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>
              <form action={resolveContentComment} className="mt-2" onClick={(event) => event.stopPropagation()}>
                <input type="hidden" name="commentId" value={comment.id} />
                <Button type="submit" size="sm" variant="ghost">{comment.resolved ? "Reopen" : "Mark resolved"}</Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
