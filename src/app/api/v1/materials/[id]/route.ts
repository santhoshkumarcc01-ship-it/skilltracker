import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { assertCsrf } from "@/backend/lib/csrf";
import { withZodValidation } from "@/backend/lib/validation";
import { requireUser } from "@/backend/middleware/require-user";
import { getMaterial, removeMaterial, updateMaterial } from "@/backend/services/material-service";
import { updateMaterialSchema } from "@/backend/validators/materials";
type Context = { params: Promise<{ id: string }> };
const validate = withZodValidation(updateMaterialSchema);
export async function GET(request: NextRequest, context: Context) { try { const user = await requireUser(request); const { id } = await context.params; return dataResponse(await getMaterial(user.id, id)); } catch (error) { return apiErrorResponse(error); } }
export async function PATCH(request: NextRequest, context: Context) { try { assertCsrf(request); const user = await requireUser(request); const { id } = await context.params; return dataResponse(await updateMaterial(user.id, id, await validate(request))); } catch (error) { return apiErrorResponse(error); } }
export async function DELETE(request: NextRequest, context: Context) { try { assertCsrf(request); const user = await requireUser(request); const { id } = await context.params; return dataResponse(await removeMaterial(user.id, id)); } catch (error) { return apiErrorResponse(error); } }

