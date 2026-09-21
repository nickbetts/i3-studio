"use client";

import { useState, useTransition } from "react";
import { Clock3 } from "lucide-react";
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
import { formatLoggedTime } from "@/lib/time-format";
import { TaskPriorityPicker } from "./task-priority-picker";
import { TaskDueDatePicker } from "./task-due-date-picker";

export type TaskRow = {
  id: string;
  title: string;
  clientAccountId: string;
  projectId: string | null;
  clientName: string;
  projectName: string | null;
  meta: string;
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  status: "open" | "in_progress" | "blocked" | "done";
  assignedToUserIds: string[];
  assigneeNames: string[];
  timeSeconds: number;
  dueLabel: "overdue" | "soon" | null;
};

type Member = { id: string; name: string | null; email: string };

export function TaskList({ rows, team, currentUserId, canManage, compact = false }: { rows: TaskRow[]; team: Member[]; currentUserId: string; canManage: boolean; compact?: boolean }) {
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
    <div className={compact ? "space-y-2 overflow-x-auto pb-1" : "space-y-2"}>
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
        const canEditTask = canManage || task.assignedToUserIds.includes(currentUserId);
        return (
          <div key={task.id} data-testid={`task-${task.id}`} className={compact ? "grid gap-3 border-b py-3 last:border-0 md:min-w-[48rem] md:grid-cols-[minmax(8rem,1fr)_auto] md:items-center" : "grid gap-3 border-b py-4 last:border-0 lg:grid-cols-[minmax(15rem,1fr)_auto] lg:items-center"}>
            <div className="flex min-w-0 items-start gap-3">
              {canManage ? <Checkbox className="mt-1" checked={selected.has(task.id)} onCheckedChange={() => toggle(task.id)} aria-label={`Select ${task.title}`} /> : null}
              <div className="min-w-0">
                <TaskDetailDialog taskId={task.id} title={task.title} currentUserId={currentUserId} canEdit={canEditTask} />
                <p className="mt-1 truncate text-xs text-muted-foreground">{task.meta}</p>
              </div>
            </div>
            <div data-testid="task-row-controls" className={compact ? "flex min-w-0 flex-wrap items-center gap-2 md:flex-nowrap md:justify-end md:whitespace-nowrap [&_[data-slot=select-trigger]]:w-28" : "flex min-w-0 flex-wrap items-center gap-2 lg:justify-end"}>
              <TaskPriorityPicker taskId={task.id} value={task.priority} editable={canEditTask} />
              <TaskDueDatePicker taskId={task.id} value={task.dueDate} editable={canEditTask} />
              {task.timeSeconds > 0 ? <Badge variant="outline" className="gap-1 font-mono tabular-nums"><Clock3 className="size-3" />{formatLoggedTime(task.timeSeconds)}</Badge> : null}
              <TaskTimerButton clientAccountId={task.clientAccountId} projectId={task.projectId} taskId={task.id} clientName={task.clientName} projectName={task.projectName} taskTitle={task.title} />
              <TaskAssignee taskId={task.id} assignedToUserIds={task.assignedToUserIds} team={team} editable={canManage} />
              {canEditTask ? <TaskStatus taskId={task.id} value={task.status} /> : <Badge variant="outline" className="capitalize">{task.status.replace("_", " ")}</Badge>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
