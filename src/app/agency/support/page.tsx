import { desc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { tickets as ticketsTable, teams as teamsTable } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { TaskFilterSelect } from "@/app/agency/tasks/task-filter-select";
import { SupportInbox } from "./support-inbox";

export default async function AgencySupportPage({ searchParams }: { searchParams: Promise<{ assignee?: string }> }) {
  const actor = await requireAgencyUser();
  const { assignee = "mine" } = await searchParams;
  const [ticketList, clients, team, teamsList] = await Promise.all([
    db.query.tickets.findMany({ orderBy: desc(ticketsTable.updatedAt), with: { messages: { orderBy: (message, { asc }) => [asc(message.createdAt)] } } }),
    db.query.clientAccounts.findMany(),
    db.query.users.findMany({ where: (user, { inArray }) => inArray(user.role, ["admin", "account_manager", "content_writer"]) }),
    db.query.teams.findMany({ where: eq(teamsTable.archived, false) }),
  ]);

  const filteredTicketList = assignee === "all" ? ticketList : ticketList.filter((ticket) => !ticket.assignedToUserId || ticket.assignedToUserId === actor.id);

  const tickets = filteredTicketList.map((ticket) => ({
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    clientName: clients.find((client) => client.id === ticket.clientAccountId)?.name ?? "Unknown client",
      clientAccountId: ticket.clientAccountId,
    assigneeName: team.find((member) => member.id === ticket.assignedToUserId)?.name ?? null,
    assignedTeamId: ticket.assignedTeamId,
    updatedAt: ticket.updatedAt,
    messages: ticket.messages,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support inbox"
        description="Search, filter and reply to every conversation from one place."
        actions={<TaskFilterSelect paramKey="assignee" placeholder="Mine & unclaimed" options={[{ value: "mine", label: "Mine & unclaimed" }, { value: "all", label: "All tickets" }]} />}
      />
      <SupportInbox tickets={tickets} teams={teamsList} staff={team} />
    </div>
  );
}
