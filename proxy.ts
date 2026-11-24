import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { refreshSupabaseSession } from "@/frontend/utils/supabase/middleware";

const publicPages = new Set(["/", "/login", "/signup", "/register"]);
const apiMethods = new Map<string, string[]>([
  ["/api/v1/auth/csrf", ["GET"]],
  ["/api/v1/auth/signup", ["POST"]],
  ["/api/v1/auth/login", ["POST"]],
  ["/api/v1/auth/refresh", ["POST"]],
  ["/api/v1/auth/logout", ["POST"]],
  ["/api/v1/auth/me", ["GET"]],
  ["/api/v1/me", ["GET", "DELETE"]],
  ["/api/v1/me/profile", ["PATCH"]],
  ["/api/v1/me/export", ["GET"]],
  ["/api/v1/tasks", ["GET", "POST"]],
  ["/api/v1/days", ["GET"]],
  ["/api/v1/streak", ["GET", "POST"]],
  ["/api/v1/xp", ["GET"]],
  ["/api/v1/dashboard", ["GET"]],
  ["/api/v1/report", ["GET"]],
  ["/api/v1/notes", ["GET", "POST"]],
  ["/api/v1/notes/positions", ["PATCH"]],
  ["/api/v1/notes/favorites", ["GET", "POST", "DELETE"]],
  ["/api/v1/motivation/uploads/presign", ["POST"]],
  ["/api/v1/cron/weekly-reports", ["GET", "POST"]],
  ["/api/v1/cron/missed-days", ["GET", "POST"]],
  ["/api/v1/pets", ["GET", "PATCH"]],
  ["/api/v1/pets/feed", ["POST"]],
  ["/api/v1/shop", ["GET"]],
  ["/api/v1/preferences", ["GET", "PATCH"]],
  ["/api/v1/notifications", ["GET", "PATCH"]],
  ["/api/v1/achievements", ["GET"]],
  ["/api/v1/league", ["GET"]],
  ["/api/v1/chest/claim", ["POST"]],
  ["/api/v1/friends", ["GET"]],
  ["/api/v1/friends/invites", ["GET", "POST"]],
  ["/api/v1/friends/goals", ["GET", "POST"]],
  ["/api/v1/friends/privacy", ["PATCH"]],
  ["/api/v1/friends/blocks", ["GET"]],
  ["/api/v1/memories", ["GET", "POST"]],
  ["/api/v1/materials", ["GET", "POST"]],
  ["/api/v1/materials/tags", ["GET"]],
  ["/api/v1/materials/uploads/presign", ["POST"]],
  ["/api/v1/folders", ["GET", "POST"]],
  ["/api/v1/tags", ["GET"]],
  ["/api/v1/uploads/presign", ["POST"]],
  ["/api/v1/uploads/confirm", ["POST"]],
]);

function allowedApiMethods(pathname: string): string[] | undefined {
  const fixed = apiMethods.get(pathname);
  if (fixed) return fixed;
  if (/^\/api\/v1\/tasks\/[^/]+$/.test(pathname)) return ["PATCH", "DELETE"];
  if (
    /^\/api\/v1\/tasks\/[^/]+\/start$/.test(pathname) ||
    /^\/api\/v1\/tasks\/[^/]+\/complete$/.test(pathname)
  )
    return ["POST"];
  if (/^\/api\/v1\/shop\/[^/]+\/purchase$/.test(pathname)) return ["POST"];
  if (/^\/api\/v1\/memories\/[^/]+$/.test(pathname)) return ["GET", "PATCH", "DELETE"];
  if (/^\/api\/v1\/materials\/[^/]+$/.test(pathname)) return ["GET", "PATCH", "DELETE"];
  if (/^\/api\/v1\/folders\/[^/]+$/.test(pathname)) return ["PATCH", "DELETE"];
  if (/^\/api\/v1\/friends\/invites\/[^/]+$/.test(pathname)) return ["POST"];
  if (/^\/api\/v1\/friends\/[^/]+\/poke$/.test(pathname)) return ["POST"];
  if (/^\/api\/v1\/friends\/[^/]+$/.test(pathname)) return ["GET", "PATCH", "DELETE"];
  if (/^\/api\/v1\/friends\/goals\/[^/]+\/progress$/.test(pathname)) return ["POST"];
  if (/^\/api\/v1\/notes\/[^/]+$/.test(pathname)) return ["PATCH", "DELETE"];
  return undefined;
}

