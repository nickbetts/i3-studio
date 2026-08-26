"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { ticketMessages, tickets, users } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";
import { sendMail } from "@/lib/mailgun";

export async function replyToTicket(ticketId: string, body: string): Promise<void> {
  const user = await requireAgencyUser();
  const ticket = await db.query.tickets.findFirst({ where: eq(tickets.id, ticketId), with: { clientAccount: true } });
  if (!ticket || !body.trim()) return;
  const client = await db.query.users.findFirst({ where: and(eq(users.clientAccountId, ticket.clientAccountId), eq(users.role, "client")) });
  await db.insert(ticketMessages).values({ ticketId, authorUserId: user.id, authorEmail: user.email, body: body.trim(), channel: "portal", direction: "outbound" });
  await db.update(tickets).set({ status: "pending", assignedToUserId: user.id, updatedAt: new Date() }).where(eq(tickets.id, ticketId));
  if (client?.email) {
    const domain = process.env.MAILGUN_DOMAIN || "localhost";
    await sendMail({ to: client.email, subject: `Re: ${ticket.subject}`, text: body.trim(), replyTo: `ticket-${ticket.id}@${domain}` });
  }
  await auditLog({ actorUserId: user.id, action: "ticket.replied", entityType: "ticket", entityId: ticketId, clientAccountId: ticket.clientAccountId });
  revalidatePath("/agency/support");
}

export async function updateTicketStatus(ticketId: string, status: "open" | "pending" | "resolved" | "closed"): Promise<void> {
  const user = await requireAgencyUser();
  const ticket = await db.query.tickets.findFirst({ where: eq(tickets.id, ticketId) });
  if (!ticket) return;
  await db.update(tickets).set({ status, updatedAt: new Date() }).where(eq(tickets.id, ticketId));
  await auditLog({ actorUserId: user.id, action: "ticket.status_updated", entityType: "ticket", entityId: ticketId, clientAccountId: ticket.clientAccountId, metadata: { status } });
  revalidatePath("/agency/support");
}
