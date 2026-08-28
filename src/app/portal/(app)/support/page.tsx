import { desc, eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { tickets } from "@/db/schema";
import { requireClientUser } from "@/lib/auth-helpers";
import { createTicket } from "./actions";
import { TicketTable } from "./ticket-table";

export default async function PortalSupportPage() {
  const user = await requireClientUser();
  const ticketList = await db.query.tickets.findMany({
    where: eq(tickets.clientAccountId, user.clientAccountId),
    orderBy: desc(tickets.updatedAt),
    with: { messages: { orderBy: (message, { asc }) => [asc(message.createdAt)] } },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Support" description="Ask the team a question and keep the whole conversation in one place." />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New support request</CardTitle>
          <CardDescription>We will reply here and by email when configured.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createTicket} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ticket-subject">Subject</Label>
              <Input id="ticket-subject" name="subject" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-priority">Priority</Label>
              <Select name="priority" defaultValue="medium">
                <SelectTrigger id="ticket-priority"><SelectValue /></SelectTrigger>
                <SelectContent>{["low", "medium", "high", "urgent"].map((item) => <SelectItem key={item} value={item} className="capitalize">{item}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-body">Message</Label>
              <Textarea id="ticket-body" name="body" required />
            </div>
            <Button type="submit">Open ticket</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Your tickets</CardTitle></CardHeader>
        <CardContent><TicketTable tickets={ticketList} /></CardContent>
      </Card>
    </div>
  );
}
