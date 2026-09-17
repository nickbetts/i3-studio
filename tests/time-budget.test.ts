import { describe, expect, it } from "vitest";
import { budgetUsage, monthWindow, secondsInPeriod } from "../src/lib/time-budget";
import { formatLoggedTime } from "../src/lib/time-format";

describe("budget display and period accounting", () => {
  const period = monthWindow("2026-09");
  it("keeps calendar dates stable and navigates year boundaries", () => {
    expect(period.start.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-09-30T23:59:59.999Z");
    expect(monthWindow("2026-01").previous).toBe("2025-12");
    expect(monthWindow("2026-12").next).toBe("2027-01");
    expect(monthWindow("2026-99", period.start).key).toBe("2026-09");
  });
  it.each([[null, 0, "unallocated"], [0, 0, "exhausted"], [0, 1, "over"], [100, 20, "available"], [100, 80, "near"], [100, 100, "exhausted"], [100, 130, "over"]] as const)("handles allocation %s and spend %s", (allocated, spent, state) => {
    const result = budgetUsage(allocated, spent, period.start, period.end);
    expect(result.state).toBe(state);
    expect(result.barPercent).toBeLessThanOrEqual(100);
    expect(Number.isFinite(result.usedPercent)).toBe(true);
  });
  it("keeps overage separate instead of a negative remaining time", () => {
    expect(budgetUsage(3600, 3661, period.start, period.end)).toMatchObject({ remaining: 0, over: 61, barPercent: 100 });
  });
  it("counts only entries within the displayed custom budget period", () => {
    const entries = [{ startedAt: new Date("2026-08-31T12:00:00Z"), durationSeconds: 3600 }, { startedAt: period.start, durationSeconds: 61 }, { startedAt: period.end, durationSeconds: 2 }];
    expect(secondsInPeriod(entries, period.start, period.end)).toBe(63);
    expect(secondsInPeriod(entries, new Date("2026-08-30"), period.end)).toBe(3663);
  });
  it("shows exact seconds without rounding to 60 minutes or wrapping hours", () => {
    expect([0, 59, 3599, 3661, 360001].map(formatLoggedTime)).toEqual(["00:00:00", "00:00:59", "00:59:59", "01:01:01", "100:00:01"]);
  });
  it("clamps the date marker for past and future periods", () => {
    expect(budgetUsage(100, 5, period.start, period.end, new Date("2026-01-01")).periodPercent).toBe(0);
    expect(budgetUsage(100, 5, period.start, period.end, new Date("2027-01-01")).periodPercent).toBe(100);
  });
});
