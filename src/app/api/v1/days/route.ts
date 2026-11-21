import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse, ApiError } from "@/server/lib/api";
import { requireUser } from "@/server/middleware/require-user";
import { getMonthDays } from "@/server/services/habit-service";
import { dayQuerySchema } from "@/server/validators/tasks";
export async function GET(request: NextRequest) {
  try { const user = await requireUser(request); const parsed = dayQuerySchema.safeParse(request.nextUrl.searchParams.get("month")); if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", "A valid month in YYYY-MM format is required."); return dataResponse(await getMonthDays(user.id, parsed.data)); }
  catch (error) { return apiErrorResponse(error); }
}

