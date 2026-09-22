import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customRoles, users, type PermissionKey } from "@/db/schema";
import { PERMISSION_KEYS } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";

export { PERMISSION_KEYS };
export type { PermissionKey };

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  edit_teams: "Create, edit & archive teams",
  edit_roles: "Create & edit custom roles",
  assign_roles: "Assign roles to staff",
  create_users: "Create internal users",
  edit_users: "Edit internal user access",
  deactivate_users: "Remove internal users",
  create_clients: "Create clients",
  edit_clients: "Edit client details & status",
  assign_account_managers: "Assign account managers to clients",
  edit_client_watchers: "Add/remove client watchers",
  edit_client_users: "Edit client portal users",
  create_tasks: "Create tasks",
  edit_tasks: "Edit & reassign any task",
  delete_task_comments: "Delete others' task comments",
  reply_tickets: "Reply to support tickets",
  edit_tickets: "Change ticket status & priority",
  assign_tickets: "Assign tickets to teams",
  edit_time_budgets: "Edit client time budgets",
  edit_service_allocations: "Edit client service allocations",
  upload_designs: "Upload new designs",
  upload_design_versions: "Upload new design versions",
  edit_content_templates: "Create & edit content templates",
  edit_content: "Create & edit content",
  publish_content: "Publish approved content",
  edit_client_types: "Create & edit client types",
  edit_project_templates: "Create & edit project templates",
  edit_onboarding_flows: "Create & edit onboarding flows",
  view_reports: "View reports",
};

// Groups permissions for display purposes only (e.g. checkbox sections in the roles UI).
export const PERMISSION_GROUPS: { label: string; keys: PermissionKey[] }[] = [
  { label: "Teams", keys: ["edit_teams"] },
  { label: "Roles & permissions", keys: ["edit_roles", "assign_roles"] },
  { label: "Internal users", keys: ["create_users", "edit_users", "deactivate_users"] },
  { label: "Clients", keys: ["create_clients", "edit_clients", "assign_account_managers", "edit_client_watchers", "edit_client_users"] },
  { label: "Tasks", keys: ["create_tasks", "edit_tasks", "delete_task_comments"] },
  { label: "Support tickets", keys: ["reply_tickets", "edit_tickets", "assign_tickets"] },
  { label: "Billing", keys: ["edit_time_budgets", "edit_service_allocations"] },
  { label: "Designs", keys: ["upload_designs", "upload_design_versions"] },
  { label: "Content", keys: ["edit_content_templates", "edit_content", "publish_content"] },
  { label: "Agency settings", keys: ["edit_client_types", "edit_project_templates", "edit_onboarding_flows"] },
  { label: "Reports", keys: ["view_reports"] },
];

// Sensible defaults applied when a staff member has no custom role assigned,
// mirroring exactly what each base role could do before the permission system existed.
const DEFAULT_PERMISSIONS_BY_ROLE: Record<string, PermissionKey[]> = {
  admin: [...PERMISSION_KEYS],
  account_manager: [
    "create_clients", "edit_clients", "assign_account_managers", "edit_client_watchers",
    "create_tasks", "edit_tasks", "delete_task_comments",
    "reply_tickets", "edit_tickets", "assign_tickets",
    "edit_time_budgets", "edit_service_allocations",
    "upload_designs", "upload_design_versions",
    "edit_content_templates", "edit_content", "publish_content",
    "view_reports",
  ],
  content_writer: [
    "reply_tickets", "edit_tickets", "assign_tickets",
    "upload_designs", "upload_design_versions",
    "edit_content_templates", "edit_content",
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
