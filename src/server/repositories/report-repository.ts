import { prisma } from "@/server/lib/prisma";
import { addLocalDays, localDateAt, localMidnight } from "@/server/lib/habit-math";

export async function listReportUsers() {
  return prisma.profile.findMany({ select: { userId: true, timezone: true } });
}

export async function getReportTimezone(userId: string) {
  return prisma.profile.findUnique({ where: { userId }, select: { timezone: true } });
}

export async function findStoredReport(userId: string, weekStart: string) {
  return prisma.weeklyReport.findUnique({ where: { userId_weekStart: { userId, weekStart } }, select: { data: true, timezone: true, updatedAt: true } });
}

export async function getReportSource(userId: string, weekStart: string, now: Date) {
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { timezone: true, pet: true, user: { select: { displayName: true, stats: { select: { xp: true, longestStreak: true } }, pet: { select: { name: true } } } } } });
  if (!profile) return null;
  const weekEnd = addLocalDays(weekStart, 7);
  const previousDay = addLocalDays(weekStart, -1);
  const from = localMidnight(weekStart, profile.timezone);
  const to = localMidnight(weekEnd, profile.timezone);
  const [tasks, dayLogs, memories, materials, badges, friendships, duoRows, earlierLogs] = await Promise.all([
    prisma.task.findMany({ where: { userId, localDate: { gte: weekStart, lt: weekEnd } }, select: { localDate: true, category: true, plannedMinutes: true, elapsedSeconds: true, completedAt: true, awardedXp: true } }),
    prisma.dayLog.findMany({ where: { userId, localDate: { gte: weekStart, lt: weekEnd } }, select: { localDate: true, status: true, xpEarned: true } }),
    prisma.memory.findMany({ where: { userId, createdAt: { gte: from, lt: to } }, select: { createdAt: true, mood: true } }),
    prisma.material.findMany({ where: { userId, createdAt: { gte: from, lt: to } }, select: { createdAt: true } }),
    prisma.achievement.findMany({ where: { userId, unlockedAt: { gte: from, lt: to } }, select: { key: true, unlockedAt: true } }),
    prisma.friendship.findMany({ where: { OR: [{ userId }, { friendId: userId }] }, select: { userId: true, friendId: true } }),
    prisma.duoStreak.findMany({ where: { OR: [{ userAId: userId }, { userBId: userId }] }, select: { userAId: true, userBId: true, current: true } }),
    prisma.dayLog.findMany({ where: { userId, localDate: { lte: previousDay } }, orderBy: { localDate: "desc" }, take: 400, select: { localDate: true, status: true } }),
  ]);
  let streakBeforeWeek = 0;
  let expectedDate = previousDay;
  for (const log of earlierLogs) {
    if (log.localDate !== expectedDate || (log.status !== "COMPLETED" && log.status !== "FROZEN")) break;
    streakBeforeWeek += 1;
    expectedDate = addLocalDays(expectedDate, -1);
  }
  const friendIds = [...new Set(friendships.map((link) => link.userId === userId ? link.friendId : link.userId))];
  const reciprocal = friendIds.length ? await prisma.friendship.findMany({ where: { userId: { in: friendIds }, friendId: userId }, select: { userId: true } }) : [];
  const acceptedIds = reciprocal.map((row) => row.userId).filter((id) => friendships.some((link) => link.userId === id || link.friendId === id));
  const friends = acceptedIds.length ? await prisma.user.findMany({ where: { id: { in: acceptedIds }, profile: { is: { shareXp: true } } }, select: { id: true, displayName: true, dayLogs: { where: { localDate: { gte: weekStart, lt: weekEnd } }, select: { xpEarned: true } } } }) : [];
  const friendComparison = friends.map((friend) => ({
    displayName: friend.displayName,
    weeklyXp: friend.dayLogs.reduce((sum, log) => sum + log.xpEarned, 0),
  }));
  const duos = duoRows.filter((row) => acceptedIds.includes(row.userAId === userId ? row.userBId : row.userAId));
  const duoFriendIds = [...new Set(duos.map((duo) => duo.userAId === userId ? duo.userBId : duo.userAId))];
  const duoFriends = duoFriendIds.length ? await prisma.user.findMany({ where: { id: { in: duoFriendIds } }, select: { id: true, displayName: true, profile: { select: { timezone: true } } } }) : [];
  const ownToday = localDateAt(now, profile.timezone);
  const duoLogRefs = [
    { userId, localDate: ownToday },
    ...duoFriends.flatMap((friend) => friend.profile ? [{ userId: friend.id, localDate: localDateAt(now, friend.profile.timezone) }] : []),
  ];
  const todayLogs = duoLogRefs.length ? await prisma.dayLog.findMany({ where: { OR: duoLogRefs }, select: { userId: true, localDate: true, status: true } }) : [];
  const todayStatuses = new Map(todayLogs.map((log) => [`${log.userId}:${log.localDate}`, log.status]));
  const friendById = new Map(duoFriends.map((friend) => [friend.id, friend]));
  const duoStreaks = duos.flatMap((duo) => {
    const friendId = duo.userAId === userId ? duo.userBId : duo.userAId;
    const friend = friendById.get(friendId);
    if (!friend?.profile) return [];
    const friendToday = localDateAt(now, friend.profile.timezone);
    return [{ friendName: friend.displayName, current: duo.current, completedToday: todayStatuses.get(`${userId}:${ownToday}`) === "COMPLETED" && todayStatuses.get(`${friendId}:${friendToday}`) === "COMPLETED" }];
  });
  return {
    timezone: profile.timezone, petName: profile.user.pet?.name ?? profile.pet ?? "Your pet", currentXp: profile.user.stats?.xp ?? 0,
    bestStreak: profile.user.stats?.longestStreak ?? 0, streakBeforeWeek, tasks, dayLogs, memories, materials, badges,
    friends: friendComparison, duoStreaks,
  };
}

export async function saveWeeklyReport(userId: string, weekStart: string, timezone: string, data: object) {
  return prisma.weeklyReport.upsert({ where: { userId_weekStart: { userId, weekStart } }, create: { userId, weekStart, timezone, data }, update: { timezone, data } });
}
