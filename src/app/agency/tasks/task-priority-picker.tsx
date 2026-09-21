"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { PriorityBadge } from "@/components/status-badge";
import { updateTaskPriority } from "./actions";

const priorities = ["low", "medium", "high", "urgent"] as const;

type Priority = (typeof priorities)[number];

export function TaskPriorityPicker({ taskId, value, editable }: { taskId: string; value: Priority; editable: boolean }) {
  const [priority, setPriority] = useState(value);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  if (!editable) return <PriorityBadge priority={priority} />;
  function choose(next: Priority) {
    setPriority(next);
    setOpen(false);
    start(async () => {
      await updateTaskPriority(taskId, next);
      toast.success("Priority updated");
    });
  }

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><button type="button" data-testid="task-priority-picker" disabled={pending} aria-label={`Change priority from ${priority}`} className="rounded-full transition-opacity hover:opacity-80"><PriorityBadge priority={priority} /></button></PopoverTrigger>
    <PopoverContent align="end" className="w-52">
      <PopoverHeader><PopoverTitle>Priority</PopoverTitle></PopoverHeader>
      <div className="space-y-1">{priorities.map((option) => <Button key={option} type="button" variant="ghost" className="w-full justify-between" onClick={() => choose(option)}><PriorityBadge priority={option} />{priority === option ? <Check className="size-4 text-primary" /> : null}</Button>)}</div>
    </PopoverContent>
  </Popover>;
}
