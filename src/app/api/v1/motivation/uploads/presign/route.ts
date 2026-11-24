import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { assertCsrf } from "@/backend/lib/csrf";
import { withZodValidation } from "@/backend/lib/validation";
import { requireUser } from "@/backend/middleware/require-user";
import { presignUpload } from "@/backend/services/storage/storage-service";
import { motivationUploadPresignSchema } from "@/backend/validators/memories";

const validate = withZodValidation(motivationUploadPresignSchema);
export async function POST(request: NextRequest) {
  try { assertCsrf(request); const user = await requireUser(request); return dataResponse(await presignUpload(user.id, await validate(request))); }
  catch (error) { return apiErrorResponse(error); }
}

