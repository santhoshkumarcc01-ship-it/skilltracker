import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { setAuthCookies } from "@/backend/lib/auth/cookies";
import { assertCsrf } from "@/backend/lib/csrf";
import { withZodValidation } from "@/backend/lib/validation";
import { login } from "@/backend/services/auth-service";
import { loginSchema } from "@/backend/validators/auth";

const validate = withZodValidation(loginSchema);

export async function POST(request: NextRequest) {
  try {
    assertCsrf(request);
    const input = await validate(request);
    const result = await login(input, request);
    const response = dataResponse({ user: result.user });
    setAuthCookies(response, result.tokens);
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}

