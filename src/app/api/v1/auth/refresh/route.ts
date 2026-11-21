import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/server/lib/api";
import { setAuthCookies, clearAuthCookies } from "@/server/lib/auth/cookies";
import { assertCsrf } from "@/server/lib/csrf";
import { refresh } from "@/server/services/auth-service";

export async function POST(request: NextRequest) {
  try {
    assertCsrf(request);
    const result = await refresh(request.cookies.get("habithop_refresh")?.value, request);
    const response = dataResponse({ user: result.user });
    setAuthCookies(response, result.tokens);
    return response;
  } catch (error) {
    const response = apiErrorResponse(error);
    if (response.status === 401) clearAuthCookies(response);
    return response;
  }
}

