import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/server/lib/api";
import { clearAuthCookies } from "@/server/lib/auth/cookies";
import { assertCsrf } from "@/server/lib/csrf";
import { requestIp } from "@/server/lib/rate-limit";
import { deleteAccount } from "@/server/services/account-service";
import { requireUser } from "@/server/middleware/require-user";
import { withZodValidation } from "@/server/lib/validation";
import { deleteAccountSchema } from "@/server/validators/auth";

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

