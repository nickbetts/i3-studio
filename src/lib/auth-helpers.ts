import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { AppRole } from "@/types/next-auth";

export async function getSession() {
  return auth();
}

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export function isAgencyRole(role: AppRole | undefined | null) {
  return role === "admin" || role === "account_manager";
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
