import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  open: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
  pending: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  in_progress: "bg-indigo-500/15 text-indigo-300 ring-indigo-500/30",
  in_review: "bg-indigo-500/15 text-indigo-300 ring-indigo-500/30",
  approved: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  resolved: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  done: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  completed: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  active: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  changes_requested: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  disabled: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  closed: "bg-muted text-muted-foreground ring-border",
  invited: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const key = status.toLowerCase().replace(/\s+/g, "_");
  const tone = tones[key] ?? "bg-muted text-muted-foreground ring-border";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset", tone, className)}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
