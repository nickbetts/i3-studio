"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateTicketStatus } from "./actions";

export function TicketStatus({ ticketId, value }: { ticketId: string; value: "open" | "pending" | "resolved" | "closed" }) {
  const [pending, startTransition] = useTransition();
  return <Select value={value} disabled={pending} onValueChange={(next) => startTransition(async () => { await updateTicketStatus(ticketId, next as typeof value); toast.success("Ticket updated"); })}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent>{["open", "pending", "resolved", "closed"].map((item) => <SelectItem key={item} value={item} className="capitalize">{item}</SelectItem>)}</SelectContent></Select>;
}
