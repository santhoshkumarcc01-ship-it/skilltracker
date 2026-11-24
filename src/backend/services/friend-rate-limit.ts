export interface FriendLookupLimiter { check(userId: string, now?: number): { allowed: boolean; retryAfterSeconds: number } }
export class InMemoryFriendLookupLimiter implements FriendLookupLimiter {
  private readonly attempts = new Map<string, number[]>();
  constructor(private readonly limit = 10, private readonly window = 60 * 60_000) {}
  check(userId: string, now = Date.now()) {
    const active = (this.attempts.get(userId) ?? []).filter((time) => time > now - this.window);
    if (active.length >= this.limit) return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((active[0]! + this.window - now) / 1000)) };
    active.push(now); this.attempts.set(userId, active); return { allowed: true, retryAfterSeconds: 0 };
  }
}
export const friendLookupLimiter: FriendLookupLimiter = new InMemoryFriendLookupLimiter();
