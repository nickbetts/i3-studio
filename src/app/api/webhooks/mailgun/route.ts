import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { tickets, users } from "@/db/schema";
import { validMailgunSignature } from "@/lib/webhook-signature";

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 1_000_000) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Invalid payload" }, { status: 400 }); }
  const timestamp = String(form.get("timestamp") ?? "");
  const token = String(form.get("token") ?? "");
  const signature = String(form.get("signature") ?? "");
  if (!validMailgunSignature(timestamp, token, signature, process.env.MAILGUN_WEBHOOK_SIGNING_KEY)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  const recipient = String(form.get("recipient") ?? "");
  const match = recipient.match(/ticket-([a-zA-Z0-9-]+)@/);
  const ticketId = match?.[1];
  const body = String(form.get("stripped-text") || form.get("body-plain") || "").trim();
  if (!ticketId || !body) return NextResponse.json({ received: true });
  const ticket = await db.query.tickets.findFirst({ where: eq(tickets.id, ticketId) });
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  const sender = String(form.get("sender") ?? "").toLowerCase().trim();
  const author = await db.query.users.findFirst({ where: and(eq(users.email, sender), eq(users.clientAccountId, ticket.clientAccountId), eq(users.role, "client"), eq(users.status, "active")) });
  if (!author) return NextResponse.json({ error: "Unknown sender" }, { status: 403 });
  if (body.length > 50000) return NextResponse.json({ error: "Message too large" }, { status: 413 });
  const messageId = String(form.get("Message-Id") || form.get("message-id") || "");
  const receipt = createHash("sha256").update(`${ticketId}:${messageId || token}`).digest("hex");
  await db.execute(sql`
    WITH claimed AS (INSERT INTO app_webhook_receipt (token_hash) VALUES (${receipt}) ON CONFLICT DO NOTHING RETURNING token_hash),
    message AS (INSERT INTO ticket_message (id, ticket_id, author_user_id, author_email, body, channel, direction, mailgun_message_id) SELECT ${crypto.randomUUID()}, ${ticketId}, ${author.id}, ${sender}, ${body}, 'email', 'inbound', ${messageId || null} FROM claimed),
    updated AS (UPDATE ticket SET status = 'open', updated_at = now() WHERE id = ${ticketId} AND EXISTS (SELECT 1 FROM claimed)),
    audit AS (INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id, client_account_id) SELECT ${crypto.randomUUID()}, ${author.id}, 'ticket.email_received', 'ticket', ${ticketId}, ${ticket.clientAccountId} FROM claimed)
    SELECT token_hash FROM claimed
  `);
  return NextResponse.json({ received: true });
}
