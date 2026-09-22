import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { annotationComments, annotations, approvals, clientAccounts, contentComments, contentItems, designAssets, projectUpdates, projects, ticketMessages, tickets, users } from "@/db/schema";
import { scoreSentimentText, scoreToIndex, sentimentLabel, type SentimentLabel } from "@/lib/sentiment";

export type SentimentSignal = {
  clientAccountId: string;
  source: "ticket_message" | "content_comment" | "annotation_comment" | "approval" | "project_update";
  score: number; // -1..1
  weight: number;
  excerpt: string;
  createdAt: Date;
};

async function collectSignals(rangeStart: Date, rangeEnd: Date, clientAccountId?: string): Promise<SentimentSignal[]> {
  const clientUsers = await db.query.users.findMany({ where: eq(users.role, "client"), columns: { id: true, clientAccountId: true } });
  const clientUserIds = clientUsers.map((user) => user.id);

  const [ticketRows, contentCommentRows, annotationCommentRows, approvalRows, updateRows] = await Promise.all([
    db.select({ clientAccountId: tickets.clientAccountId, body: ticketMessages.body, createdAt: ticketMessages.createdAt })
      .from(ticketMessages).innerJoin(tickets, eq(ticketMessages.ticketId, tickets.id))
      .where(and(eq(ticketMessages.direction, "inbound"), gte(ticketMessages.createdAt, rangeStart), lte(ticketMessages.createdAt, rangeEnd), clientAccountId ? eq(tickets.clientAccountId, clientAccountId) : undefined)),
    clientUserIds.length
      ? db.select({ clientAccountId: contentItems.clientAccountId, body: contentComments.body, createdAt: contentComments.createdAt, authorUserId: contentComments.authorUserId })
        .from(contentComments).innerJoin(contentItems, eq(contentComments.contentItemId, contentItems.id))
        .where(and(inArray(contentComments.authorUserId, clientUserIds), gte(contentComments.createdAt, rangeStart), lte(contentComments.createdAt, rangeEnd), clientAccountId ? eq(contentItems.clientAccountId, clientAccountId) : undefined))
      : Promise.resolve([]),
    clientUserIds.length
      ? db.select({ clientAccountId: designAssets.clientAccountId, body: annotationComments.body, createdAt: annotationComments.createdAt, authorUserId: annotationComments.authorUserId })
        .from(annotationComments)
        .innerJoin(annotations, eq(annotationComments.annotationId, annotations.id))
        .innerJoin(designAssets, eq(annotations.designAssetId, designAssets.id))
        .where(and(inArray(annotationComments.authorUserId, clientUserIds), gte(annotationComments.createdAt, rangeStart), lte(annotationComments.createdAt, rangeEnd), clientAccountId ? eq(designAssets.clientAccountId, clientAccountId) : undefined))
      : Promise.resolve([]),
    db.query.approvals.findMany({ where: and(gte(approvals.createdAt, rangeStart), lte(approvals.createdAt, rangeEnd), clientAccountId ? eq(approvals.clientAccountId, clientAccountId) : undefined), columns: { clientAccountId: true, decision: true, note: true, createdAt: true } }),
    db.select({ clientAccountId: projects.clientAccountId, sentiment: projectUpdates.sentiment, body: projectUpdates.body, createdAt: projectUpdates.createdAt })
      .from(projectUpdates).innerJoin(projects, eq(projectUpdates.projectId, projects.id))
      .where(and(gte(projectUpdates.createdAt, rangeStart), lte(projectUpdates.createdAt, rangeEnd), clientAccountId ? eq(projects.clientAccountId, clientAccountId) : undefined)),
  ]);

  const signals: SentimentSignal[] = [];

  for (const row of ticketRows) signals.push({ clientAccountId: row.clientAccountId, source: "ticket_message", score: scoreSentimentText(row.body), weight: 1, excerpt: row.body.slice(0, 160), createdAt: row.createdAt });
  for (const row of contentCommentRows) signals.push({ clientAccountId: row.clientAccountId, source: "content_comment", score: scoreSentimentText(row.body), weight: 1, excerpt: row.body.slice(0, 160), createdAt: row.createdAt });
  for (const row of annotationCommentRows) signals.push({ clientAccountId: row.clientAccountId, source: "annotation_comment", score: scoreSentimentText(row.body), weight: 1, excerpt: row.body.slice(0, 160), createdAt: row.createdAt });
  for (const row of approvalRows) {
    const decisionScore = row.decision === "approved" ? 0.6 : row.decision === "changes_requested" ? -0.6 : 0;
    const noteScore = row.note ? scoreSentimentText(row.note) : 0;
    const blended = row.note ? (decisionScore + noteScore) / 2 : decisionScore;
    signals.push({ clientAccountId: row.clientAccountId, source: "approval", score: blended, weight: 2, excerpt: row.note?.slice(0, 160) || `${row.decision.replace("_", " ")} (no note)`, createdAt: row.createdAt });
  }
  for (const row of updateRows) {
    const explicit = row.sentiment === "positive" ? 1 : row.sentiment === "at_risk" ? -1 : 0;
    signals.push({ clientAccountId: row.clientAccountId, source: "project_update", score: explicit, weight: 2, excerpt: row.body.slice(0, 160), createdAt: row.createdAt });
  }

  return signals;
}

