"use client";

import { useState, useTransition } from "react";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { updateTaskDueDate } from "./actions";

function dateText(value: string | null) {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function urgency(value: string | null) {
  if (!value) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(value); due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  return days < 0 ? "overdue" : days <= 1 ? "soon" : null;
}

export function TaskDueDatePicker({ taskId, value, editable }: { taskId: string; value: string | null; editable: boolean }) {
  const [date, setDate] = useState(value?.slice(0, 10) ?? "");
  const [draft, setDraft] = useState(date);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const dueState = urgency(date);
  const className = dueState === "overdue" ? "bg-rose-500/15 text-rose-300 ring-rose-500/30" : dueState === "soon" ? "bg-amber-500/15 text-amber-300 ring-amber-500/30" : "bg-muted text-muted-foreground ring-border";
  const label = `${dueState === "overdue" ? "Overdue · " : dueState === "soon" ? "Due soon · " : ""}${dateText(date)}`;

  function save(next: string) {
    setDate(next);
    setDraft(next);
    setOpen(false);
    start(async () => {
      await updateTaskDueDate(taskId, next || null);
      toast.success(next ? "Due date updated" : "Due date cleared");
    });
  }

  const chip = <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${className}`}><CalendarDays className="size-3" />{label}</span>;
  if (!editable) return chip;
  return <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) setDraft(date); }}>
    <PopoverTrigger asChild><button type="button" data-testid="task-due-date-picker" disabled={pending} aria-label={`Change due date from ${dateText(date)}`} className="rounded-full transition-opacity hover:opacity-80">{chip}</button></PopoverTrigger>
    <PopoverContent align="end" className="w-72">
      <PopoverHeader><PopoverTitle>Due date</PopoverTitle></PopoverHeader>
      <div className="space-y-3"><div className="space-y-1"><Label htmlFor={`due-${taskId}`}>Date</Label><Input id={`due-${taskId}`} type="date" value={draft} onChange={(event) => setDraft(event.target.value)} /></div><div className="flex flex-wrap justify-between gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => save("")}>Clear</Button><div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setDraft(new Date().toISOString().slice(0, 10))}>Today</Button><Button type="button" size="sm" onClick={() => save(draft)} disabled={!draft}>Save</Button></div></div></div>
    </PopoverContent>
  </Popover>;
}