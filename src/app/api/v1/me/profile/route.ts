import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { assertCsrf } from "@/backend/lib/csrf";
import { withZodValidation } from "@/backend/lib/validation";
import { requireUser } from "@/backend/middleware/require-user";
import { updateProfile } from "@/backend/services/account-service";
import { profileSchema } from "@/backend/validators/auth";

const validate = withZodValidation(profileSchema);

export async function PATCH(request: NextRequest) {
  try {
    assertCsrf(request);
    const user = await requireUser(request);
    const input = await validate(request);
    return dataResponse({ profile: await updateProfile(user.id, input) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