function weightedAverage(signals: SentimentSignal[]): number | null {
  if (!signals.length) return null;
  const totalWeight = signals.reduce((total, signal) => total + signal.weight, 0);
  const totalScore = signals.reduce((total, signal) => total + signal.score * signal.weight, 0);
  return totalWeight ? totalScore / totalWeight : null;
}

export type ClientSentiment = {
  clientAccountId: string;
  clientName: string;
  index: number | null; // 0-100, null when no signals in range
  label: SentimentLabel | "no_data";
  signalCount: number;
  trend: "improving" | "declining" | "steady" | "no_data";
  breakdown: { positive: number; neutral: number; at_risk: number };
};

export async function getSentimentOverview(rangeStart: Date, rangeEnd: Date): Promise<{ overallIndex: number | null; clients: ClientSentiment[] }> {
  const [signals, clients] = await Promise.all([
    collectSignals(rangeStart, rangeEnd),
    db.query.clientAccounts.findMany({ columns: { id: true, name: true }, where: (client, { ne }) => ne(client.status, "prospect") }),
  ]);
  const midpoint = new Date((rangeStart.getTime() + rangeEnd.getTime()) / 2);

  const clientsList: ClientSentiment[] = clients.map((client) => {
    const clientSignals = signals.filter((signal) => signal.clientAccountId === client.id);
    const avg = weightedAverage(clientSignals);
    const firstHalf = weightedAverage(clientSignals.filter((signal) => signal.createdAt < midpoint));
    const secondHalf = weightedAverage(clientSignals.filter((signal) => signal.createdAt >= midpoint));
    let trend: ClientSentiment["trend"] = "no_data";
    if (firstHalf !== null && secondHalf !== null) {
      const delta = secondHalf - firstHalf;
      trend = delta > 0.1 ? "improving" : delta < -0.1 ? "declining" : "steady";
    }
    const breakdown = { positive: 0, neutral: 0, at_risk: 0 };
    for (const signal of clientSignals) breakdown[sentimentLabel(signal.score)] += 1;
    return {
      clientAccountId: client.id,
      clientName: client.name,
      index: avg === null ? null : scoreToIndex(avg),
      label: avg === null ? "no_data" : sentimentLabel(avg),
      signalCount: clientSignals.length,
      trend,
      breakdown,
    };
  });

  const overallAvg = weightedAverage(signals);
  return { overallIndex: overallAvg === null ? null : scoreToIndex(overallAvg), clients: clientsList.sort((a, b) => (a.index ?? 101) - (b.index ?? 101)) };
}

export type ClientSentimentDetail = ClientSentiment & { recentSignals: SentimentSignal[] };

export async function getClientSentiment(clientAccountId: string, rangeStart: Date, rangeEnd: Date): Promise<ClientSentimentDetail> {
  const [signals, client] = await Promise.all([
    collectSignals(rangeStart, rangeEnd, clientAccountId),
    db.query.clientAccounts.findFirst({ where: eq(clientAccounts.id, clientAccountId), columns: { id: true, name: true } }),
  ]);
  const midpoint = new Date((rangeStart.getTime() + rangeEnd.getTime()) / 2);
  const avg = weightedAverage(signals);
  const firstHalf = weightedAverage(signals.filter((signal) => signal.createdAt < midpoint));
  const secondHalf = weightedAverage(signals.filter((signal) => signal.createdAt >= midpoint));
  let trend: ClientSentiment["trend"] = "no_data";
  if (firstHalf !== null && secondHalf !== null) {
    const delta = secondHalf - firstHalf;
    trend = delta > 0.1 ? "improving" : delta < -0.1 ? "declining" : "steady";
  }
  const breakdown = { positive: 0, neutral: 0, at_risk: 0 };
  for (const signal of signals) breakdown[sentimentLabel(signal.score)] += 1;
  const recentSignals = [...signals].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 6);

  return {
    clientAccountId,
    clientName: client?.name ?? "Unknown client",
    index: avg === null ? null : scoreToIndex(avg),
    label: avg === null ? "no_data" : sentimentLabel(avg),
    signalCount: signals.length,
    trend,
    breakdown,
    recentSignals,
  };
}
