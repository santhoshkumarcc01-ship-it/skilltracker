import type { NextRequest } from "next/server";
import { apiErrorResponse, ApiError, dataResponse } from "@/backend/lib/api";
import { env } from "@/backend/lib/env";
import { generatePreviousWeekReports } from "@/backend/services/reports/report-service";
import { hasValidCronAuthorization } from "@/backend/lib/reports/cron-auth";

async function run(request: NextRequest) {
  try {
    const secret = env.CRON_SECRET ?? env.REPORT_CRON_SECRET;
    if (!hasValidCronAuthorization(request.headers.get("authorization"), secret)) {
      throw new ApiError(401, "CRON_UNAUTHORIZED", "This scheduled task is not authorized.");
    }
    return dataResponse(await generatePreviousWeekReports());
  } catch (error) { return apiErrorResponse(error); }
}

export const GET = run;
export const POST = run;

