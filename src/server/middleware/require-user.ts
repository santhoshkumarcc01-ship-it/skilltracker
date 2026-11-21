import type { NextRequest } from "next/server";
import { ApiError } from "@/server/lib/api";
import { verifyAccessToken } from "@/server/lib/auth/tokens";
import { findActiveSession } from "@/server/repositories/auth-repository";
import { toPublicUser } from "@/server/lib/auth/public-user";

export async function requireUser(request: NextRequest) {
  const accessToken = request.cookies.get("habithop_access")?.value;
  if (!accessToken) throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
  const claims = await verifyAccessToken(accessToken);
  if (!claims) throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
  const session = await findActiveSession(claims.sessionId, claims.userId);
  if (!session) throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return toPublicUser(session.user);
}
