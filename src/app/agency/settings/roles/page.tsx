import { asc, inArray } from "drizzle-orm";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmButton } from "@/components/confirm-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { CreatePanel } from "@/components/create-panel";
import { EmptyState } from "@/components/empty-state";
import { db } from "@/db";
import { customRoles, users } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { hasPermission, PERMISSION_GROUPS, PERMISSION_LABELS, type PermissionKey } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { assignCustomRole, createCustomRole, deleteCustomRole, updateCustomRole } from "./actions";

function PermissionCheckboxes({ namePrefix, defaultGranted }: { namePrefix: string; defaultGranted: Set<PermissionKey> }) {
  return (
    <div className="space-y-3">
      {PERMISSION_GROUPS.map((group) => (
        <fieldset key={group.label} className="space-y-1.5 rounded-md border p-3">
          <legend className="px-1 text-xs font-semibold text-muted-foreground">{group.label}</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {group.keys.map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <Checkbox name={`${namePrefix}${key}`} value="on" defaultChecked={defaultGranted.has(key)} />
                {PERMISSION_LABELS[key]}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export default async function RolesPage() {
  const actor = await requireAgencyUser();
  const canManageRoles = await hasPermission(actor, "manage_roles");
  const canAssignRoles = await hasPermission(actor, "assign_roles");
  if (!canManageRoles && !canAssignRoles) redirect("/agency");
  const [roles, staff] = await Promise.all([
    db.query.customRoles.findMany({ orderBy: asc(customRoles.name) }),
    db.query.users.findMany({ where: inArray(users.role, ["admin", "account_manager", "content_writer"]), orderBy: asc(users.name) }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Roles & permissions" description="Build custom permission sets for internal staff, beyond the base admin/account manager/content writer roles." breadcrumbs={[{ label: "Settings", href: "/agency/settings" }, { label: "Roles" }]} />

      {canManageRoles ? (
      <CreatePanel title="New custom role">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create a custom role</CardTitle>
            <CardDescription>Admins always have every permission. Staff without a custom role keep their existing default access.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createCustomRole} className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="role-name">Name</Label><Input id="role-name" name="name" required /></div>
                <div className="space-y-2"><Label htmlFor="role-description">Description (optional)</Label><Input id="role-description" name="description" /></div>
              </div>
              <PermissionCheckboxes namePrefix="perm-" defaultGranted={new Set()} />
              <div><Button type="submit">Create role</Button></div>
            </form>
          </CardContent>
        </Card>
      </CreatePanel>
      ) : null}

      {canManageRoles && roles.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No custom roles yet" description="Create one above to grant a specific set of permissions to staff." />
      ) : null}
      {canManageRoles && roles.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {roles.map((role) => {
            const granted = new Set(Array.isArray(role.permissions) ? (role.permissions as PermissionKey[]) : []);
            const assignedStaff = staff.filter((member) => member.customRoleId === role.id);
            return (
              <Card key={role.id}>
                <CardHeader>
                  <CardTitle className="text-base">{role.name}</CardTitle>
                  {role.description ? <CardDescription>{role.description}</CardDescription> : null}
                </CardHeader>
                <CardContent className="space-y-4">
                  <form action={updateCustomRole} className="space-y-3">
                    <input type="hidden" name="roleId" value={role.id} />
                    <PermissionCheckboxes namePrefix="perm-" defaultGranted={granted} />
                    <Button type="submit" variant="outline" size="sm">Save permissions</Button>
                  </form>

                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Assigned staff ({assignedStaff.length})</p>
                    {assignedStaff.length === 0 ? <p className="text-sm text-muted-foreground">No one has this role yet.</p> : (
                      <div className="flex flex-wrap gap-1.5">{assignedStaff.map((member) => <Badge key={member.id} variant="outline">{member.name || member.email}</Badge>)}</div>
                    )}
                  </div>

                  <ConfirmButton
                    action={deleteCustomRole}
                    hidden={{ roleId: role.id }}
                    label="Delete role"
                    title="Delete this custom role?"
                    description="Staff assigned to it will fall back to their default access."
                    confirmLabel="Delete"
                    variant="ghost"
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      {canAssignRoles ? (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assign roles to staff</CardTitle>
          <CardDescription>Pick a custom role for each teammate, or leave as default.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {staff.map((member) => (
            <form key={member.id} action={assignCustomRole} className="flex flex-wrap items-center gap-3 border-b pb-3 last:border-0">
              <input type="hidden" name="userId" value={member.id} />
              <div className="w-48"><p className="font-medium">{member.name || member.email}</p><p className="text-xs capitalize text-muted-foreground">{member.role.replace("_", " ")}</p></div>
              <Select name="customRoleId" defaultValue={member.customRoleId ?? ""}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Default access" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Default access</SelectItem>
                  {roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="submit" variant="outline" size="sm">Save</Button>
            </form>
          ))}
        </CardContent>
      </Card>
      ) : null}
    </div>
  );
}
