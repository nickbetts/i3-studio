import { desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { tickets } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { TicketReply } from "./ticket-reply";
import { TicketStatus } from "./status-select";

export default async function AgencySupportPage() {
  await requireAgencyUser();
  const [ticketList, clients] = await Promise.all([db.query.tickets.findMany({ orderBy: desc(tickets.updatedAt), with: { messages: true } }), db.query.clientAccounts.findMany()]);
  return <div className="space-y-6"><PageHeader title="Support inbox" description="Reply in the portal or send an email through Mailgun." />{ticketList.length === 0 ? <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">No support tickets yet.</p></CardContent></Card> : ticketList.map((ticket) => <Card key={ticket.id}><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">{ticket.subject}</CardTitle><CardDescription>{clients.find((client) => client.id === ticket.clientAccountId)?.name ?? "Unknown client"} · {ticket.priority}</CardDescription></div><Badge variant="outline" className="capitalize">{ticket.status}</Badge></div></CardHeader><CardContent className="space-y-4"><div className="space-y-2">{ticket.messages.map((message) => <div key={message.id} className={`rounded-md p-3 text-sm ${message.direction === "inbound" ? "bg-muted" : "bg-primary/10"}`}><p>{message.body}</p><p className="mt-1 text-xs text-muted-foreground">{message.authorEmail || message.channel}</p></div>)}</div><TicketReply ticketId={ticket.id} /><TicketStatus ticketId={ticket.id} value={ticket.status} /></CardContent></Card>)}</div>;
}
