import { Prisma } from "@prisma/client";
import { prisma } from "@/server/lib/prisma";

export async function habitProfile(userId: string) {
  return prisma.profile.findUnique({ where: { userId }, select: { userId: true, timezone: true, dailyGoal: true, pet: true } });
}

export async function getStats(userId: string) {
  return prisma.userStats.upsert({ where: { userId }, create: { userId }, update: {} });
}

export async function purchaseStreakFreeze(userId: string, cost: number): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    await tx.userStats.upsert({ where: { userId }, create: { userId }, update: {} });
    const purchased = await tx.userStats.updateMany({ where: { userId, xp: { gte: cost } }, data: { xp: { decrement: cost }, streakFreezeCount: { increment: 1 } } });
    return purchased.count === 1;
  });
}

export async function listTasks(userId: string, localDate: string) {
  return prisma.task.findMany({ where: { userId, localDate }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
}

export async function createTask(userId: string, input: { localDate: string; title: string; category: string; scheduledStart: string; plannedMinutes: number }) {
  return prisma.$transaction(async (tx) => {
    const count = await tx.task.count({ where: { userId, localDate: input.localDate } });
    await tx.dayLog.upsert({ where: { userId_localDate: { userId, localDate: input.localDate } }, create: { userId, localDate: input.localDate, status: "PLANNED" }, update: {} });
    return tx.task.create({ data: { ...input, userId, position: count } });
  });
}

export async function ownedTask(userId: string, taskId: string) {
  return prisma.task.findFirst({ where: { id: taskId, userId } });
}

export async function updateTask(userId: string, taskId: string, data: { title?: string; category?: string; scheduledStart?: string; plannedMinutes?: number; position?: number }) {
  const task = await ownedTask(userId, taskId);
  if (!task) return null;
  if (task.completedAt) return { error: "completed" as const };
  return prisma.task.update({ where: { id: task.id }, data });
}

export async function reorderOwnedTask(userId: string, taskId: string, localDate: string, position: number) {
  return prisma.$transaction(async (tx) => {
    const tasks = await tx.task.findMany({ where: { userId, localDate }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
    const from = tasks.findIndex((task) => task.id === taskId);
    if (from < 0) return null;
    const [selected] = tasks.splice(from, 1);
    tasks.splice(Math.min(position, tasks.length), 0, selected!);
    await Promise.all(tasks.map((task, index) => tx.task.update({ where: { id: task.id }, data: { position: index } })));
    return tx.task.findUnique({ where: { id: taskId } });
  });
}

export async function deleteTask(userId: string, taskId: string) {
  const task = await ownedTask(userId, taskId);
  if (!task) return false;
  await prisma.task.delete({ where: { id: taskId } });
  return true;
}

export async function mutateTaskTimer(userId: string, taskId: string, action: "start" | "pause" | "resume", now: Date) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.task.findFirst({ where: { id: taskId, userId } });
    if (!task || task.completedAt) return null;
    if (action === "start" && !task.startedAt) return tx.task.update({ where: { id: task.id }, data: { startedAt: now, timerRunningSince: now } });
    if (action === "resume" && task.startedAt && !task.timerRunningSince) return tx.task.update({ where: { id: task.id }, data: { timerRunningSince: now } });
    if (action === "pause" && task.timerRunningSince) {
      const elapsed = Math.max(0, Math.floor((now.getTime() - task.timerRunningSince.getTime()) / 1000));
      return tx.task.update({ where: { id: task.id }, data: { elapsedSeconds: task.elapsedSeconds + elapsed, timerRunningSince: null } });
    }
    return task;
  });
}

export async function completeTask(userId: string, taskId: string, now: Date, completionFraction: number, taskXp: number, currentStreak: number, longestStreak: number, chestExpiresAt: Date) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
    const task = await tx.task.findFirst({ where: { id: taskId, userId } });
    if (!task) return { kind: "missing" as const };
    if (task.completedAt) return { kind: "already" as const, task };
    const runningSeconds = task.timerRunningSince ? Math.max(0, Math.floor((now.getTime() - task.timerRunningSince.getTime()) / 1000)) : 0;
    const elapsed = task.elapsedSeconds + runningSeconds;
    const required = Math.ceil(task.plannedMinutes * 60 * completionFraction);
    if (!task.startedAt || elapsed < required) return { kind: "too_early" as const, remainingSeconds: Math.max(0, required - elapsed) };
    const award = taskXp;
    const claimed = await tx.task.updateMany({ where: { id: task.id, userId, completedAt: null }, data: { completedAt: now, elapsedSeconds: elapsed, timerRunningSince: null, awardedXp: award } });
    if (claimed.count !== 1) return { kind: "already" as const, task };
    const updated = await tx.task.findUniqueOrThrow({ where: { id: task.id } });
    await tx.userStats.upsert({ where: { userId }, create: { userId, xp: award }, update: { xp: { increment: award } } });
    await tx.dayLog.updateMany({ where: { userId, localDate: task.localDate, status: { not: "COMPLETED" } }, data: { status: "PARTIAL", xpEarned: { increment: award } } });
    const remaining = await tx.task.count({ where: { userId, localDate: task.localDate, completedAt: null } });
    if (remaining === 0) {
      const chestXp = 15;
      const gems = 5 + Math.floor(Math.random() * 11);
      const chestAwarded = await tx.dayLog.updateMany({ where: { userId, localDate: task.localDate, status: { not: "COMPLETED" } }, data: { status: "COMPLETED", chestXp, chestGems: gems, chestExpiresAt } });
      if (chestAwarded.count === 1) {
        await tx.userStats.update({ where: { userId }, data: { currentStreak, longestStreak, lastCompletedDate: task.localDate } });
        return { kind: "completed" as const, task: updated, xp: award, chest: { xp: chestXp, gems, expiresAt: chestExpiresAt.toISOString() }, dayComplete: true };
      }
      return { kind: "completed" as const, task: updated, xp: award, chest: null, dayComplete: true };
    }
    return { kind: "completed" as const, task: updated, xp: award, chest: null, dayComplete: false };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt === 2 || !(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034")) throw error;
    }
  }
  throw new Error("Task completion transaction could not be serialized.");
}

