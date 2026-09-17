import { get } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { taskComments } from "@/db/schema";
import { getCurrentUser, isAgencyRole } from "@/lib/auth-helpers";
import { consumeRateLimit } from "@/lib/rate-limit";
import { safeFileName } from "@/lib/upload-policy";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) return new Response(null, { status: 401 });
  if (!isAgencyRole(actor.role)) return new Response(null, { status: 404 });
  if (!await consumeRateLimit(`file-download:${actor.id}`, 120, 3600)) return new Response(null, { status: 429 });
  const { id } = await params;
  const comment = await db.query.taskComments.findFirst({ where: eq(taskComments.id, id) });
  if (!comment?.attachmentUrl) return new Response(null, { status: 404 });
  const url = new URL(comment.attachmentUrl);
  if (url.protocol !== "https:" || !/^[a-z0-9]+\.private\.blob\.vercel-storage\.com$/.test(url.hostname)) return new Response(null, { status: 404 });
  const result = await get(url.href, { access: "private", token: process.env.BLOB_PRIVATE_READ_WRITE_TOKEN });
  if (!result || result.statusCode !== 200) return new Response(null, { status: 404 });
  return new Response(result.stream, { headers: { "Content-Type": comment.attachmentContentType ?? "application/octet-stream", "Content-Disposition": `attachment; filename="${safeFileName(comment.attachmentName ?? "attachment")}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
