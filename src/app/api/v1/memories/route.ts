import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { assertCsrf } from "@/backend/lib/csrf";
import { withZodSearchParams, withZodValidation } from "@/backend/lib/validation";
import { requireUser } from "@/backend/middleware/require-user";
import { createMemory, getMemories } from "@/backend/services/memory-service";
import { createMemorySchema, memoryListQuerySchema } from "@/backend/validators/memories";

const validateCreate = withZodValidation(createMemorySchema);
const validateQuery = withZodSearchParams(memoryListQuerySchema);
export async function GET(request: NextRequest) {
  try { const user = await requireUser(request); return dataResponse(await getMemories(user.id, validateQuery(request))); }
  catch (error) { return apiErrorResponse(error); }
}
export async function POST(request: NextRequest) {
  try { assertCsrf(request); const user = await requireUser(request); return dataResponse(await createMemory(user.id, await validateCreate(request)), 201); }
  catch (error) { return apiErrorResponse(error); }
}

