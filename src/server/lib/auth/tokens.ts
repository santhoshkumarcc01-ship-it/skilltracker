import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/server/lib/env";

const ACCESS_SECONDS = 15 * 60;
const REFRESH_SECONDS = 7 * 24 * 60 * 60;
const secret = new TextEncoder().encode(env.JWT_SECRET);

export type SessionTokens = { accessToken: string; refreshToken: string; refreshExpiresAt: Date };
export type AccessClaims = { userId: string; sessionId: string };

export async function createAccessToken(userId: string, sessionId: string): Promise<string> {
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("habithop")
    .setAudience("habithop-web")
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_SECONDS}s`)
    .sign(secret);
}

export function createOpaqueRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(refreshToken: string): string {
  return createHash("sha256").update(refreshToken).digest("hex");
}

export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"], issuer: "habithop", audience: "habithop-web" });
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") return null;
    return { userId: payload.sub, sessionId: payload.sid };
  } catch {
    return null;
  }
}

export const accessTokenMaxAge = ACCESS_SECONDS;
export const refreshTokenMaxAge = REFRESH_SECONDS;
