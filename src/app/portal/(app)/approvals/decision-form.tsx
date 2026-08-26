"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { decideDocument } from "./actions";

export function DecisionForm({ documentId }: { documentId: string }) {
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [pending, startTransition] = useTransition();
  function decide(decision: "approved" | "changes_requested") {
    startTransition(async () => {
      await decideDocument(documentId, decision, noteRef.current?.value ?? "");
      toast.success(decision === "approved" ? "Approved" : "Changes requested");
    });
  }
  return <div className="space-y-3"><Textarea ref={noteRef} placeholder="Add a note (optional)" /><div className="flex gap-2"><Button disabled={pending} onClick={() => decide("approved")}>Approve</Button><Button disabled={pending} variant="outline" onClick={() => decide("changes_requested")}>Request changes</Button></div></div>;
}
