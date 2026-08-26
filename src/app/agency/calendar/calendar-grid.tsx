"use client";

import { useState, useTransition } from "react";
import { addDays, format, startOfMonth, startOfWeek } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteAllocation, updateAllocation } from "./actions";

type Block = { id: string; memberUserId: string; title: string; date: Date; startMinute: number; endMinute: number };
type Member = { id: string; name: string };
const HOUR_HEIGHT = 64;

export function CalendarGrid({ members, blocks }: { members: Member[]; blocks: Block[] }) {
  const [view, setView] = useState<"day" | "month">("day");
  const [date, setDate] = useState(new Date());
  const [localBlocks, setLocalBlocks] = useState(blocks);
  const [pending, startTransition] = useTransition();
  const dayKey = format(date, "yyyy-MM-dd");
  const dayBlocks = localBlocks.filter((block) => format(new Date(block.date), "yyyy-MM-dd") === dayKey);
  const monthStart = startOfMonth(date);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const monthDays = Array.from({ length: 42 }, (_, index) => addDays(calendarStart, index));

  function shift(amount: number) { setDate((current) => view === "day" ? addDays(current, amount) : addDays(current, amount * 30)); }
  function move(id: string, event: React.DragEvent<HTMLDivElement>) {
    const block = localBlocks.find((item) => item.id === id);
    if (!block) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const startMinute = Math.max(0, Math.min(1439, Math.round(((event.clientY - bounds.top) / HOUR_HEIGHT) * 60 / 15) * 15));
    const next = { ...block, startMinute, endMinute: Math.min(1440, startMinute + block.endMinute - block.startMinute), date };
    setLocalBlocks((items) => items.map((item) => item.id === id ? next : item));
    startTransition(async () => { await updateAllocation(id, next.startMinute, next.endMinute, dayKey); toast.success("Time block moved"); });
  }
  function resize(id: string, event: React.PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const block = localBlocks.find((item) => item.id === id);
    if (!block) return;
    const startY = event.clientY;
    const initialEnd = block.endMinute;
    const onMove = (moveEvent: PointerEvent) => { const delta = Math.round(((moveEvent.clientY - startY) / HOUR_HEIGHT) * 60 / 15) * 15; const endMinute = Math.max(block.startMinute + 15, Math.min(1440, initialEnd + delta)); setLocalBlocks((items) => items.map((item) => item.id === id ? { ...item, endMinute } : item)); };
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); const changed = localBlocks.find((item) => item.id === id); if (changed) startTransition(async () => updateAllocation(id, changed.startMinute, changed.endMinute)); };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
  }
  function remove(id: string) { setLocalBlocks((items) => items.filter((item) => item.id !== id)); startTransition(async () => { await deleteAllocation(id); toast.success("Time block removed"); }); }

  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => shift(-1)}>Previous</Button><Button variant="outline" size="sm" onClick={() => setDate(new Date())}>Today</Button><Button variant="outline" size="sm" onClick={() => shift(1)}>Next</Button><span className="ml-2 text-sm font-medium">{view === "day" ? format(date, "EEEE, d MMMM yyyy") : format(date, "MMMM yyyy")}</span></div><div className="flex rounded-md border p-1"><Button size="sm" variant={view === "day" ? "default" : "ghost"} onClick={() => setView("day")}>Day</Button><Button size="sm" variant={view === "month" ? "default" : "ghost"} onClick={() => setView("month")}>Month</Button></div></div>{view === "day" ? <div className="overflow-auto rounded-md border"><div className="grid min-w-225 grid-cols-[180px_1fr]"><div className="sticky left-0 z-10 border-b bg-muted/40 p-3 text-sm font-medium">Team member</div><div className="border-b bg-muted/40 p-3 text-sm font-medium">{format(date, "EEE d")}</div>{members.map((member) => <div key={member.id} className="contents"><div className="sticky left-0 z-10 border-b bg-background p-3 text-sm font-medium">{member.name}</div><div className="relative border-b bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_63px,hsl(var(--border))_64px)]" style={{ height: `${24 * HOUR_HEIGHT}px` }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => move(event.dataTransfer.getData("block-id"), event)}><div className="pointer-events-none absolute -left-10 top-0 text-[10px] text-muted-foreground">{Array.from({ length: 24 }, (_, hour) => <span key={hour} className="absolute right-0" style={{ top: `${hour * HOUR_HEIGHT - 7}px` }}>{formatTime(hour * 60)}</span>)}</div>{dayBlocks.filter((block) => block.memberUserId === member.id).map((block) => <div key={block.id} draggable onDragStart={(event) => event.dataTransfer.setData("block-id", block.id)} className="absolute left-2 right-2 cursor-grab overflow-hidden rounded border-l-4 border-primary bg-primary/15 px-3 py-2 text-xs shadow-sm" style={{ top: `${(block.startMinute / 60) * HOUR_HEIGHT}px`, height: `${Math.max(28, ((block.endMinute - block.startMinute) / 60) * HOUR_HEIGHT)}px` }}><p className="font-medium">{block.title}</p><p>{formatTime(block.startMinute)}–{formatTime(block.endMinute)}</p><button type="button" className="text-muted-foreground underline" disabled={pending} onClick={() => remove(block.id)}>Remove</button><button type="button" aria-label="Resize time block" className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize" onPointerDown={(event) => resize(block.id, event)} /></div>)}</div></div>)}</div></div> : <div className="grid grid-cols-7 overflow-hidden rounded-md border">{monthDays.map((day) => { const key = format(day, "yyyy-MM-dd"); const items = localBlocks.filter((block) => format(new Date(block.date), "yyyy-MM-dd") === key); return <div key={key} className={`min-h-28 border-b border-r p-2 ${day.getMonth() !== date.getMonth() ? "bg-muted/30 text-muted-foreground" : ""}`}><p className="text-xs font-medium">{format(day, "d")}</p>{items.map((item) => <div key={item.id} className="mt-1 truncate rounded bg-primary/15 px-1 py-0.5 text-[10px]">{item.title}</div>)}</div>; })}</div>}</div>;
}
function formatTime(minutes: number) { const hour = Math.floor(minutes / 60); const minute = String(minutes % 60).padStart(2, "0"); return `${hour % 12 || 12}:${minute}${hour >= 12 ? "pm" : "am"}`; }
