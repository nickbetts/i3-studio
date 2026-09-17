import { get } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documents, referenceFiles, ticketMessages, tickets } from "@/db/schema";
import { getCurrentUser, isAgencyRole } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";
import { consumeRateLimit } from "@/lib/rate-limit";
import { safeFileName } from "@/lib/upload-policy";

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) return new Response(null, { status: 401 });
  if (!await consumeRateLimit(`file-download:${actor.id}`, 120, 3600)) return new Response(null, { status: 429 });
  const { kind, id } = await params;
  const file = kind === "document" ? await db.query.documents.findFirst({ where: eq(documents.id, id) }) : kind === "reference" ? await db.query.referenceFiles.findFirst({ where: eq(referenceFiles.id, id) }) : kind === "ticket" ? (await db.select({ fileUrl: ticketMessages.attachmentUrl, fileName: ticketMessages.attachmentName, clientAccountId: tickets.clientAccountId }).from(ticketMessages).innerJoin(tickets, eq(ticketMessages.ticketId, tickets.id)).where(eq(ticketMessages.id, id)).limit(1))[0] : null;
  if (!file?.fileUrl || (!isAgencyRole(actor.role) && file.clientAccountId !== actor.clientAccountId)) return new Response(null, { status: 404 });
  const url = new URL(file.fileUrl);
  const privateFile = /^[a-z0-9]+\.private\.blob\.vercel-storage\.com$/.test(url.hostname);
  if (url.protocol !== "https:" || (!privateFile && !/^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/.test(url.hostname) && url.hostname !== "picsum.photos")) return new Response(null, { status: 404 });
  const result = privateFile ? await get(url.href, { access: "private", token: process.env.BLOB_PRIVATE_READ_WRITE_TOKEN }) : null;
  const legacy = !privateFile ? await fetch(url, { signal: AbortSignal.timeout(10000) }) : null;
  const stream = result?.statusCode === 200 ? result.stream : legacy?.ok ? legacy.body : null;
  if (!stream) return new Response(null, { status: 404 });
  await auditLog({ actorUserId: actor.id, action: `${kind}.downloaded`, entityType: kind, entityId: id, clientAccountId: file.clientAccountId });
  return new Response(stream, { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${safeFileName(file.fileName ?? "attachment")}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}