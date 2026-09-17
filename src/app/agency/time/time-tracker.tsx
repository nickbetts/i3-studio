"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Clock3, Play, Square, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startTimer, stopTimer } from "./actions";

type Client = { id: string; name: string };
type Project = { id: string; clientAccountId: string; name: string };
type Task = { id: string; clientAccountId: string; projectId: string | null; title: string };
export type ActiveTimer = { startedAt: string; clientName: string; projectName: string | null; taskTitle: string | null };
export type TimerEventDetail = { active: ActiveTimer | null };

export function notifyTimerChanged(active: ActiveTimer | null) {
  window.dispatchEvent(new CustomEvent<TimerEventDetail>("i3:timer-changed", { detail: { active } }));
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}:${String(remaining).padStart(2, "0")}`;
}

export function TimeTracker({ clients, projects, tasks, initialActive }: { clients: Client[]; projects: Project[]; tasks: Task[]; initialActive: ActiveTimer | null }) {
  const [open, setOpen] = useState(Boolean(initialActive));
  const [active, setActive] = useState(initialActive);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const handleTimerChanged = (event: Event) => {
      setActive((event as CustomEvent<TimerEventDetail>).detail.active);
      setOpen(true);
    };
    window.addEventListener("i3:timer-changed", handleTimerChanged);
    return () => window.removeEventListener("i3:timer-changed", handleTimerChanged);
  }, []);

  useEffect(() => {
    if (!active) {
      // Clear the display immediately when the active timer is stopped.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setElapsed(0);
      return;
    }
    const update = () => {
      // The timer display is an external clock; refreshing it on the interval is intentional.
      setElapsed(Math.max(0, Math.floor((Date.now() - new Date(active.startedAt).getTime()) / 1000)));
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [active]);

  const filteredProjects = useMemo(() => projects.filter((project) => project.clientAccountId === clientId), [projects, clientId]);
  const filteredTasks = useMemo(() => tasks.filter((task) => task.clientAccountId === clientId && (!projectId || task.projectId === projectId)), [tasks, clientId, projectId]);

  function selectClient(value: string) {
    setClientId(value);
    setProjectId("");
    setTaskId("");
  }

  function selectProject(value: string) {
    setProjectId(value);
    setTaskId("");
  }

  function begin() {
    if (!clientId) return;
    startTransition(async () => {
      const result = await startTimer({ clientAccountId: clientId, projectId: projectId || null, taskId: taskId || null });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const client = clients.find((item) => item.id === clientId);
      const project = projects.find((item) => item.id === projectId);
      const task = tasks.find((item) => item.id === taskId);
      const nextActive: ActiveTimer = { startedAt: result.startedAt ?? new Date().toISOString(), clientName: client?.name ?? "Client work", projectName: project?.name ?? null, taskTitle: task?.title ?? null };
      setActive(nextActive);
      notifyTimerChanged(nextActive);
      setOpen(true);
      toast.success("Timer started");
    });
  }

  function finish() {
    startTransition(async () => {
      const result = await stopTimer();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setActive(null);
      notifyTimerChanged(null);
      setClientId("");
      setProjectId("");
      setTaskId("");
      toast.success(`Logged ${formatDuration(result.durationSeconds ?? 0)}`);
    });
  }

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-2">
      {open ? (
        <div className="w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border/70 bg-background/95 p-4 shadow-xl backdrop-blur-xl">
          {active ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tracking time</p>
                  <p className="mt-1 truncate font-medium">{active.clientName}</p>
                  <p className="truncate text-xs text-muted-foreground">{active.projectName ?? "Client work"}{active.taskTitle ? ` · ${active.taskTitle}` : ""}</p>
                </div>
                <span className="font-mono text-lg font-semibold tabular-nums">{formatDuration(elapsed)}</span>
              </div>
              <Button type="button" className="w-full" variant="destructive" onClick={finish} disabled={pending}><Square className="size-4" /> Stop and log time</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div><p className="font-medium">Start a timer</p><p className="text-xs text-muted-foreground">Choose the client first, then narrow it to a project or task.</p></div>
              <select aria-label="Timer client" value={clientId} onChange={(event) => selectClient(event.target.value)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Choose a client</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
              <select aria-label="Timer project" value={projectId} onChange={(event) => selectProject(event.target.value)} disabled={!clientId} className="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-50">
                <option value="">No project</option>
                {filteredProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
              <select aria-label="Timer task" value={taskId} onChange={(event) => setTaskId(event.target.value)} disabled={!clientId} className="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-50">
                <option value="">No task</option>
                {filteredTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
              </select>
              <Button type="button" className="w-full" onClick={begin} disabled={!clientId || pending}><Play className="size-4" /> Start timer</Button>
            </div>
          )}
        </div>
      ) : null}
      <Button type="button" size="lg" className="rounded-full px-4 shadow-lg" onClick={() => setOpen((value) => !value)} aria-label={active ? "Open active timer" : "Start a timer"}>
        {active ? <Clock3 className="size-4" /> : <Timer className="size-4" />}
        {active ? <span className="font-mono tabular-nums">{formatDuration(elapsed)}</span> : <span>Track time</span>}
      </Button>
    </div>
  );
}
