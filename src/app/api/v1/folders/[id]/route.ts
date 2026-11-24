import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { assertCsrf } from "@/backend/lib/csrf";
import { withZodValidation } from "@/backend/lib/validation";
import { requireUser } from "@/backend/middleware/require-user";
import { deleteFolder, updateFolder } from "@/backend/services/material-service";
import { updateFolderSchema } from "@/backend/validators/materials";
type Context = { params: Promise<{ id: string }> };
const validate = withZodValidation(updateFolderSchema);
export async function PATCH(request: NextRequest, context: Context) { try { assertCsrf(request); const user = await requireUser(request); const { id } = await context.params; return dataResponse({ folder: await updateFolder(user.id, id, await validate(request)) }); } catch (error) { return apiErrorResponse(error); } }
export async function DELETE(request: NextRequest, context: Context) { try { assertCsrf(request); const user = await requireUser(request); const { id } = await context.params; return dataResponse(await deleteFolder(user.id, id)); } catch (error) { return apiErrorResponse(error); } }

