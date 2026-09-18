import { Clock3 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { formatLoggedTime } from "@/lib/time-format";
import { BudgetProgress } from "@/components/budget-progress";
import { MonthNavigation } from "@/components/month-navigation";
import { getTimeReport } from "@/lib/time-report";
import { SERVICE_ALLOCATIONS } from "@/lib/service-allocations";

export default async function PortalTimePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams;
  const { period, rows, entries } = await getTimeReport(month, true);
  return <div className="space-y-6">
    <PageHeader title="Delivery time" description="Your allocation, delivery effort and remaining hours." actions={<MonthNavigation period={period} path="/portal/time" />} />
    {rows.map(({ client, budget, serviceAllocations, serviceSpent, start, end }) => <section key={client.id} className="max-w-3xl space-y-5 py-2"><h2 className="text-base font-semibold">{client.name}</h2><div className="space-y-4"><p className="text-xs font-medium text-muted-foreground">Hour services</p>{SERVICE_ALLOCATIONS.filter((service) => service.kind === "hours").map((service) => { const allocation = serviceAllocations.find((item) => item.serviceType === service.key); const allocated = allocation?.allocatedSeconds ?? (service.key === "account_manager_hours" ? budget?.allocatedSeconds ?? null : null); return <div key={service.key}><p className="mb-1 text-sm font-medium">{service.label}</p><BudgetProgress label={service.label} allocated={allocated} spent={serviceSpent[service.key] ?? 0} start={start} end={end} /></div>; })}</div><div className="grid gap-2 sm:grid-cols-2"><p className="col-span-full text-xs font-medium text-muted-foreground">Monthly service quotas</p>{SERVICE_ALLOCATIONS.filter((service) => service.kind === "quantity").map((service) => { const allocation = serviceAllocations.find((item) => item.serviceType === service.key); return <div key={service.key} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-sm"><span>{service.label}</span><span className="font-mono tabular-nums">{allocation?.allocatedQuantity ?? 0} allocated</span></div>; })}</div></section>)}
    <section className="space-y-4 border-t pt-6"><h2 className="font-semibold">Logged work · {period.label}</h2>
      {!entries.length ? <EmptyState icon={Clock3} title="No time logged this month" /> : <div className="divide-y divide-border">{entries.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium">{entry.taskId ? "Task delivery" : "General client work"}</p><p className="text-xs text-muted-foreground">{entry.startedAt.toLocaleDateString("en-GB")}</p></div><span className="font-mono text-sm tabular-nums">{formatLoggedTime(entry.durationSeconds)}</span></div>)}</div>}
    </section>
  </div>;
}
