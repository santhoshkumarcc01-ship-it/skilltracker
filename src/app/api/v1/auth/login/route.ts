import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/server/lib/api";
import { setAuthCookies } from "@/server/lib/auth/cookies";
import { assertCsrf } from "@/server/lib/csrf";
import { withZodValidation } from "@/server/lib/validation";
import { login } from "@/server/services/auth-service";
import { loginSchema } from "@/server/validators/auth";

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