export async function calendarRows(userId: string, from: string, to: string) {
  return prisma.dayLog.findMany({ where: { userId, localDate: { gte: from, lte: to } }, orderBy: { localDate: "asc" } });
}

export async function dayStatus(userId: string, localDate: string) {
  const log = await prisma.dayLog.findUnique({ where: { userId_localDate: { userId, localDate } }, select: { status: true } });
  return log?.status ?? null;
}

export async function currentChest(userId: string, localDate: string) {
  return prisma.dayLog.findUnique({ where: { userId_localDate: { userId, localDate } }, select: { chestXp: true, chestGems: true, chestExpiresAt: true, chestClaimedAt: true } });
}

export async function claimDailyChest(userId: string, localDate: string, now: Date) {
  return prisma.$transaction(async (tx) => {
    const log = await tx.dayLog.findUnique({ where: { userId_localDate: { userId, localDate } } });
    if (!log || log.status !== "COMPLETED" || !log.chestExpiresAt || log.chestExpiresAt <= now || log.chestClaimedAt) return null;
    const claimed = await tx.dayLog.updateMany({ where: { id: log.id, chestClaimedAt: null, chestExpiresAt: { gt: now } }, data: { chestClaimedAt: now, xpEarned: { increment: log.chestXp }, gemsEarned: { increment: log.chestGems } } });
    if (claimed.count !== 1) return null;
    await tx.userStats.update({ where: { userId }, data: { xp: { increment: log.chestXp }, gems: { increment: log.chestGems } } });
    return { xp: log.chestXp, gems: log.chestGems, claimedAt: now.toISOString() };
  });
}

export async function saveStreakRollover(userId: string, updates: { localDate: string; status: string }[], currentStreak: number, streakFreezeCount: number) {
  return prisma.$transaction(async (tx) => {
    for (const update of updates) {
      await tx.dayLog.upsert({ where: { userId_localDate: { userId, localDate: update.localDate } }, create: { userId, ...update }, update: { status: update.status } });
    }
    await tx.userStats.update({ where: { userId }, data: { currentStreak, streakFreezeCount } });
  });
}

