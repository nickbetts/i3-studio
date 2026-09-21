"use client";

import { useState, useTransition } from "react";
import { CalendarDays, Clock3 } from "lucide-react";
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
import { PriorityBadge } from "@/components/status-badge";

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

function dueDateText(value: string | null) {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
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
        const canEditTask = canManage || task.assignedToUserIds.includes(currentUserId);
        return (
          <div key={task.id} data-testid={`task-${task.id}`} className="grid gap-3 border-b py-4 last:border-0 lg:grid-cols-[minmax(15rem,1fr)_auto] lg:items-center">
            <div className="flex min-w-0 items-start gap-3">
              {canManage ? <Checkbox className="mt-1" checked={selected.has(task.id)} onCheckedChange={() => toggle(task.id)} aria-label={`Select ${task.title}`} /> : null}
              <div className="min-w-0">
                <TaskDetailDialog taskId={task.id} title={task.title} currentUserId={currentUserId} canEdit={canEditTask} />
                <p className="mt-1 truncate text-xs text-muted-foreground">{task.meta}</p>
              </div>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
              <PriorityBadge priority={task.priority} />
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${task.dueLabel === "overdue" ? "bg-rose-500/15 text-rose-300 ring-rose-500/30" : task.dueLabel === "soon" ? "bg-amber-500/15 text-amber-300 ring-amber-500/30" : "bg-muted text-muted-foreground ring-border"}`}><CalendarDays className="size-3" />{task.dueLabel === "overdue" ? "Overdue · " : task.dueLabel === "soon" ? "Due soon · " : ""}{dueDateText(task.dueDate)}</span>
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
