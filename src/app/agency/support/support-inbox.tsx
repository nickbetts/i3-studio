"use client";

import { useMemo, useState, useTransition } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Mail, MessageCircle, Paperclip, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { prepareUpload } from "@/lib/upload-client";
import { replyToTicket, updateTicketPriority, updateTicketStatus, updateTicketTeam } from "./actions";

export type Message = { id: string; body: string; direction: string; channel: string; authorEmail: string | null; createdAt: string | Date; attachmentUrl: string | null; attachmentName: string | null };
export type Ticket = {
  id: string;
  subject: string;
  status: "open" | "pending" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  clientName: string;
  clientAccountId: string;
  assigneeName: string | null;
  assignedTeamId: string | null;
  updatedAt: string | Date;
  messages: Message[];
};

const STATUS_FILTERS = ["active", "all", "open", "pending", "resolved", "closed"] as const;

export function SupportInbox({ tickets, teams = [] }: { tickets: Ticket[]; teams?: { id: string; name: string }[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("active");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter((ticket) => (statusFilter === "all" || (statusFilter === "active" ? ["open", "pending"].includes(ticket.status) : ticket.status === statusFilter)) && (!q || ticket.subject.toLowerCase().includes(q) || ticket.clientName.toLowerCase().includes(q)));
  }, [tickets, query, statusFilter]);

  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? null;

  function send() {
    if (!selected || reply.trim().length === 0) return;
    startTransition(async () => {
      let attachmentForm: FormData | undefined;
      if (replyFile) {
        const form = new FormData();
        form.set("file", replyFile);
        form.set("clientAccountId", selected.clientAccountId);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search tickets" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tickets…" className="pl-8" />
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((value) => (
            <Button key={value} size="sm" aria-pressed={statusFilter === value} variant={statusFilter === value ? "secondary" : "ghost"} className="capitalize" onClick={() => setStatusFilter(value)}>
              {value === "active" ? "Open & pending" : value} <span className="ml-1 text-xs text-muted-foreground">{value === "all" ? tickets.length : value === "active" ? tickets.filter((ticket) => ["open", "pending"].includes(ticket.status)).length : tickets.filter((ticket) => ticket.status === value).length}</span>
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
                      <button type="button" className="max-w-full truncate text-left font-medium hover:text-primary" onClick={() => { setSelectedId(ticket.id); setReply(""); setReplyFile(null); }}>{ticket.subject}</button>
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
                  <SelectTrigger aria-label="Ticket status" className="w-36 capitalize"><SelectValue /></SelectTrigger>
                  <SelectContent>{["open", "pending", "resolved", "closed"].map((item) => <SelectItem key={item} value={item} className="capitalize">{item}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={selected.priority} onValueChange={(value) => startTransition(async () => { await updateTicketPriority(selected.id, value as Ticket["priority"]); toast.success("Priority updated"); })}>
                  <SelectTrigger aria-label="Ticket priority" className="w-32 capitalize"><SelectValue /></SelectTrigger>
                  <SelectContent>{["low", "medium", "high", "urgent"].map((item) => <SelectItem key={item} value={item} className="capitalize">{item}</SelectItem>)}</SelectContent>
                </Select>
                {teams.length > 0 ? (
                  <Select value={selected.assignedTeamId ?? "none"} onValueChange={(value) => startTransition(async () => { await updateTicketTeam(selected.id, value === "none" ? null : value); toast.success("Team updated"); })}>
                    <SelectTrigger aria-label="Assigned team" className="w-40"><SelectValue placeholder="No team" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">No team</SelectItem>{teams.map((teamOption) => <SelectItem key={teamOption.id} value={teamOption.id}>{teamOption.name}</SelectItem>)}</SelectContent>
                  </Select>
                ) : null}
              </div>
            </DialogHeader>
            <div className="max-h-[45vh] space-y-3 overflow-y-auto p-4">
              {selected.messages.map((message) => (
                <div key={message.id} className={`max-w-[85%] rounded-lg p-3 text-sm ${message.direction === "inbound" ? "bg-muted" : "ml-auto bg-primary/10"}`}>
                  <p className="whitespace-pre-wrap">{message.body}</p>
                    {message.attachmentUrl ? (
                      <a href={`/api/files/ticket/${message.id}`} className="mt-1.5 flex items-center gap-1 break-all text-xs font-medium underline underline-offset-2">
                        <Paperclip className="size-3" />{message.attachmentName ?? "Attachment"}
                      </a>
                    ) : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    {message.channel === "email" ? <Mail className="size-3" /> : <MessageCircle className="size-3" />}
                    <span>{message.authorEmail || message.channel}</span>
                    <span>·</span>
                    <span>{format(new Date(message.createdAt), "d MMM, HH:mm")}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t bg-muted/20 p-4">
              <Textarea aria-label="Reply to client" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Reply to the client…" rows={3} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Input aria-label="Reply attachment" key={replyFile ? "selected" : "empty"} type="file" className="min-w-0 max-w-56 text-xs" onChange={(event) => setReplyFile(event.target.files?.[0] ?? null)} />
                <Button size="sm" disabled={pending || reply.trim().length === 0} onClick={send}>Reply and email client</Button>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
