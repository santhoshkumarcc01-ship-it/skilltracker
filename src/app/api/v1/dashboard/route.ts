import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { requireUser } from "@/backend/middleware/require-user";
import { getTodayDashboard } from "@/backend/services/habit-service";
export async function GET(request: NextRequest) { try { const user = await requireUser(request); return dataResponse(await getTodayDashboard(user.id)); } catch (error) { return apiErrorResponse(error); } }

