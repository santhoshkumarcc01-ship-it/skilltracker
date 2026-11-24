import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse, ApiError } from "@/backend/lib/api";
import { assertCsrf } from "@/backend/lib/csrf";
import { withZodValidation } from "@/backend/lib/validation";
import { requireUser } from "@/backend/middleware/require-user";
import { editTask, removeTask } from "@/backend/services/habit-service";
import { localDateSchema, updateTaskSchema } from "@/backend/validators/tasks";

const validate = withZodValidation(updateTaskSchema);
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, context: Context) {
  try { assertCsrf(request); const user = await requireUser(request); const { id } = await context.params; return dataResponse({ task: await editTask(user.id, id, await validate(request)) }); }
  catch (error) { return apiErrorResponse(error); }
}
export async function DELETE(request: NextRequest, context: Context) {
  try {
    assertCsrf(request); const user = await requireUser(request);
    const { id } = await context.params;
    const localDate = request.nextUrl.searchParams.get("localDate");
    const parsed = localDateSchema.safeParse(localDate);
    if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", "A valid localDate is required.");
    await removeTask(user.id, id, parsed.data);
    return dataResponse({ deleted: true });
  } catch (error) { return apiErrorResponse(error); }
}

