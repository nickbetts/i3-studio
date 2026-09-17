"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { bulkUpdateTasks } from "./actions";
import { TaskAssignee } from "./task-assignee";
import { TaskDetailDialog } from "./task-detail-dialog";
import { TaskStatus } from "./task-status";
import { TaskTimerButton } from "./task-timer-button";

export type TaskRow = {
  id: string;
  title: string;
  clientAccountId: string;
  projectId: string | null;
  clientName: string;
  projectName: string | null;
  meta: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "blocked" | "done";
  assignedToUserId: string | null;
  timeSeconds: number;
  dueLabel: "overdue" | "soon" | null;
};

type Member = { id: string; name: string | null; email: string };

function formatTime(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`;
}

export function TaskList({ rows, team, currentUserId, canManage }: { rows: TaskRow[]; team: Member[]; currentUserId: string; canManage: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyBulkStatus(status: string) {
    start(async () => {
      await bulkUpdateTasks([...selected], { status: status as TaskRow["status"] });
      setSelected(new Set());
      toast.success("Tasks updated");
    });
  }

  function applyBulkAssignee(userId: string) {
    start(async () => {
      await bulkUpdateTasks([...selected], { assignedToUserId: userId === "unassigned" ? null : userId });
      setSelected(new Set());
      toast.success("Tasks reassigned");
    });
  }

  return (
    <div className="space-y-2">
      {canManage && selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <Select onValueChange={applyBulkStatus} disabled={pending}>
            <SelectTrigger className="w-40" aria-label="Bulk set status"><SelectValue placeholder="Set status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
          <Select onValueChange={applyBulkAssignee} disabled={pending}>
            <SelectTrigger className="w-44" aria-label="Bulk set assignee"><SelectValue placeholder="Reassign to…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {team.map((member) => <SelectItem key={member.id} value={member.id}>{member.name || member.email}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      ) : null}

      {rows.map((task) => {
        const canEditTask = canManage || task.assignedToUserId === currentUserId;
        return (
          <div key={task.id} data-testid={`task-${task.id}`} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-0">
            <div className="flex items-start gap-3">
              {canManage ? <Checkbox className="mt-1" checked={selected.has(task.id)} onCheckedChange={() => toggle(task.id)} aria-label={`Select ${task.title}`} /> : null}
              <div>
                <TaskDetailDialog taskId={task.id} title={task.title} currentUserId={currentUserId} canEdit={canEditTask} />
                <p className="text-xs capitalize text-muted-foreground">{task.meta}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {task.dueLabel === "overdue" ? <Badge variant="destructive">Overdue</Badge> : null}
              {task.dueLabel === "soon" ? <Badge className="bg-amber-500 text-white dark:bg-amber-600">Due soon</Badge> : null}
              {task.timeSeconds > 0 ? <Badge variant="outline" className="font-mono">{formatTime(task.timeSeconds)}</Badge> : null}
              <TaskTimerButton clientAccountId={task.clientAccountId} projectId={task.projectId} taskId={task.id} clientName={task.clientName} projectName={task.projectName} taskTitle={task.title} />
              {canManage ? <TaskAssignee taskId={task.id} assignedToUserId={task.assignedToUserId} team={team} /> : null}
              {canEditTask ? <TaskStatus taskId={task.id} value={task.status} /> : <Badge variant="outline" className="capitalize">{task.status.replace("_", " ")}</Badge>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
