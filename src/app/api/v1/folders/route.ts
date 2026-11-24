import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { assertCsrf } from "@/backend/lib/csrf";
import { withZodValidation } from "@/backend/lib/validation";
import { requireUser } from "@/backend/middleware/require-user";
import { createFolder, getFolderTree } from "@/backend/services/material-service";
import { createFolderSchema } from "@/backend/validators/materials";
const validate = withZodValidation(createFolderSchema);
export async function GET(request: NextRequest) { try { const user = await requireUser(request); return dataResponse(await getFolderTree(user.id)); } catch (error) { return apiErrorResponse(error); } }
export async function POST(request: NextRequest) { try { assertCsrf(request); const user = await requireUser(request); return dataResponse({ folder: await createFolder(user.id, await validate(request)) }, 201); } catch (error) { return apiErrorResponse(error); } }

