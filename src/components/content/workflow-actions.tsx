"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { amDecision, clientDecision, publishContent } from "@/app/agency/content/actions";

export function WorkflowActions({ itemId, mode }: { itemId: string; mode: "am" | "client" | "publish" }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  const approve = () =>
    start(async () => {
      if (mode === "am") await amDecision(itemId, "approve", "");
      else if (mode === "client") await clientDecision(itemId, "approve", "");
      else await publishContent(itemId);
      toast.success(mode === "publish" ? "Published" : mode === "am" ? "Approved — sent to client" : "Approved");
    });

  const requestChanges = () =>
    start(async () => {
      if (mode === "am") await amDecision(itemId, "changes", note);
      else await clientDecision(itemId, "changes", note);
      setOpen(false);
      setNote("");
      toast.success("Changes requested");
    });

  if (mode === "publish") return <Button onClick={approve} disabled={pending}>Mark as published</Button>;

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={approve} disabled={pending}>{mode === "am" ? "Approve & send to client" : "Approve"}</Button>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={pending}>Request changes</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request changes</DialogTitle></DialogHeader>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="What needs to change?" rows={4} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={requestChanges} disabled={pending || note.trim().length === 0}>Send request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
