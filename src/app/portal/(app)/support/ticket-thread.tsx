"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { replyToTicket } from "./actions";

export function TicketThread({ ticketId, messages }: { ticketId: string; messages: { id: string; body: string; direction: string }[] }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [pending, startTransition] = useTransition();
  return <div className="space-y-3">{messages.map((message) => <div key={message.id} className={`rounded-md p-3 text-sm ${message.direction === "inbound" ? "bg-muted" : "bg-primary/10"}`}>{message.body}</div>)}<Textarea ref={ref} placeholder="Write a reply" /><Button disabled={pending} onClick={() => startTransition(async () => { await replyToTicket(ticketId, ref.current?.value ?? ""); if (ref.current) ref.current.value = ""; toast.success("Reply sent"); })}>Reply</Button></div>;
}
