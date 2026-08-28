import { desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";
import { createTeammate, updateUserAccess } from "./actions";
import { AvatarUpload } from "./avatar-upload";
import { ClientManagement } from "./client-management";

const tabs = [["dashboard", "Dashboard"], ["projects", "Projects"], ["approvals", "Approvals"], ["designs", "Designs"], ["support", "Support"]] as const;
const palette = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6", "#3b82f6", "#eab308"];

export default async function AgencySettingsPage() {
  await requireAdmin();
  const team = await db.query.users.findMany({ where: (user, { inArray }) => inArray(user.role, ["admin", "account_manager"]), orderBy: desc(users.createdAt) });
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">Admin settings</h1><p className="text-muted-foreground">Manage teammates, client users, permissions and previews.</p></div><Card><CardHeader><CardTitle className="text-base">Add teammate</CardTitle><CardDescription>Create an internal user account.</CardDescription></CardHeader><CardContent><form action={createTeammate} className="grid gap-4 md:grid-cols-4"><Input name="name" placeholder="Name" required /><Input name="email" type="email" placeholder="Email" required /><Input name="password" type="password" minLength={8} placeholder="Temporary password" required /><Select name="role" defaultValue="account_manager"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="account_manager">Account manager</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select><Button type="submit">Add teammate</Button></form></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Internal users</CardTitle><CardDescription>Control agency role and visible tabs.</CardDescription></CardHeader><CardContent className="space-y-4">{team.map((member, index) => { const permissionData = member.permissions as { tabs?: unknown } | null; const allowed = Array.isArray(permissionData?.tabs) ? permissionData.tabs : tabs.map(([value]) => value); return <div key={member.id} className="flex flex-wrap items-center gap-4 border-b pb-4 last:border-0"><AvatarUpload userId={member.id} name={member.name || member.email} image={member.image} color={palette[index % palette.length]} /><form action={updateUserAccess} className="flex flex-1 flex-wrap items-center gap-4"><input type="hidden" name="userId" value={member.id} /><div className="w-48"><p className="font-medium">{member.name || member.email}</p><p className="text-xs text-muted-foreground">{member.email}</p></div><Select name="role" defaultValue={member.role}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="account_manager">Account manager</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select><div className="flex flex-wrap gap-3">{tabs.map(([value, label]) => <label key={value} className="flex items-center gap-2 text-sm"><Checkbox name={`tab-${value}`} defaultChecked={allowed.includes(value)} value="on" />{label}</label>)}</div><Button type="submit" variant="outline">Save access</Button></form></div>; })}</CardContent></Card><ClientManagement /></div>;
}
