"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateTaskAssignee } from "./actions";

type Member = { id: string; name: string | null; email: string };

export function TaskAssignee({ taskId, assignedToUserId, team }: { taskId: string; assignedToUserId: string | null; team: Member[] }) {
  const [pending, startTransition] = useTransition();
  return (
    <Select
      value={assignedToUserId ?? "unassigned"}
      disabled={pending}
      onValueChange={(value) => startTransition(async () => {
        await updateTaskAssignee(taskId, value === "unassigned" ? null : value);
        toast.success("Assignee updated");
      })}
    >
      <SelectTrigger className="w-40" aria-label="Assignee"><SelectValue placeholder="Unassigned" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="unassigned">Unassigned</SelectItem>
        {team.map((member) => <SelectItem key={member.id} value={member.id}>{member.name || member.email}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
