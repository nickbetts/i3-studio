"use client";

import { useRef, useState, useTransition } from "react";
import { addDays, differenceInCalendarDays, format, startOfMonth, startOfWeek } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteAllocation, updateAllocation } from "./actions";

type Block = { id: string; memberUserId: string; title: string; date: Date; endDate: Date | null; startMinute: number; endMinute: number };
type Member = { id: string; name: string };

const DAY_WIDTH = 160;
const ROW_HEIGHT = 68;

function minutesToTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
function timeToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function formatTime(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = String(minutes % 60).padStart(2, "0");
  return `${hour % 12 || 12}:${minute}${hour >= 12 ? "pm" : "am"}`;
}
function durationDays(block: Block) {
  return Math.max(0, differenceInCalendarDays(block.endDate || block.date, block.date));
}
function blockHours(block: Block) {
  return (durationDays(block) * 1440 + block.endMinute - block.startMinute) / 60;
}

export function CalendarGrid({ members, blocks }: { members: Member[]; blocks: Block[] }) {
  const [view, setView] = useState<"week" | "month">("week");
  const [date, setDate] = useState(new Date());
  const [localBlocks, setLocalBlocks] = useState(blocks);
  const [editing, setEditing] = useState<Block | null>(null);
  const [pending, startTransition] = useTransition();
  const resizingRef = useRef(false);

  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const monthStart = startOfMonth(date);
  const monthCalendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const monthDays = Array.from({ length: 42 }, (_, index) => addDays(monthCalendarStart, index));

  function shift(amount: number) {
    setDate((current) => (view === "week" ? addDays(current, amount * 7) : addDays(current, amount * 30)));
  }

  function drop(memberId: string, event: React.DragEvent<HTMLDivElement>) {
    const id = event.dataTransfer.getData("block-id");
    const block = localBlocks.find((item) => item.id === id);
    if (!block) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const dropDay = Math.max(0, Math.min(6, Math.floor((event.clientX - bounds.left) / DAY_WIDTH)));
    const newDate = addDays(weekStart, dropDay);
    const newEndDate = addDays(newDate, durationDays(block));
    const next = { ...block, memberUserId: memberId, date: newDate, endDate: newEndDate };
    setLocalBlocks((items) => items.map((item) => (item.id === id ? next : item)));
    startTransition(async () => {
      await updateAllocation(id, { memberUserId: memberId, date: format(newDate, "yyyy-MM-dd"), endDate: format(newEndDate, "yyyy-MM-dd") });
      toast.success("Block moved");
    });
  }

  function resize(id: string, event: React.PointerEvent<HTMLSpanElement>) {
    event.stopPropagation();
    event.preventDefault();
    resizingRef.current = true;
    const block = localBlocks.find((item) => item.id === id);
    if (!block) return;
    const startX = event.clientX;
    const initial = durationDays(block);
    const onMove = (moveEvent: PointerEvent) => {
      const delta = Math.round((moveEvent.clientX - startX) / DAY_WIDTH);
      const nextDuration = Math.max(0, initial + delta);
      const endDate = addDays(block.date, nextDuration);
      setLocalBlocks((items) => items.map((item) => (item.id === id ? { ...item, endDate } : item)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const changed = localBlocks.find((item) => item.id === id);
      const endDate = changed?.endDate ?? block.date;
      startTransition(async () => {
        await updateAllocation(id, { endDate: format(endDate, "yyyy-MM-dd") });
        toast.success("Block resized");
      });
      setTimeout(() => (resizingRef.current = false), 0);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function saveEdit() {
    if (!editing || !editing.title.trim()) return;
    const next = { ...editing, title: editing.title.trim() };
    setLocalBlocks((items) => items.map((item) => (item.id === next.id ? next : item)));
    startTransition(async () => {
      await updateAllocation(next.id, {
        memberUserId: next.memberUserId,
        title: next.title,
        date: format(next.date, "yyyy-MM-dd"),
        endDate: format(next.endDate || next.date, "yyyy-MM-dd"),
        startMinute: next.startMinute,
        endMinute: next.endMinute,
      });
      setEditing(null);
      toast.success("Block updated");
    });
  }

  function remove(id: string) {
    setLocalBlocks((items) => items.filter((item) => item.id !== id));
    startTransition(async () => {
      await deleteAllocation(id);
      setEditing(null);
      toast.success("Block removed");
    });
  }

  const hoursFor = (memberId: string) =>
    localBlocks
      .filter((block) => block.memberUserId === memberId && differenceInCalendarDays(block.endDate || block.date, weekStart) >= 0 && differenceInCalendarDays(block.date, weekStart) <= 6)
      .reduce((total, block) => total + blockHours(block), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => shift(-1)}>Previous</Button>
          <Button variant="outline" size="sm" onClick={() => setDate(new Date())}>Today</Button>
          <Button variant="outline" size="sm" onClick={() => shift(1)}>Next</Button>
          <span className="ml-2 text-sm font-medium">{view === "week" ? `${format(weekStart, "d MMM")} – ${format(addDays(weekStart, 6), "d MMM yyyy")}` : format(date, "MMMM yyyy")}</span>
        </div>
        <div className="flex rounded-md border p-1">
          <Button size="sm" variant={view === "week" ? "default" : "ghost"} onClick={() => setView("week")}>Week</Button>
          <Button size="sm" variant={view === "month" ? "default" : "ghost"} onClick={() => setView("month")}>Month</Button>
        </div>
      </div>

      {view === "month" ? (
        <div className="grid grid-cols-7 overflow-hidden rounded-md border">
          {monthDays.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const items = localBlocks.filter((block) => {
              const start = differenceInCalendarDays(new Date(block.date), day);
              const finish = differenceInCalendarDays(new Date(block.endDate || block.date), day);
              return start <= 0 && finish >= 0;
            });
            return (
              <div key={key} className={`min-h-28 border-b border-r p-2 ${day.getMonth() !== date.getMonth() ? "bg-muted/30 text-muted-foreground" : ""}`}>
                <p className="text-xs font-medium">{format(day, "EEE d")}</p>
                {items.map((item) => (
                  <button type="button" key={item.id} className="mt-1 block w-full truncate rounded bg-primary/15 px-1 py-0.5 text-left text-[10px]" onClick={() => setEditing(item)}>
                    {item.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <div style={{ minWidth: 240 + 7 * DAY_WIDTH }}>
            <div className="grid border-b bg-muted/40 text-xs font-medium" style={{ gridTemplateColumns: `240px repeat(7, ${DAY_WIDTH}px)` }}>
              <div className="p-3">Team member</div>
              {days.map((day) => (
                <div key={day.toISOString()} className="border-l p-3">
                  <p>{format(day, "EEE")}</p>
                  <p className="text-muted-foreground">{format(day, "d MMM")}</p>
                </div>
              ))}
            </div>
            {members.map((member) => (
              <div key={member.id} className="grid" style={{ gridTemplateColumns: `240px repeat(7, ${DAY_WIDTH}px)` }}>
                <div className="border-b p-3">
                  <p className="text-sm font-medium">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{hoursFor(member.id).toFixed(1)}h this week</p>
                </div>
                <div
                  className="relative col-span-7 border-b"
                  style={{ height: ROW_HEIGHT }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => drop(member.id, event)}
                >
                  <div className="absolute inset-0 grid grid-cols-7">
                    {days.map((day) => (
                      <div key={day.toISOString()} className="border-l" />
                    ))}
                  </div>
                  {localBlocks
                    .filter((block) => block.memberUserId === member.id)
                    .map((block) => {
                      const startDay = differenceInCalendarDays(new Date(block.date), weekStart);
                      const finishDay = differenceInCalendarDays(new Date(block.endDate || block.date), weekStart);
                      if (finishDay < 0 || startDay > 6) return null;
                      const clampedStart = Math.max(0, startDay);
                      const clampedFinish = Math.min(6, finishDay);
                      const left = clampedStart * DAY_WIDTH + 4;
                      const width = (clampedFinish - clampedStart + 1) * DAY_WIDTH - 8;
                      return (
                        <div
                          key={block.id}
                          draggable
                          onDragStart={(event) => {
                            if (resizingRef.current) {
                              event.preventDefault();
                              return;
                            }
                            event.dataTransfer.setData("block-id", block.id);
                          }}
                          onClick={() => setEditing(block)}
                          className="absolute top-2 flex cursor-grab flex-col justify-center overflow-hidden rounded-md border-l-4 border-primary bg-primary px-3 py-1.5 text-left text-xs text-primary-foreground shadow-sm"
                          style={{ left, width, height: ROW_HEIGHT - 16 }}
                        >
                          <p className="truncate font-medium">{block.title}</p>
                          <p className="truncate opacity-80">{formatTime(block.startMinute)}–{formatTime(block.endMinute)} · {blockHours(block).toFixed(1)}h</p>
                          <span
                            aria-label="Resize block"
                            className="absolute right-0 top-0 h-full w-2 cursor-ew-resize"
                            onPointerDown={(event) => resize(block.id, event)}
                          />
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editing ? (
        <Dialog open onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit time block</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input id="edit-title" value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-member">Team member</Label>
                <Select value={editing.memberUserId} onValueChange={(value) => setEditing({ ...editing, memberUserId: value })}>
                  <SelectTrigger id="edit-member"><SelectValue /></SelectTrigger>
                  <SelectContent>{members.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-date">Start date</Label>
                  <Input id="edit-date" type="date" value={format(editing.date, "yyyy-MM-dd")} onChange={(event) => setEditing({ ...editing, date: new Date(`${event.target.value}T12:00:00`) })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-end-date">End date</Label>
                  <Input id="edit-end-date" type="date" value={format(editing.endDate || editing.date, "yyyy-MM-dd")} onChange={(event) => setEditing({ ...editing, endDate: new Date(`${event.target.value}T12:00:00`) })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-start">Start time</Label>
                  <Input id="edit-start" type="time" step={900} value={minutesToTime(editing.startMinute)} onChange={(event) => setEditing({ ...editing, startMinute: timeToMinutes(event.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-end">End time</Label>
                  <Input id="edit-end" type="time" step={900} value={minutesToTime(editing.endMinute)} onChange={(event) => setEditing({ ...editing, endMinute: timeToMinutes(event.target.value) })} />
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="destructive" onClick={() => remove(editing.id)} disabled={pending}>Remove</Button>
                <Button onClick={saveEdit} disabled={pending}>Save changes</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
