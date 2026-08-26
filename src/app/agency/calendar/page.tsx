import { addDays, format, startOfWeek } from "date-fns";
import { desc, eq, gte } from "drizzle-orm";
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
  const week = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, index) => { const date = addDays(week, index); return { key: format(date, "yyyy-MM-dd"), label: format(date, "EEE d") }; });
  const [members, allRows] = await Promise.all([db.query.users.findMany({ where: eq(users.role, "account_manager"), orderBy: desc(users.name) }), db.query.allocations.findMany({ where: gte(allocations.date, week), orderBy: desc(allocations.startMinute) })]);
  const rows = allRows.filter((row) => row.date < addDays(week, 7));
  const blocks = rows.map((row) => ({ ...row, dateKey: format(row.date, "yyyy-MM-dd") }));
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">Team calendar</h1><p className="text-muted-foreground">Plan capacity across the current week.</p></div><Card><CardHeader><CardTitle className="text-base">Add time block</CardTitle><CardDescription>Blocks are managed by administrators. Time fields use minutes from midnight.</CardDescription></CardHeader><CardContent><form action={createAllocation} className="grid gap-4 md:grid-cols-5"><div className="space-y-2"><Label htmlFor="allocation-member">Team member</Label><Select name="memberUserId" required><SelectTrigger id="allocation-member"><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{members.map((member) => <SelectItem key={member.id} value={member.id}>{member.name || member.email}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="allocation-title">Work</Label><Input id="allocation-title" name="title" required /></div><div className="space-y-2"><Label htmlFor="allocation-date">Date</Label><Input id="allocation-date" name="date" type="date" required /></div><div className="space-y-2"><Label htmlFor="allocation-start">Start</Label><Input id="allocation-start" name="startMinute" type="number" min="0" max="1439" defaultValue="540" required /></div><div className="space-y-2"><Label htmlFor="allocation-end">End</Label><Input id="allocation-end" name="endMinute" type="number" min="1" max="1440" defaultValue="600" required /></div><div><Button type="submit">Add block</Button></div></form></CardContent></Card><CalendarGrid days={days} members={members.map((member) => ({ id: member.id, name: member.name || member.email }))} blocks={blocks} /></div>;
}
