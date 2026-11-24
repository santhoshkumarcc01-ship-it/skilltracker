import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { clearAuthCookies } from "@/backend/lib/auth/cookies";
import { assertCsrf } from "@/backend/lib/csrf";
import { requestIp } from "@/backend/lib/rate-limit";
import { deleteAccount } from "@/backend/services/account-service";
import { requireUser } from "@/backend/middleware/require-user";
import { withZodValidation } from "@/backend/lib/validation";
import { deleteAccountSchema } from "@/backend/validators/auth";

const validateDelete = withZodValidation(deleteAccountSchema);

export async function GET(request: NextRequest) {
  try {
    return dataResponse({ user: await requireUser(request) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    assertCsrf(request);
    const user = await requireUser(request);
    const input = await validateDelete(request);
    await deleteAccount(user.id, input.password, requestIp(request));
    const response = dataResponse({ ok: true });
    clearAuthCookies(response);
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}

