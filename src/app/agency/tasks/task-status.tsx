"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateTaskStatus } from "./actions";

export function TaskStatus({ taskId, value }: { taskId: string; value: "open" | "in_progress" | "blocked" | "done" }) {
  const [pending, startTransition] = useTransition();
  return (
    <Select value={value} disabled={pending} onValueChange={(status) => startTransition(async () => {
      await updateTaskStatus(taskId, status as typeof value);
      toast.success("Task updated");
    })}>
      <SelectTrigger className="w-35"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="open">Open</SelectItem>
        <SelectItem value="in_progress">In progress</SelectItem>
        <SelectItem value="blocked">Blocked</SelectItem>
        <SelectItem value="done">Done</SelectItem>
      </SelectContent>
    </Select>
  );
}
