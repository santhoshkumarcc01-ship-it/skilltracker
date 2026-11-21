export interface MotivationWriteLimiter { allow(userId: string, now?: number): boolean }

export class InMemoryMotivationWriteLimiter implements MotivationWriteLimiter {
  private readonly writes = new Map<string, number[]>();
  constructor(private readonly maxWrites = 90, private readonly windowMs = 60_000) {}
  allow(userId: string, now = Date.now()) {
    const recent = (this.writes.get(userId) ?? []).filter((write) => write > now - this.windowMs);
    if (recent.length >= this.maxWrites) { this.writes.set(userId, recent); return false; }
    recent.push(now); this.writes.set(userId, recent); return true;
  }
}

export const motivationWriteLimiter: MotivationWriteLimiter = new InMemoryMotivationWriteLimiter();
