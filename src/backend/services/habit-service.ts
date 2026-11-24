import { ApiError } from "@/backend/lib/api";
import { env } from "@/backend/lib/env";
import { addLocalDays, advanceStreak, applyMissedDay, completionXp, isOnTime, localDateAt, localHourAt, localMidnight, type StreakState } from "@/backend/lib/habit-math";
import { assertOwnership } from "@/backend/middleware/ownership";
import { recordChestOpen, recordTaskGameRewards } from "@/backend/services/game-service";
import { countFriendsCompletedOnDates, friendTimezones, preferences } from "@/backend/repositories/game-repository";
import { calendarRows, claimDailyChest, completeTask, createTask, currentChest, dayStatus, deleteTask, getStats, habitProfile, listTasks, mutateTaskTimer, ownedTask, purchaseStreakFreeze, reorderOwnedTask, saveStreakRollover, updateTask } from "@/backend/repositories/habit-repository";

const COMPLETION_FRACTION = env.TASK_COMPLETION_FRACTION;
export { COMPLETION_FRACTION };

async function userTimezone(userId: string) {
  assertOwnership(userId, userId);
  const profile = await habitProfile(userId);
  if (!profile) throw new ApiError(404, "PROFILE_NOT_FOUND", "Profile not found.");
  try { new Intl.DateTimeFormat("en", { timeZone: profile.timezone }); }
  catch { throw new ApiError(422, "INVALID_TIMEZONE", "Choose a valid timezone in your profile."); }
  return profile.timezone;
}

export async function todayForUser(userId: string, now = new Date()) {
  return localDateAt(now, await userTimezone(userId));
}

async function assertToday(userId: string, requested: string, now = new Date()) {
  const timezone = await userTimezone(userId);
  const today = localDateAt(now, timezone);
  if (requested !== today) throw new ApiError(403, "DATE_LOCKED", "Only today’s tasks can be changed. Past days are read-only and future days are locked.");
  return timezone;
}

export async function getTodayDashboard(userId: string, now = new Date()) {
  const timezone = await userTimezone(userId);
  const today = localDateAt(now, timezone);
  const yesterday = addLocalDays(today, -1);
  const stats = await getStats(userId);
  const lastCompleted = stats.lastCompletedDate;
  if (lastCompleted && lastCompleted < today && lastCompleted < yesterday) {
    const missedDays = await calendarRows(userId, addLocalDays(lastCompleted, 1), yesterday);
    const known = new Map(missedDays.map((day) => [day.localDate, day]));
    let streak: StreakState = { current: stats.currentStreak, longest: stats.longestStreak, lastCompletedDate: stats.lastCompletedDate, lastStreakDate: stats.lastCompletedDate, freezes: stats.streakFreezeCount };
    const updates: { localDate: string; status: string }[] = [];
    for (let date = addLocalDays(lastCompleted, 1); date <= yesterday; date = addLocalDays(date, 1)) {
      const status = known.get(date)?.status;
      if (status === "COMPLETED" || status === "FROZEN") {
        streak = { ...streak, lastStreakDate: date };
        continue;
      }
      const missed = applyMissedDay(streak, date);
      streak = missed.state;
      updates.push({ localDate: date, status: missed.status === "MISSED" && status === "PARTIAL" ? "PARTIAL" : missed.status });
    }
    await saveStreakRollover(userId, updates, streak.current, streak.freezes);
  }
  const [tasks, freshStats, chest, userPreferences, friendDates] = await Promise.all([listTasks(userId, today), getStats(userId), currentChest(userId, today), preferences(userId), friendTimezones(userId)]);
  const friendsFinished = await countFriendsCompletedOnDates(userId, friendDates.map(({ friendId, timezone: friendTimezone }) => ({ friendId, localDate: localDateAt(now, friendTimezone) })));
  const hour = localHourAt(now, timezone);
  const completedCount = tasks.filter((task) => task.completedAt).length;
  return {
    today, timezone, dayEndsAt: localMidnight(addLocalDays(today, 1), timezone).toISOString(), tasks, stats: freshStats,
    streakAtRisk: hour >= 18 && tasks.length > completedCount,
    completedCount,
    progress: tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0,
    completionFraction: COMPLETION_FRACTION,
    chest: chest && chest.chestXp > 0 && !chest.chestClaimedAt ? { xp: chest.chestXp, gems: chest.chestGems, expiresAt: chest.chestExpiresAt?.toISOString() ?? null, expired: !chest.chestExpiresAt || chest.chestExpiresAt <= now } : null,
    reduceFomo: userPreferences.reduceFomo,
    friendsFinished,
  };
}

export async function getTasks(userId: string, requested: string) {
  await assertToday(userId, requested);
  return listTasks(userId, requested);
}

export async function addTask(userId: string, input: { localDate: string; title: string; category: string; scheduledStart: string; plannedMinutes: number }) {
  await assertToday(userId, input.localDate);
  const stats = await getStats(userId);
  if (stats.lastCompletedDate === input.localDate) throw new ApiError(409, "DAY_COMPLETE", "You’ve already completed today’s path.");
  return createTask(userId, input);
}

