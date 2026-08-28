"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addContentComment } from "@/app/agency/content/actions";
import type { ContentField, FaqEntry } from "@/lib/content";
import type { CommentRow } from "./content-comments";

const proseClass =
  "space-y-4 text-[15px] leading-7 [&_h1]:mt-6 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_a]:text-primary [&_a]:underline [&_strong]:font-semibold";

function flashMark(commentId: string) {
  const el = document.getElementById(`comment-${commentId}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("ring-2", "ring-primary", "bg-primary/5");
  window.setTimeout(() => el.classList.remove("ring-2", "ring-primary", "bg-primary/5"), 1500);
}

// Wraps the first textual match of each comment's quote (within its own field) in a clickable <mark>.
function applyHighlights(root: HTMLElement, comments: CommentRow[]) {
  const byField = new Map<string, CommentRow[]>();
  for (const comment of comments) {
    if (!comment.quote?.trim()) continue;
    const key = comment.fieldKey ?? "__general";
    byField.set(key, [...(byField.get(key) ?? []), comment]);
  }
  if (byField.size === 0) return;

  root.querySelectorAll<HTMLElement>("[data-field]").forEach((container) => {
    const pending = byField.get(container.dataset.field ?? "");
    if (!pending?.length) return;
    for (const comment of pending) {
      const quote = comment.quote!.trim();
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        const index = node.textContent?.indexOf(quote) ?? -1;
        if (index === -1) continue;
        const match = node.splitText(index);
        match.splitText(quote.length);
        const mark = document.createElement("mark");
        mark.dataset.commentId = comment.id;
        mark.className = `cursor-pointer rounded-sm px-0.5 ${comment.resolved ? "bg-emerald-500/25" : "bg-amber-400/40"} hover:bg-amber-400/60`;
        match.replaceWith(mark);
        mark.appendChild(match);
        break;
      }
    }
  });
}

export function ArticlePreview({
  itemId,
  fields,
  data,
  comments,
  canComment = true,
}: {
  itemId: string;
  fields: ContentField[];
  data: Record<string, unknown>;
  comments: CommentRow[];
  canComment?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<{ quote: string; fieldKey: string | null; top: number; left: number } | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  const bodyFields = fields.filter((f) => f.type === "richtext");
  const faqField = fields.find((f) => f.type === "faq_list");
  const detailFields = fields.filter((f) => f.type !== "richtext" && f.type !== "faq_list" && f.key !== "title");
  const titleField = fields.find((f) => f.key === "title");

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    applyHighlights(root, comments);
    const onClick = (event: MouseEvent) => {
      const mark = (event.target as HTMLElement)?.closest("mark[data-comment-id]") as HTMLElement | null;
      if (mark?.dataset.commentId) flashMark(mark.dataset.commentId);
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
    // Re-run whenever the underlying content or comment set changes.
  }, [data, comments]);

  function onMouseUp() {
    if (!canComment) return;
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (!sel || sel.isCollapsed || text.length < 3 || !containerRef.current) {
      setSelection(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const anchorEl = (sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement) ?? null;
    const fieldEl = anchorEl?.closest("[data-field]") as HTMLElement | null;
    if (!fieldEl || !containerRef.current.contains(fieldEl)) {
      setSelection(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    setSelection({ quote: text, fieldKey: fieldEl.dataset.field ?? null, top: rect.top - containerRect.top - 44, left: Math.min(Math.max(rect.left - containerRect.left, 0), containerRect.width - 260) });
    setDraft("");
  }

  function submitComment() {
    if (!selection || draft.trim().length === 0) return;
    startTransition(async () => {
      await addContentComment(itemId, { fieldKey: selection.fieldKey, quote: selection.quote, body: draft });
      toast.success("Comment added");
      setSelection(null);
      setDraft("");
      window.getSelection()?.removeAllRanges();
    });
  }

  return (
    <div ref={containerRef} onMouseUp={onMouseUp} className="relative">
      {detailFields.length > 0 ? (
        <div className="mb-6 grid gap-3 rounded-md border bg-muted/20 p-4 sm:grid-cols-2">
          {detailFields.map((field) => {
            const value = data[field.key];
            const str = typeof value === "string" ? value : "";
            if (!str.trim()) return null;
            return (
              <div key={field.key} data-field={field.key}>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{field.label}</p>
                <p className="text-sm">{str}</p>
              </div>
            );
          })}
        </div>
      ) : null}

      {titleField ? (
        <h1 data-field={titleField.key} className="mb-4 text-3xl font-bold tracking-tight">
          {String(data[titleField.key] ?? "") || "Untitled"}
        </h1>
      ) : null}

      {bodyFields.map((field) => {
        const value = String(data[field.key] ?? "").trim();
        return (
          <div key={field.key} data-field={field.key} className={proseClass}>
            {value ? <div dangerouslySetInnerHTML={{ __html: value }} /> : <p className="text-muted-foreground">No content yet.</p>}
          </div>
        );
      })}

      {faqField && Array.isArray(data[faqField.key]) && (data[faqField.key] as FaqEntry[]).length > 0 ? (
        <div data-field={faqField.key} className="mt-8 space-y-3 border-t pt-6">
          <h2 className="text-lg font-semibold">Frequently asked questions</h2>
          {(data[faqField.key] as FaqEntry[]).map((faq, index) => (
            <div key={index} className="rounded-md border p-3">
              <p className="text-sm font-medium">{faq.question}</p>
              <p className="mt-1 text-sm text-muted-foreground">{faq.answer}</p>
            </div>
          ))}
        </div>
      ) : null}

      {selection ? (
        <div
          className="absolute z-20 w-64 space-y-2 rounded-md border bg-popover p-3 shadow-xl"
          style={{ top: Math.max(selection.top, 0), left: selection.left }}
          onMouseUp={(event) => event.stopPropagation()}
        >
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><MessageSquarePlus className="size-3.5" />Comment on selection</p>
          <blockquote className="rounded bg-muted px-2 py-1 text-xs italic">&ldquo;{selection.quote.length > 80 ? `${selection.quote.slice(0, 80)}…` : selection.quote}&rdquo;</blockquote>
          <Textarea autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Leave a comment…" rows={2} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelection(null)}>Cancel</Button>
            <Button size="sm" disabled={pending || draft.trim().length === 0} onClick={submitComment}>Comment</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
