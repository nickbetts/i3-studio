"use client";

import { useState, useTransition } from "react";
import { Clock3 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bulkUpdateTasks } from "./actions";
import { TaskAssignee } from "./task-assignee";
import { TaskTeamPicker } from "./task-team-picker";
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
  assignedTeamId: string | null;
  timeSeconds: number;
  dueLabel: "overdue" | "soon" | null;
};

type Member = { id: string; name: string | null; email: string };
type Team = { id: string; name: string };

export function TaskList({ rows, team, teams = [], currentUserId, canManage }: { rows: TaskRow[]; team: Member[]; teams?: Team[]; currentUserId: string; canManage: boolean }) {
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

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {canManage ? <TableHead className="w-10"></TableHead> : null}
              <TableHead>Task</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Assignee</TableHead>
              {teams.length > 0 ? <TableHead>Team</TableHead> : null}
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((task) => {
              const canEditTask = canManage || task.assignedToUserIds.includes(currentUserId);
              return (
                <TableRow key={task.id} data-testid={`task-${task.id}`}>
                  {canManage ? (
                    <TableCell>
                      <Checkbox checked={selected.has(task.id)} onCheckedChange={() => toggle(task.id)} aria-label={`Select ${task.title}`} />
                    </TableCell>
                  ) : null}
                  <TableCell className="max-w-72 whitespace-normal">
                    <TaskDetailDialog taskId={task.id} title={task.title} currentUserId={currentUserId} canEdit={canEditTask} team={team} />
                    <p className="mt-1 truncate text-xs text-muted-foreground">{task.meta}</p>
                  </TableCell>
                  <TableCell><TaskPriorityPicker taskId={task.id} value={task.priority} editable={canEditTask} /></TableCell>
                  <TableCell><TaskDueDatePicker taskId={task.id} value={task.dueDate} editable={canEditTask} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {task.timeSeconds > 0 ? <Badge variant="outline" className="gap-1 font-mono tabular-nums"><Clock3 className="size-3" />{formatLoggedTime(task.timeSeconds)}</Badge> : null}
                      <TaskTimerButton clientAccountId={task.clientAccountId} projectId={task.projectId} taskId={task.id} clientName={task.clientName} projectName={task.projectName} taskTitle={task.title} />
                    </div>
                  </TableCell>
                  <TableCell><TaskAssignee taskId={task.id} assignedToUserIds={task.assignedToUserIds} team={team} editable={canManage} /></TableCell>
                  {teams.length > 0 ? <TableCell><TaskTeamPicker taskId={task.id} assignedTeamId={task.assignedTeamId} teams={teams} editable={canManage} /></TableCell> : null}
                  <TableCell>{canEditTask ? <TaskStatus taskId={task.id} value={task.status} /> : <Badge variant="outline" className="capitalize">{task.status.replace("_", " ")}</Badge>}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
