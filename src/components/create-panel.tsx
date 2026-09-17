import type { ReactNode } from "react";
import { ChevronDown, Plus } from "lucide-react";

export function CreatePanel({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="create-panel group border-b border-border/70 pb-4">
      <summary className="flex w-fit max-w-full cursor-pointer list-none items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-accent [&::-webkit-details-marker]:hidden">
        <Plus className="size-4 text-primary" /><span>{title}</span><ChevronDown className="size-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="pt-4">{children}</div>
    </details>
  );
}
