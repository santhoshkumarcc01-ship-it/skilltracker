import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { assertCsrf } from "@/backend/lib/csrf";
import { withZodValidation } from "@/backend/lib/validation";
import { requireUser } from "@/backend/middleware/require-user";
import { setFriendPrivacy } from "@/backend/services/friend-service";
import { friendPrivacySchema } from "@/backend/validators/game";
const validate = withZodValidation(friendPrivacySchema);
export async function PATCH(request: NextRequest) { try { assertCsrf(request); const user = await requireUser(request); return dataResponse(await setFriendPrivacy(user.id, await validate(request))); } catch (error) { return apiErrorResponse(error); } }

