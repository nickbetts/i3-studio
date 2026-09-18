"use client";

import { useMemo, useState } from "react";
import { Check, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SERVICE_ALLOCATIONS } from "@/lib/service-allocations";
import { formatLoggedTime } from "@/lib/time-format";

export type AllocationClient = {
  id: string;
  name: string;
  start: string;
  end: string;
  totalHours: number;
  spentSeconds: number;
  serviceAllocations: { serviceType: string; allocatedSeconds: number; allocatedQuantity: number }[];
};

type AllocationAction = (formData: FormData) => Promise<void>;

export function ServiceAllocationEditor({ clients, action }: { clients: AllocationClient[]; action: AllocationAction }) {
  const [selectedId, setSelectedId] = useState(clients[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [totalHours, setTotalHours] = useState(clients[0]?.totalHours ?? 0);
  const [splitHours, setSplitHours] = useState(clients[0]?.serviceAllocations.filter((item) => SERVICE_ALLOCATIONS.find((service) => service.key === item.serviceType)?.kind === "hours").reduce((total, item) => total + item.allocatedSeconds / 3600, 0) ?? 0);
  const selected = clients.find((client) => client.id === selectedId) ?? null;
  const filteredClients = useMemo(() => clients.filter((client) => client.name.toLowerCase().includes(query.trim().toLowerCase())), [clients, query]);
  const selectedValues = selected ? Object.fromEntries(selected.serviceAllocations.map((item) => [item.serviceType, item])) : {};

  function hoursFor(serviceType: string) {
    return ((selectedValues[serviceType]?.allocatedSeconds ?? 0) / 3600) || "";
  }

  function quantityFor(serviceType: string) {
    return selectedValues[serviceType]?.allocatedQuantity || "";
  }

  async function submit(formData: FormData): Promise<void> {
    try {
      await action(formData);
      toast.success("Monthly allocation saved");
    } catch {
      toast.error("Allocation could not be saved. Check that the hour split matches the total.");
    }
  }

  return (
    <div className="grid gap-0 overflow-hidden rounded-xl border bg-card lg:grid-cols-[17rem_1fr]">
      <aside className="border-b bg-muted/20 lg:border-r lg:border-b-0">
        <div className="border-b p-4"><p className="text-sm font-semibold">Clients</p><div className="relative mt-3"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Find client allocation" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a client..." className="pl-8" /></div></div>
        <div className="max-h-80 overflow-y-auto p-2 lg:max-h-140">
          {filteredClients.map((client) => <button type="button" key={client.id} onClick={() => { setSelectedId(client.id); setTotalHours(client.totalHours); setSplitHours(client.serviceAllocations.filter((item) => SERVICE_ALLOCATIONS.find((service) => service.key === item.serviceType)?.kind === "hours").reduce((total, item) => total + item.allocatedSeconds / 3600, 0)); }} className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors ${client.id === selectedId ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><span className="min-w-0 truncate">{client.name}</span>{client.id === selectedId ? <Check className="size-4 shrink-0 text-primary" /> : null}</button>)}
          {!filteredClients.length ? <p className="p-3 text-xs text-muted-foreground">No clients match.</p> : null}
        </div>
      </aside>
      {selected ? (
        <div className="min-w-0 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-5"><div><p className="text-lg font-semibold">{selected.name}</p><p className="mt-1 text-xs text-muted-foreground">{selected.start} - {selected.end}</p></div><div className="rounded-md bg-muted px-3 py-2 text-right"><p className="text-[11px] text-muted-foreground">Logged this month</p><p className="font-mono text-sm font-semibold tabular-nums">{formatLoggedTime(selected.spentSeconds)}</p></div></div>
          <form action={submit} onChange={(event) => { const target = event.target as unknown as HTMLInputElement; if (target.name === "totalHours") setTotalHours(Number(target.value) || 0); if (target.name.startsWith("hours_")) { const form = target.form; if (form) setSplitHours(SERVICE_ALLOCATIONS.filter((service) => service.kind === "hours").reduce((total, service) => total + (Number(new FormData(form).get(`hours_${service.key}`)) || 0), 0)); } }} className="mt-5 space-y-6">
            <input type="hidden" name="clientAccountId" value={selected.id} /><input type="hidden" name="periodStart" value={selected.start} /><input type="hidden" name="periodEnd" value={selected.end} />
            <section className={`rounded-lg border p-4 ${Math.abs(totalHours - splitHours) < 0.001 ? "border-primary/30 bg-primary/5" : "border-amber-400/50 bg-amber-400/5"}`}><div className="flex flex-wrap items-end justify-between gap-4"><div><Label htmlFor="allocation-total">Total monthly hours</Label><p className="mt-1 text-xs text-muted-foreground">Split this total across the hour services below.</p></div><div className="w-40"><Input id="allocation-total" name="totalHours" type="number" min="0" max="10000" step="0.25" required value={totalHours || ""} onChange={(event) => setTotalHours(Number(event.target.value) || 0)} placeholder="e.g. 40" /></div></div><div className="mt-3 flex items-center justify-between text-xs"><span>Hour split: <strong className="font-mono">{splitHours.toFixed(2)}h</strong> of <strong className="font-mono">{totalHours.toFixed(2)}h</strong></span><span className={Math.abs(totalHours - splitHours) < 0.001 ? "text-primary" : "text-amber-300"}>{Math.abs(totalHours - splitHours) < 0.001 ? "Balanced" : `${(totalHours - splitHours).toFixed(2)}h remaining to allocate`}</span></div></section>
            <section><div className="mb-3 flex items-center gap-2"><SlidersHorizontal className="size-4 text-primary" /><h3 className="text-sm font-semibold">Hour split</h3><span className="text-xs text-muted-foreground">Used for timers and progress bars</span></div><div className="grid gap-3 sm:grid-cols-2">{SERVICE_ALLOCATIONS.filter((service) => service.kind === "hours").map((service) => <div key={service.key} className="space-y-1"><Label htmlFor={`hours_${service.key}`} className="text-xs">{service.label}</Label><div className="relative"><Input id={`hours_${service.key}`} name={`hours_${service.key}`} type="number" min="0" step="0.25" defaultValue={hoursFor(service.key)} placeholder="0" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">hrs</span></div></div>)}</div></section>
            <section><div className="mb-3 flex items-center gap-2"><h3 className="text-sm font-semibold">Monthly quotas</h3><span className="text-xs text-muted-foreground">Piece-based services, not time</span></div><div className="grid gap-3 sm:grid-cols-3">{SERVICE_ALLOCATIONS.filter((service) => service.kind === "quantity").map((service) => <div key={service.key} className="space-y-1"><Label htmlFor={`quantity_${service.key}`} className="text-xs">{service.label}</Label><div className="relative"><Input id={`quantity_${service.key}`} name={`quantity_${service.key}`} type="number" min="0" step="1" defaultValue={quantityFor(service.key)} placeholder="0" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">pieces</span></div></div>)}</div></section>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5"><p className="text-xs text-muted-foreground">Save once to update all services for this client.</p><Button type="submit">Save monthly allocation</Button></div>
          </form>
        </div>
      ) : <div className="flex min-h-64 items-center justify-center p-6 text-sm text-muted-foreground">Select a client to edit their allocation.</div>}
    </div>
  );
}
