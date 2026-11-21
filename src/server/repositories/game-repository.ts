import { Prisma } from "@prisma/client";
import { prisma } from "@/server/lib/prisma";
import { SHOP_ITEMS } from "@/server/lib/shop-catalog";

export async function ensurePet(userId: string, species: string) {
  try { return await prisma.userPet.upsert({ where: { userId }, create: { userId, species }, update: {} }); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return prisma.userPet.findUniqueOrThrow({ where: { userId } });
    throw error;
  }
}
export async function getPet(userId: string) { return prisma.userPet.findUnique({ where: { userId } }); }
export async function updatePet(userId: string, data: { name?: string; species?: string; equippedHat?: string | null; equippedGlasses?: string | null; equippedScarf?: string | null }) {
  return prisma.userPet.update({ where: { userId }, data });
}
export async function petInventory(userId: string) {
  return prisma.userItem.findMany({ where: { userId }, include: { item: true }, orderBy: { purchasedAt: "asc" } });
}
export async function grantBond(userId: string, xp: number) {
  return prisma.$transaction(async (tx) => {
    const pet = await tx.userPet.findUniqueOrThrow({ where: { userId } });
    const newBondXp = pet.bondXp + xp;
    return tx.userPet.update({ where: { userId }, data: { bondXp: { increment: xp }, bondLevel: Math.floor(newBondXp / 100) + 1 } });
  });
}
export async function feedPet(userId: string, cost: number) {
  return prisma.$transaction(async (tx) => {
    await tx.userPet.findUniqueOrThrow({ where: { userId } });
    const charged = await tx.userStats.updateMany({ where: { userId, gems: { gte: cost } }, data: { gems: { decrement: cost } } });
    if (charged.count !== 1) return false;
    const pet = await tx.userPet.findUniqueOrThrow({ where: { userId } });
    const bondXp = pet.bondXp + 20;
    await tx.userPet.update({ where: { userId }, data: { bondXp: { increment: 20 }, bondLevel: Math.floor(bondXp / 100) + 1 } });
    return true;
  });
}
export async function seedShop() {
  for (const item of SHOP_ITEMS) await prisma.shopItem.upsert({ where: { id: item.id }, create: item, update: item });
  return prisma.shopItem.findMany({ orderBy: [{ category: "asc" }, { price: "asc" }] });
}
export async function shopInventory(userId: string) {
  const items = await seedShop();
  const owned = await prisma.userItem.findMany({ where: { userId }, select: { itemId: true } });
  return { items: items.map((item) => ({ ...item, owned: owned.some((entry) => entry.itemId === item.id) })), ownedIds: owned.map((entry) => entry.itemId) };
}
export async function purchaseShopItem(userId: string, itemId: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const item = await tx.shopItem.findUnique({ where: { id: itemId } });
        if (!item) return { kind: "missing" as const };
        if (await tx.userItem.findUnique({ where: { userId_itemId: { userId, itemId } } })) return { kind: "owned" as const };
        const charged = await tx.userStats.updateMany({ where: { userId, gems: { gte: item.price } }, data: { gems: { decrement: item.price } } });
        if (charged.count !== 1) return { kind: "poor" as const };
      await tx.userItem.create({ data: { userId, itemId } });
        return { kind: "purchased" as const, item };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { kind: "owned" as const };
      if (attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") continue;
      throw error;
    }
  }
  throw new Error("Shop purchase could not be serialized.");
}
export async function preferences(userId: string) {
  return prisma.preferences.upsert({ where: { userId }, create: { userId }, update: {} });
}
export async function updatePreferences(userId: string, data: { reduceFomo?: boolean; reduceMotion?: boolean; theme?: "light" | "dark"; soundMuted?: boolean; soundVolume?: number; ambientEnabled?: boolean }) {
  return prisma.preferences.upsert({ where: { userId }, create: { userId, ...data }, update: data });
}
export async function notifications(userId: string, includeFriendWarnings = true) {
  return prisma.notification.findMany({ where: { userId, ...(includeFriendWarnings ? {} : { type: { not: "friend-streak-warning" } }) }, orderBy: { createdAt: "desc" }, take: 25 });
}
export async function unreadNotifications(userId: string, includeFriendWarnings = true) { return prisma.notification.count({ where: { userId, readAt: null, ...(includeFriendWarnings ? {} : { type: { not: "friend-streak-warning" } }) } }); }
export async function unlockedAchievements(userId: string) { return prisma.achievement.findMany({ where: { userId }, orderBy: { unlockedAt: "desc" } }); }
export async function markNotificationRead(userId: string, id?: string) {
  return prisma.notification.updateMany({ where: { userId, readAt: null, ...(id ? { id } : {}) }, data: { readAt: new Date() } });
}
export async function addNotification(userId: string, input: { type: string; title: string; message: string; expiresAt?: Date; dedupeKey?: string }) {
  return prisma.notification.create({ data: { userId, ...input } });
}

