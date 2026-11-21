import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/server/lib/api";
import { assertCsrf } from "@/server/lib/csrf";
import { withZodValidation } from "@/server/lib/validation";
import { requireUser } from "@/server/middleware/require-user";
import { createSharedGoal, getSharedGoals } from "@/server/services/friend-service";
import { sharedGoalSchema } from "@/server/validators/game";
const validate = withZodValidation(sharedGoalSchema);
export async function GET(request: NextRequest) { try { const user = await requireUser(request); return dataResponse(await getSharedGoals(user.id)); } catch (error) { return apiErrorResponse(error); } }
export async function POST(request: NextRequest) { try { assertCsrf(request); const user = await requireUser(request); return dataResponse(await createSharedGoal(user.id, await validate(request)), 201); } catch (error) { return apiErrorResponse(error); } }

