import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse, ApiError } from "@/server/lib/api";
import { assertCsrf } from "@/server/lib/csrf";
import { withZodValidation } from "@/server/lib/validation";
import { requireUser } from "@/server/middleware/require-user";
import { addTask, getTasks } from "@/server/services/habit-service";
import { createTaskSchema, localDateSchema } from "@/server/validators/tasks";

const validate = withZodValidation(createTaskSchema);
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const localDate = request.nextUrl.searchParams.get("localDate");
    const parsed = localDateSchema.safeParse(localDate);
    if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", "A valid localDate is required.");
    return dataResponse({ tasks: await getTasks(user.id, parsed.data) });
  } catch (error) { return apiErrorResponse(error); }
}
export async function POST(request: NextRequest) {
  try { assertCsrf(request); const user = await requireUser(request); return dataResponse({ task: await addTask(user.id, await validate(request)) }, 201); }
  catch (error) { return apiErrorResponse(error); }
}

