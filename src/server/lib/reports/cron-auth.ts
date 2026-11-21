import { timingSafeEqual } from "node:crypto";

export function hasValidCronAuthorization(authorization: string | null, secret?: string): boolean {
  if (!secret || !authorization?.startsWith("Bearer ")) return false;
  const supplied = authorization.slice(7);
  if (supplied.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(secret));
}
