"use client";

import { useMemo, useState, useTransition } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Mail, MessageCircle, Paperclip, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { prepareUpload } from "@/lib/upload-client";
import { replyToTicket } from "./actions";

type Message = { id: string; body: string; direction: string; channel: string; authorEmail: string | null; createdAt: string | Date; attachmentUrl: string | null; attachmentName: string | null };
type Ticket = { id: string; subject: string; status: string; priority: string; updatedAt: string | Date; messages: Message[] };
const PAGE_SIZE = 10;
const STATUS_FILTERS = ["all", "open", "pending", "resolved", "closed"] as const;

export function TicketTable({ tickets, clientAccountId }: { tickets: Ticket[]; clientAccountId: string }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter((ticket) => (!q || ticket.subject.toLowerCase().includes(q)) && (statusFilter === "all" || ticket.status === statusFilter));
  }, [tickets, query, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageTickets = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? null;

  function send() {
    if (!selected || reply.trim().length === 0) return;
    startTransition(async () => {
      let attachmentForm: FormData | undefined;
      if (replyFile) {
        const form = new FormData();
        form.set("file", replyFile);
        form.set("clientAccountId", clientAccountId);
        try {
          attachmentForm = await prepareUpload(form, "ticket_attachment");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Attachment upload failed.");
          return;
        }
      }
      await replyToTicket(selected.id, reply, attachmentForm);
      setReply("");
      setReplyFile(null);
      toast.success("Reply sent");
    });
  }

  if (tickets.length === 0) {
    return <EmptyState icon={MessageCircle} title="No support requests yet" description="Open a ticket above and we'll reply here and by email." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search your tickets…" className="pl-8" />
        </div>
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((option) => (
            <Button key={option} type="button" size="sm" variant={statusFilter === option ? "default" : "outline"} className="capitalize" onClick={() => { setStatusFilter(option); setPage(1); }}>{option}</Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No tickets match your search/filter.</p>
      ) : (
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
            {pageTickets.map((ticket) => {
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
      )}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      ) : null}

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
                    {message.attachmentUrl ? (
                      <a href={message.attachmentUrl} target="_blank" rel="noreferrer" className="mt-1.5 flex items-center gap-1 text-xs font-medium underline underline-offset-2">
                        <Paperclip className="size-3" />{message.attachmentName ?? "Attachment"}
                      </a>
                    ) : null}
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {message.channel === "email" ? <Mail className="size-3" /> : <MessageCircle className="size-3" />}
                    <span>{format(new Date(message.createdAt), "d MMM, HH:mm")}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t bg-muted/20 p-4">
              <Textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a reply…" rows={3} />
                <div className="flex items-center justify-between gap-2">
                  <Input type="file" className="max-w-56 text-xs" onChange={(event) => setReplyFile(event.target.files?.[0] ?? null)} />
                <Button size="sm" disabled={pending || reply.trim().length === 0} onClick={send}>Reply</Button>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
