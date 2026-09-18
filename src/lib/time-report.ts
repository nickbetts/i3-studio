import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { clientAccounts, clientServiceAllocations, clientTimeBudgets, timeEntries } from "@/db/schema";
import { requireAgencyUser, requireClientUser } from "@/lib/auth-helpers";
import { monthWindow, secondsInPeriod } from "@/lib/time-budget";

export async function getTimeReport(month: string | undefined, portal = false) {
  const actor = portal ? await requireClientUser() : await requireAgencyUser();
  const clientId = portal ? actor.clientAccountId! : null;
  const period = monthWindow(month);
  const [clients, budgets, serviceAllocations] = await Promise.all([
    db.query.clientAccounts.findMany({ columns: { id: true, name: true }, where: clientId ? eq(clientAccounts.id, clientId) : undefined, orderBy: asc(clientAccounts.name) }),
    db.query.clientTimeBudgets.findMany({ where: and(lte(clientTimeBudgets.periodStart, period.end), gte(clientTimeBudgets.periodEnd, period.start), clientId ? eq(clientTimeBudgets.clientAccountId, clientId) : undefined), orderBy: desc(clientTimeBudgets.periodStart) }),
    db.query.clientServiceAllocations.findMany({ where: and(lte(clientServiceAllocations.periodStart, period.end), gte(clientServiceAllocations.periodEnd, period.start), clientId ? eq(clientServiceAllocations.clientAccountId, clientId) : undefined), orderBy: asc(clientServiceAllocations.serviceType) }),
  ]);
  const rangeStart = new Date(Math.min(period.start.getTime(), ...budgets.map((budget) => budget.periodStart.getTime()), ...serviceAllocations.map((allocation) => allocation.periodStart.getTime())));
  const rangeEnd = new Date(Math.max(period.end.getTime(), ...budgets.map((budget) => budget.periodEnd.getTime()), ...serviceAllocations.map((allocation) => allocation.periodEnd.getTime())));
  const allEntries = await db.query.timeEntries.findMany({ where: and(gte(timeEntries.startedAt, rangeStart), lte(timeEntries.startedAt, rangeEnd), clientId ? eq(timeEntries.clientAccountId, clientId) : undefined), orderBy: desc(timeEntries.startedAt) });
  const entries = allEntries.filter((entry) => entry.startedAt >= period.start && entry.startedAt <= period.end);
  const rows = clients.map((client) => {
    const budget = budgets.find((item) => item.clientAccountId === client.id) ?? null;
    const start = budget?.periodStart ?? serviceAllocations.find((item) => item.clientAccountId === client.id)?.periodStart ?? period.start;
    const end = budget?.periodEnd ?? serviceAllocations.find((item) => item.clientAccountId === client.id)?.periodEnd ?? period.end;
    const clientEntries = allEntries.filter((entry) => entry.clientAccountId === client.id);
    const spent = secondsInPeriod(clientEntries, start, end);
    const serviceSpent = Object.fromEntries([...new Set(clientEntries.map((entry) => entry.serviceType))].map((serviceType) => [serviceType, secondsInPeriod(clientEntries.filter((entry) => entry.serviceType === serviceType), start, end)]));
    return { client, budget, serviceAllocations: serviceAllocations.filter((item) => item.clientAccountId === client.id), serviceSpent, start, end, spent };
  });
  return { period, rows, entries, totalSeconds: entries.reduce((total, entry) => total + entry.durationSeconds, 0) };
}
