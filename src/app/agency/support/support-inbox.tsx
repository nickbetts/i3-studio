"use client";

import { useMemo, useState, useTransition } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Mail, MessageCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { replyToTicket, updateTicketPriority, updateTicketStatus } from "./actions";

type Message = { id: string; body: string; direction: string; channel: string; authorEmail: string | null; createdAt: string | Date };
type Ticket = {
  id: string;
  subject: string;
  status: "open" | "pending" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  clientName: string;
  assigneeName: string | null;
  updatedAt: string | Date;
  messages: Message[];
};

const STATUS_FILTERS = ["all", "open", "pending", "resolved", "closed"] as const;

export function SupportInbox({ tickets }: { tickets: Ticket[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter((ticket) => (statusFilter === "all" || ticket.status === statusFilter) && (!q || ticket.subject.toLowerCase().includes(q) || ticket.clientName.toLowerCase().includes(q)));
  }, [tickets, query, statusFilter]);

  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? null;

  function send() {
    if (!selected || reply.trim().length === 0) return;
    startTransition(async () => {
      await replyToTicket(selected.id, reply);
      setReply("");
      toast.success("Reply sent");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tickets…" className="pl-8" />
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((value) => (
            <Button key={value} size="sm" variant={statusFilter === value ? "default" : "outline"} className="capitalize" onClick={() => setStatusFilter(value)}>
              {value}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={MessageCircle} title="No tickets found" description="Try adjusting your search or filters." />
      ) : (
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned to</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((ticket) => {
                const last = ticket.messages.at(-1);
                return (
                  <TableRow key={ticket.id} className="cursor-pointer" onClick={() => setSelectedId(ticket.id)}>
                    <TableCell className="max-w-72 whitespace-normal">
                      <p className="truncate font-medium">{ticket.subject}</p>
                      {last ? <p className="truncate text-xs text-muted-foreground">{last.body}</p> : null}
                    </TableCell>
                    <TableCell>{ticket.clientName}</TableCell>
                    <TableCell><PriorityBadge priority={ticket.priority} /></TableCell>
                    <TableCell><StatusBadge status={ticket.status} /></TableCell>
                    <TableCell className="text-muted-foreground">{ticket.assigneeName ?? "Unassigned"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelectedId(null)}>
        {selected ? (
          <DialogContent className="max-w-2xl p-0 sm:max-w-2xl">
            <DialogHeader className="gap-2 border-b p-4 pr-12">
              <DialogTitle className="truncate">{selected.subject}</DialogTitle>
              <p className="text-xs text-muted-foreground">{selected.clientName}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Select value={selected.status} onValueChange={(value) => startTransition(async () => { await updateTicketStatus(selected.id, value as Ticket["status"]); toast.success("Status updated"); })}>
                  <SelectTrigger className="w-36 capitalize"><SelectValue /></SelectTrigger>
                  <SelectContent>{["open", "pending", "resolved", "closed"].map((item) => <SelectItem key={item} value={item} className="capitalize">{item}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={selected.priority} onValueChange={(value) => startTransition(async () => { await updateTicketPriority(selected.id, value as Ticket["priority"]); toast.success("Priority updated"); })}>
                  <SelectTrigger className="w-32 capitalize"><SelectValue /></SelectTrigger>
                  <SelectContent>{["low", "medium", "high", "urgent"].map((item) => <SelectItem key={item} value={item} className="capitalize">{item}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </DialogHeader>
            <div className="max-h-[45vh] space-y-3 overflow-y-auto p-4">
              {selected.messages.map((message) => (
                <div key={message.id} className={`max-w-[85%] rounded-lg p-3 text-sm ${message.direction === "inbound" ? "bg-muted" : "ml-auto bg-primary/10"}`}>
                  <p className="whitespace-pre-wrap">{message.body}</p>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {message.channel === "email" ? <Mail className="size-3" /> : <MessageCircle className="size-3" />}
                    <span>{message.authorEmail || message.channel}</span>
                    <span>·</span>
                    <span>{format(new Date(message.createdAt), "d MMM, HH:mm")}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t bg-muted/20 p-4">
              <Textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Reply to the client…" rows={3} />
              <div className="flex justify-end">
                <Button size="sm" disabled={pending || reply.trim().length === 0} onClick={send}>Reply and email client</Button>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
