"use client";

import { useState } from "react";
import { format } from "date-fns";
import { History } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArticlePreview } from "./article-preview";
import type { CommentRow } from "./content-comments";
import type { ContentField } from "@/lib/content";

export type ContentVersionRow = { version: number; data: Record<string, unknown>; authorName: string | null; note: string | null; createdAt: string | Date };

export function ContentReview({
  itemId,
  fields,
  currentData,
  versions,
  comments,
}: {
  itemId: string;
  fields: ContentField[];
  currentData: Record<string, unknown>;
  versions: ContentVersionRow[];
  comments: CommentRow[];
}) {
  const [selection, setSelection] = useState("current");
  const sorted = [...versions].sort((a, b) => b.version - a.version);
  const viewing = selection === "current" ? null : sorted.find((v) => String(v.version) === selection) ?? null;
  const isCurrent = selection === "current";

  return (
    <div className="space-y-3">
      {sorted.length > 0 ? (
        <div className="flex items-center justify-between gap-3">
          <Select value={selection} onValueChange={setSelection}>
            <SelectTrigger className="w-56"><History className="size-4" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current (editable draft)</SelectItem>
              {sorted.map((v) => (
                <SelectItem key={v.version} value={String(v.version)}>
                  Version {v.version} · {format(new Date(v.createdAt), "d MMM")}{v.authorName ? ` · ${v.authorName}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {!isCurrent ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          Viewing version {viewing?.version} from {viewing ? format(new Date(viewing.createdAt), "d MMM yyyy") : ""}{viewing?.note ? ` — "${viewing.note}"` : ""}. Comments can only be added on the current version — switch above to comment.
        </div>
      ) : null}

      <ArticlePreview itemId={itemId} fields={fields} data={isCurrent ? currentData : viewing?.data ?? currentData} comments={isCurrent ? comments : []} canComment={isCurrent} />
    </div>
  );
}
