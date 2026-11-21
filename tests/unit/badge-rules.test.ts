import { describe, expect, it } from "vitest";
import { evaluateBadgeRules } from "@/server/lib/badge-rules";

describe("achievement rules", () => {
  it("unlocks activity, streak and collection milestones", () => {
    expect(evaluateBadgeRules({ streak: 7, completedTasks: 1, taskCount: 12, completedDays: 10, completedDaysThisWeek: 7, earlyBird: true, noteTaker: true })).toEqual([
      "first-task", "streak-3", "streak-7", "memory-maker", "perfect-week", "early-bird", "note-taker",
    ]);
  });

  it("does not award milestones before their conditions are met", () => {
    expect(evaluateBadgeRules({ streak: 0, completedTasks: 0, taskCount: 0, completedDays: 0, completedDaysThisWeek: 0, earlyBird: false })).toEqual([]);
  });

  it("unlocks the note taker badge after saving a library note", () => {
    expect(evaluateBadgeRules({ streak: 0, completedTasks: 0, taskCount: 0, completedDays: 0, completedDaysThisWeek: 0, earlyBird: false, materialCreated: true })).toContain("note-taker");
  });
});
