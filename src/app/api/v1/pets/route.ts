import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/server/lib/api";
import { assertCsrf } from "@/server/lib/csrf";
import { withZodValidation } from "@/server/lib/validation";
import { requireUser } from "@/server/middleware/require-user";
import { getPet, savePet } from "@/server/services/game-service";
import { petUpdateSchema } from "@/server/validators/game";
const validate = withZodValidation(petUpdateSchema);
export async function GET(request: NextRequest) { try { const user = await requireUser(request); return dataResponse({ pet: await getPet(user.id) }); } catch (error) { return apiErrorResponse(error); } }
export async function PATCH(request: NextRequest) { try { assertCsrf(request); const user = await requireUser(request); return dataResponse({ pet: await savePet(user.id, await validate(request)) }); } catch (error) { return apiErrorResponse(error); } }

