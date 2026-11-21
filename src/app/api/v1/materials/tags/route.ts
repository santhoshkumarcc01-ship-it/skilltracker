import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/server/lib/api";
import { requireUser } from "@/server/middleware/require-user";
import { getMaterialTags } from "@/server/services/material-service";
export async function GET(request: NextRequest) { try { const user = await requireUser(request); return dataResponse({ tags: await getMaterialTags(user.id) }); } catch (error) { return apiErrorResponse(error); } }