function isProtectedPage(pathname: string): boolean {
  return !publicPages.has(pathname) && !pathname.startsWith("/api/");
}

async function hasValidAccessCookie(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("habithop_access")?.value;
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
      issuer: "habithop",
      audience: "habithop-web",
    });
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const devConnect = process.env.NODE_ENV === "development" ? " ws: wss:" : "";
  const devEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  let storageConnect = "";
  try {
    if (process.env.S3_ENDPOINT) storageConnect = ` ${new URL(process.env.S3_ENDPOINT).origin}`;
  } catch {
    /* Invalid storage config is reported by the application env loader. */
  }
  let supabaseConnect = "";
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL)
      supabaseConnect = ` ${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin}`;
  } catch {
    /* Invalid Supabase config is reported by its client helper. */
  }
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devEval}`,
    "style-src 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' data: blob: https:${storageConnect}`,
    "font-src 'self' data:",
    `connect-src 'self'${devConnect}${storageConnect}${supabaseConnect}`,
    `frame-src https://www.youtube-nocookie.com https://player.vimeo.com${storageConnect}`,
    `media-src 'self' data: blob:${storageConnect}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set("x-nonce", nonce);
  forwardedHeaders.set("Content-Security-Policy", csp);
  const supabaseResponse = await refreshSupabaseSession(
    request,
    NextResponse.next({ request: { headers: forwardedHeaders } }),
  );
  let response: NextResponse;

  const pathname = request.nextUrl.pathname;
  const apiV1 = pathname === "/api/v1" || pathname.startsWith("/api/v1/");
  const authApi = pathname === "/api/v1/auth" || pathname.startsWith("/api/v1/auth/");
  const cronApi =
    pathname === "/api/v1/cron/weekly-reports" || pathname === "/api/v1/cron/missed-days";
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase());
  const csrfCookie = request.cookies.get("habithop_csrf")?.value ?? "";
  const csrfHeader = request.headers.get("x-csrf-token") ?? "";
  let csrfValid = csrfCookie.length >= 32 && csrfCookie.length === csrfHeader.length;
  if (csrfValid) {
    let difference = 0;
    for (let index = 0; index < csrfCookie.length; index += 1)
      difference |= csrfCookie.charCodeAt(index) ^ csrfHeader.charCodeAt(index);
    csrfValid = difference === 0;
  }
  let sameOrigin = false;
  const originHeader = request.headers.get("origin");
  const host = request.headers.get("host");
  if (originHeader && host) {
    try {
      const origin = new URL(originHeader);
      sameOrigin =
        origin.host.toLowerCase() === host.toLowerCase() &&
        origin.protocol === request.nextUrl.protocol;
    } catch {
      sameOrigin = false;
    }
  }

  const allowedMethods = allowedApiMethods(pathname);
  if (apiV1 && allowedMethods && !allowedMethods.includes(request.method.toUpperCase())) {
    response = NextResponse.json(
      { error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." } },
      { status: 405, headers: { Allow: allowedMethods.join(", "), "Cache-Control": "no-store" } },
    );
  } else if (apiV1 && !cronApi && mutating && (!sameOrigin || !csrfValid)) {
    response = NextResponse.json(
      {
        error: {
          code: "CSRF_REJECTED",
          message: "Request could not be verified. Refresh the page and try again.",
        },
      },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  } else if (apiV1 && !authApi && !cronApi) {
    if (!(await hasValidAccessCookie(request))) {
      response = NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    } else {
      response = NextResponse.next({ request: { headers: forwardedHeaders } });
    }
  } else if (isProtectedPage(pathname) && !(await hasValidAccessCookie(request))) {
    response = NextResponse.redirect(new URL("/login", request.url));
  } else {
    response = supabaseResponse;
  }

  if (response !== supabaseResponse) {
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  }

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (process.env.NODE_ENV === "production")
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
