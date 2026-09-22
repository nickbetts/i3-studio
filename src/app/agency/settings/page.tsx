import { desc } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { CreatePanel } from "@/components/create-panel";
import { ConfirmButton } from "@/components/confirm-button";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/permissions";
import { createTeammate, removeTeammate, updateUserAccess } from "./actions";
import { AvatarUpload } from "./avatar-upload";
import { ClientManagement } from "./client-management";
import { redirect } from "next/navigation";

const tabs = [["dashboard", "Dashboard"], ["projects", "Projects"], ["approvals", "Approvals"], ["designs", "Designs"], ["support", "Support"]] as const;
const palette = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6", "#3b82f6", "#eab308"];

export default async function AgencySettingsPage() {
  const actor = await requireAgencyUser();
  const canManageStaff = await hasPermission(actor, "manage_users");
  const canManageClients = await hasPermission(actor, "manage_clients");
  if (!canManageStaff && !canManageClients) redirect("/agency");
  const team = await db.query.users.findMany({
    where: (user, { inArray }) => inArray(user.role, ["admin", "account_manager", "content_writer"]),
    orderBy: desc(users.createdAt),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin settings"
        description="Manage teammates, client users, permissions and previews."
        actions={
          <>
            <Button asChild variant="outline" size="sm"><Link href="/agency/settings/teams">Teams</Link></Button>
            <Button asChild variant="outline" size="sm"><Link href="/agency/settings/roles">Roles & permissions</Link></Button>
            <Button asChild variant="outline" size="sm"><Link href="/agency/settings/client-types">Client types</Link></Button>
            <Button asChild variant="outline" size="sm"><Link href="/agency/settings/project-templates">Project templates</Link></Button>
            <Button asChild variant="outline" size="sm"><Link href="/agency/settings/onboarding-flows">Onboarding flows</Link></Button>
          </>
        }
      />


      {canManageStaff ? (
      <CreatePanel title="Add teammate"><Card>
        <CardHeader>
          <CardTitle className="text-base">Add teammate</CardTitle>
          <CardDescription>Create an internal user account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createTeammate} className="grid gap-4 md:grid-cols-4">
            <Input aria-label="Teammate name" name="name" placeholder="Name" required />
            <Input aria-label="Teammate email" name="email" type="email" placeholder="Email" required />
            <Input aria-label="Temporary password" name="password" type="password" minLength={8} placeholder="Temporary password" required />
            <Select name="role" defaultValue="account_manager">
              <SelectTrigger aria-label="Teammate role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="account_manager">Account manager</SelectItem>
                <SelectItem value="content_writer">Content writer</SelectItem>
                {actor.role === "admin" ? <SelectItem value="admin">Admin</SelectItem> : null}
              </SelectContent>
            </Select>
            <Button type="submit">Add teammate</Button>
          </form>
        </CardContent>
      </Card></CreatePanel>
      ) : null}

      {canManageStaff ? (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Internal users</CardTitle>
          <CardDescription>Control agency role, visible tabs, and remove access.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {team.map((member, index) => {
            const permissionData = member.permissions as { tabs?: unknown } | null;
            const allowed = Array.isArray(permissionData?.tabs) ? permissionData.tabs : tabs.map(([value]) => value);
            return (
              <div key={member.id} className="flex flex-wrap items-center gap-4 border-b pb-4 last:border-0">
                <AvatarUpload userId={member.id} name={member.name || member.email} image={member.image} color={palette[index % palette.length]} />
                <form action={updateUserAccess} className="flex flex-1 flex-wrap items-center gap-4">
                  <input type="hidden" name="userId" value={member.id} />
                  <div className="w-48">
                    <p className="font-medium">{member.name || member.email}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <Select name="role" defaultValue={member.role}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="account_manager">Account manager</SelectItem>
                      <SelectItem value="content_writer">Content writer</SelectItem>
                      {actor.role === "admin" || member.role === "admin" ? <SelectItem value="admin">Admin</SelectItem> : null}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-3">
                    {tabs.map(([value, label]) => (
                      <label key={value} className="flex items-center gap-2 text-sm">
                        <Checkbox name={`tab-${value}`} defaultChecked={allowed.includes(value)} value="on" />
                        {label}
                      </label>
                    ))}
                  </div>
                  <Button type="submit" variant="outline">Save access</Button>
                </form>
                {member.id !== actor.id ? (
                  <ConfirmButton
                    action={removeTeammate}
                    hidden={{ userId: member.id }}
                    label="Remove"
                    title="Remove this teammate?"
                    description={`${member.name || member.email} will lose access immediately. Their past activity stays on record.`}
                    confirmLabel="Remove"
                    variant="ghost"
                  />
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>
      ) : null}

      {canManageClients ? <ClientManagement /> : null}
    </div>
  );
}
