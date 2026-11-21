import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/server/lib/api";
import { assertCsrf } from "@/server/lib/csrf";
import { withZodValidation } from "@/server/lib/validation";
import { requireUser } from "@/server/middleware/require-user";
import { getMemory, removeMemory, updateMemory } from "@/server/services/memory-service";
import { updateMemorySchema } from "@/server/validators/memories";

const validate = withZodValidation(updateMemorySchema);
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) {
  try { const user = await requireUser(request); const { id } = await context.params; return dataResponse({ memory: await getMemory(user.id, id) }); }
  catch (error) { return apiErrorResponse(error); }
}
export async function PATCH(request: NextRequest, context: Context) {
  try { assertCsrf(request); const user = await requireUser(request); const { id } = await context.params; return dataResponse(await updateMemory(user.id, id, await validate(request))); }
  catch (error) { return apiErrorResponse(error); }
}
export async function DELETE(request: NextRequest, context: Context) {
  try { assertCsrf(request); const user = await requireUser(request); const { id } = await context.params; return dataResponse(await removeMemory(user.id, id)); }
  catch (error) { return apiErrorResponse(error); }
}

