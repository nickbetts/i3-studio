import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customRoles, users, type PermissionKey } from "@/db/schema";
import { PERMISSION_KEYS } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";

export { PERMISSION_KEYS };
export type { PermissionKey };

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  manage_teams: "Manage teams",
  manage_roles: "Manage custom roles",
  manage_users: "Manage internal users",
  manage_clients: "Manage clients",
  manage_tasks: "Manage tasks",
  manage_tickets: "Manage support tickets",
  manage_content: "Manage content",
  manage_designs: "Manage designs",
  manage_billing: "Manage billing/time budgets",
  view_reports: "View reports",
  manage_settings: "Manage agency settings",
};

// Sensible defaults applied when a staff member has no custom role assigned,
// so behaviour matches pre-existing role-based guards until an admin opts in.
const DEFAULT_PERMISSIONS_BY_ROLE: Record<string, PermissionKey[]> = {
  admin: [...PERMISSION_KEYS],
  account_manager: ["manage_clients", "manage_tasks", "manage_tickets", "manage_content", "manage_designs", "manage_billing", "view_reports"],
  content_writer: ["manage_content", "manage_tasks", "manage_tickets", "manage_designs"],
  client: [],
};

type PermissionUser = {
  id: string;
  role: string;
  permissions?: unknown;
  customRoleId?: string | null;
};

/** Resolves the effective set of permission keys for a staff user (admins always get everything). */
export async function getUserPermissions(user: PermissionUser): Promise<Set<PermissionKey>> {
  if (user.role === "admin") return new Set(PERMISSION_KEYS);

  const overrides = user.permissions && typeof user.permissions === "object" ? (user.permissions as { grants?: unknown }).grants : undefined;
  if (Array.isArray(overrides) && overrides.length) {
    return new Set(overrides.filter((key): key is PermissionKey => (PERMISSION_KEYS as readonly string[]).includes(key)));
  }

  if (user.customRoleId) {
    const customRole = await db.query.customRoles.findFirst({ where: eq(customRoles.id, user.customRoleId) });
    const granted = Array.isArray(customRole?.permissions) ? customRole.permissions : [];
    return new Set(granted.filter((key): key is PermissionKey => (PERMISSION_KEYS as readonly string[]).includes(key)));
  }

  return new Set(DEFAULT_PERMISSIONS_BY_ROLE[user.role] ?? []);
}

export async function hasPermission(user: PermissionUser, key: PermissionKey): Promise<boolean> {
  const granted = await getUserPermissions(user);
  return granted.has(key);
}

/** Throws if the current user lacks the given permission. Callers should first run requireAgencyUser(). */
export async function requirePermission(user: PermissionUser, key: PermissionKey): Promise<void> {
  if (!(await hasPermission(user, key))) throw new Error("You don't have permission to do that.");
}

/** Requires an authenticated agency user AND the given permission; use in place of requireManager/requireAdmin in actions gated by a specific permission key. */
export async function requireAgencyPermission(key: PermissionKey) {
  const actor = await requireAgencyUser();
  await requirePermission(actor, key);
  return actor;
}

export async function listCustomRoles() {
  return db.query.customRoles.findMany({ orderBy: (role, { asc }) => [asc(role.name)] });
}

export async function findUserById(userId: string) {
  return db.query.users.findFirst({ where: eq(users.id, userId) });
}
