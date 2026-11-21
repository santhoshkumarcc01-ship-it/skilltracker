import { addLocalDays, levelForXp, weekStartForLocalDate } from "@/server/lib/habit-math";

export type ReportTask = { localDate: string; category: string; plannedMinutes: number; elapsedSeconds: number; completedAt: Date | null; awardedXp: number };
export type ReportDayLog = { localDate: string; status: string; xpEarned: number };
export type ReportMemory = { createdAt: Date; mood: string | null };
export type ReportBadge = { key: string; unlockedAt: Date };
export type ReportFriend = { displayName: string; weeklyXp: number };
export type WeeklyReportInput = {
  userId: string; weekStart: string; timezone: string; today: string; tasks: ReportTask[]; dayLogs: ReportDayLog[];
  memories: ReportMemory[]; materials: { createdAt: Date }[]; badges: ReportBadge[]; currentXp: number; bestStreak: number;
  streakBeforeWeek?: number;
  petName: string; friends?: ReportFriend[]; duoStreaks?: { friendName: string; current: number; completedToday: boolean }[];
};

export function buildWeeklyReport(input: WeeklyReportInput) {
  if (weekStartForLocalDate(input.weekStart) !== input.weekStart) throw new Error("Week must start on Monday.");
  const days = Array.from({ length: 7 }, (_, index) => addLocalDays(input.weekStart, index));
  const visibleDays = days.filter((day) => day <= input.today);
  const tasks = input.tasks.filter((task) => days.includes(task.localDate));
  const logs = new Map(input.dayLogs.map((log) => [log.localDate, log]));
  const daily = visibleDays.map((date) => {
    const dayTasks = tasks.filter((task) => task.localDate === date);
    const planned = dayTasks.length;
    const completed = dayTasks.filter((task) => task.completedAt !== null).length;
    const focusMinutes = Math.round(dayTasks.reduce((sum, task) => sum + task.elapsedSeconds, 0) / 60);
    return { date, label: new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)), planned, completed, completionRate: planned ? Math.round(completed / planned * 100) : 0, focusMinutes, status: logs.get(date)?.status ?? (date < input.today ? "MISSED" : "PLANNED"), xp: logs.get(date)?.xpEarned ?? 0 };
  });
  const planned = tasks.length;
  const completed = tasks.filter((task) => task.completedAt !== null).length;
  const focusMinutes = Math.round(tasks.reduce((sum, task) => sum + task.elapsedSeconds, 0) / 60);
  const xpGained = daily.reduce((sum, day) => sum + day.xp, 0) || tasks.reduce((sum, task) => sum + task.awardedXp, 0);
  const categories = [...new Set(tasks.map((task) => task.category))].map((category) => {
    const rows = tasks.filter((task) => task.category === category);
    return { name: category, planned: rows.length, completed: rows.filter((task) => task.completedAt).length, focusMinutes: Math.round(rows.reduce((sum, row) => sum + row.elapsedSeconds, 0) / 60) };
  }).sort((a, b) => b.planned - a.planned || a.name.localeCompare(b.name));
  const activeDays = daily.filter((day) => day.planned > 0);
  const bestDay = activeDays.slice().sort((a, b) => b.completionRate - a.completionRate || b.focusMinutes - a.focusMinutes)[0] ?? null;
  const worstDay = activeDays.slice().sort((a, b) => a.completionRate - b.completionRate || a.focusMinutes - b.focusMinutes)[0] ?? null;
  const moodCounts = new Map<string, number>();
  for (const memory of input.memories) if (memory.mood) moodCounts.set(memory.mood, (moodCounts.get(memory.mood) ?? 0) + 1);
  const moods = [...moodCounts].map(([mood, count]) => ({ mood, count })).sort((a, b) => b.count - a.count);
  const levelBefore = levelForXp(Math.max(0, input.currentXp - xpGained));
  const levelAfter = levelForXp(input.currentXp);
  let streakAtEnd = input.streakBeforeWeek ?? 0;
  const streakAtStart = streakAtEnd;
  let bestWeekStreak = 0; let run = 0;
  for (const day of daily) {
    const active = day.status === "COMPLETED" || day.status === "FROZEN";
    if (active) { streakAtEnd += 1; run += 1; bestWeekStreak = Math.max(bestWeekStreak, run); }
    else if (day.date < input.today && day.status !== "PLANNED") { streakAtEnd = 0; run = 0; }
  }
  const tipSeed = Array.from(`${input.userId}${input.weekStart}`).reduce((value, char) => value + char.charCodeAt(0), 0);
  const tipTemplates = [
    `Try scheduling one ${categories[0]?.name ?? "small"} task earlier in the day.`,
    `A short focused session still counts. Aim for ${Math.max(5, Math.min(20, Math.round((focusMinutes || 20) / Math.max(1, visibleDays.length))))} minutes next time.`,
    bestDay ? `Repeat what worked on ${bestDay.label} for another good day.` : "Start with one tiny task to build momentum.",
    moods[0] ? `Your memories leaned ${moods[0].mood}; make a little room for what felt good.` : "Add a mood to a memory to notice how your week feels.",
    planned > completed ? "Break an unfinished task into a smaller first step." : "You followed through this week. Pick one new stretch goal.",
  ];
  const tips = [0, 1, 2].map((offset) => tipTemplates[(tipSeed + offset * 2) % tipTemplates.length]!);
  const summary = planned === 0
    ? `${input.petName} is ready for a fresh week with you. Add one small activity and start from there.`
    : `${input.petName} noticed ${completed} of ${planned} planned activities completed, with ${focusMinutes} focused minutes. ${bestDay ? `${bestDay.label} was your strongest day.` : "Every start is progress."}`;
  return {
    userId: input.userId, weekStart: input.weekStart, weekEnd: days[6], currentWeek: weekStartForLocalDate(input.today), timezone: input.timezone, generatedAt: new Date().toISOString(),
    streak: { start: streakAtStart, end: streakAtEnd, best: input.bestStreak, bestThisWeek: bestWeekStreak },
    completionRate: planned ? Math.round(completed / planned * 100) : 0, focusMinutes, tasks: { completed, planned }, xpGained,
    level: { before: levelBefore, after: levelAfter, change: Math.max(0, levelAfter - levelBefore) },
    bestDay: bestDay ? { date: bestDay.date, label: bestDay.label, completionRate: bestDay.completionRate } : null,
    worstDay: worstDay ? { date: worstDay.date, label: worstDay.label, completionRate: worstDay.completionRate } : null,
    categories, memoriesAdded: input.memories.length, materialsAdded: input.materials.length, moodTrend: moods, daily,
    badges: input.badges.map((badge) => badge.key), friendComparison: input.friends ?? [], duoStreaks: input.duoStreaks ?? [], summary, tips,
  };
}
