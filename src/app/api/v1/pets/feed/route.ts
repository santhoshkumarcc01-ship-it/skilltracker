import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/server/lib/api";
import { assertCsrf } from "@/server/lib/csrf";
import { withZodValidation } from "@/server/lib/validation";
import { requireUser } from "@/server/middleware/require-user";
import { feedUserPet } from "@/server/services/game-service";
import { emptyActionSchema } from "@/server/validators/game";
const validate = withZodValidation(emptyActionSchema);
export async function POST(request: NextRequest) { try { assertCsrf(request); const user = await requireUser(request); await validate(request); return dataResponse({ pet: await feedUserPet(user.id) }); } catch (error) { return apiErrorResponse(error); } }

