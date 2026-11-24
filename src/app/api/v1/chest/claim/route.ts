import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { assertCsrf } from "@/backend/lib/csrf";
import { withZodValidation } from "@/backend/lib/validation";
import { requireUser } from "@/backend/middleware/require-user";
import { openDailyChest } from "@/backend/services/habit-service";
import { completeTaskSchema } from "@/backend/validators/tasks";
const validate = withZodValidation(completeTaskSchema);
export async function POST(request: NextRequest) { try { assertCsrf(request); const user = await requireUser(request); const input = await validate(request); return dataResponse(await openDailyChest(user.id, input.localDate)); } catch (error) { return apiErrorResponse(error); } }

