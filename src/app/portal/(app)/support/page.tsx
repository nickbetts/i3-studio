import { desc, eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { CreatePanel } from "@/components/create-panel";
import { db } from "@/db";
import { tickets } from "@/db/schema";
import { requireClientUser } from "@/lib/auth-helpers";
import { NewTicketForm } from "./new-ticket-form";
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
      <CreatePanel title="New support request" defaultOpen={ticketList.length === 0}><Card>
        <CardHeader>
          <CardTitle className="text-base">New support request</CardTitle>
          <CardDescription>We will reply here and by email when configured.</CardDescription>
        </CardHeader>
        <CardContent>
          <NewTicketForm clientAccountId={user.clientAccountId} />
        </CardContent>
      </Card></CreatePanel>
      <Card>
        <CardHeader><CardTitle className="text-base">Your tickets</CardTitle></CardHeader>
        <CardContent><TicketTable tickets={ticketList} clientAccountId={user.clientAccountId} /></CardContent>
      </Card>
    </div>
  );
}
