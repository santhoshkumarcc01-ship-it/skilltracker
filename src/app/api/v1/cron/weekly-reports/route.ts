import type { NextRequest } from "next/server";
import { apiErrorResponse, ApiError, dataResponse } from "@/server/lib/api";
import { env } from "@/server/lib/env";
import { generatePreviousWeekReports } from "@/server/services/reports/report-service";
import { hasValidCronAuthorization } from "@/server/lib/reports/cron-auth";

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

