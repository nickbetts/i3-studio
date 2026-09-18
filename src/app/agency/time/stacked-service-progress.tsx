"use client";

import { SERVICE_ALLOCATIONS } from "@/lib/service-allocations";
import { formatLoggedTime } from "@/lib/time-format";

const SERVICE_COLORS = ["#8be0be", "#80c6e3", "#c5a7f5", "#e9bb73", "#ef9a9a", "#9fb7a7"];

export function StackedServiceProgress({ totalAllocatedSeconds, serviceSpent, serviceAllocations }: { totalAllocatedSeconds: number; serviceSpent: Record<string, number>; serviceAllocations: { serviceType: string; allocatedSeconds: number }[] }) {
  const hourServices = SERVICE_ALLOCATIONS.filter((service) => service.kind === "hours");
  const totalSpent = hourServices.reduce((total, service) => total + (serviceSpent[service.key] ?? 0), 0);
  const allocatedByService = new Map(serviceAllocations.map((item) => [item.serviceType, item.allocatedSeconds]));
  const allocated = Math.max(0, totalAllocatedSeconds);
  const overSeconds = Math.max(0, totalSpent - allocated);
  const scale = Math.max(allocated, totalSpent, 1);
  const usedPercent = Math.min(100, totalSpent / scale * 100);
  const segments = hourServices.map((service, index) => ({
    ...service,
    spent: serviceSpent[service.key] ?? 0,
    allocated: allocatedByService.get(service.key) ?? 0,
    color: SERVICE_COLORS[index % SERVICE_COLORS.length],
  })).filter((service) => service.spent > 0 || service.allocated > 0);

  return (
    <section className="rounded-lg border border-border/70 bg-muted/20 p-4" data-testid="stacked-service-progress">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold">Total monthly usage</p><p className="mt-1 text-xs text-muted-foreground">Every hour service in one view</p></div><div className="text-right"><p className="font-mono text-lg font-semibold tabular-nums">{formatLoggedTime(totalSpent)}</p><p className={`text-xs ${overSeconds ? "text-rose-300" : "text-muted-foreground"}`}>{overSeconds ? `${formatLoggedTime(overSeconds)} over` : `${formatLoggedTime(Math.max(0, allocated - totalSpent))} remaining`}</p></div></div>
      <div className="mt-4 relative h-4 overflow-hidden rounded-sm bg-muted" role="progressbar" aria-label="Total monthly service usage" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(usedPercent)} aria-valuetext={`${formatLoggedTime(totalSpent)} used of ${formatLoggedTime(allocated)} allocated`}>
        <div className="flex h-full" style={{ width: `${usedPercent}%` }}>{segments.map((segment) => <span key={segment.key} title={`${segment.label}: ${formatLoggedTime(segment.spent)}`} style={{ backgroundColor: segment.color, width: `${segment.spent / Math.max(totalSpent, 1) * 100}%` }} />)}</div>
        {overSeconds ? <span className="absolute inset-y-0 right-0 bg-rose-400" style={{ width: `${overSeconds / scale * 100}%` }} title={`${formatLoggedTime(overSeconds)} over budget`} /> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">{segments.filter((segment) => segment.spent > 0).map((segment) => <div key={segment.key} className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-2 rounded-sm" style={{ backgroundColor: segment.color }} /><span>{segment.label}</span><span className="font-mono tabular-nums text-foreground">{formatLoggedTime(segment.spent)}</span></div>)}</div>
    </section>
  );
}
