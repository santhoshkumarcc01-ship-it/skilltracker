import type { NextRequest } from "next/server";
import { apiErrorResponse, ApiError, dataResponse } from "@/server/lib/api";
import { env } from "@/server/lib/env";
import { hasValidCronAuthorization } from "@/server/lib/reports/cron-auth";
import { listReportUsers } from "@/server/repositories/report-repository";
import { getTodayDashboard } from "@/server/services/habit-service";

async function run(request: NextRequest) {
  try {
    if (!hasValidCronAuthorization(request.headers.get("authorization"), env.CRON_SECRET ?? env.REPORT_CRON_SECRET)) {
      throw new ApiError(401, "CRON_UNAUTHORIZED", "This scheduled task is not authorized.");
    }

    const users = await listReportUsers();
    let processed = 0;
    for (const user of users) {
      await getTodayDashboard(user.userId);
      processed += 1;
    }
    return dataResponse({ processed });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export const GET = run;
export const POST = run;
