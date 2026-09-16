"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/audit";

export async function startPreview(formData: FormData): Promise<void> {
  const actor = await getAuthenticatedUser();
  const targetId = String(formData.get("targetId") || "");
  if (actor?.role !== "admin" || !targetId) redirect("/agency");
  const target = await db.query.users.findFirst({ where: eq(users.id, targetId) });
  if (!target || target.status !== "active") redirect("/agency");
  await auditLog({ actorUserId: actor.id, action: "preview.started", entityType: "user", entityId: target.id });
  (await cookies()).set("i3_preview_user", target.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60, path: "/" });
  redirect(target.role === "client" ? "/portal" : "/agency");
}

export async function stopPreview(): Promise<void> {
  const actor = await getAuthenticatedUser();
  if (actor) await auditLog({ actorUserId: actor.id, action: "preview.stopped" });
  (await cookies()).delete("i3_preview_user");
  redirect("/agency");
}
