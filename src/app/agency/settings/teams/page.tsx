import { asc, inArray } from "drizzle-orm";
import { Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { CreatePanel } from "@/components/create-panel";
import { EmptyState } from "@/components/empty-state";
import { db } from "@/db";
import { clientAccounts, teamMembers, teams, users } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/permissions";
import { addTeamMember, createTeam, removeTeamMember, setTeamArchived } from "./actions";

export default async function TeamsPage() {
  const actor = await requireAgencyUser();
  const canManage = await hasPermission(actor, "edit_teams");

  const [teamList, clients, staff] = await Promise.all([
    db.query.teams.findMany({ orderBy: asc(teams.name) }),
    db.query.clientAccounts.findMany({ orderBy: asc(clientAccounts.name) }),
    db.query.users.findMany({ where: inArray(users.role, ["admin", "account_manager", "content_writer"]), orderBy: asc(users.name) }),
  ]);
  const memberRows = teamList.length ? await db.query.teamMembers.findMany({ where: inArray(teamMembers.teamId, teamList.map((team) => team.id)) }) : [];
  const clientName = (id: string | null) => (id ? clients.find((client) => client.id === id)?.name ?? "Unknown client" : null);
  const staffName = (id: string) => staff.find((member) => member.id === id)?.name || staff.find((member) => member.id === id)?.email || "Unknown";

  return (
    <div className="space-y-6">
      <PageHeader title="Teams" description="Group staff members so you can assign a whole team to tasks or support tickets." breadcrumbs={[{ label: "Settings", href: "/agency/settings" }, { label: "Teams" }]} />

      {canManage ? (
        <CreatePanel title="New team">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create a team</CardTitle>
              <CardDescription>Leave the client field empty for a team usable across every client.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createTeam} className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="team-name">Team name</Label><Input id="team-name" name="name" required /></div>
                <div className="space-y-2">
                  <Label htmlFor="team-client">Restrict to client (optional)</Label>
                  <Select name="clientAccountId">
                    <SelectTrigger id="team-client"><SelectValue placeholder="All clients" /></SelectTrigger>
                    <SelectContent>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2"><Label htmlFor="team-description">Description (optional)</Label><Textarea id="team-description" name="description" /></div>
                <div><Button type="submit">Create team</Button></div>
              </form>
            </CardContent>
          </Card>
        </CreatePanel>
      ) : null}

      {teamList.length === 0 ? (
        <EmptyState icon={Users2} title="No teams yet" description="Create a team above to start grouping staff members." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {teamList.map((team) => {
            const memberIds = memberRows.filter((row) => row.teamId === team.id).map((row) => row.userId);
            const availableStaff = staff.filter((member) => !memberIds.includes(member.id));
            return (
              <Card key={team.id}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{team.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      {team.clientAccountId ? <Badge variant="outline">{clientName(team.clientAccountId)}</Badge> : <Badge variant="outline">All clients</Badge>}
                      {team.archived ? <Badge variant="outline">Archived</Badge> : null}
                    </div>
                  </div>
                  {team.description ? <CardDescription>{team.description}</CardDescription> : null}
                </CardHeader>
                <CardContent className="space-y-3">
                  {memberIds.length === 0 ? <p className="text-sm text-muted-foreground">No members yet.</p> : (
                    <div className="space-y-2">
                      {memberIds.map((userId) => (
                        <div key={userId} className="flex items-center justify-between gap-2 text-sm">
                          <span>{staffName(userId)}</span>
                          {canManage ? (
                            <form action={removeTeamMember}>
                              <input type="hidden" name="teamId" value={team.id} />
                              <input type="hidden" name="userId" value={userId} />
                              <Button type="submit" variant="ghost" size="sm">Remove</Button>
                            </form>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                  {canManage ? (
                    <form action={addTeamMember} className="flex items-center gap-2 pt-2">
                      <input type="hidden" name="teamId" value={team.id} />
                      <Select name="userId">
                        <SelectTrigger className="w-full"><SelectValue placeholder="Add member" /></SelectTrigger>
                        <SelectContent>{availableStaff.map((member) => <SelectItem key={member.id} value={member.id}>{member.name || member.email}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button type="submit" variant="outline" size="sm">Add</Button>
                    </form>
                  ) : null}
                  {canManage ? (
                    <form action={setTeamArchived} className="pt-1">
                      <input type="hidden" name="teamId" value={team.id} />
                      <input type="hidden" name="archived" value={String(!team.archived)} />
                      <Button type="submit" variant="ghost" size="sm">{team.archived ? "Restore team" : "Archive team"}</Button>
                    </form>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
