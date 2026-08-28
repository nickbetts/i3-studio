import { desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/db";
import { allocations, users } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { createAllocation } from "./actions";
import { CalendarGrid } from "./calendar-grid";

export default async function AgencyCalendarPage() {
  const user = await requireAgencyUser();
  const canEdit = user.role === "admin" || user.role === "account_manager";
  const [members, rows] = await Promise.all([db.query.users.findMany({ where: (user, { inArray }) => inArray(user.role, ["admin", "account_manager"]), orderBy: desc(users.name) }), db.query.allocations.findMany({ orderBy: desc(allocations.date) })]);
  const palette = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6", "#3b82f6", "#eab308"];
  const memberOptions = members.map((member, index) => ({ id: member.id, name: member.name || member.email, image: member.image, color: palette[index % palette.length] }));
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">Team calendar</h1><p className="text-muted-foreground">{canEdit ? "Drag blocks between people and days, drag the right edge to resize, or click a block to edit it." : "See what everyone on the team is working on."}</p></div>{canEdit ? <Card><CardHeader><CardTitle className="text-base">Add time block</CardTitle><CardDescription>Schedule work for a team member.</CardDescription></CardHeader><CardContent><form action={createAllocation} className="grid gap-4 md:grid-cols-6"><div className="space-y-2"><Label htmlFor="allocation-member">Team member</Label><Select name="memberUserId" required><SelectTrigger id="allocation-member"><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{memberOptions.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="allocation-title">Work</Label><Input id="allocation-title" name="title" required /></div><div className="space-y-2"><Label htmlFor="allocation-date">Start date</Label><Input id="allocation-date" name="date" type="date" required /></div><div className="space-y-2"><Label htmlFor="allocation-end-date">End date</Label><Input id="allocation-end-date" name="endDate" type="date" required /></div><div className="space-y-2"><Label htmlFor="allocation-start">Starts</Label><Select name="startHalf" defaultValue="am"><SelectTrigger id="allocation-start"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="am">Morning</SelectItem><SelectItem value="pm">Afternoon</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="allocation-end">Ends</Label><Select name="endHalf" defaultValue="end"><SelectTrigger id="allocation-end"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="midday">Midday</SelectItem><SelectItem value="end">End of day</SelectItem></SelectContent></Select></div><div><Button type="submit">Add block</Button></div></form></CardContent></Card> : null}<CalendarGrid members={memberOptions} blocks={rows} canEdit={canEdit} /></div>;
}
