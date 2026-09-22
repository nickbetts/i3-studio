import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, taskActivities, taskAssignments, tasks, ticketMessages, timeEntries, users } from "@/db/schema";

export type StaffPerformanceRow = {
  userId: string;
  name: string;
  email: string;
  role: string;
  timeSeconds: number;
  tasksCreated: number;
  tasksCompleted: number;
  openTasksAssigned: number;
  ticketsReplied: number;
  ticketsResolved: number;
  avgFirstResponseSeconds: number | null;
};

export type SupportSla = {
  ticketsCreated: number;
  ticketsResolved: number;
  avgFirstResponseSeconds: number | null;
  avgResolutionSeconds: number | null;
  openByPriority: { priority: string; count: number }[];
};

export async function getStaffPerformanceReport(rangeStart: Date, rangeEnd: Date) {
  const staff = await db.query.users.findMany({
    where: inArray(users.role, ["admin", "account_manager", "content_writer"]),
    columns: { id: true, name: true, email: true, role: true },
    orderBy: asc(users.name),
  });

  const [timeRows, createdTaskRows, statusActivityRows, openAssignmentPairs, openTaskRows, replyRows, resolutionLogRows, ticketRows] = await Promise.all([
    db.query.timeEntries.findMany({ where: and(gte(timeEntries.startedAt, rangeStart), lte(timeEntries.startedAt, rangeEnd)), columns: { userId: true, durationSeconds: true } }),
    db.query.tasks.findMany({ where: and(gte(tasks.createdAt, rangeStart), lte(tasks.createdAt, rangeEnd)), columns: { createdByUserId: true } }),
    db.query.taskActivities.findMany({ where: and(eq(taskActivities.action, "status_changed"), gte(taskActivities.createdAt, rangeStart), lte(taskActivities.createdAt, rangeEnd)), columns: { actorUserId: true, metadata: true } }),
    db.select({ userId: taskAssignments.userId, taskId: taskAssignments.taskId }).from(taskAssignments).innerJoin(tasks, eq(taskAssignments.taskId, tasks.id)).where(inArray(tasks.status, ["open", "in_progress", "blocked"])),
    db.query.tasks.findMany({ where: inArray(tasks.status, ["open", "in_progress", "blocked"]), columns: { id: true, assignedToUserId: true } }),
    db.query.ticketMessages.findMany({ where: and(eq(ticketMessages.direction, "outbound"), gte(ticketMessages.createdAt, rangeStart), lte(ticketMessages.createdAt, rangeEnd)), columns: { authorUserId: true, ticketId: true, createdAt: true } }),
    db.query.auditLogs.findMany({ where: and(eq(auditLogs.action, "ticket.status_updated"), gte(auditLogs.createdAt, rangeStart), lte(auditLogs.createdAt, rangeEnd)), columns: { actorUserId: true, metadata: true } }),
    db.query.tickets.findMany({ columns: { id: true, createdAt: true, updatedAt: true, status: true, priority: true }, with: { messages: { columns: { direction: true, authorUserId: true, createdAt: true }, orderBy: (message, { asc: ascOrder }) => [ascOrder(message.createdAt)] } } }),
  ]);

  const timeByUser = new Map<string, number>();
  for (const row of timeRows) timeByUser.set(row.userId, (timeByUser.get(row.userId) ?? 0) + row.durationSeconds);

  const createdByUser = new Map<string, number>();
  for (const row of createdTaskRows) if (row.createdByUserId) createdByUser.set(row.createdByUserId, (createdByUser.get(row.createdByUserId) ?? 0) + 1);

  const completedByUser = new Map<string, number>();
  for (const row of statusActivityRows) {
    const status = row.metadata && typeof row.metadata === "object" ? (row.metadata as { status?: string }).status : undefined;
    if (status === "done" && row.actorUserId) completedByUser.set(row.actorUserId, (completedByUser.get(row.actorUserId) ?? 0) + 1);
  }

  const openByUser = new Map<string, Set<string>>();
  for (const row of openAssignmentPairs) {
    if (!openByUser.has(row.userId)) openByUser.set(row.userId, new Set());
    openByUser.get(row.userId)!.add(row.taskId);
  }
  for (const row of openTaskRows) {
    if (!row.assignedToUserId) continue;
    if (!openByUser.has(row.assignedToUserId)) openByUser.set(row.assignedToUserId, new Set());
    openByUser.get(row.assignedToUserId)!.add(row.id);
  }

  const repliedByUser = new Map<string, number>();
  for (const row of replyRows) if (row.authorUserId) repliedByUser.set(row.authorUserId, (repliedByUser.get(row.authorUserId) ?? 0) + 1);

  const resolvedByUser = new Map<string, number>();
  for (const row of resolutionLogRows) {
    const status = row.metadata && typeof row.metadata === "object" ? (row.metadata as { status?: string }).status : undefined;
    if ((status === "resolved" || status === "closed") && row.actorUserId) resolvedByUser.set(row.actorUserId, (resolvedByUser.get(row.actorUserId) ?? 0) + 1);
  }

  // First-response credit: the author of the earliest outbound message on each ticket,
  // counted when that response itself landed inside the reporting window.
  const firstResponseByUser = new Map<string, number[]>();
  const allFirstResponses: number[] = [];
  let ticketsCreatedInRange = 0;
  let ticketsResolvedInRange = 0;
  const resolutionSeconds: number[] = [];
  const openByPriority = new Map<string, number>();

  for (const ticket of ticketRows) {
    if (ticket.createdAt >= rangeStart && ticket.createdAt <= rangeEnd) ticketsCreatedInRange += 1;
    if (["open", "pending"].includes(ticket.status)) openByPriority.set(ticket.priority, (openByPriority.get(ticket.priority) ?? 0) + 1);
    if ((ticket.status === "resolved" || ticket.status === "closed") && ticket.updatedAt >= rangeStart && ticket.updatedAt <= rangeEnd) {
      ticketsResolvedInRange += 1;
      resolutionSeconds.push(Math.max(0, (ticket.updatedAt.getTime() - ticket.createdAt.getTime()) / 1000));
    }
    const firstOutbound = ticket.messages.find((message) => message.direction === "outbound");
    if (!firstOutbound || !firstOutbound.authorUserId) continue;
    if (firstOutbound.createdAt < rangeStart || firstOutbound.createdAt > rangeEnd) continue;
    const seconds = Math.max(0, (firstOutbound.createdAt.getTime() - ticket.createdAt.getTime()) / 1000);
    allFirstResponses.push(seconds);
    if (!firstResponseByUser.has(firstOutbound.authorUserId)) firstResponseByUser.set(firstOutbound.authorUserId, []);
    firstResponseByUser.get(firstOutbound.authorUserId)!.push(seconds);
  }

  const average = (values: number[]) => (values.length ? values.reduce((total, value) => total + value, 0) / values.length : null);

  const rows: StaffPerformanceRow[] = staff.map((member) => ({
    userId: member.id,
    name: member.name || member.email,
    email: member.email,
    role: member.role,
    timeSeconds: timeByUser.get(member.id) ?? 0,
    tasksCreated: createdByUser.get(member.id) ?? 0,
    tasksCompleted: completedByUser.get(member.id) ?? 0,
    openTasksAssigned: openByUser.get(member.id)?.size ?? 0,
    ticketsReplied: repliedByUser.get(member.id) ?? 0,
    ticketsResolved: resolvedByUser.get(member.id) ?? 0,
    avgFirstResponseSeconds: average(firstResponseByUser.get(member.id) ?? []),
  }));

  const support: SupportSla = {
    ticketsCreated: ticketsCreatedInRange,
    ticketsResolved: ticketsResolvedInRange,
    avgFirstResponseSeconds: average(allFirstResponses),
    avgResolutionSeconds: average(resolutionSeconds),
    openByPriority: [...openByPriority.entries()].map(([priority, count]) => ({ priority, count })).sort((a, b) => b.count - a.count),
  };

  return { rows, support };
}

export function formatDuration(totalSeconds: number | null): string {
  if (totalSeconds === null || !Number.isFinite(totalSeconds)) return "—";
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`;
}
