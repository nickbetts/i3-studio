import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  clientAccounts,
  documents,
  onboardingSubmissions,
  projects,
  referenceFiles,
  tasks,
  tickets,
  ticketMessages,
  users,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";
import { consumeRateLimit } from "@/lib/rate-limit";

// Data Subject Access Request export: bundles everything we hold that's attributable to one client account.
export async function GET(_request: Request, { params }: { params: Promise<{ clientId: string }> }) {
  const actor = await requireAdmin();
  const { clientId } = await params;
  if (!await consumeRateLimit(`client-export:${actor.id}`, 10, 3600)) return new Response(null, { status: 429 });

  const account = await db.query.clientAccounts.findFirst({ where: eq(clientAccounts.id, clientId) });
  if (!account) return new Response(null, { status: 404 });

  const [clientUsers, onboarding, clientTasks, clientProjects, clientDocuments, clientReferences, clientTickets] = await Promise.all([
    db.query.users.findMany({ where: eq(users.clientAccountId, clientId), columns: { id: true, name: true, email: true, role: true, status: true, createdAt: true } }),
    db.query.onboardingSubmissions.findFirst({ where: eq(onboardingSubmissions.clientAccountId, clientId) }),
    db.query.tasks.findMany({ where: eq(tasks.clientAccountId, clientId) }),
    db.query.projects.findMany({ where: eq(projects.clientAccountId, clientId) }),
    db.query.documents.findMany({ where: eq(documents.clientAccountId, clientId) }),
    db.query.referenceFiles.findMany({ where: eq(referenceFiles.clientAccountId, clientId) }),
    db.query.tickets.findMany({ where: eq(tickets.clientAccountId, clientId) }),
  ]);

  const ticketIds = clientTickets.map((t) => t.id);
  const messages = ticketIds.length > 0 ? await db.query.ticketMessages.findMany({ where: inArray(ticketMessages.ticketId, ticketIds) }) : [];

  const dump = {
    exportedAt: new Date().toISOString(),
    account,
    users: clientUsers,
    onboarding,
    tasks: clientTasks,
    projects: clientProjects,
    documents: clientDocuments,
    referenceFiles: clientReferences,
    tickets: clientTickets,
    ticketMessages: messages,
  };

  await auditLog({ actorUserId: actor.id, action: "client.data_exported", entityType: "client_account", entityId: clientId, clientAccountId: clientId });

  return new Response(JSON.stringify(dump, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="client-${clientId}-data-export.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}

