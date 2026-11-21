import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/server/lib/api";
import { assertCsrf } from "@/server/lib/csrf";
import { withZodValidation } from "@/server/lib/validation";
import { requireUser } from "@/server/middleware/require-user";
import { updateProfile } from "@/server/services/account-service";
import { profileSchema } from "@/server/validators/auth";

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

