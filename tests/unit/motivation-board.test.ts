import { describe, expect, it } from "vitest";
import { clampBoardPosition, orderByBoardLayer } from "@/lib/motivation/board-math";
import { InMemoryMotivationWriteLimiter } from "@/server/services/motivation/write-limit";

describe("Motivation Corner board rules", () => {
  it("clamps notes to board bounds and supported dimensions", () => {
    expect(clampBoardPosition({ x: 99, y: -4, width: 120, height: 3, rotation: 50, zIndex: 1.6 })).toEqual({ x: 54, y: 0, width: 46, height: 15, rotation: 15, zIndex: 2 });
    expect(clampBoardPosition({ x: Number.NaN, y: 8, width: 24, height: 28, rotation: -9, zIndex: 4 }).x).toBe(0);
  });

  it("orders board notes by z-index with a stable ID tiebreaker", () => {
    expect(orderByBoardLayer([{ id: "c", zIndex: 1 }, { id: "b", zIndex: 5 }, { id: "a", zIndex: 1 }]).map(({ id }) => id)).toEqual(["a", "c", "b"]);
  });

  it("limits writes per user in a sliding time window", () => {
    const limiter = new InMemoryMotivationWriteLimiter(2, 1000);
    expect(limiter.allow("owner", 1000)).toBe(true);
    expect(limiter.allow("owner", 1200)).toBe(true);
    expect(limiter.allow("owner", 1400)).toBe(false);
    expect(limiter.allow("other", 1400)).toBe(true);
    expect(limiter.allow("owner", 2101)).toBe(true);
  });
});
