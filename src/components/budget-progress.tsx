import { budgetUsage } from "@/lib/time-budget";
import { formatLoggedTime } from "@/lib/time-format";

export function BudgetProgress({ allocated, spent, start, end, label }: { allocated: number | null; spent: number; start: Date; end: Date; label: string }) {
  const usage = budgetUsage(allocated, spent, start, end);
  const tone = usage.state === "over" || usage.state === "exhausted" ? "bg-rose-400" : usage.state === "near" ? "bg-amber-300" : "bg-primary";
  const status = usage.state === "unallocated" ? "No allocation" : usage.state === "over" ? "Over budget" : usage.state === "exhausted" ? "Fully used" : usage.state === "near" ? "Nearing limit" : "Available";
  return (
    <div className="space-y-3" data-testid="budget-progress">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{start.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })} - {end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</span>
        <span className="flex items-center gap-1.5"><span className={`size-1.5 rounded-full ${allocated === null ? "bg-muted-foreground" : tone}`} />{status}{allocated !== null ? ` · ${Math.round(usage.usedPercent)}% used` : ""}</span>
      </div>
      <div className="relative h-3 rounded-sm bg-muted" role="progressbar" aria-label={`${label} budget used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(usage.barPercent)} aria-valuetext={`${formatLoggedTime(spent)} used, ${status}`}>
        <div className={`h-full rounded-sm transition-[width] duration-300 ${tone}`} style={{ width: `${usage.barPercent}%` }} />
        <span className="absolute -top-1 h-5 w-px bg-foreground/80" style={{ left: `${Math.min(99.5, usage.periodPercent)}%` }} title={`${Math.round(usage.periodPercent)}% of period elapsed`} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[["Used", formatLoggedTime(usage.spent)], ["Allocated", usage.allocated === null ? "Not set" : formatLoggedTime(usage.allocated)], [usage.over ? "Over budget" : "Remaining", usage.remaining === null ? "Not set" : formatLoggedTime(usage.over || usage.remaining)]].map(([name, value]) => (
          <div key={name} className="min-w-0"><p className="text-[11px] text-muted-foreground">{name}</p><p className={`mt-0.5 font-mono text-sm font-medium tabular-nums sm:text-base ${name === "Over budget" ? "text-rose-300" : ""}`}>{value}</p></div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">{Math.round(usage.periodPercent)}% of period elapsed</p>
    </div>
  );
}