export async function badgeContext(userId: string, timezone: string) {
  const [stats, completedTasks, taskCount, completedDays, completedDaysThisWeek, earlyBird, noteTask, existing] = await Promise.all([
    prisma.userStats.upsert({ where: { userId }, create: { userId }, update: {} }),
    prisma.task.count({ where: { userId, completedAt: { not: null } } }),
    prisma.task.count({ where: { userId } }),
    prisma.dayLog.count({ where: { userId, status: "COMPLETED" } }),
    prisma.dayLog.count({ where: { userId, status: "COMPLETED", localDate: { gte: weekStartLocal(timezone), lte: localDateNow(timezone) } } }),
    prisma.task.findFirst({ where: { userId, startedAt: { not: null }, scheduledStart: { lte: "08:59" } } }),
    prisma.task.findFirst({ where: { userId, completedAt: { not: null }, category: { contains: "note", mode: "insensitive" } } }),
    prisma.achievement.findMany({ where: { userId }, select: { key: true } }),
  ]);
  return { streak: stats.currentStreak, completedTasks, taskCount, completedDays, completedDaysThisWeek, earlyBird: Boolean(earlyBird), noteTaker: Boolean(noteTask), existing: existing.map((badge) => badge.key) };
}
function localDateNow(timezone: string) { return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function weekStartLocal(timezone: string) {
  const date = localDateNow(timezone);
  const weekday = new Date(`${date}T12:00:00.000Z`).getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const start = new Date(`${date}T12:00:00.000Z`); start.setUTCDate(start.getUTCDate() + mondayOffset);
  return start.toISOString().slice(0, 10);
}
export async function awardBadges(userId: string, keys: string[], definitions: Record<string, { title: string; description: string }>) {
  if (!keys.length) return [];
  return prisma.$transaction(async (tx) => {
    const inserted = await tx.achievement.createManyAndReturn({ data: keys.map((key) => ({ userId, key })), skipDuplicates: true });
    if (!inserted.length) return [];
    await tx.notification.createMany({ data: inserted.map((badge) => ({ userId, type: "badge", title: `Badge unlocked: ${definitions[badge.key]?.title ?? badge.key}`, message: definitions[badge.key]?.description ?? "You did a great thing!", dedupeKey: `badge:${badge.key}` })), skipDuplicates: true });
    return inserted;
  });
}

export async function ensureLeague(userId: string, weekStart: string, initialLeague: string) {
  return prisma.weeklyLeague.upsert({ where: { userId_weekStart: { userId, weekStart } }, create: { userId, weekStart, league: initialLeague }, update: {} });
}
export async function leagueMember(userId: string, weekStart: string) { return prisma.weeklyLeague.findUnique({ where: { userId_weekStart: { userId, weekStart } } }); }
export async function leagueBoard(weekStart: string, league: string) {
  return prisma.weeklyLeague.findMany({ where: { weekStart, league }, include: { user: { select: { displayName: true, pet: { select: { species: true, name: true } } } } }, orderBy: [{ weeklyXp: "desc" }, { userId: "asc" }] });
}
export async function addWeeklyXp(userId: string, weekStart: string, xp: number) {
  return prisma.weeklyLeague.updateMany({ where: { userId, weekStart }, data: { weeklyXp: { increment: xp } } });
}
export async function leagueCount(weekStart: string, league: string) { return prisma.weeklyLeague.count({ where: { weekStart, league } }); }
export async function previousLeagueRank(userId: string, weekStart: string) {
  const previous = await prisma.weeklyLeague.findFirst({ where: { userId, weekStart }, orderBy: { weekStart: "desc" } });
  if (!previous) return null;
  const board = await leagueBoard(weekStart, previous.league);
  return { previous, rank: board.findIndex((row) => row.userId === userId) + 1, count: board.length };
}

export async function connectByFriendToken(userId: string, friendToken: string) {
  const target = await prisma.profile.findUnique({ where: { friendToken }, select: { userId: true } });
  if (!target) return { kind: "missing" as const };
  if (target.userId === userId) return { kind: "self" as const };
  await prisma.$transaction(async (tx) => {
    await tx.friendship.createMany({ data: [{ userId, friendId: target.userId }, { userId: target.userId, friendId: userId }], skipDuplicates: true });
  });
  return { kind: "connected" as const, friendId: target.userId };
}
export async function friendList(userId: string) {
  return prisma.friendship.findMany({ where: { userId }, include: { friend: { select: { id: true, displayName: true, profile: { select: { friendToken: true, timezone: true } }, pet: { select: { species: true, name: true } } } } }, orderBy: { createdAt: "asc" } });
}
export async function countFriendsCompletedOnDates(userId: string, dates: { friendId: string; localDate: string }[]) {
  if (!dates.length) return 0;
  return prisma.dayLog.count({ where: { status: "COMPLETED", OR: dates.map(({ friendId, localDate }) => ({ userId: friendId, localDate })), user: { friendOf: { some: { userId } } } } });
}
export async function friendTimezones(userId: string) {
  const links = await prisma.friendship.findMany({ where: { userId }, include: { friend: { select: { id: true, profile: { select: { timezone: true } } } } } });
  return links.map(({ friend }) => ({ friendId: friend.id, timezone: friend.profile?.timezone ?? "UTC" }));
}
export async function friendsAtRisk(userId: string) {
  return prisma.friendship.findMany({
    where: { userId },
    include: {
      friend: {
        select: {
          id: true,
          displayName: true,
          profile: { select: { timezone: true } },
          stats: { select: { currentStreak: true, lastCompletedDate: true } },
          tasks: { where: { completedAt: null }, select: { localDate: true }, take: 30 },
        },
      },
    },
  });
}
export async function saveFriendRiskNotifications(userId: string, friendIds: string[], date: string, friendNames: Map<string, string>) {
  if (!friendIds.length) return;
  await prisma.notification.createMany({ data: friendIds.map((id) => ({ userId, type: "friend-streak-warning", title: "A friend could use a little cheer", message: `${friendNames.get(id) ?? "Your friend"} has an activity left today. Send them some encouragement.`, dedupeKey: `friend-risk:${id}:${date}` })), skipDuplicates: true });
}
