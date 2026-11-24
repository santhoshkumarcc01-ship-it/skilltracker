import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { assertCsrf } from "@/backend/lib/csrf";
import { withZodValidation } from "@/backend/lib/validation";
import { requireUser } from "@/backend/middleware/require-user";
import { saveMotivationPositions } from "@/backend/services/motivation/motivation-service";
import { bulkNotePositionsSchema } from "@/backend/validators/motivation";

const validate = withZodValidation(bulkNotePositionsSchema);
export async function PATCH(request: NextRequest) {
  try { assertCsrf(request); const user = await requireUser(request); return dataResponse(await saveMotivationPositions(user.id, (await validate(request)).notes)); }
  catch (error) { return apiErrorResponse(error); }
}

