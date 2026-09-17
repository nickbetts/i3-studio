export function monthWindow(value?: string, now = new Date()) {
  const key = value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) >= 2000 && Number(value.slice(0, 4)) <= 2100 ? value : now.toISOString().slice(0, 7);
  const start = new Date(`${key}-01T00:00:00.000Z`);
  const next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const previous = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));
  return { key, start, end: new Date(next.getTime() - 1), previous: previous.toISOString().slice(0, 7), next: next.toISOString().slice(0, 7), label: start.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) };
}

export function budgetUsage(allocatedSeconds: number | null, spentSeconds: number, start: Date, end: Date, now = new Date()) {
  const spent = Math.max(0, spentSeconds);
  const allocated = allocatedSeconds === null ? null : Math.max(0, allocatedSeconds);
  const usedPercent = allocated === null ? 0 : allocated === 0 ? (spent > 0 ? 100 : 0) : spent / allocated * 100;
  const periodPercent = Math.min(100, Math.max(0, (now.getTime() - start.getTime()) / Math.max(1, end.getTime() - start.getTime()) * 100));
  const remaining = allocated === null ? null : Math.max(0, allocated - spent);
  const over = allocated === null ? 0 : Math.max(0, spent - allocated);
  const state = allocated === null ? "unallocated" : over > 0 ? "over" : remaining === 0 ? "exhausted" : usedPercent >= 80 ? "near" : "available";
  return { spent, allocated, remaining, over, usedPercent, barPercent: Math.min(100, usedPercent), periodPercent, state };
}

export function secondsInPeriod(entries: { startedAt: Date; durationSeconds: number }[], start: Date, end: Date) {
  return entries.reduce((total, entry) => entry.startedAt >= start && entry.startedAt <= end ? total + entry.durationSeconds : total, 0);
}
