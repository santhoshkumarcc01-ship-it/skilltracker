import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse, ApiError } from "@/backend/lib/api";
import { assertCsrf } from "@/backend/lib/csrf";
import { withZodValidation } from "@/backend/lib/validation";
import { requireUser } from "@/backend/middleware/require-user";
import { updateTimer } from "@/backend/services/habit-service";
import { startTaskSchema } from "@/backend/validators/tasks";

const validate = withZodValidation(startTaskSchema);
type Context = { params: Promise<{ id: string }> };
export async function POST(request: NextRequest, context: Context) {
  try { assertCsrf(request); const user = await requireUser(request); const input = await validate(request); const { id } = await context.params; const task = await updateTimer(user.id, id, input.localDate, input.action); if (!task) throw new ApiError(404, "TASK_NOT_FOUND", "Task not found."); return dataResponse({ task }); }
  catch (error) { return apiErrorResponse(error); }
}

