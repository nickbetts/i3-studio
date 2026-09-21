"use client";

import { useState, useTransition } from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { updateTaskAssignees } from "./actions";

type Member = { id: string; name: string | null; email: string };

export function TaskAssignee({ taskId, assignedToUserIds, team }: { taskId: string; assignedToUserIds: string[]; team: Member[] }) {
  const [selected, setSelected] = useState(assignedToUserIds);
  const [pending, startTransition] = useTransition();

  function toggle(userId: string, checked: boolean) {
    const next = checked ? [...new Set([...selected, userId])] : selected.filter((id) => id !== userId);
    setSelected(next);
    startTransition(async () => {
      await updateTaskAssignees(taskId, next);
      toast.success(next.length === 1 ? "Assignee updated" : "Assignees updated");
    });
  }

  return (
    <Popover>
      <PopoverTrigger asChild><Button type="button" variant="outline" size="sm" className="max-w-52 justify-start" disabled={pending} aria-label="Assignees"><Users className="size-4" /><span className="truncate">{selected.length ? `${selected.length} assigned` : "Unassigned"}</span></Button></PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <PopoverHeader><PopoverTitle>Task assignees</PopoverTitle></PopoverHeader>
        <div className="max-h-64 space-y-1 overflow-y-auto">{team.map((member) => <label key={member.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"><Checkbox checked={selected.includes(member.id)} onCheckedChange={(value) => toggle(member.id, value === true)} disabled={pending} /><span className="truncate">{member.name || member.email}</span></label>)}</div>
      </PopoverContent>
    </Popover>
  );
}
