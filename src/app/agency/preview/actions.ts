"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/auth";

export async function startPreview(formData: FormData): Promise<void> {
  const session = await auth();
  const targetId = String(formData.get("targetId") || "");
  const destination = String(formData.get("destination") || "/agency");
  if (session?.user.role !== "admin" || !targetId) redirect("/agency");
  const target = await db.query.users.findFirst({ where: eq(users.id, targetId) });
  if (!target || target.status !== "active") redirect("/agency");
  (await cookies()).set("i3_preview_user", target.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60, path: "/" });
  redirect(destination);
}

export async function stopPreview(): Promise<void> {
  (await cookies()).delete("i3_preview_user");
  redirect("/agency");
}
