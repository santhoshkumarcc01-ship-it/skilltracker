import { describe, expect, it } from "vitest";
import { InMemoryLoginRateLimitAdapter, loginRateLimitKey } from "@/server/lib/rate-limit";

describe("login rate-limit adapter", () => {
  it("locks the IP and normalized email pair after five failures for fifteen minutes", () => {
    const adapter = new InMemoryLoginRateLimitAdapter();
    const key = loginRateLimitKey("203.0.113.1", "Person@example.com");
    expect(loginRateLimitKey("203.0.113.1", "person@example.com")).toBe(key);
    for (let attempt = 1; attempt < 5; attempt += 1) expect(adapter.fail(key, 10_000).locked).toBe(false);
    expect(adapter.fail(key, 10_000)).toMatchObject({ locked: true, retryAfterSeconds: 900, count: 5 });
    expect(adapter.check(key, 10_001).locked).toBe(true);
    expect(adapter.check(key, 910_000).locked).toBe(false);
  });

  it("clears failures after a successful login", () => {
    const adapter = new InMemoryLoginRateLimitAdapter();
    adapter.fail("test", 0);
    adapter.reset("test");
    expect(adapter.check("test", 1).locked).toBe(false);
    expect(adapter.fail("test", 1).count).toBe(1);
  });
});
