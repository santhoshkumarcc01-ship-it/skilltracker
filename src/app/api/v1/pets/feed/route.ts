import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { assertCsrf } from "@/backend/lib/csrf";
import { withZodValidation } from "@/backend/lib/validation";
import { requireUser } from "@/backend/middleware/require-user";
import { feedUserPet } from "@/backend/services/game-service";
import { emptyActionSchema } from "@/backend/validators/game";
const validate = withZodValidation(emptyActionSchema);
export async function POST(request: NextRequest) { try { assertCsrf(request); const user = await requireUser(request); await validate(request); return dataResponse({ pet: await feedUserPet(user.id) }); } catch (error) { return apiErrorResponse(error); } }

