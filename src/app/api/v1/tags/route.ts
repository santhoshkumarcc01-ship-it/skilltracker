import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/server/lib/api";
import { withZodSearchParams } from "@/server/lib/validation";
import { requireUser } from "@/server/middleware/require-user";
import { getMemoryTags } from "@/server/services/memory-service";
import { tagQuerySchema } from "@/server/validators/memories";

const validate = withZodSearchParams(tagQuerySchema);
export async function GET(request: NextRequest) {
  try { const user = await requireUser(request); return dataResponse({ tags: await getMemoryTags(user.id, validate(request).q) }); }
  catch (error) { return apiErrorResponse(error); }
}

