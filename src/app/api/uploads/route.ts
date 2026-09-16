import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { cookies } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clientAccounts, designAssets } from "@/db/schema";
import { getCurrentUser, isAgencyRole } from "@/lib/auth-helpers";
import { consumeRateLimit } from "@/lib/rate-limit";
import { IMAGE_TYPES, validateUpload } from "@/lib/upload-policy";

const payloadSchema = z.object({ kind: z.enum(["document", "reference", "design", "version", "avatar"]), clientAccountId: z.string().nullable(), designAssetId: z.string().nullable(), userId: z.string().nullable(), size: z.number(), contentType: z.string().max(200), fileName: z.string().min(1).max(255) });

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Invalid origin." }, { status: 403 });
    if ((await cookies()).has("i3_preview_user")) return Response.json({ error: "Exit preview first." }, { status: 403 });
    const actor = await getCurrentUser();
    if (!actor) return Response.json({ error: "Sign in to upload." }, { status: 401 });
    const body = await request.json() as HandleUploadBody;
    if (body.type !== "blob.generate-client-token") return Response.json({ error: "Unsupported upload event." }, { status: 400 });
    const payload = payloadSchema.parse(JSON.parse(body.payload.clientPayload ?? "{}"));
    validateUpload(payload.kind, payload.size, payload.contentType);
    if (!await consumeRateLimit(`upload:${actor.id}`, 60, 3600)) return Response.json({ error: "Upload limit reached. Try later." }, { status: 429 });
    if (!isAgencyRole(actor.role) && (actor.role !== "client" || payload.kind !== "reference" || payload.clientAccountId !== actor.clientAccountId)) return Response.json({ error: "Access denied." }, { status: 403 });
    let clientId = payload.clientAccountId;
    if (payload.kind === "avatar") {
      if (actor.role !== "admin" && payload.userId !== actor.id) return Response.json({ error: "Access denied." }, { status: 403 });
    } else if (payload.kind === "version") {
      const design = await db.query.designAssets.findFirst({ where: eq(designAssets.id, payload.designAssetId ?? "") });
      if (!design) return Response.json({ error: "Design not found." }, { status: 404 });
      clientId = design.clientAccountId;
    } else if (!clientId || !await db.query.clientAccounts.findFirst({ where: eq(clientAccounts.id, clientId) })) return Response.json({ error: "Client not found." }, { status: 404 });
    const isPrivate = payload.kind === "document" || payload.kind === "reference";
    const token = isPrivate ? process.env.BLOB_PRIVATE_READ_WRITE_TOKEN : process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return Response.json({ error: "File storage is not configured. Contact your administrator." }, { status: 503 });
    const response = await handleUpload({ request, body, token,
      onBeforeGenerateToken: async (pathname) => {
        if (!/^uploads\/[a-f0-9-]{36}\/[a-zA-Z0-9._-]{1,120}$/.test(pathname)) throw new Error("Invalid upload path.");
        await db.execute(sql`INSERT INTO app_upload (pathname, actor_id, client_id, kind, target_id, file_name, content_type, expires_at) VALUES (${pathname}, ${actor.id}, ${clientId}, ${payload.kind}, ${payload.designAssetId ?? payload.userId}, ${payload.fileName}, ${payload.contentType}, now() + interval '1 hour')`);
        return { maximumSizeInBytes: payload.size, allowedContentTypes: isPrivate ? undefined : IMAGE_TYPES, addRandomSuffix: false, allowOverwrite: false, validUntil: Date.now() + 15 * 60 * 1000 };
      },
    });
    return Response.json(response);
  } catch {
    return Response.json({ error: "Upload could not be authorized." }, { status: 400 });
  }
}