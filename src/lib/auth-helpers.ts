import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { auth } from "@/auth";
import type { AppRole } from "@/types/next-auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { credentialVersion } from "@/lib/credential-version";

export async function getSession() {
  return auth();
}

const userColumns = { id: true, name: true, email: true, image: true, role: true, status: true, clientAccountId: true } as const;

export async function getAuthenticatedUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const current = await db.query.users.findFirst({ where: eq(users.id, session.user.id), columns: { ...userColumns, passwordHash: true } });
  if (!current || current.status !== "active") return null;
  if (session.user.credentialVersion !== credentialVersion(current.passwordHash)) return null;
  const { passwordHash, ...publicUser } = current;
  void passwordHash;
  return publicUser;
}

export async function getCurrentUser() {
  const current = await getAuthenticatedUser();
  if (!current) return null;
  const previewId = (await cookies()).get("i3_preview_user")?.value;
  if (previewId && current.role === "admin") {
    if ((await headers()).has("next-action")) throw new Error("Exit preview before making changes.");
    const previewUser = await db.query.users.findFirst({ where: eq(users.id, previewId), columns: userColumns });
    if (previewUser && previewUser.status === "active") return previewUser;
  }
  return current;
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

export async function requireManager() {
  const user = await requireAgencyUser();
  if (user.role !== "admin" && user.role !== "account_manager") throw new Error("Manager access required.");
  return user;
}

/** Require an authenticated client user with a client account. */
export async function requireClientUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "client" || !user.clientAccountId) redirect("/agency");
  return user as typeof user & { clientAccountId: string };
}
