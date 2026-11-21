import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { ApiError } from "@/server/lib/api";

export const CSRF_COOKIE = "habithop_csrf";
export const CSRF_HEADER = "x-csrf-token";

function equalToken(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function assertSameOrigin(request: NextRequest): void {
  const originHeader = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!originHeader || !host) throw new ApiError(403, "CSRF_REJECTED", "Request origin could not be verified.");
  try {
    const origin = new URL(originHeader);
    if (origin.host.toLowerCase() !== host.toLowerCase() || origin.protocol !== new URL(request.url).protocol) {
      throw new ApiError(403, "CSRF_REJECTED", "Request origin could not be verified.");
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(403, "CSRF_REJECTED", "Request origin could not be verified.");
  }
}

export function assertCsrf(request: NextRequest): void {
  assertSameOrigin(request);
  const cookie = request.cookies.get(CSRF_COOKIE)?.value ?? "";
  const header = request.headers.get(CSRF_HEADER) ?? "";
  if (cookie.length < 32 || !equalToken(cookie, header)) {
    throw new ApiError(403, "CSRF_REJECTED", "Request could not be verified. Refresh the page and try again.");
  }
}
