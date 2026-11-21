import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/server/lib/api";
import { assertCsrf } from "@/server/lib/csrf";
import { withZodValidation } from "@/server/lib/validation";
import { requireUser } from "@/server/middleware/require-user";
import { createMotivationNote, getMotivationBoard } from "@/server/services/motivation/motivation-service";
import { createNoteSchema } from "@/server/validators/motivation";

const validate = withZodValidation(createNoteSchema);
export async function GET(request: NextRequest) {
  try { const user = await requireUser(request); return dataResponse(await getMotivationBoard(user.id)); }
  catch (error) { return apiErrorResponse(error); }
}
export async function POST(request: NextRequest) {
  try { assertCsrf(request); const user = await requireUser(request); return dataResponse({ note: await createMotivationNote(user.id, await validate(request)) }, 201); }
  catch (error) { return apiErrorResponse(error); }
}

