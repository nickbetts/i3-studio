import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import type { AppRole } from "@/types/next-auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getSession() {
  return auth();
}

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user) return null;
  const previewId = (await cookies()).get("i3_preview_user")?.value;
  if (previewId && isAgencyRole(session.user.role)) {
    const previewUser = await db.query.users.findFirst({ where: eq(users.id, previewId) });
    if (previewUser && previewUser.status === "active") return { ...session.user, ...previewUser, clientAccountId: previewUser.clientAccountId };
  }
  return session.user;
}

export async function isPreviewing() {
  return Boolean((await cookies()).get("i3_preview_user")?.value);
}

export function isAgencyRole(role: AppRole | undefined | null) {
  return role === "admin" || role === "account_manager" || role === "content_writer";
}

/** Require an authenticated agency user (admin or account manager). */
export async function requireAgencyUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAgencyRole(user.role)) redirect("/portal");
  return user;
}

/** Require an authenticated admin. */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/agency");
  return user;
}

/** Require an authenticated client user with a client account. */
export async function requireClientUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "client" || !user.clientAccountId) redirect("/agency");
  return user as typeof user & { clientAccountId: string };
}
