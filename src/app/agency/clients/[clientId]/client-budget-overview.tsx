import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SERVICE_ALLOCATIONS } from "@/lib/service-allocations";
import { formatLoggedTime } from "@/lib/time-format";
import { budgetUsage } from "@/lib/time-budget";
import { StackedServiceProgress } from "@/app/agency/time/stacked-service-progress";

type Allocation = { serviceType: string; allocatedSeconds: number; allocatedQuantity: number };

export function ClientBudgetOverview({ clientId, periodLabel, start, end, totalAllocatedSeconds, serviceAllocations, serviceSpent }: { clientId: string; periodLabel: string; start: Date; end: Date; totalAllocatedSeconds: number; serviceAllocations: Allocation[]; serviceSpent: Record<string, number> }) {
  const allocations = new Map(serviceAllocations.map((item) => [item.serviceType, item]));
  return <div className="@container/budget space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">Current period</p><p className="text-sm font-medium">{periodLabel}</p></div><Button asChild variant="outline" size="sm"><Link href={`/agency/time?clientId=${clientId}`}>Open full ledger <ArrowUpRight className="size-4" /></Link></Button></div>
    <StackedServiceProgress totalAllocatedSeconds={totalAllocatedSeconds} serviceSpent={serviceSpent} serviceAllocations={serviceAllocations} />
    <div className="grid gap-x-6 gap-y-4 @2xl/budget:grid-cols-2">
      {SERVICE_ALLOCATIONS.filter((service) => service.kind === "hours").map((service) => {
        const allocated = allocations.get(service.key)?.allocatedSeconds ?? 0;
        const spent = serviceSpent[service.key] ?? 0;
        const usage = budgetUsage(allocated, spent, start, end);
        return <div key={service.key} className="min-w-0 space-y-1.5"><div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs"><span className="font-medium">{service.label}</span><span className="whitespace-nowrap font-mono text-muted-foreground">{formatLoggedTime(spent)} / {formatLoggedTime(allocated)}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${usage.over ? "bg-rose-400" : usage.usedPercent >= 80 ? "bg-amber-300" : "bg-primary"}`} style={{ width: `${usage.barPercent}%` }} /></div></div>;
      })}
    </div>
    <div className="grid gap-2 sm:grid-cols-3">{SERVICE_ALLOCATIONS.filter((service) => service.kind === "quantity").map((service) => <div key={service.key} className="rounded-md bg-muted/30 px-3 py-2"><p className="text-xs text-muted-foreground">{service.label}</p><p className="mt-1 font-mono text-lg font-semibold tabular-nums">{allocations.get(service.key)?.allocatedQuantity ?? 0}</p><p className="text-[11px] text-muted-foreground">allocated this month</p></div>)}</div>
  </div>;
}
