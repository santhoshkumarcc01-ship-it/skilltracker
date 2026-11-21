import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/server/lib/api";
import { assertCsrf } from "@/server/lib/csrf";
import { withZodValidation } from "@/server/lib/validation";
import { requireUser } from "@/server/middleware/require-user";
import { saveMotivationPositions } from "@/server/services/motivation/motivation-service";
import { bulkNotePositionsSchema } from "@/server/validators/motivation";

const validate = withZodValidation(bulkNotePositionsSchema);
export async function PATCH(request: NextRequest) {
  try { assertCsrf(request); const user = await requireUser(request); return dataResponse(await saveMotivationPositions(user.id, (await validate(request)).notes)); }
  catch (error) { return apiErrorResponse(error); }
}

