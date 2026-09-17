"use client";

import { useTransition } from "react";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startTimer } from "../time/actions";
import { notifyTimerChanged } from "../time/time-tracker";

export function TaskTimerButton({ clientAccountId, projectId, taskId, clientName, projectName, taskTitle }: { clientAccountId: string; projectId: string | null; taskId: string; clientName: string; projectName: string | null; taskTitle: string }) {
  const [pending, start] = useTransition();

  function begin() {
    start(async () => {
      const result = await startTimer({ clientAccountId, projectId, taskId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      notifyTimerChanged({ startedAt: result.startedAt ?? new Date().toISOString(), clientName, projectName, taskTitle });
      toast.success("Timer started");
    });
  }

  return <Button type="button" size="icon-sm" variant="ghost" onClick={begin} disabled={pending} aria-label={`Start timer for ${taskTitle}`} title="Start timer"><Play className="size-4" /></Button>;
}