export async function editTask(userId: string, taskId: string, input: { localDate: string; title?: string; category?: string; scheduledStart?: string; plannedMinutes?: number; position?: number }) {
  await assertToday(userId, input.localDate);
  const task = await ownedTask(userId, taskId);
  if (!task) throw new ApiError(404, "TASK_NOT_FOUND", "Task not found.");
  if (task.localDate !== input.localDate) throw new ApiError(403, "DATE_LOCKED", "Only today’s tasks can be changed.");
  if (task.startedAt && input.position === undefined) throw new ApiError(409, "TASK_STARTED", "A focused task can’t be edited. Pause it or finish it first.");
  if (input.position !== undefined) {
    const reordered = await reorderOwnedTask(userId, taskId, input.localDate, input.position);
    if (!reordered) throw new ApiError(404, "TASK_NOT_FOUND", "Task not found.");
    if (Object.keys(input).length === 2) return reordered;
  }
  const changes = { title: input.title, category: input.category, scheduledStart: input.scheduledStart, plannedMinutes: input.plannedMinutes };
  const updated = await updateTask(userId, taskId, changes);
  if (updated && "error" in updated) throw new ApiError(409, "TASK_COMPLETED", "Completed tasks can’t be changed.");
  return updated;
}

export async function removeTask(userId: string, taskId: string, requested: string) {
  await assertToday(userId, requested);
  const task = await ownedTask(userId, taskId);
  if (!task) throw new ApiError(404, "TASK_NOT_FOUND", "Task not found.");
  if (task.localDate !== requested) throw new ApiError(403, "DATE_LOCKED", "Only today’s tasks can be changed.");
  if (task.completedAt) throw new ApiError(409, "TASK_COMPLETED", "Completed tasks can’t be deleted.");
  await deleteTask(userId, taskId);
}

export async function updateTimer(userId: string, taskId: string, requested: string, action: "start" | "pause" | "resume") {
  await assertToday(userId, requested);
  const task = await ownedTask(userId, taskId);
  if (!task) throw new ApiError(404, "TASK_NOT_FOUND", "Task not found.");
  if (task.localDate !== requested) throw new ApiError(403, "DATE_LOCKED", "Only today’s tasks can be started.");
  if (task.completedAt) throw new ApiError(409, "TASK_COMPLETED", "This task is already complete.");
  const updated = await mutateTaskTimer(userId, taskId, action, new Date());
  return updated;
}

export async function finishTask(userId: string, taskId: string, requested: string) {
  const timezone = await assertToday(userId, requested);
  await getTodayDashboard(userId);
  const task = await ownedTask(userId, taskId);
  if (!task) throw new ApiError(404, "TASK_NOT_FOUND", "Task not found.");
  if (task.localDate !== requested) throw new ApiError(403, "DATE_LOCKED", "Only today’s tasks can be completed.");
  const onTime = task.startedAt ? isOnTime(task.scheduledStart, task.startedAt, timezone) : false;
  const yesterday = addLocalDays(requested, -1);
  const [stats, yesterdayStatus] = await Promise.all([getStats(userId), dayStatus(userId, yesterday)]);
  const streak = advanceStreak({ current: stats.currentStreak, longest: stats.longestStreak, lastCompletedDate: stats.lastCompletedDate, lastStreakDate: yesterdayStatus === "COMPLETED" || yesterdayStatus === "FROZEN" ? yesterday : null, freezes: stats.streakFreezeCount }, requested);
  const result = await completeTask(userId, taskId, new Date(), COMPLETION_FRACTION, completionXp(onTime), streak.current, streak.longest, localMidnight(addLocalDays(requested, 1), timezone));
  if (result.kind === "missing") throw new ApiError(404, "TASK_NOT_FOUND", "Task not found.");
  if (result.kind === "already") throw new ApiError(409, "TASK_COMPLETED", "This task is already complete.");
  if (result.kind === "too_early") throw new ApiError(409, "TIMER_INCOMPLETE", `Keep going for ${result.remainingSeconds} more seconds before completing this task.`);
  const rewards = await recordTaskGameRewards(userId, result.xp);
  return { ...result, ...rewards };
}

export async function openDailyChest(userId: string, requested: string) {
  await assertToday(userId, requested);
  const reward = await claimDailyChest(userId, requested, new Date());
  if (!reward) throw new ApiError(410, "CHEST_EXPIRED", "This daily chest is no longer available. A new one can be earned tomorrow.");
  const game = await recordChestOpen(userId, reward.xp);
  return { ...reward, ...game };
}

export async function getMonthDays(userId: string, month: string) {
  await getTodayDashboard(userId);
  const timezone = await userTimezone(userId);
  const today = localDateAt(new Date(), timezone);
  const from = `${month}-01`;
  const lastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const to = `${month}-${String(lastDay).padStart(2, "0")}`;
  const rows = await calendarRows(userId, from, to);
  const byDate = new Map(rows.map((row) => [row.localDate, { status: row.status.toLowerCase(), xpEarned: row.xpEarned, gemsEarned: row.gemsEarned }]));
  return { month, today, days: Array.from({ length: lastDay }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, "0")}`;
    const details = byDate.get(date);
    const savedStatus = details?.status;
    const historicalStatus = savedStatus === "completed" || savedStatus === "partial" || savedStatus === "frozen" || savedStatus === "missed" ? savedStatus : "missed";
    const status = date === today ? "today" : date > today ? "future" : historicalStatus;
    return { date, status, xpEarned: details?.xpEarned ?? 0, gemsEarned: details?.gemsEarned ?? 0 };
  }) };
}

export async function getStreak(userId: string) {
  await getTodayDashboard(userId);
  return getStats(userId);
}

export async function buyStreakFreeze(userId: string) {
  const result = await purchaseStreakFreeze(userId, 200);
  if (!result) throw new ApiError(409, "NOT_ENOUGH_XP", "You need 200 XP to get a streak freeze.");
  return getStats(userId);
}
