import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { assertCsrf } from "@/backend/lib/csrf";
import { withZodValidation } from "@/backend/lib/validation";
import { requireUser } from "@/backend/middleware/require-user";
import { createSharedGoal, getSharedGoals } from "@/backend/services/friend-service";
import { sharedGoalSchema } from "@/backend/validators/game";
const validate = withZodValidation(sharedGoalSchema);
export async function GET(request: NextRequest) { try { const user = await requireUser(request); return dataResponse(await getSharedGoals(user.id)); } catch (error) { return apiErrorResponse(error); } }
export async function POST(request: NextRequest) { try { assertCsrf(request); const user = await requireUser(request); return dataResponse(await createSharedGoal(user.id, await validate(request)), 201); } catch (error) { return apiErrorResponse(error); } }

