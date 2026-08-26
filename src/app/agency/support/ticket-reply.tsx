"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { replyToTicket } from "./actions";

export function TicketReply({ ticketId }: { ticketId: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [pending, startTransition] = useTransition();
  return <div className="space-y-2"><Textarea ref={ref} placeholder="Reply to the client" /><Button size="sm" disabled={pending} onClick={() => startTransition(async () => { await replyToTicket(ticketId, ref.current?.value ?? ""); if (ref.current) ref.current.value = ""; toast.success("Reply sent"); })}>Reply and email client</Button></div>;
}
