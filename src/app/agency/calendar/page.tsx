import { desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/db";
import { allocations, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";
import { createAllocation } from "./actions";
import { CalendarGrid } from "./calendar-grid";

export default async function AgencyCalendarPage() {
  await requireAdmin();
  const [members, rows] = await Promise.all([db.query.users.findMany({ where: (user, { inArray }) => inArray(user.role, ["admin", "account_manager"]), orderBy: desc(users.name) }), db.query.allocations.findMany({ orderBy: desc(allocations.date) })]);
  const memberOptions = members.map((member) => ({ id: member.id, name: member.name || member.email }));
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">Team calendar</h1><p className="text-muted-foreground">Drag blocks between people and days, drag the right edge to resize, or click a block to edit it.</p></div><Card><CardHeader><CardTitle className="text-base">Add time block</CardTitle><CardDescription>Schedule work for a team member.</CardDescription></CardHeader><CardContent><form action={createAllocation} className="grid gap-4 md:grid-cols-6"><div className="space-y-2"><Label htmlFor="allocation-member">Team member</Label><Select name="memberUserId" required><SelectTrigger id="allocation-member"><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{memberOptions.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="allocation-title">Work</Label><Input id="allocation-title" name="title" required /></div><div className="space-y-2"><Label htmlFor="allocation-date">Start date</Label><Input id="allocation-date" name="date" type="date" required /></div><div className="space-y-2"><Label htmlFor="allocation-end-date">End date</Label><Input id="allocation-end-date" name="endDate" type="date" required /></div><div className="space-y-2"><Label htmlFor="allocation-start">Start time</Label><Input id="allocation-start" name="startTime" type="time" defaultValue="09:00" step="900" required /></div><div className="space-y-2"><Label htmlFor="allocation-end">End time</Label><Input id="allocation-end" name="endTime" type="time" defaultValue="17:00" step="900" required /></div><div><Button type="submit">Add block</Button></div></form></CardContent></Card><CalendarGrid members={memberOptions} blocks={rows} /></div>;
}
