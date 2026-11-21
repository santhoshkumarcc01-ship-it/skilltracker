import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/server/lib/api";
import { assertCsrf } from "@/server/lib/csrf";
import { withZodValidation } from "@/server/lib/validation";
import { requireUser } from "@/server/middleware/require-user";
import { openDailyChest } from "@/server/services/habit-service";
import { completeTaskSchema } from "@/server/validators/tasks";
const validate = withZodValidation(completeTaskSchema);
export async function POST(request: NextRequest) { try { assertCsrf(request); const user = await requireUser(request); const input = await validate(request); return dataResponse(await openDailyChest(user.id, input.localDate)); } catch (error) { return apiErrorResponse(error); } }

