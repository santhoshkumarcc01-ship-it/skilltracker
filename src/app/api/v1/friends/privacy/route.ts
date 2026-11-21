import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/server/lib/api";
import { assertCsrf } from "@/server/lib/csrf";
import { withZodValidation } from "@/server/lib/validation";
import { requireUser } from "@/server/middleware/require-user";
import { setFriendPrivacy } from "@/server/services/friend-service";
import { friendPrivacySchema } from "@/server/validators/game";
const validate = withZodValidation(friendPrivacySchema);
export async function PATCH(request: NextRequest) { try { assertCsrf(request); const user = await requireUser(request); return dataResponse(await setFriendPrivacy(user.id, await validate(request))); } catch (error) { return apiErrorResponse(error); } }

