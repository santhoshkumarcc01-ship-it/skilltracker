import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/server/lib/api";
import { assertCsrf } from "@/server/lib/csrf";
import { withZodValidation } from "@/server/lib/validation";
import { requireUser } from "@/server/middleware/require-user";
import { presignUpload } from "@/server/services/storage/storage-service";
import { motivationUploadPresignSchema } from "@/server/validators/memories";

const validate = withZodValidation(motivationUploadPresignSchema);
export async function POST(request: NextRequest) {
  try { assertCsrf(request); const user = await requireUser(request); return dataResponse(await presignUpload(user.id, await validate(request))); }
  catch (error) { return apiErrorResponse(error); }
}

