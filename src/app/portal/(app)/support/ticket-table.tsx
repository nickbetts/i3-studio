"use client";

import { useMemo, useState, useTransition } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Mail, MessageCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { replyToTicket } from "./actions";

type Message = { id: string; body: string; direction: string; channel: string; authorEmail: string | null; createdAt: string | Date };
type Ticket = { id: string; subject: string; status: string; priority: string; updatedAt: string | Date; messages: Message[] };

export function TicketTable({ tickets }: { tickets: Ticket[] }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter((ticket) => !q || ticket.subject.toLowerCase().includes(q));
  }, [tickets, query]);

  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? null;

  function send() {
    if (!selected || reply.trim().length === 0) return;
    startTransition(async () => {
      await replyToTicket(selected.id, reply);
      setReply("");
      toast.success("Reply sent");
    });
  }

  if (tickets.length === 0) {
    return <EmptyState icon={MessageCircle} title="No support requests yet" description="Open a ticket above and we'll reply here and by email." />;
  }

  return (
    <div className="space-y-4">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your tickets…" className="pl-8" />
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((ticket) => {
              const last = ticket.messages.at(-1);
              return (
                <TableRow key={ticket.id} className="cursor-pointer" onClick={() => setSelectedId(ticket.id)}>
                  <TableCell className="max-w-80 whitespace-normal">
                    <p className="truncate font-medium">{ticket.subject}</p>
                    {last ? <p className="truncate text-xs text-muted-foreground">{last.body}</p> : null}
                  </TableCell>
                  <TableCell><PriorityBadge priority={ticket.priority} /></TableCell>
                  <TableCell><StatusBadge status={ticket.status} /></TableCell>
                  <TableCell className="text-muted-foreground">{formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelectedId(null)}>
        {selected ? (
          <DialogContent className="max-w-2xl p-0 sm:max-w-2xl">
            <DialogHeader className="gap-2 border-b p-4 pr-12">
              <DialogTitle className="truncate">{selected.subject}</DialogTitle>
              <div className="flex flex-wrap gap-2 pt-1">
                <PriorityBadge priority={selected.priority} />
                <StatusBadge status={selected.status} />
              </div>
            </DialogHeader>
            <div className="max-h-[45vh] space-y-3 overflow-y-auto p-4">
              {selected.messages.map((message) => (
                <div key={message.id} className={`max-w-[85%] rounded-lg p-3 text-sm ${message.direction === "inbound" ? "ml-auto bg-primary/10" : "bg-muted"}`}>
                  <p className="whitespace-pre-wrap">{message.body}</p>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {message.channel === "email" ? <Mail className="size-3" /> : <MessageCircle className="size-3" />}
                    <span>{format(new Date(message.createdAt), "d MMM, HH:mm")}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t bg-muted/20 p-4">
              <Textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a reply…" rows={3} />
              <div className="flex justify-end">
                <Button size="sm" disabled={pending || reply.trim().length === 0} onClick={send}>Reply</Button>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
