import { desc, eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/db";
import { tickets } from "@/db/schema";
import { requireClientUser } from "@/lib/auth-helpers";
import { createTicket } from "./actions";
import { TicketThread } from "./ticket-thread";

export default async function PortalSupportPage() {
  const user = await requireClientUser();
  const ticketList = await db.query.tickets.findMany({ where: eq(tickets.clientAccountId, user.clientAccountId), orderBy: desc(tickets.updatedAt), with: { messages: true } });
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">Support</h1><p className="text-muted-foreground">Ask the team a question and keep the whole conversation in one place.</p></div><Card><CardHeader><CardTitle className="text-base">New support request</CardTitle><CardDescription>We will reply here and by email when configured.</CardDescription></CardHeader><CardContent><form action={createTicket} className="space-y-4"><div className="space-y-2"><Label htmlFor="ticket-subject">Subject</Label><Input id="ticket-subject" name="subject" required /></div><div className="space-y-2"><Label htmlFor="ticket-priority">Priority</Label><Select name="priority" defaultValue="medium"><SelectTrigger id="ticket-priority"><SelectValue /></SelectTrigger><SelectContent>{["low", "medium", "high", "urgent"].map((item) => <SelectItem key={item} value={item} className="capitalize">{item}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="ticket-body">Message</Label><Textarea id="ticket-body" name="body" required /></div><Button type="submit">Open ticket</Button></form></CardContent></Card><div className="space-y-4">{ticketList.map((ticket) => <Card key={ticket.id}><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="text-base">{ticket.subject}</CardTitle><Badge variant="outline" className="capitalize">{ticket.status}</Badge></div></CardHeader><CardContent><TicketThread ticketId={ticket.id} messages={ticket.messages} /></CardContent></Card>)}</div></div>;
}
