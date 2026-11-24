import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { assertCsrf } from "@/backend/lib/csrf";
import { withZodValidation } from "@/backend/lib/validation";
import { requireUser } from "@/backend/middleware/require-user";
import { getPet, savePet } from "@/backend/services/game-service";
import { petUpdateSchema } from "@/backend/validators/game";
const validate = withZodValidation(petUpdateSchema);
export async function GET(request: NextRequest) { try { const user = await requireUser(request); return dataResponse({ pet: await getPet(user.id) }); } catch (error) { return apiErrorResponse(error); } }
export async function PATCH(request: NextRequest) { try { assertCsrf(request); const user = await requireUser(request); return dataResponse({ pet: await savePet(user.id, await validate(request)) }); } catch (error) { return apiErrorResponse(error); } }

