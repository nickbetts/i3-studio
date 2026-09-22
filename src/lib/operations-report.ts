import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { approvals, contentEvents, documents, projects, taskActivities, tasks } from "@/db/schema";

export type OperationsReport = {
  contentPipeline: { statusCounts: { status: string; count: number }[]; publishedInRange: number; avgCycleSeconds: number | null };
  approvalPipeline: { pendingCount: number; decidedInRange: number; avgTurnaroundSeconds: number | null };
  taskSla: { overdueCount: number; completedInRange: number; avgCycleSeconds: number | null };
  projectDelivery: { activeProjects: number; overdueMilestones: number; dueSoonMilestones: number };
};

const average = (values: number[]) => (values.length ? values.reduce((total, value) => total + value, 0) / values.length : null);

export async function getOperationsReport(rangeStart: Date, rangeEnd: Date): Promise<OperationsReport> {
  const now = new Date();
  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [contentRows, publishedEvents, pendingDocs, decidedApprovals, allDocuments, overdueTasks, completedTaskActivities, activeProjectRows, milestones] = await Promise.all([
    db.query.contentItems.findMany({ columns: { status: true } }),
    db.query.contentEvents.findMany({ where: and(eq(contentEvents.type, "published"), gte(contentEvents.createdAt, rangeStart), lte(contentEvents.createdAt, rangeEnd)), columns: { contentItemId: true, createdAt: true } }),
    db.query.documents.findMany({ where: eq(documents.status, "pending"), columns: { id: true } }),
    db.query.approvals.findMany({ where: and(gte(approvals.createdAt, rangeStart), lte(approvals.createdAt, rangeEnd)), columns: { documentId: true, createdAt: true }, orderBy: (approval, { asc }) => [asc(approval.createdAt)] }),
    db.query.documents.findMany({ columns: { id: true, createdAt: true } }),
    db.query.tasks.findMany({ where: and(lte(tasks.dueDate, now)), columns: { id: true, status: true, dueDate: true } }),
    db.query.taskActivities.findMany({ where: and(eq(taskActivities.action, "status_changed"), gte(taskActivities.createdAt, rangeStart), lte(taskActivities.createdAt, rangeEnd)), columns: { taskId: true, createdAt: true, metadata: true } }),
    db.query.projects.findMany({ where: eq(projects.status, "active"), columns: { id: true } }),
    db.query.projectMilestones.findMany({ columns: { dueDate: true, status: true } }),
  ]);

  // Content pipeline: current snapshot by status, plus cycle time (creation -> first publish event) for items published in range.
  const statusCounts = new Map<string, number>();
  for (const row of contentRows) statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
  const publishedItemIds = [...new Set(publishedEvents.map((event) => event.contentItemId))];
  const publishedItems = publishedItemIds.length ? await db.query.contentItems.findMany({ where: (item, { inArray }) => inArray(item.id, publishedItemIds), columns: { id: true, createdAt: true } }) : [];
  const publishedItemById = new Map(publishedItems.map((item) => [item.id, item]));
  const contentCycleSeconds: number[] = [];
  for (const event of publishedEvents) {
    const item = publishedItemById.get(event.contentItemId);
    if (item) contentCycleSeconds.push(Math.max(0, (event.createdAt.getTime() - item.createdAt.getTime()) / 1000));
  }

  // Document approvals: turnaround from upload to the first client decision, for decisions made in range.
  const documentById = new Map(allDocuments.map((doc) => [doc.id, doc]));
  const firstDecisionByDocument = new Map<string, Date>();
  for (const decision of decidedApprovals) {
    if (!firstDecisionByDocument.has(decision.documentId)) firstDecisionByDocument.set(decision.documentId, decision.createdAt);
  }
  const approvalTurnaroundSeconds: number[] = [];
  for (const [documentId, decidedAt] of firstDecisionByDocument) {
    const doc = documentById.get(documentId);
    if (doc) approvalTurnaroundSeconds.push(Math.max(0, (decidedAt.getTime() - doc.createdAt.getTime()) / 1000));
  }

  // Task SLA: tasks currently overdue (live snapshot), plus completion cycle time for tasks marked done in range.
  const overdueCount = overdueTasks.filter((task) => task.status !== "done").length;
  const completedTaskIds = new Set<string>();
  const taskCycleSeconds: number[] = [];
  const relevantTaskIds = [...new Set(completedTaskActivities.filter((activity) => {
    const status = activity.metadata && typeof activity.metadata === "object" ? (activity.metadata as { status?: string }).status : undefined;
    return status === "done";
  }).map((activity) => activity.taskId))];
  const relevantTasks = relevantTaskIds.length ? await db.query.tasks.findMany({ where: (task, { inArray }) => inArray(task.id, relevantTaskIds), columns: { id: true, createdAt: true } }) : [];
  const taskCreatedById = new Map(relevantTasks.map((task) => [task.id, task.createdAt]));
  for (const activity of completedTaskActivities) {
    const status = activity.metadata && typeof activity.metadata === "object" ? (activity.metadata as { status?: string }).status : undefined;
    if (status !== "done" || completedTaskIds.has(activity.taskId)) continue;
    const createdAt = taskCreatedById.get(activity.taskId);
    if (createdAt) {
      taskCycleSeconds.push(Math.max(0, (activity.createdAt.getTime() - createdAt.getTime()) / 1000));
      completedTaskIds.add(activity.taskId);
    }
  }

  // Project delivery: overdue / due-soon milestones, live snapshot (not range-bound, this is a current-risk view).
  const overdueMilestones = milestones.filter((milestone) => milestone.status !== "done" && milestone.dueDate && milestone.dueDate < now).length;
  const dueSoonMilestones = milestones.filter((milestone) => milestone.status !== "done" && milestone.dueDate && milestone.dueDate >= now && milestone.dueDate <= sevenDaysOut).length;

  return {
    contentPipeline: {
      statusCounts: [...statusCounts.entries()].map(([status, count]) => ({ status, count })),
      publishedInRange: publishedEvents.length,
      avgCycleSeconds: average(contentCycleSeconds),
    },
    approvalPipeline: {
      pendingCount: pendingDocs.length,
      decidedInRange: firstDecisionByDocument.size,
      avgTurnaroundSeconds: average(approvalTurnaroundSeconds),
    },
    taskSla: {
      overdueCount,
      completedInRange: completedTaskIds.size,
      avgCycleSeconds: average(taskCycleSeconds),
    },
    projectDelivery: {
      activeProjects: activeProjectRows.length,
      overdueMilestones,
      dueSoonMilestones,
    },
  };
}
