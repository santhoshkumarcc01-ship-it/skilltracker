import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/server/lib/api";
import { assertCsrf } from "@/server/lib/csrf";
import { requireUser } from "@/server/middleware/require-user";
import { buyStreakFreeze, getStreak } from "@/server/services/habit-service";
import { withZodValidation } from "@/server/lib/validation";
import { freezePurchaseSchema } from "@/server/validators/tasks";
const validate = withZodValidation(freezePurchaseSchema);
export async function GET(request: NextRequest) { try { const user = await requireUser(request); return dataResponse({ stats: await getStreak(user.id) }); } catch (error) { return apiErrorResponse(error); } }
export async function POST(request: NextRequest) { try { assertCsrf(request); const user = await requireUser(request); await validate(request); return dataResponse({ stats: await buyStreakFreeze(user.id) }); } catch (error) { return apiErrorResponse(error); } }

