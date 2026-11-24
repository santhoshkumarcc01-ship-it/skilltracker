import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { assertCsrf } from "@/backend/lib/csrf";
import { withZodSearchParams, withZodValidation } from "@/backend/lib/validation";
import { requireUser } from "@/backend/middleware/require-user";
import { createMaterial, getMaterials } from "@/backend/services/material-service";
import { createMaterialSchema, materialListSchema } from "@/backend/validators/materials";

const validateCreate = withZodValidation(createMaterialSchema);
const validateQuery = withZodSearchParams(materialListSchema);
export async function GET(request: NextRequest) { try { const user = await requireUser(request); return dataResponse(await getMaterials(user.id, validateQuery(request))); } catch (error) { return apiErrorResponse(error); } }
export async function POST(request: NextRequest) { try { assertCsrf(request); const user = await requireUser(request); return dataResponse(await createMaterial(user.id, await validateCreate(request)), 201); } catch (error) { return apiErrorResponse(error); } }

