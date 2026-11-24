import { describe, expect, it } from "vitest";
import { InMemoryFriendLookupLimiter } from "@/backend/services/friend-rate-limit";

describe("friend invite token lookup limiter", () => {
  it("allows ten lookups per hour and returns a retry window", () => {
    const limiter = new InMemoryFriendLookupLimiter(10, 60 * 60_000);
    for (let index = 0; index < 10; index += 1) expect(limiter.check("user-a", 1_000).allowed).toBe(true);
    expect(limiter.check("user-a", 1_000)).toMatchObject({ allowed: false, retryAfterSeconds: 3600 });
    expect(limiter.check("user-b", 1_000).allowed).toBe(true);
    expect(limiter.check("user-a", 3_601_001).allowed).toBe(true);
  });
});
