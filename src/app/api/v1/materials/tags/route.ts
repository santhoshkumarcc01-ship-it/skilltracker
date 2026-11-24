import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { requireUser } from "@/backend/middleware/require-user";
import { getMaterialTags } from "@/backend/services/material-service";
export async function GET(request: NextRequest) { try { const user = await requireUser(request); return dataResponse({ tags: await getMaterialTags(user.id) }); } catch (error) { return apiErrorResponse(error); } }

