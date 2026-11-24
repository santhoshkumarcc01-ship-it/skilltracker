import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { setAuthCookies } from "@/backend/lib/auth/cookies";
import { assertCsrf } from "@/backend/lib/csrf";
import { withZodValidation } from "@/backend/lib/validation";
import { signup } from "@/backend/services/auth-service";
import { signupSchema } from "@/backend/validators/auth";

const validate = withZodValidation(signupSchema);

export async function POST(request: NextRequest) {
  try {
    assertCsrf(request);
    const input = await validate(request);
    const tokens = await signup(input, request);
    const response = dataResponse({ message: "If your account can be created, it is ready to continue." }, 202);
    if (tokens) setAuthCookies(response, tokens);
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}

