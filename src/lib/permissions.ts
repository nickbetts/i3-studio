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
  assign_roles: "Assign roles to staff",
  create_users: "Create internal users",
  edit_user_access: "Edit internal user access",
  remove_users: "Remove internal users",
  create_clients: "Create clients",
  edit_clients: "Edit client details & status",
  manage_account_managers: "Manage account manager assignments",
  manage_client_watchers: "Manage client watchers",
  manage_client_users: "Manage client portal users",
  create_tasks: "Create tasks",
  manage_all_tasks: "Manage & reassign any task",
  moderate_task_comments: "Delete others' task comments",
  reply_tickets: "Reply to support tickets",
  manage_ticket_status: "Change ticket status & priority",
  assign_tickets: "Assign tickets to teams",
  manage_time_budgets: "Manage client time budgets",
  manage_service_allocations: "Manage client service allocations",
  upload_designs: "Upload new designs",
  upload_design_versions: "Upload new design versions",
  manage_content_templates: "Manage content templates",
  manage_content_items: "Create & edit content",
  publish_content: "Publish approved content",
  manage_client_types: "Manage client types",
  manage_project_templates: "Manage project templates",
  manage_onboarding_flows: "Manage onboarding flows",
  view_reports: "View reports",
};

// Groups permissions for display purposes only (e.g. checkbox sections in the roles UI).
export const PERMISSION_GROUPS: { label: string; keys: PermissionKey[] }[] = [
  { label: "Teams", keys: ["manage_teams"] },
  { label: "Roles & permissions", keys: ["manage_roles", "assign_roles"] },
  { label: "Internal users", keys: ["create_users", "edit_user_access", "remove_users"] },
  { label: "Clients", keys: ["create_clients", "edit_clients", "manage_account_managers", "manage_client_watchers", "manage_client_users"] },
  { label: "Tasks", keys: ["create_tasks", "manage_all_tasks", "moderate_task_comments"] },
  { label: "Support tickets", keys: ["reply_tickets", "manage_ticket_status", "assign_tickets"] },
  { label: "Billing", keys: ["manage_time_budgets", "manage_service_allocations"] },
  { label: "Designs", keys: ["upload_designs", "upload_design_versions"] },
  { label: "Content", keys: ["manage_content_templates", "manage_content_items", "publish_content"] },
  { label: "Agency settings", keys: ["manage_client_types", "manage_project_templates", "manage_onboarding_flows"] },
  { label: "Reports", keys: ["view_reports"] },
];

// Sensible defaults applied when a staff member has no custom role assigned,
// mirroring exactly what each base role could do before the permission system existed.
const DEFAULT_PERMISSIONS_BY_ROLE: Record<string, PermissionKey[]> = {
  admin: [...PERMISSION_KEYS],
  account_manager: [
    "create_clients", "edit_clients", "manage_account_managers", "manage_client_watchers",
    "create_tasks", "manage_all_tasks", "moderate_task_comments",
    "reply_tickets", "manage_ticket_status", "assign_tickets",
    "manage_time_budgets", "manage_service_allocations",
    "upload_designs", "upload_design_versions",
    "manage_content_templates", "manage_content_items", "publish_content",
    "view_reports",
  ],
  content_writer: [
    "reply_tickets", "manage_ticket_status", "assign_tickets",
    "upload_designs", "upload_design_versions",
    "manage_content_templates", "manage_content_items",
    "view_reports",
  ],
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
