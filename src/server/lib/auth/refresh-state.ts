export type RefreshState = "active" | "expired" | "revoked";

export function refreshState(revokedAt: Date | null, expiresAt: Date, now = Date.now()): RefreshState {
  if (revokedAt) return "revoked";
  if (expiresAt.getTime() <= now) return "expired";
  return "active";
}
