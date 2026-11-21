import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/server/lib/api";
import { requireUser } from "@/server/middleware/require-user";
import { withZodSearchParams } from "@/server/lib/validation";
import { reportWeekQuery } from "@/server/validators/reports";
import { getWeeklyReport } from "@/server/services/reports/report-service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const query = withZodSearchParams(reportWeekQuery)(request);
    return dataResponse(await getWeeklyReport(user.id, query.week));
  } catch (error) { return apiErrorResponse(error); }
}

