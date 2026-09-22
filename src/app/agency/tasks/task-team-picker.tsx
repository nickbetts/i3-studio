"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateTaskTeam } from "./actions";

type Team = { id: string; name: string };

export function TaskTeamPicker({ taskId, assignedTeamId, teams, editable = true }: { taskId: string; assignedTeamId: string | null; teams: Team[]; editable?: boolean }) {
  const [pending, startTransition] = useTransition();

  function handleChange(value: string) {
    startTransition(async () => {
      await updateTaskTeam(taskId, value === "none" ? null : value);
      toast.success("Team updated");
    });
  }

  if (!editable) {
    const team = teams.find((candidate) => candidate.id === assignedTeamId);
    return team ? <span className="text-xs text-muted-foreground">{team.name}</span> : null;
  }

  return (
    <Select defaultValue={assignedTeamId ?? "none"} onValueChange={handleChange} disabled={pending}>
      <SelectTrigger className="w-36" aria-label="Assigned team"><SelectValue placeholder="No team" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No team</SelectItem>
        {teams.map((team) => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
