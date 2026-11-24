import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { clearAuthCookies } from "@/backend/lib/auth/cookies";
import { assertCsrf } from "@/backend/lib/csrf";
import { logout } from "@/backend/services/auth-service";

export async function POST(request: NextRequest) {
  try {
    assertCsrf(request);
    await logout(request.cookies.get("habithop_refresh")?.value, request);
    const response = dataResponse({ ok: true });
    clearAuthCookies(response);
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}

