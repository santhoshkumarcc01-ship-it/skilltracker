import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/server/lib/api";
import { assertCsrf } from "@/server/lib/csrf";
import { withZodValidation } from "@/server/lib/validation";
import { requireUser } from "@/server/middleware/require-user";
import { respondToInvite } from "@/server/services/friend-service";
import { inviteActionSchema } from "@/server/validators/game";
const validate = withZodValidation(inviteActionSchema);
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) { try { assertCsrf(request); const user = await requireUser(request); const { id } = await context.params; const { action } = await validate(request); const status = action === "accept" ? "ACCEPTED" : action === "decline" ? "DECLINED" : "CANCELED"; return dataResponse(await respondToInvite(user.id, id, status)); } catch (error) { return apiErrorResponse(error); } }

