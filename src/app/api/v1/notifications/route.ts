import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { assertCsrf } from "@/backend/lib/csrf";
import { withZodValidation } from "@/backend/lib/validation";
import { requireUser } from "@/backend/middleware/require-user";
import { getNotifications, readNotifications } from "@/backend/services/game-service";
import { notificationReadSchema } from "@/backend/validators/game";
const validate = withZodValidation(notificationReadSchema);
export async function GET(request: NextRequest) { try { const user = await requireUser(request); return dataResponse(await getNotifications(user.id)); } catch (error) { return apiErrorResponse(error); } }
export async function PATCH(request: NextRequest) { try { assertCsrf(request); const user = await requireUser(request); return dataResponse(await readNotifications(user.id, await validate(request))); } catch (error) { return apiErrorResponse(error); } }

