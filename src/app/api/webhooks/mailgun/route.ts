import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { ticketMessages, tickets } from "@/db/schema";
import { auditLog } from "@/lib/audit";

function validSignature(timestamp: string, token: string, signature: string) {
  const key = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  if (!key || !timestamp || !token || !signature) return false;
  const expected = createHmac("sha256", key).update(timestamp + token).digest("hex");
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function POST(request: Request) {
  const form = await request.formData();
  const timestamp = String(form.get("timestamp") ?? "");
  const token = String(form.get("token") ?? "");
  const signature = String(form.get("signature") ?? "");
  if (!validSignature(timestamp, token, signature)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  const recipient = String(form.get("recipient") ?? "");
  const match = recipient.match(/ticket-([a-zA-Z0-9-]+)@/);
  const ticketId = match?.[1];
  const body = String(form.get("stripped-text") || form.get("body-plain") || "").trim();
  if (!ticketId || !body) return NextResponse.json({ received: true });
  const ticket = await db.query.tickets.findFirst({ where: eq(tickets.id, ticketId) });
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  const messageId = String(form.get("Message-Id") || form.get("message-id") || "");
  if (messageId) {
    const existing = await db.query.ticketMessages.findFirst({ where: eq(ticketMessages.mailgunMessageId, messageId) });
    if (existing) return NextResponse.json({ received: true });
  }
  await db.insert(ticketMessages).values({ ticketId, authorEmail: String(form.get("sender") ?? ""), body, channel: "email", direction: "inbound", mailgunMessageId: messageId || null });
  await db.update(tickets).set({ status: "open", updatedAt: new Date() }).where(and(eq(tickets.id, ticketId), eq(tickets.clientAccountId, ticket.clientAccountId)));
  await auditLog({ action: "ticket.email_received", entityType: "ticket", entityId: ticketId, clientAccountId: ticket.clientAccountId, metadata: { messageId } });
  return NextResponse.json({ received: true });
}
