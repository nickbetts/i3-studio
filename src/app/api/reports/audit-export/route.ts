import { and, desc, gte, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { consumeRateLimit } from "@/lib/rate-limit";

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const actor = await requireAgencyUser();
  if (!await consumeRateLimit(`audit-export:${actor.id}`, 20, 3600)) return new NextResponse(null, { status: 429 });
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const conditions = [];
  if (from) conditions.push(gte(auditLogs.createdAt, new Date(`${from}T00:00:00`)));
  if (to) conditions.push(lte(auditLogs.createdAt, new Date(`${to}T23:59:59`)));

  const rows = await db.query.auditLogs.findMany({ where: conditions.length ? and(...conditions) : undefined, orderBy: desc(auditLogs.createdAt), limit: 5000 });
  const header = ["createdAt", "action", "entityType", "entityId", "actorUserId", "clientAccountId"];
  const lines = [header.join(","), ...rows.map((row) => [row.createdAt.toISOString(), row.action, row.entityType ?? "", row.entityId ?? "", row.actorUserId ?? "", row.clientAccountId ?? ""].map((value) => csvEscape(String(value))).join(","))];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
