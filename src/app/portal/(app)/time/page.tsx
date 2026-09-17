import { Clock3 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { formatLoggedTime } from "@/lib/time-format";
import { BudgetProgress } from "@/components/budget-progress";
import { MonthNavigation } from "@/components/month-navigation";
import { getTimeReport } from "@/lib/time-report";

export default async function PortalTimePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams;
  const { period, rows, entries } = await getTimeReport(month, true);
  return <div className="space-y-6">
    <PageHeader title="Delivery time" description="Your allocation, delivery effort and remaining hours." actions={<MonthNavigation period={period} path="/portal/time" />} />
    {rows.map(({ client, budget, start, end, spent }) => <section key={client.id} className="max-w-3xl space-y-5 py-2"><h2 className="text-base font-semibold">{client.name}</h2><BudgetProgress label={client.name} allocated={budget?.allocatedSeconds ?? null} start={start} end={end} spent={spent} /></section>)}
    <section className="space-y-4 border-t pt-6"><h2 className="font-semibold">Logged work · {period.label}</h2>
      {!entries.length ? <EmptyState icon={Clock3} title="No time logged this month" /> : <div className="divide-y divide-border">{entries.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium">{entry.taskId ? "Task delivery" : "General client work"}</p><p className="text-xs text-muted-foreground">{entry.startedAt.toLocaleDateString("en-GB")}</p></div><span className="font-mono text-sm tabular-nums">{formatLoggedTime(entry.durationSeconds)}</span></div>)}</div>}
    </section>
  </div>;
}
