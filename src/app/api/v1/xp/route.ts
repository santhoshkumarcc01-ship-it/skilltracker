import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { requireUser } from "@/backend/middleware/require-user";
import { progressInLevel } from "@/backend/lib/habit-math";
import { getStats } from "@/backend/repositories/habit-repository";
export async function GET(request: NextRequest) { try { const user = await requireUser(request); const stats = await getStats(user.id); return dataResponse({ ...stats, level: progressInLevel(stats.xp) }); } catch (error) { return apiErrorResponse(error); } }

