import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { requireUser } from "@/backend/middleware/require-user";
import { withZodSearchParams } from "@/backend/lib/validation";
import { reportWeekQuery } from "@/backend/validators/reports";
import { getWeeklyReport } from "@/backend/services/reports/report-service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const query = withZodSearchParams(reportWeekQuery)(request);
    return dataResponse(await getWeeklyReport(user.id, query.week));
  } catch (error) { return apiErrorResponse(error); }
}

