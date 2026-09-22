"use client";

import { useMemo, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";

export type MentionCandidate = { id: string; name: string };

/** A plain textarea that shows an @-mention suggestion list; inserts "@Full Name " as plain text on pick. */
export function MentionInput({ value, onChange, candidates, placeholder, rows = 3, className, disabled, "aria-label": ariaLabel }: {
  value: string;
  onChange: (value: string) => void;
  candidates: MentionCandidate[];
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const [cursor, setCursor] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeQuery = useMemo(() => {
    const upToCursor = value.slice(0, cursor);
    const match = upToCursor.match(/(?:^|\s)@([\w'-]*)$/);
    return match ? match[1] : null;
  }, [value, cursor]);

  const suggestions = useMemo(() => {
    if (activeQuery === null) return [];
    const query = activeQuery.toLowerCase();
    return candidates.filter((candidate) => candidate.name.toLowerCase().includes(query)).slice(0, 6);
  }, [activeQuery, candidates]);

  function pick(candidate: MentionCandidate) {
    const upToCursor = value.slice(0, cursor);
    const replaced = upToCursor.replace(/@([\w'-]*)$/, `@${candidate.name} `);
    const next = replaced + value.slice(cursor);
    onChange(next);
    setCursor(replaced.length);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(replaced.length, replaced.length);
    });
  }

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        aria-label={ariaLabel}
        value={value}
        placeholder={placeholder}
        rows={rows}
        className={className}
        disabled={disabled}
        onChange={(event) => { onChange(event.target.value); setCursor(event.target.selectionStart ?? event.target.value.length); }}
        onKeyUp={(event) => setCursor(event.currentTarget.selectionStart ?? 0)}
        onClick={(event) => setCursor(event.currentTarget.selectionStart ?? 0)}
      />
      {suggestions.length > 0 ? (
        <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-md border bg-popover shadow-md">
          {suggestions.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
              onMouseDown={(event) => { event.preventDefault(); pick(candidate); }}
            >
              {candidate.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
