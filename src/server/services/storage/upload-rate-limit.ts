export interface UploadRateLimitAdapter {
  check(userId: string, now?: number): { allowed: boolean; retryAfterSeconds: number };
}

export class InMemoryUploadRateLimitAdapter implements UploadRateLimitAdapter {
  private readonly calls = new Map<string, number[]>();
  constructor(private readonly maxCalls = 20, private readonly windowMs = 15 * 60_000) {}

  check(userId: string, now = Date.now()) {
    const recent = (this.calls.get(userId) ?? []).filter((timestamp) => timestamp > now - this.windowMs);
    if (recent.length >= this.maxCalls) {
      this.calls.set(userId, recent);
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0]! + this.windowMs - now) / 1000)) };
    }
    recent.push(now);
    this.calls.set(userId, recent);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

// Swap this adapter for Redis when the app runs on multiple instances.
export const uploadRateLimit: UploadRateLimitAdapter = new InMemoryUploadRateLimitAdapter();
