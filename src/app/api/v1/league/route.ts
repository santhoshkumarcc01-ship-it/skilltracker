import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { requireUser } from "@/backend/middleware/require-user";
import { getLeague } from "@/backend/services/game-service";
export async function GET(request: NextRequest) { try { const user = await requireUser(request); return dataResponse(await getLeague(user.id)); } catch (error) { return apiErrorResponse(error); } }

