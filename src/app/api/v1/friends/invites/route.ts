import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { assertCsrf } from "@/backend/lib/csrf";
import { withZodValidation } from "@/backend/lib/validation";
import { requireUser } from "@/backend/middleware/require-user";
import { getInvites, inviteByToken } from "@/backend/services/friend-service";
import { friendInviteSchema } from "@/backend/validators/game";
const validate = withZodValidation(friendInviteSchema);
export async function GET(request: NextRequest) { try { const user = await requireUser(request); return dataResponse(await getInvites(user.id)); } catch (error) { return apiErrorResponse(error); } }
export async function POST(request: NextRequest) { try { assertCsrf(request); const user = await requireUser(request); return dataResponse(await inviteByToken(user.id, (await validate(request)).friendToken), 202); } catch (error) { return apiErrorResponse(error); } }

