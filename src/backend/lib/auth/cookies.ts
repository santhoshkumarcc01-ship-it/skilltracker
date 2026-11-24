import type { NextResponse } from "next/server";
import type { SessionTokens } from "@/backend/lib/auth/tokens";
import { accessTokenMaxAge, refreshTokenMaxAge } from "@/backend/lib/auth/tokens";
import { CSRF_COOKIE } from "@/backend/lib/csrf";
import { env } from "@/backend/lib/env";

const secure = env.NODE_ENV === "production";

export function setAuthCookies(response: NextResponse, tokens: SessionTokens): void {
  response.cookies.set("habithop_access", tokens.accessToken, {
    httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: accessTokenMaxAge,
  });
  response.cookies.set("habithop_refresh", tokens.refreshToken, {
    httpOnly: true, secure, sameSite: "lax", path: "/api/v1/auth", maxAge: refreshTokenMaxAge,
    expires: tokens.refreshExpiresAt,
  });
}

export function setCsrfCookie(response: NextResponse, token: string): void {
  response.cookies.set(CSRF_COOKIE, token, { httpOnly: false, secure, sameSite: "lax", path: "/", maxAge: refreshTokenMaxAge });
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set("habithop_access", "", { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 0 });
  response.cookies.set("habithop_refresh", "", { httpOnly: true, secure, sameSite: "lax", path: "/api/v1/auth", maxAge: 0 });
}
