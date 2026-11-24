import type { NextRequest } from "next/server";
import { ApiError } from "@/backend/lib/api";
import { verifyAccessToken } from "@/backend/lib/auth/tokens";
import { findActiveSession } from "@/backend/repositories/auth-repository";
import { toPublicUser } from "@/backend/lib/auth/public-user";

export async function requireUser(request: NextRequest) {
  const accessToken = request.cookies.get("habithop_access")?.value;
  if (!accessToken) throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
  const claims = await verifyAccessToken(accessToken);
  if (!claims) throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
  const session = await findActiveSession(claims.sessionId, claims.userId);
  if (!session) throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return toPublicUser(session.user);
}
