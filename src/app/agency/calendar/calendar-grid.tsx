"use client";

import { useState, useTransition } from "react";
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
const HALF = DAY_WIDTH / 2;
const ROW_HEIGHT = 68;
const NAME_WIDTH = 200;

// Allocations are measured in whole/half days.
// startMinute: 0 = morning, 720 = afternoon.  endMinute: 720 = midday, 1440 = end of day.
function startsPM(block: Block) {
  return block.startMinute >= 720;
}
function endsMidday(block: Block) {
  return block.endMinute <= 720;
}

// Convert a block to a half-day span (in half-day units) relative to the week start.
function toHalfSpan(block: Block, weekStart: Date) {
  const startDay = differenceInCalendarDays(new Date(block.date), weekStart);
  const endDay = differenceInCalendarDays(new Date(block.endDate || block.date), weekStart);
  const startHalf = startDay * 2 + (startsPM(block) ? 1 : 0);
  const endHalf = endDay * 2 + (endsMidday(block) ? 1 : 2);
  return { startHalf, endHalf: Math.max(startHalf + 1, endHalf) };
}

// Convert a half-day span back into persistable date/half fields.
function fromHalfSpan(startHalf: number, endHalf: number, weekStart: Date) {
  const safeEnd = Math.max(startHalf + 1, endHalf);
  const startDay = Math.floor(startHalf / 2);
  const startPM = startHalf - startDay * 2 === 1;
  const lastHalf = safeEnd - 1;
  const endDay = Math.floor(lastHalf / 2);
  const endPM = lastHalf - endDay * 2 === 1;
  return {
    date: addDays(weekStart, startDay),
    endDate: addDays(weekStart, endDay),
    startMinute: startPM ? 720 : 0,
    endMinute: endPM ? 1440 : 720,
  };
}

function blockDays(block: Block) {
  const startOffset = startsPM(block) ? 1 : 0;
  const endHalves = differenceInCalendarDays(new Date(block.endDate || block.date), new Date(block.date)) * 2 + (endsMidday(block) ? 1 : 2);
  return (endHalves - startOffset) / 2;
}
function daysLabel(days: number) {
  return `${days} day${days === 1 ? "" : "s"}`;
}
function rangeLabel(block: Block) {
  const start = new Date(block.date);
  const end = new Date(block.endDate || block.date);
  return differenceInCalendarDays(end, start) === 0 ? format(start, "d MMM") : `${format(start, "d MMM")} – ${format(end, "d MMM")}`;
}

