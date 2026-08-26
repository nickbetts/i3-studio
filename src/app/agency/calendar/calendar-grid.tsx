"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteAllocation } from "./actions";

type Block = { id: string; memberUserId: string; title: string; startMinute: number; endMinute: number };
export function CalendarGrid({ days, members, blocks }: { days: { key: string; label: string }[]; members: { id: string; name: string }[]; blocks: (Block & { dateKey: string })[] }) {
  const [pending, startTransition] = useTransition();
  function remove(id: string) { startTransition(async () => { await deleteAllocation(id); toast.success("Time block removed"); }); }
  return <div className="overflow-x-auto rounded-md border"><div className="min-w-225"><div className="grid grid-cols-[180px_repeat(7,minmax(100px,1fr))] border-b bg-muted/40 text-xs font-medium"><div className="p-3">Team member</div>{days.map((day) => <div key={day.key} className="border-l p-3">{day.label}</div>)}</div>{members.map((member) => <div key={member.id} className="grid min-h-28 grid-cols-[180px_repeat(7,minmax(100px,1fr))] border-b last:border-0"><div className="p-3 text-sm font-medium">{member.name}</div>{days.map((day) => <div key={day.key} className="border-l p-2">{blocks.filter((block) => block.memberUserId === member.id && block.dateKey === day.key).map((block) => <div key={block.id} className="mb-2 rounded border-l-4 border-primary bg-primary/10 p-2 text-xs"><p className="font-medium">{block.title}</p><p className="text-muted-foreground">{formatTime(block.startMinute)}–{formatTime(block.endMinute)}</p><Button type="button" variant="ghost" size="sm" disabled={pending} className="mt-1 h-6 px-1 text-xs" onClick={() => remove(block.id)}>Remove</Button></div>)}</div>)}</div>)}</div></div>;
}
function formatTime(minutes: number) { const hour = Math.floor(minutes / 60); const minute = String(minutes % 60).padStart(2, "0"); return `${hour % 12 || 12}:${minute}${hour >= 12 ? "pm" : "am"}`; }
