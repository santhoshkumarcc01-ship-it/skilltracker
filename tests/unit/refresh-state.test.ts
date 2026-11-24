import { describe, expect, it } from "vitest";
import { refreshState } from "@/backend/lib/auth/refresh-state";

describe("refresh token state", () => {
  it("distinguishes active, expired, and revoked tokens for rotation and reuse handling", () => {
    const now = 10_000;
    expect(refreshState(null, new Date(now + 1), now)).toBe("active");
    expect(refreshState(null, new Date(now), now)).toBe("expired");
    expect(refreshState(new Date(now - 10), new Date(now + 1), now)).toBe("revoked");
  });
});