export function CalendarGrid({ members, blocks, canEdit }: { members: Member[]; blocks: Block[]; canEdit: boolean }) {
  const [view, setView] = useState<"week" | "month">("week");
  const [date, setDate] = useState(new Date());
  const [localBlocks, setLocalBlocks] = useState(blocks);
  const [editing, setEditing] = useState<Block | null>(null);
  const [pending, startTransition] = useTransition();

  // Re-sync with server data whenever an allocation is added, edited or removed.
  const signature = blocks.map((b) => `${b.id}:${new Date(b.date).getTime()}:${b.endDate ? new Date(b.endDate).getTime() : 0}:${b.startMinute}:${b.endMinute}:${b.memberUserId}:${b.title}`).join("|");
  const [prevSignature, setPrevSignature] = useState(signature);
  if (signature !== prevSignature) {
    setPrevSignature(signature);
    setLocalBlocks(blocks);
  }

  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const monthStart = startOfMonth(date);
  const monthCalendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const monthDays = Array.from({ length: 42 }, (_, index) => addDays(monthCalendarStart, index));

  function shift(amount: number) {
    setDate((current) => (view === "week" ? addDays(current, amount * 7) : addDays(current, amount * 30)));
  }

  // Fluid pointer drag: moves a block across days (half-day snap) and between people.
  function beginDrag(block: Block, event: React.PointerEvent<HTMLDivElement>) {
    if (!canEdit) return;
    event.preventDefault();
    const { startHalf, endHalf } = toHalfSpan(block, weekStart);
    const duration = endHalf - startHalf;
    const originMember = Math.max(0, members.findIndex((member) => member.id === block.memberUserId));
    let moved = false;
    let curStartHalf = startHalf;
    let curMember = originMember;
    const onMove = (moveEvent: PointerEvent) => {
      if (Math.abs(moveEvent.clientX - event.clientX) > 4 || Math.abs(moveEvent.clientY - event.clientY) > 4) moved = true;
      const dx = Math.round((moveEvent.clientX - event.clientX) / HALF);
      const dy = Math.round((moveEvent.clientY - event.clientY) / ROW_HEIGHT);
      curStartHalf = startHalf + dx;
      curMember = Math.max(0, Math.min(members.length - 1, originMember + dy));
      const span = fromHalfSpan(curStartHalf, curStartHalf + duration, weekStart);
      const memberUserId = members[curMember].id;
      setLocalBlocks((items) => items.map((item) => (item.id === block.id ? { ...item, ...span, memberUserId } : item)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (!moved) {
        setEditing(block);
        return;
      }
      const span = fromHalfSpan(curStartHalf, curStartHalf + duration, weekStart);
      const memberUserId = members[curMember].id;
      startTransition(async () => {
        await updateAllocation(block.id, { memberUserId, date: format(span.date, "yyyy-MM-dd"), endDate: format(span.endDate, "yyyy-MM-dd"), startMinute: span.startMinute, endMinute: span.endMinute });
        toast.success("Block moved");
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Right-edge resize in half-day steps.
  function resize(block: Block, event: React.PointerEvent<HTMLSpanElement>) {
    if (!canEdit) return;
    event.stopPropagation();
    event.preventDefault();
    const { startHalf, endHalf } = toHalfSpan(block, weekStart);
    let curEndHalf = endHalf;
    const onMove = (moveEvent: PointerEvent) => {
      const dx = Math.round((moveEvent.clientX - event.clientX) / HALF);
      curEndHalf = Math.max(startHalf + 1, endHalf + dx);
      const span = fromHalfSpan(startHalf, curEndHalf, weekStart);
      setLocalBlocks((items) => items.map((item) => (item.id === block.id ? { ...item, ...span } : item)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const span = fromHalfSpan(startHalf, curEndHalf, weekStart);
      startTransition(async () => {
        await updateAllocation(block.id, { date: format(span.date, "yyyy-MM-dd"), endDate: format(span.endDate, "yyyy-MM-dd"), startMinute: span.startMinute, endMinute: span.endMinute });
        toast.success("Block resized");
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function saveEdit() {
    if (!editing || !editing.title.trim()) return;
    if (blockDays(editing) <= 0) {
      toast.error("The block needs to end after it starts");
      return;
    }
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

  const daysFor = (memberId: string) =>
    localBlocks
      .filter((block) => block.memberUserId === memberId && differenceInCalendarDays(new Date(block.endDate || block.date), weekStart) >= 0 && differenceInCalendarDays(new Date(block.date), weekStart) <= 6)
      .reduce((total, block) => total + blockDays(block), 0);

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
                  <button type="button" key={item.id} className="mt-1 block w-full truncate rounded bg-primary/15 px-1 py-0.5 text-left text-[10px]" onClick={() => canEdit && setEditing(item)}>
                    {item.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <div style={{ minWidth: NAME_WIDTH + 7 * DAY_WIDTH }}>
            <div className="flex border-b bg-muted/40 text-xs font-medium">
              <div className="p-3" style={{ width: NAME_WIDTH }}>Team member</div>
              <div className="flex">
                {days.map((day) => (
                  <div key={day.toISOString()} className="border-l p-3" style={{ width: DAY_WIDTH }}>
                    <p>{format(day, "EEE")}</p>
                    <p className="text-muted-foreground">{format(day, "d MMM")}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex">
              <div style={{ width: NAME_WIDTH }}>
                {members.map((member) => (
                  <div key={member.id} className="flex flex-col justify-center border-b px-3" style={{ height: ROW_HEIGHT }}>
                    <p className="truncate text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{daysLabel(daysFor(member.id))} this week</p>
                  </div>
                ))}
              </div>
              <div className="relative" style={{ width: 7 * DAY_WIDTH, height: members.length * ROW_HEIGHT }}>
                {members.map((member, index) => (
                  <div key={member.id} className="absolute inset-x-0 border-b" style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT }} />
                ))}
                {days.map((day, index) => (
                  <div key={day.toISOString()} className="absolute top-0 border-l" style={{ left: index * DAY_WIDTH, width: DAY_WIDTH, height: members.length * ROW_HEIGHT }}>
                    <div className="absolute bottom-0 top-0 border-l border-dashed border-border/60" style={{ left: HALF }} />
                  </div>
                ))}
                {localBlocks.map((block) => {
                  const memberIndex = members.findIndex((member) => member.id === block.memberUserId);
                  if (memberIndex < 0) return null;
                  const { startHalf, endHalf } = toHalfSpan(block, weekStart);
                  if (endHalf <= 0 || startHalf >= 14) return null;
                  const clampedStart = Math.max(0, startHalf);
                  const clampedEnd = Math.min(14, endHalf);
                  const left = clampedStart * HALF + 3;
                  const width = (clampedEnd - clampedStart) * HALF - 6;
                  return (
                    <div
                      key={block.id}
                      onPointerDown={(event) => beginDrag(block, event)}
                      className={`absolute flex flex-col justify-center overflow-hidden rounded-md border-l-4 border-primary bg-primary px-3 py-1 text-left text-xs text-primary-foreground shadow-sm ${canEdit ? "cursor-grab touch-none select-none active:cursor-grabbing" : "cursor-default"}`}
                      style={{ top: memberIndex * ROW_HEIGHT + 6, left, width, height: ROW_HEIGHT - 12 }}
                    >
                      <p className="truncate font-medium">{block.title}</p>
                      <p className="truncate text-[11px] opacity-80">{rangeLabel(block)} · {daysLabel(blockDays(block))}</p>
                      {canEdit ? (
                        <span
                          aria-label="Resize block"
                          className="absolute right-0 top-0 h-full w-2.5 touch-none cursor-ew-resize"
                          onPointerDown={(event) => resize(block, event)}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
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
                  <Label htmlFor="edit-start-half">Starts</Label>
                  <Select value={editing.startMinute >= 720 ? "pm" : "am"} onValueChange={(value) => setEditing({ ...editing, startMinute: value === "pm" ? 720 : 0 })}>
                    <SelectTrigger id="edit-start-half"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="am">Morning</SelectItem><SelectItem value="pm">Afternoon</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-end-half">Ends</Label>
                  <Select value={editing.endMinute <= 720 ? "midday" : "end"} onValueChange={(value) => setEditing({ ...editing, endMinute: value === "midday" ? 720 : 1440 })}>
                    <SelectTrigger id="edit-end-half"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="midday">Midday</SelectItem><SelectItem value="end">End of day</SelectItem></SelectContent>
                  </Select>
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
