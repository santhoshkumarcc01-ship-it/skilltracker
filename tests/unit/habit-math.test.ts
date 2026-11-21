import { describe, expect, it } from "vitest";
import { addLocalDays, advanceStreak, applyMissedDay, completionXp, isOnTime, levelForXp, localDateAt, localHourAt, progressInLevel, xpForLevel } from "@/server/lib/habit-math";

describe("timezone-aware habit calendar math", () => {
  it("uses the profile timezone across UTC midnight and leap day", () => {
    expect(localDateAt(new Date("2024-02-29T23:30:00.000Z"), "Asia/Kolkata")).toBe("2024-03-01");
    expect(localDateAt(new Date("2024-03-10T10:30:00.000Z"), "America/Los_Angeles")).toBe("2024-03-10");
    expect(addLocalDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addLocalDays("2024-02-29", 1)).toBe("2024-03-01");
  });

  it("handles DST spring-forward without skipping the user's local date", () => {
    const before = new Date("2024-03-10T09:59:00.000Z");
    const after = new Date("2024-03-10T10:01:00.000Z");
    expect(localDateAt(before, "America/Los_Angeles")).toBe("2024-03-10");
    expect(localDateAt(after, "America/Los_Angeles")).toBe("2024-03-10");
    expect(localHourAt(after, "America/Los_Angeles")).toBe(3);
  });

  it("awards the on-time bonus using the task owner's wall clock", () => {
    expect(isOnTime("09:30", new Date("2025-05-05T03:00:00.000Z"), "Asia/Kolkata")).toBe(true);
    expect(isOnTime("08:29", new Date("2025-05-05T03:00:00.000Z"), "Asia/Kolkata")).toBe(false);
  });
});

describe("streak and XP rules", () => {
  it("advances consecutive completed days and tracks the longest streak", () => {
    const one = advanceStreak({ current: 2, longest: 4, lastCompletedDate: "2026-02-28", freezes: 0 }, "2026-03-01");
    expect(one).toMatchObject({ current: 3, longest: 4, lastCompletedDate: "2026-03-01" });
    expect(advanceStreak(one, "2026-03-01")).toEqual(one);
  });

  it("consumes one freeze to bridge a missed day and otherwise resets", () => {
    const state = { current: 4, longest: 7, lastCompletedDate: "2026-04-01", freezes: 1 };
    expect(applyMissedDay(state, "2026-04-02")).toEqual({ state: { ...state, freezes: 0, lastStreakDate: "2026-04-02" }, status: "FROZEN" });
    expect(applyMissedDay({ ...state, freezes: 0 }, "2026-04-02")).toEqual({ state: { ...state, current: 0, freezes: 0, lastStreakDate: "2026-04-02" }, status: "MISSED" });
  });

  it("keeps a streak moving across frozen dates but breaks it after an uncovered miss", () => {
    const initial = { current: 4, longest: 7, lastCompletedDate: "2026-04-01", freezes: 2 };
    const first = applyMissedDay(initial, "2026-04-02");
    const second = applyMissedDay(first.state, "2026-04-03");
    expect(first.status).toBe("FROZEN");
    expect(second.status).toBe("FROZEN");
    expect(advanceStreak(second.state, "2026-04-04")).toMatchObject({ current: 5, lastCompletedDate: "2026-04-04" });
    const noFreeze = applyMissedDay({ ...initial, freezes: 0 }, "2026-04-02");
    expect(applyMissedDay(noFreeze.state, "2026-04-03").state.current).toBe(0);
  });

  it("calculates level thresholds and in-level progress", () => {
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(2)).toBe(300);
    expect(levelForXp(299)).toBe(1);
    expect(levelForXp(300)).toBe(2);
    expect(progressInLevel(200)).toEqual({ level: 1, current: 100, needed: 200, percent: 50 });
  });

  it("adds the on-time task bonus to base XP", () => {
    expect(completionXp(false)).toBe(10);
    expect(completionXp(true)).toBe(15);
  });
});
