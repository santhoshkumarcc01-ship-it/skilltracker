import { createHash } from "node:crypto";

export interface LoginRateLimitAdapter {
  check(key: string, now?: number): { locked: boolean; retryAfterSeconds: number };
  fail(key: string, now?: number): { locked: boolean; retryAfterSeconds: number; count: number };
  reset(key: string): void;
}

type Entry = { failures: number; windowEndsAt: number; lockedUntil: number };
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

export class InMemoryLoginRateLimitAdapter implements LoginRateLimitAdapter {
  private readonly entries = new Map<string, Entry>();

  check(key: string, now = Date.now()) {
    const entry = this.entries.get(key);
    if (!entry) return { locked: false, retryAfterSeconds: 0 };
    if (entry.lockedUntil > now) return { locked: true, retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000) };
    if (entry.windowEndsAt <= now || entry.lockedUntil > 0) this.entries.delete(key);
    return { locked: false, retryAfterSeconds: 0 };
  }

  fail(key: string, now = Date.now()) {
    let entry = this.entries.get(key);
    if (!entry || entry.windowEndsAt <= now || entry.lockedUntil > 0) {
      entry = { failures: 0, windowEndsAt: now + WINDOW_MS, lockedUntil: 0 };
    }
    entry.failures += 1;
    if (entry.failures >= MAX_FAILURES) entry.lockedUntil = now + WINDOW_MS;
    this.entries.set(key, entry);
    return {
      locked: entry.lockedUntil > now,
      retryAfterSeconds: entry.lockedUntil > now ? Math.ceil((entry.lockedUntil - now) / 1000) : 0,
      count: entry.failures,
    };
  }

  reset(key: string) { this.entries.delete(key); }
}

// Replace this adapter with Redis without changing auth-service callers.
export const loginRateLimit: LoginRateLimitAdapter = new InMemoryLoginRateLimitAdapter();

export function loginRateLimitKey(ip: string, email: string): string {
  return createHash("sha256").update(`${ip}\0${email.toLowerCase()}`).digest("hex");
}

export function requestIp(request: Request): string {
  // Configure the deployment proxy to overwrite these headers with the connecting client IP.
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwardedIp = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return forwardedIp || "unknown";
}
