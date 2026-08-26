"use client";

import { useState, useTransition } from "react";
import { addDays, differenceInCalendarDays, format, startOfMonth, startOfWeek } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteAllocation, updateAllocation } from "./actions";

type Block = { id: string; memberUserId: string; title: string; date: Date; startMinute: number; endMinute: number };
type Member = { id: string; name: string };
const DAY_WIDTH = 150;
const ROW_HEIGHT = 92;

export function CalendarGrid({ members, blocks }: { members: Member[]; blocks: Block[] }) {
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [date, setDate] = useState(new Date());
  const [localBlocks, setLocalBlocks] = useState(blocks);
  const [pending, startTransition] = useTransition();
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const monthStart = startOfMonth(date);
  const monthCalendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const monthDays = Array.from({ length: 42 }, (_, index) => addDays(monthCalendarStart, index));

  function shift(amount: number) { setDate((current) => view === "day" ? addDays(current, amount) : view === "week" ? addDays(current, amount * 7) : addDays(current, amount * 30)); }
  function move(id: string, event: React.DragEvent<HTMLDivElement>) {
    const block = localBlocks.find((item) => item.id === id);
    if (!block) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const dayOffset = Math.max(0, Math.min(6, Math.floor((event.clientX - bounds.left) / DAY_WIDTH)));
    const startMinute = Math.max(0, Math.min(1439, Math.round(((event.clientX - bounds.left - dayOffset * DAY_WIDTH) / DAY_WIDTH) * 1440 / 15) * 15));
    const nextDate = addDays(weekStart, dayOffset);
    const next = { ...block, date: nextDate, startMinute, endMinute: Math.min(1440, startMinute + block.endMinute - block.startMinute) };
    setLocalBlocks((items) => items.map((item) => item.id === id ? next : item));
    startTransition(async () => { await updateAllocation(id, next.startMinute, next.endMinute, format(nextDate, "yyyy-MM-dd")); toast.success("Time block moved"); });
  }
  function resize(id: string, event: React.PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const block = localBlocks.find((item) => item.id === id);
    if (!block) return;
    const startX = event.clientX;
    const initialEnd = block.endMinute;
    const onMove = (moveEvent: PointerEvent) => { const delta = Math.round(((moveEvent.clientX - startX) / DAY_WIDTH) * 1440 / 15) * 15; const endMinute = Math.max(block.startMinute + 15, Math.min(1440, initialEnd + delta)); setLocalBlocks((items) => items.map((item) => item.id === id ? { ...item, endMinute } : item)); };
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); const changed = localBlocks.find((item) => item.id === id); if (changed) startTransition(async () => updateAllocation(id, changed.startMinute, changed.endMinute)); };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
  }
  function remove(id: string) { setLocalBlocks((items) => items.filter((item) => item.id !== id)); startTransition(async () => { await deleteAllocation(id); toast.success("Time block removed"); }); }
  const hoursFor = (memberId: string) => localBlocks.filter((block) => block.memberUserId === memberId && days.some((day) => format(day, "yyyy-MM-dd") === format(new Date(block.date), "yyyy-MM-dd"))).reduce((total, block) => total + (block.endMinute - block.startMinute) / 60, 0);

  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => shift(-1)}>Previous</Button><Button variant="outline" size="sm" onClick={() => setDate(new Date())}>Today</Button><Button variant="outline" size="sm" onClick={() => shift(1)}>Next</Button><span className="ml-2 text-sm font-medium">{view === "day" ? format(date, "EEEE, d MMMM yyyy") : view === "week" ? `${format(weekStart, "d MMM")} – ${format(addDays(weekStart, 6), "d MMM yyyy")}` : format(date, "MMMM yyyy")}</span></div><div className="flex rounded-md border p-1"><Button size="sm" variant={view === "day" ? "ghost" : view === "week" ? "default" : "ghost"} onClick={() => setView("week")}>Weeks</Button><Button size="sm" variant={view === "day" ? "default" : "ghost"} onClick={() => setView("day")}>Day</Button><Button size="sm" variant={view === "month" ? "default" : "ghost"} onClick={() => setView("month")}>Month</Button></div></div>{view === "month" ? <div className="grid grid-cols-7 overflow-hidden rounded-md border">{monthDays.map((day) => { const key = format(day, "yyyy-MM-dd"); const items = localBlocks.filter((block) => format(new Date(block.date), "yyyy-MM-dd") === key); return <div key={key} className={`min-h-28 border-b border-r p-2 ${day.getMonth() !== date.getMonth() ? "bg-muted/30 text-muted-foreground" : ""}`}><p className="text-xs font-medium">{format(day, "EEE d")}</p>{items.map((item) => <div key={item.id} className="mt-1 truncate rounded bg-primary/15 px-1 py-0.5 text-[10px]">{item.title}</div>)}</div>; })}</div> : <div className="overflow-x-auto rounded-md border"><div className="min-w-1120"><div className="grid grid-cols-[240px_repeat(7,150px)] border-b bg-muted/40 text-xs font-medium"><div className="p-3">Team member</div>{days.map((day) => <div key={day.toISOString()} className="border-l p-3"><p>{format(day, "EEE")}</p><p className="text-muted-foreground">{format(day, "d MMM")}</p></div>)}</div>{members.map((member) => <div key={member.id} className="grid grid-cols-[240px_repeat(7,150px)]" onDragOver={(event) => event.preventDefault()} onDrop={(event) => move(event.dataTransfer.getData("block-id"), event)}><div className="border-b p-3"><p className="text-sm font-medium">{member.name}</p><p className="text-xs text-muted-foreground">{hoursFor(member.id).toFixed(1)}h planned</p></div><div className="relative col-span-7 border-b" style={{ height: ROW_HEIGHT }}><div className="absolute inset-0 grid grid-cols-7">{days.map((day) => <div key={day.toISOString()} className="border-l bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_45px,hsl(var(--border))_46px)]" />)}</div>{localBlocks.filter((block) => block.memberUserId === member.id).map((block) => { const blockDay = differenceInCalendarDays(new Date(block.date), weekStart); if (blockDay < 0 || blockDay > 6) return null; const left = blockDay * DAY_WIDTH + (block.startMinute / 1440) * DAY_WIDTH; const width = Math.max(56, ((block.endMinute - block.startMinute) / 1440) * DAY_WIDTH); return <div key={block.id} draggable onDragStart={(event) => event.dataTransfer.setData("block-id", block.id)} className="absolute top-3 z-10 h-16 cursor-grab overflow-hidden rounded border-l-4 border-primary bg-primary px-3 py-2 text-xs text-primary-foreground shadow-sm" style={{ left, width }}><p className="truncate font-medium">{block.title}</p><p className="truncate opacity-80">{formatTime(block.startMinute)}–{formatTime(block.endMinute)}</p><button type="button" className="opacity-80 underline" disabled={pending} onClick={() => remove(block.id)}>Remove</button><button type="button" aria-label="Resize time block" className="absolute bottom-0 right-0 h-3 w-3 cursor-ew-resize" onPointerDown={(event) => resize(block.id, event)} /></div>; })}</div></div>)}</div></div>}</div>;
}
function formatTime(minutes: number) { const hour = Math.floor(minutes / 60); const minute = String(minutes % 60).padStart(2, "0"); return `${hour % 12 || 12}:${minute}${hour >= 12 ? "pm" : "am"}`; }
