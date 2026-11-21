import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/server/lib/api";
import { assertCsrf } from "@/server/lib/csrf";
import { withZodValidation } from "@/server/lib/validation";
import { requireUser } from "@/server/middleware/require-user";
import { finishTask } from "@/server/services/habit-service";
import { completeTaskSchema } from "@/server/validators/tasks";

const validate = withZodValidation(completeTaskSchema);
type Context = { params: Promise<{ id: string }> };
export async function POST(request: NextRequest, context: Context) {
  try { assertCsrf(request); const user = await requireUser(request); const input = await validate(request); const { id } = await context.params; return dataResponse(await finishTask(user.id, id, input.localDate)); }
  catch (error) { return apiErrorResponse(error); }
}

