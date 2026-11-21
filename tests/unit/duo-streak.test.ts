import { describe, expect, it } from "vitest";
import { advanceDuoStreak } from "@/server/lib/duo-streak";
import { localDateAt } from "@/server/lib/habit-math";

describe("duo streak rules", () => {
  it("does not advance until both friends finish their daily goals", () => {
    const state = { current: 2, longest: 3, lastDate: "2026-11-18" };
    expect(advanceDuoStreak(state, "2026-11-19", false)).toEqual(state);
    expect(advanceDuoStreak(state, "2026-11-19", true)).toEqual({ current: 3, longest: 3, lastDate: "2026-11-19" });
  });
  it("uses each friend’s own local day across timezone boundaries", () => {
    const instant = new Date("2026-11-20T01:30:00.000Z");
    const earlier = localDateAt(instant, "America/Los_Angeles");
    const later = localDateAt(instant, "Asia/Tokyo");
    expect(earlier).not.toBe(later);
    expect(advanceDuoStreak({ current: 0, longest: 0, lastDate: null }, "2026-11-20", true).current).toBe(1);
  });
  it("starts again after a missed paired day", () => {
    expect(advanceDuoStreak({ current: 4, longest: 4, lastDate: "2026-11-17" }, "2026-11-19", true)).toEqual({ current: 1, longest: 4, lastDate: "2026-11-19" });
  });
});
