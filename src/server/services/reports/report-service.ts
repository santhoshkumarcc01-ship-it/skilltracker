import { ApiError } from "@/server/lib/api";
import { addLocalDays, localDateAt, weekStartForLocalDate } from "@/server/lib/habit-math";
import { findStoredReport, getReportSource, getReportTimezone, listReportUsers, saveWeeklyReport } from "@/server/repositories/report-repository";
import { buildWeeklyReport } from "./report-math";

export async function getWeeklyReport(userId: string, requestedWeek?: string, now = new Date()) {
  const profile = await getReportTimezone(userId);
  if (!profile) throw new ApiError(404, "PROFILE_NOT_FOUND", "Your report is not available yet.");
  const currentWeek = weekStartForLocalDate(localDateAt(now, profile.timezone));
  requestedWeek ??= currentWeek;
  if (requestedWeek > currentWeek) throw new ApiError(400, "FUTURE_REPORT", "That week has not happened yet.");
  const cached = await findStoredReport(userId, requestedWeek);
  if (cached && requestedWeek < currentWeek && typeof cached.data === "object" && cached.data !== null) {
    return { ...cached.data, currentWeek };
  }
  const source = await getReportSource(userId, requestedWeek, now);
  if (!source) throw new ApiError(404, "PROFILE_NOT_FOUND", "Your report is not available yet.");
  const report = buildWeeklyReport({ userId, weekStart: requestedWeek, today: localDateAt(now, source.timezone), ...source });
  await saveWeeklyReport(userId, requestedWeek, source.timezone, report);
  return report;
}

export async function generatePreviousWeekReports(now = new Date()) {
  const users = await listReportUsers();
  let generated = 0;
  for (const profile of users) {
    const thisWeek = weekStartForLocalDate(localDateAt(now, profile.timezone));
    const previousWeek = addLocalDays(thisWeek, -7);
    await getWeeklyReport(profile.userId, previousWeek, now);
    generated += 1;
  }
  return { generated };
}
