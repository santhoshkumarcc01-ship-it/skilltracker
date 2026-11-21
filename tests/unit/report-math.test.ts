import { describe, expect, it } from "vitest";
import { localDateAt, weekStartForLocalDate } from "@/server/lib/habit-math";
import { buildWeeklyReport } from "@/server/services/reports/report-math";

const base = { userId: "u1", weekStart: "2026-03-02", timezone: "America/New_York", today: "2026-03-04", tasks: [], dayLogs: [], memories: [], materials: [], badges: [], currentXp: 0, bestStreak: 0, petName: "Pip" };

describe("weekly report math", () => {
  it("returns a useful empty partial-week report without NaN values", () => {
    const report = buildWeeklyReport(base);
    expect(report.daily).toHaveLength(3);
    expect(report.completionRate).toBe(0);
    expect(report.bestDay).toBeNull();
    expect(report.tips).toHaveLength(3);
    expect(report.summary).toContain("Pip");
    expect(JSON.stringify(report)).not.toContain("NaN");
  });

  it("calculates completion, focus, categories, XP, levels, moods and badges", () => {
    const report = buildWeeklyReport({ ...base, currentXp: 310, bestStreak: 8,
      tasks: [
        { localDate: "2026-03-02", category: "Reading", plannedMinutes: 20, elapsedSeconds: 1200, completedAt: new Date(), awardedXp: 15 },
        { localDate: "2026-03-03", category: "Reading", plannedMinutes: 30, elapsedSeconds: 900, completedAt: null, awardedXp: 0 },
      ],
      dayLogs: [{ localDate: "2026-03-02", status: "COMPLETED", xpEarned: 20 }, { localDate: "2026-03-03", status: "PARTIAL", xpEarned: 0 }],
      memories: [{ createdAt: new Date("2026-03-02T12:00:00Z"), mood: "😊" }], materials: [{ createdAt: new Date("2026-03-03T12:00:00Z") }], badges: [{ key: "first_task", unlockedAt: new Date("2026-03-02T12:00:00Z") }],
    });
    expect(report.tasks).toEqual({ completed: 1, planned: 2 });
    expect(report.completionRate).toBe(50);
    expect(report.focusMinutes).toBe(35);
    expect(report.xpGained).toBe(20);
    expect(report.level.change).toBe(1);
    expect(report.categories[0]?.name).toBe("Reading");
    expect(report.memoriesAdded).toBe(1);
    expect(report.materialsAdded).toBe(1);
    expect(report.moodTrend).toEqual([{ mood: "😊", count: 1 }]);
    expect(report.badges).toEqual(["first_task"]);
  });

  it("uses local dates across daylight saving transitions and requires Monday weeks", () => {
    expect(localDateAt(new Date("2026-03-09T03:30:00Z"), "America/New_York")).toBe("2026-03-08");
    expect(weekStartForLocalDate("2026-03-08")).toBe("2026-03-02");
    expect(() => buildWeeklyReport({ ...base, weekStart: "2026-03-03" })).toThrow("Monday");
  });
});
