import { desc } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { tickets as ticketsTable } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { SupportInbox } from "./support-inbox";

export default async function AgencySupportPage() {
  await requireAgencyUser();
  const [ticketList, clients, team] = await Promise.all([
    db.query.tickets.findMany({ orderBy: desc(ticketsTable.updatedAt), with: { messages: { orderBy: (message, { asc }) => [asc(message.createdAt)] } } }),
    db.query.clientAccounts.findMany(),
    db.query.users.findMany({ where: (user, { inArray }) => inArray(user.role, ["admin", "account_manager", "content_writer"]) }),
  ]);

  const tickets = ticketList.map((ticket) => ({
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    clientName: clients.find((client) => client.id === ticket.clientAccountId)?.name ?? "Unknown client",
    assigneeName: team.find((member) => member.id === ticket.assignedToUserId)?.name ?? null,
    updatedAt: ticket.updatedAt,
    messages: ticket.messages,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Support inbox" description="Search, filter and reply to every conversation from one place." />
      <SupportInbox tickets={tickets} />
    </div>
  );
}
