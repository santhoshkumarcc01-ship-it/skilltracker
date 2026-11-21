import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/server/lib/api";
import { assertCsrf } from "@/server/lib/csrf";
import { withZodValidation } from "@/server/lib/validation";
import { requireUser } from "@/server/middleware/require-user";
import { confirmUpload } from "@/server/services/storage/storage-service";
import { uploadConfirmSchema } from "@/server/validators/memories";

const validate = withZodValidation(uploadConfirmSchema);
export async function POST(request: NextRequest) {
  try {
    assertCsrf(request);
    const user = await requireUser(request);
    const result = await confirmUpload(user.id, (await validate(request)).key);
    return dataResponse({ file: { id: result.file.id, mimeType: result.file.mimeType, size: result.file.size }, url: result.url, thumbnailUrl: result.thumbnailUrl });
  } catch (error) { return apiErrorResponse(error); }
}

