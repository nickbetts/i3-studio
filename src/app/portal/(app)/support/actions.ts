"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { ticketMessages, tickets } from "@/db/schema";
import { requireClientUser } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";
import { consumeUpload, verifiedUpload } from "@/lib/upload-server";

const ticketSchema = z.object({ subject: z.string().trim().min(3), body: z.string().trim().min(3), priority: z.enum(["low", "medium", "high", "urgent"]) });

async function attachmentFromForm(formData: FormData, actorId: string, clientAccountId: string) {
  if (!formData.get("uploadedUrl")) return {};
  const blob = await verifiedUpload(formData, actorId, "ticket_attachment", clientAccountId);
  await consumeUpload(blob.pathname);
  return { attachmentUrl: blob.url, attachmentName: blob.fileName, attachmentContentType: blob.contentType, attachmentSize: blob.size };
}

export async function createTicket(formData: FormData): Promise<void> {
  const user = await requireClientUser();
  const parsed = ticketSchema.safeParse({ subject: formData.get("subject"), body: formData.get("body"), priority: formData.get("priority") || "medium" });
  if (!parsed.success) return;
  const [ticket] = await db.insert(tickets).values({ clientAccountId: user.clientAccountId, subject: parsed.data.subject, priority: parsed.data.priority, createdByUserId: user.id }).returning({ id: tickets.id });
  const attachment = await attachmentFromForm(formData, user.id, user.clientAccountId);
  await db.insert(ticketMessages).values({ ticketId: ticket.id, authorUserId: user.id, authorEmail: user.email, body: parsed.data.body, channel: "portal", direction: "inbound", ...attachment });
  await auditLog({ actorUserId: user.id, action: "ticket.created", entityType: "ticket", entityId: ticket.id, clientAccountId: user.clientAccountId });
  revalidatePath("/portal/support");
}

export async function replyToTicket(ticketId: string, body: string, attachmentForm?: FormData): Promise<void> {
  const user = await requireClientUser();
  const ticket = await db.query.tickets.findFirst({ where: and(eq(tickets.id, ticketId), eq(tickets.clientAccountId, user.clientAccountId)) });
  if (!ticket || !body.trim()) return;
  const attachment = attachmentForm ? await attachmentFromForm(attachmentForm, user.id, user.clientAccountId) : {};
  await db.insert(ticketMessages).values({ ticketId, authorUserId: user.id, authorEmail: user.email, body: body.trim(), channel: "portal", direction: "inbound", ...attachment });
  await db.update(tickets).set({ status: "open", updatedAt: new Date() }).where(eq(tickets.id, ticketId));
  await auditLog({ actorUserId: user.id, action: "ticket.replied", entityType: "ticket", entityId: ticketId, clientAccountId: user.clientAccountId });
  revalidatePath("/portal/support");
}
