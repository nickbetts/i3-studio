"use client";

import { useState, useTransition } from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { updateTaskAssignees } from "./actions";

type Member = { id: string; name: string | null; email: string };

const avatarTones = ["from-cyan-500 to-blue-600", "from-emerald-500 to-teal-700", "from-fuchsia-500 to-violet-700", "from-amber-400 to-orange-600", "from-rose-500 to-pink-700", "from-lime-500 to-emerald-700"];

function initials(value: string) {
  const parts = value.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || value.slice(0, 2).toUpperCase();
}

function toneFor(id: string) {
  return avatarTones[[...id].reduce((total, character) => total + character.charCodeAt(0), 0) % avatarTones.length];
}

function AssigneeAvatars({ ids, team }: { ids: string[]; team: Member[] }) {
  const assigned = ids.map((id) => team.find((member) => member.id === id)).filter((member): member is Member => Boolean(member));
  if (!assigned.length) return <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-dashed px-2 text-xs text-muted-foreground"><Users className="size-3.5" />Unassigned</span>;
  return <AvatarGroup aria-label={assigned.map((member) => member.name || member.email).join(", ")}>{assigned.slice(0, 3).map((member) => <Avatar key={member.id} size="sm" title={member.name || member.email}><AvatarFallback className={`bg-linear-to-br ${toneFor(member.id)} text-[10px] font-semibold text-white`}>{initials(member.name || member.email)}</AvatarFallback></Avatar>)}{assigned.length > 3 ? <AvatarGroupCount className="text-[10px]">+{assigned.length - 3}</AvatarGroupCount> : null}</AvatarGroup>;
}

export function TaskAssignee({ taskId, assignedToUserIds, team, editable = true }: { taskId: string; assignedToUserIds: string[]; team: Member[]; editable?: boolean }) {
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

  if (!editable) return <AssigneeAvatars ids={selected} team={team} />;
  return (
    <Popover>
      <PopoverTrigger asChild><Button type="button" variant="ghost" size="sm" className="h-8 px-1.5" disabled={pending} aria-label="Assignees" title={selected.length ? "Edit assignees" : "Assign team members"}><AssigneeAvatars ids={selected} team={team} /></Button></PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <PopoverHeader><PopoverTitle>Task assignees</PopoverTitle></PopoverHeader>
        <div className="max-h-64 space-y-1 overflow-y-auto">{team.map((member) => <label key={member.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"><Checkbox checked={selected.includes(member.id)} onCheckedChange={(value) => toggle(member.id, value === true)} disabled={pending} /><span className="truncate">{member.name || member.email}</span></label>)}</div>
      </PopoverContent>
    </Popover>
  );
}
