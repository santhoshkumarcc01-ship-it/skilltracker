import { randomBytes, randomUUID } from "node:crypto";
import { ApiError } from "@/server/lib/api";
import { writeAudit } from "@/server/lib/audit";
import { hashPassword, verifyUserPassword } from "@/server/lib/auth/password";
import { refreshState } from "@/server/lib/auth/refresh-state";
import { toPublicUser, type PublicUser } from "@/server/lib/auth/public-user";
import { createAccessToken, createOpaqueRefreshToken, hashRefreshToken, type SessionTokens } from "@/server/lib/auth/tokens";
import { loginRateLimit, loginRateLimitKey, requestIp } from "@/server/lib/rate-limit";
import { createUserWithProfile, findSessionByRefreshHash, findUserByEmail, isUniqueConstraintError, RefreshRotationConflict, revokeFamily, revokeSession, rotateSession, createSession, type UserWithProfile } from "@/server/repositories/auth-repository";
import type { LoginInput, SignupInput } from "@/server/validators/auth";

const REFRESH_DAYS = 7;
const FRIEND_TOKEN_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const INVALID_CREDENTIALS = () => new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");

export type AuthSession = { user: PublicUser; tokens: SessionTokens };

function newFriendToken(): string {
  const bytes = randomBytes(10);
  return Array.from(bytes, (byte) => FRIEND_TOKEN_ALPHABET[byte & 31]).join("");
}

async function startSession(userId: string, familyId = randomUUID()): Promise<SessionTokens> {
  const refreshToken = createOpaqueRefreshToken();
  const refreshExpiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
  const session = await createSession({ userId, familyId, refreshTokenHash: hashRefreshToken(refreshToken), expiresAt: refreshExpiresAt });
  const accessToken = await createAccessToken(userId, session.id);
  return { accessToken, refreshToken, refreshExpiresAt };
}

export async function signup(input: SignupInput, request: Request): Promise<SessionTokens | null> {
  // Hash before the unique insert so an existing address still pays the password-hash cost.
  const passwordHash = await hashPassword(input.password);
  const ip = requestIp(request);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    let user: UserWithProfile;
    try {
      user = await createUserWithProfile({
        email: input.email,
        displayName: input.displayName,
        passwordHash,
        friendToken: newFriendToken(),
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const target = String(error.meta?.target ?? "").toLowerCase();
      if (target.includes("email")) {
        await writeAudit("signup", { email: input.email, ip, metadata: { outcome: "duplicate" } });
        return null;
      }
      if (attempt === 3) throw error;
      continue;
    }
    await writeAudit("signup", { userId: user.id, email: input.email, ip, metadata: { outcome: "created" } });
    return startSession(user.id);
  }
  throw new Error("Profile token allocation failed");
}

export async function login(input: LoginInput, request: Request): Promise<AuthSession> {
  const ip = requestIp(request);
  const key = loginRateLimitKey(ip, input.email);
  const limit = loginRateLimit.check(key);
  if (limit.locked) {
    await writeAudit("lockout", { email: input.email, ip, metadata: { retryAfterSeconds: limit.retryAfterSeconds } });
    throw new ApiError(429, "RATE_LIMITED", "Invalid email or password", { "Retry-After": String(limit.retryAfterSeconds) });
  }

  const user = await findUserByEmail(input.email);
  const verified = await verifyUserPassword(input.password, user?.passwordHash);
  if (!user || !verified) {
    const result = loginRateLimit.fail(key);
    await writeAudit("login_failure", { userId: user?.id, email: input.email, ip });
    if (result.locked) {
      await writeAudit("lockout", { userId: user?.id, email: input.email, ip, metadata: { retryAfterSeconds: result.retryAfterSeconds } });
      throw new ApiError(429, "RATE_LIMITED", "Invalid email or password", { "Retry-After": String(result.retryAfterSeconds) });
    }
    throw INVALID_CREDENTIALS();
  }

  loginRateLimit.reset(key);
  await writeAudit("login_success", { userId: user.id, email: user.email, ip });
  return { user: toPublicUser(user), tokens: await startSession(user.id) };
}

export async function refresh(refreshToken: string | undefined, request: Request): Promise<AuthSession> {
  if (!refreshToken) throw INVALID_CREDENTIALS();
  const current = await findSessionByRefreshHash(hashRefreshToken(refreshToken));
  if (!current) throw INVALID_CREDENTIALS();
  const ip = requestIp(request);
  const state = refreshState(current.revokedAt, current.expiresAt);
  if (state === "revoked") {
    await revokeFamily(current.familyId);
    await writeAudit("token_reuse", { userId: current.userId, email: current.user.email, ip, metadata: { familyId: current.familyId } });
    throw INVALID_CREDENTIALS();
  }
  if (state === "expired") {
    await revokeSession(current.id);
    throw INVALID_CREDENTIALS();
  }

  const nextRefreshToken = createOpaqueRefreshToken();
  const nextExpiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
  try {
    const nextSession = await rotateSession({
      currentSessionId: current.id,
      userId: current.userId,
      familyId: current.familyId,
      refreshTokenHash: hashRefreshToken(nextRefreshToken),
      expiresAt: nextExpiresAt,
      now: new Date(),
    });
    const accessToken = await createAccessToken(current.userId, nextSession.id);
    return { user: toPublicUser(current.user), tokens: { accessToken, refreshToken: nextRefreshToken, refreshExpiresAt: nextExpiresAt } };
  } catch (error) {
    if (!(error instanceof RefreshRotationConflict)) throw error;
    await revokeFamily(current.familyId);
    await writeAudit("token_reuse", { userId: current.userId, email: current.user.email, ip, metadata: { familyId: current.familyId } });
    throw INVALID_CREDENTIALS();
  }
}

export async function logout(refreshToken: string | undefined, request: Request): Promise<void> {
  const ip = requestIp(request);
  if (!refreshToken) {
    await writeAudit("logout", { ip });
    return;
  }
  const session = await findSessionByRefreshHash(hashRefreshToken(refreshToken));
  if (session) await revokeFamily(session.familyId);
  await writeAudit("logout", { userId: session?.userId, email: session?.user.email, ip });
}
