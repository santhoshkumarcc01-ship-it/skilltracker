import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { withZodSearchParams } from "@/backend/lib/validation";
import { requireUser } from "@/backend/middleware/require-user";
import { getMemoryTags } from "@/backend/services/memory-service";
import { tagQuerySchema } from "@/backend/validators/memories";

const validate = withZodSearchParams(tagQuerySchema);
export async function GET(request: NextRequest) {
  try { const user = await requireUser(request); return dataResponse({ tags: await getMemoryTags(user.id, validate(request).q) }); }
  catch (error) { return apiErrorResponse(error); }
}

