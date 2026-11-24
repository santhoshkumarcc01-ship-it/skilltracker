import type { NextRequest } from "next/server";
import { ApiError, apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { assertCsrf } from "@/backend/lib/csrf";
import { withZodValidation } from "@/backend/lib/validation";
import { requireUser } from "@/backend/middleware/require-user";
import { removeMotivationNote, updateMotivationNote } from "@/backend/services/motivation/motivation-service";
import { idSchema } from "@/backend/validators/common";
import { updateNoteSchema } from "@/backend/validators/motivation";

const validate = withZodValidation(updateNoteSchema);
function validatedId(value: string) { const parsed = idSchema.safeParse(value); if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", "Please check the board item ID."); return parsed.data; }
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try { assertCsrf(request); const user = await requireUser(request); const { id: rawId } = await context.params; const id = validatedId(rawId); return dataResponse({ note: await updateMotivationNote(user.id, id, await validate(request)) }); }
  catch (error) { return apiErrorResponse(error); }
}
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try { assertCsrf(request); const user = await requireUser(request); const { id } = await context.params; return dataResponse(await removeMotivationNote(user.id, validatedId(id))); }
  catch (error) { return apiErrorResponse(error); }
}

