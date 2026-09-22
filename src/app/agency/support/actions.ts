"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { ticketMessages, tickets, users } from "@/db/schema";
import { requireAgencyPermission } from "@/lib/permissions";
import { auditLog } from "@/lib/audit";
import { notifyMentions } from "@/lib/notifications";
import { queueMail } from "@/lib/mailgun";
import { consumeUpload, verifiedUpload } from "@/lib/upload-server";

export async function replyToTicket(ticketId: string, body: string, attachmentForm?: FormData): Promise<void> {
  const user = await requireAgencyPermission("reply_tickets");
  const ticket = await db.query.tickets.findFirst({ where: eq(tickets.id, ticketId), with: { clientAccount: true } });
  if (!ticket || !body.trim()) return;
  const client = await db.query.users.findFirst({ where: and(eq(users.clientAccountId, ticket.clientAccountId), eq(users.role, "client")) });
  let attachment: { attachmentUrl?: string; attachmentName?: string; attachmentContentType?: string; attachmentSize?: number } = {};
  if (attachmentForm?.get("uploadedUrl")) {
    const blob = await verifiedUpload(attachmentForm, user.id, "ticket_attachment", ticket.clientAccountId);
    await consumeUpload(blob.pathname);
    attachment = { attachmentUrl: blob.url, attachmentName: blob.fileName, attachmentContentType: blob.contentType, attachmentSize: blob.size };
  }
  await db.insert(ticketMessages).values({ ticketId, authorUserId: user.id, authorEmail: user.email, body: body.trim(), channel: "portal", direction: "outbound", ...attachment });
  await db.update(tickets).set({ status: "pending", assignedToUserId: user.id, updatedAt: new Date() }).where(eq(tickets.id, ticketId));
  if (client?.email) {
    const domain = process.env.MAILGUN_DOMAIN || "localhost";
    await queueMail({ to: client.email, subject: `Re: ${ticket.subject}`, text: body.trim(), replyTo: `ticket-${ticket.id}@${domain}` });
  }
  await auditLog({ actorUserId: user.id, action: "ticket.replied", entityType: "ticket", entityId: ticketId, clientAccountId: ticket.clientAccountId });
  const staff = await db.query.users.findMany({ where: (row, { inArray }) => inArray(row.role, ["admin", "account_manager", "content_writer"]), columns: { id: true, name: true, email: true, role: true } });
  await notifyMentions({
    text: body.trim(),
    candidates: staff.map((member) => ({ id: member.id, name: member.name || member.email, role: member.role })),
    actorUserId: user.id,
    actorName: user.name || user.email,
    excerpt: `"${ticket.subject}": ${body.trim()}`,
    linkUrlForRole: () => "/agency/support",
  });
  revalidatePath("/agency/support");
  revalidatePath(`/agency/clients/${ticket.clientAccountId}`);
}

export async function updateTicketStatus(ticketId: string, status: "open" | "pending" | "resolved" | "closed"): Promise<void> {
  const user = await requireAgencyPermission("edit_tickets");
  const ticket = await db.query.tickets.findFirst({ where: eq(tickets.id, ticketId) });
  if (!ticket) return;
  await db.update(tickets).set({ status, updatedAt: new Date() }).where(eq(tickets.id, ticketId));
  await auditLog({ actorUserId: user.id, action: "ticket.status_updated", entityType: "ticket", entityId: ticketId, clientAccountId: ticket.clientAccountId, metadata: { status } });
  revalidatePath("/agency/support");
  revalidatePath(`/agency/clients/${ticket.clientAccountId}`);
}

export async function updateTicketPriority(ticketId: string, priority: "low" | "medium" | "high" | "urgent"): Promise<void> {
  const user = await requireAgencyPermission("edit_tickets");
  const ticket = await db.query.tickets.findFirst({ where: eq(tickets.id, ticketId) });
  if (!ticket) return;
  await db.update(tickets).set({ priority, updatedAt: new Date() }).where(eq(tickets.id, ticketId));
  await auditLog({ actorUserId: user.id, action: "ticket.priority_updated", entityType: "ticket", entityId: ticketId, clientAccountId: ticket.clientAccountId, metadata: { priority } });
  revalidatePath("/agency/support");
  revalidatePath(`/agency/clients/${ticket.clientAccountId}`);
}

export async function updateTicketTeam(ticketId: string, assignedTeamId: string | null): Promise<void> {
  const user = await requireAgencyPermission("assign_tickets");
  const ticket = await db.query.tickets.findFirst({ where: eq(tickets.id, ticketId) });
  if (!ticket) return;
  await db.update(tickets).set({ assignedTeamId, updatedAt: new Date() }).where(eq(tickets.id, ticketId));
  await auditLog({ actorUserId: user.id, action: "ticket.team_updated", entityType: "ticket", entityId: ticketId, clientAccountId: ticket.clientAccountId, metadata: { assignedTeamId } });
  revalidatePath("/agency/support");
  revalidatePath(`/agency/clients/${ticket.clientAccountId}`);
}
