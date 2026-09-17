import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const started = Date.now();
  // Detailed diagnostics (version/latency) require a shared secret so they aren't exposed to anonymous callers.
  const trusted = process.env.HEALTH_CHECK_SECRET && request.headers.get("x-health-secret") === process.env.HEALTH_CHECK_SECRET;
  try {
    await db.execute(sql`SELECT 1`);
    const body = trusted
      ? { status: "ok", database: "ok", version: process.env.VERCEL_GIT_COMMIT_SHA ?? "local", latencyMs: Date.now() - started }
      : { status: "ok" };
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "degraded" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}