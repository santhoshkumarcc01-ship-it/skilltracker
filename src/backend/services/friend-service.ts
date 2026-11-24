import { ApiError } from "@/backend/lib/api";
import { advanceDuoStreak } from "@/backend/lib/duo-streak";
import { levelForXp, localDateAt, weekStartForLocalDate } from "@/backend/lib/habit-math";
import { assertOwnership } from "@/backend/middleware/ownership";
import { prisma } from "@/backend/lib/prisma";
import { addNotification } from "@/backend/repositories/game-repository";
import { blockUser, findUserByFriendToken, friendIsMember, invitesFor, listFriendIds, respondInvite, sendFriendInvite, unblockUser } from "@/backend/repositories/friend-repository";
import { friendLookupLimiter } from "@/backend/services/friend-rate-limit";

const genericInvite = { message: "If the code matches an eligible account, an invite has been sent." };
export async function inviteByToken(userId: string, token: string) {
  assertOwnership(userId, userId);
  const limit = friendLookupLimiter.check(userId);
  if (!limit.allowed) throw new ApiError(429, "INVITE_RATE_LIMITED", genericInvite.message, { "Retry-After": String(limit.retryAfterSeconds) });
  const target = await findUserByFriendToken(token.toUpperCase());
  if (target && target.userId !== userId) {
    await sendFriendInvite(userId, target.userId);
    const invite = await prisma.friendInvite.findFirst({ where: { senderId: userId, receiverId: target.userId, status: "PENDING" }, select: { id: true } });
    if (invite) await addNotification(target.userId, { type: "friend-invite", title: "A new friend invite", message: "Someone would like to hop together.", dedupeKey: `invite:${invite.id}` });
  }
  return genericInvite;
}
export async function getInvites(userId: string) { assertOwnership(userId, userId); return { invites: await invitesFor(userId) }; }
export async function respondToInvite(userId: string, id: string, response: "ACCEPTED" | "DECLINED" | "CANCELED") {
  assertOwnership(userId, userId);
  const result = await respondInvite(userId, id, response);
  if (!result) throw new ApiError(404, "INVITE_NOT_FOUND", "Invite not found.");
  if (response === "ACCEPTED") {
    await addNotification(result.senderId, { type: "friend-invite", title: "Friend invite accepted", message: "Your friend is ready to hop together." });
    await prisma.duoStreak.upsert({ where: { userAId_userBId: { userAId: result.senderId < result.receiverId ? result.senderId : result.receiverId, userBId: result.senderId < result.receiverId ? result.receiverId : result.senderId } }, create: { userAId: result.senderId < result.receiverId ? result.senderId : result.receiverId, userBId: result.senderId < result.receiverId ? result.receiverId : result.senderId }, update: {} });
  }
  return { id, status: response };
}
export async function removeFriend(userId: string, friendId: string) { assertOwnership(userId, userId); const membership = await friendIsMember(userId, friendId); if (!membership) throw new ApiError(404, "FRIEND_NOT_FOUND", "Friend not found."); await prisma.friendship.deleteMany({ where: { OR: [{ userId, friendId }, { userId: friendId, friendId: userId }] } }); return { friendId }; }
export async function blockFriend(userId: string, friendId: string) { assertOwnership(userId, userId); if (userId === friendId) throw new ApiError(400, "INVALID_BLOCK", "You can’t block yourself."); if (!(await prisma.user.findUnique({ where: { id: friendId }, select: { id: true } }))) throw new ApiError(404, "USER_NOT_FOUND", "User not found."); await blockUser(userId, friendId); return { blocked: true }; }
export async function unblockFriend(userId: string, friendId: string) { assertOwnership(userId, userId); await unblockUser(userId, friendId); return { blocked: true }; }
export async function getBlockedFriends(userId: string) { assertOwnership(userId, userId); const rows = await prisma.userBlock.findMany({ where: { blockerId: userId }, include: { blocked: { select: { id: true, displayName: true } } } }); return { users: rows.map((row) => row.blocked) }; }
export async function pokeFriend(userId: string, friendId: string) {
  assertOwnership(userId, userId);
  if (!(await friendIsMember(userId, friendId))) throw new ApiError(404, "FRIEND_NOT_FOUND", "Friend not found.");
  const recipient = await prisma.user.findUnique({ where: { id: friendId }, select: { preferences: { select: { reduceFomo: true } } } });
  const now = Date.now(); const key = `${userId}:${friendId}`; const previous = pokeTimes.get(key) ?? 0;
  if (now - previous < 6 * 60 * 60 * 1000) throw new ApiError(429, "POKE_RATE_LIMITED", "You can send another poke in a few hours.", { "Retry-After": String(Math.ceil((6 * 60 * 60 * 1000 - (now - previous)) / 1000)) });
  pokeTimes.set(key, now);
  if (!recipient?.preferences?.reduceFomo) await addNotification(friendId, { type: "friend-poke", title: "A friendly hello", message: "Your friend sent a little wave 👋" });
  return { sent: !recipient?.preferences?.reduceFomo };
}
export async function setFriendPrivacy(userId: string, input: { shareStreak?: boolean; shareXp?: boolean }) { assertOwnership(userId, userId); const profile = await prisma.profile.updateMany({ where: { userId }, data: input }); if (!profile.count) throw new ApiError(404, "PROFILE_NOT_FOUND", "Profile not found."); return prisma.profile.findUniqueOrThrow({ where: { userId }, select: { shareStreak: true, shareXp: true } }); }
export async function createSharedGoal(userId: string, input: { friendId: string; title: string; targetDays: number }) {
  assertOwnership(userId, userId);
  if (!(await friendIsMember(userId, input.friendId))) throw new ApiError(404, "FRIEND_NOT_FOUND", "Friend not found.");
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { timezone: true } });
  return { goal: await prisma.sharedStudyGoal.create({ data: { creatorId: userId, partnerId: input.friendId, title: input.title, targetDays: input.targetDays, startDate: localDateAt(new Date(), profile?.timezone ?? "UTC") } }) };
}
export async function getSharedGoals(userId: string) {
  assertOwnership(userId, userId);
  const rows = await prisma.sharedStudyGoal.findMany({ where: { OR: [{ creatorId: userId }, { partnerId: userId }] }, include: { progress: true, creator: { select: { id: true, displayName: true } }, partner: { select: { id: true, displayName: true } } }, orderBy: { createdAt: "desc" } });
  const active = await Promise.all(rows.map(async (goal) => ({ goal, connected: await friendIsMember(userId, goal.creatorId === userId ? goal.partnerId : goal.creatorId) })));
  return { goals: active.filter(({ connected }) => connected).map(({ goal }) => { const byDate = new Map<string, Set<string>>(); for (const entry of goal.progress) { const set = byDate.get(entry.localDate) ?? new Set<string>(); set.add(entry.userId); byDate.set(entry.localDate, set); } return { id: goal.id, title: goal.title, targetDays: goal.targetDays, completedAt: goal.completedAt, members: [goal.creator, goal.partner], sharedDays: [...byDate.values()].filter((set) => set.size === 2).length, progress: goal.progress }; }) };
}
export async function markSharedGoalProgress(userId: string, goalId: string) {
  assertOwnership(userId, userId);
  const goal = await prisma.sharedStudyGoal.findFirst({ where: { id: goalId, OR: [{ creatorId: userId }, { partnerId: userId }] } });
  if (!goal) throw new ApiError(404, "GOAL_NOT_FOUND", "Shared goal not found.");
  if (!(await friendIsMember(userId, goal.creatorId === userId ? goal.partnerId : goal.creatorId))) throw new ApiError(404, "GOAL_NOT_FOUND", "Shared goal not found.");
  const sharedDate = new Date().toISOString().slice(0, 10);
  await prisma.sharedGoalProgress.upsert({ where: { goalId_userId_localDate: { goalId, userId, localDate: sharedDate } }, create: { goalId, userId, localDate: sharedDate }, update: {} });
  const progress = await prisma.sharedGoalProgress.findMany({ where: { goalId, userId: { in: [goal.creatorId, goal.partnerId] } }, select: { userId: true, localDate: true } });
  const membersByDay = new Map<string, Set<string>>();
  for (const entry of progress) { const members = membersByDay.get(entry.localDate) ?? new Set<string>(); members.add(entry.userId); membersByDay.set(entry.localDate, members); }
  const bothDays = [...membersByDay.values()].filter((members) => members.size === 2);
  const completedAt = bothDays.length >= goal.targetDays ? new Date() : null;
  if (completedAt) await prisma.sharedStudyGoal.updateMany({ where: { id: goalId, completedAt: null }, data: { completedAt } });
  return { marked: true, completed: Boolean(completedAt), sharedDays: bothDays.length, targetDays: goal.targetDays };
}

const pokeTimes = new Map<string, number>();

export async function getDuoStreak(userId: string, friendId: string) {
  assertOwnership(userId, userId);
  if (!(await friendIsMember(userId, friendId))) throw new ApiError(404, "FRIEND_NOT_FOUND", "Friend not found.");
  const [userAId, userBId] = [userId, friendId].sort();
  const streak = await prisma.duoStreak.findUnique({ where: { userAId_userBId: { userAId, userBId } } });
  return { current: streak?.current ?? 0, longest: streak?.longest ?? 0, lastDuoDate: streak?.lastDuoDate ?? null };
}
export async function getFriendCollaboration(userId: string) {
  assertOwnership(userId, userId);
  const ids = await listFriendIds(userId);
  const self = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { profile: { select: { timezone: true, dailyGoal: true, friendToken: true, shareStreak: true, shareXp: true } }, stats: { select: { xp: true } } } });
  const date = new Date().toISOString().slice(0, 10);
  const dayFloor = new Date(`${date}T12:00:00.000Z`); dayFloor.setUTCDate(dayFloor.getUTCDate() - 2);
  const friends = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true, profile: { select: { timezone: true, dailyGoal: true, friendToken: true, shareStreak: true, shareXp: true } }, pet: { select: { species: true, name: true } }, stats: { select: { xp: true, currentStreak: true } }, achievements: { where: { unlockedAt: { gte: new Date(Date.now() - 14 * 86_400_000) } }, select: { key: true, unlockedAt: true } }, dayLogs: { where: { localDate: { gte: dayFloor.toISOString().slice(0, 10) } }, select: { localDate: true, status: true } }, tasks: { where: { completedAt: { not: null } }, select: { localDate: true } } } });
  const result = await Promise.all(friends.map(async (friend) => {
    const timezone = friend.profile?.timezone ?? "UTC"; const today = localDateAt(new Date(), timezone);
    const completed = friend.dayLogs.some((log) => log.localDate === today && log.status === "COMPLETED") && friend.tasks.filter((task) => task.localDate === today).length >= (friend.profile?.dailyGoal ?? 1);
    const duoId = [userId, friend.id].sort();
    const duo = await prisma.duoStreak.findUnique({ where: { userAId_userBId: { userAId: duoId[0]!, userBId: duoId[1]! } } });
    const selfToday = localDateAt(new Date(), self.profile?.timezone ?? "UTC");
    const selfDay = await prisma.dayLog.findFirst({ where: { userId, localDate: selfToday, status: "COMPLETED" } });
    const selfTaskCount = await prisma.task.count({ where: { userId, localDate: selfToday, completedAt: { not: null } } });
    const selfDone = Boolean(selfDay && selfTaskCount >= (self.profile?.dailyGoal ?? 1));
    const duoDate = new Date().toISOString().slice(0, 10);
    const streak = advanceDuoStreak({ current: duo?.current ?? 0, longest: duo?.longest ?? 0, lastDate: duo?.lastDuoDate ?? null }, duoDate, Boolean(selfDone && completed));
    const updated = await prisma.duoStreak.upsert({ where: { userAId_userBId: { userAId: duoId[0]!, userBId: duoId[1]! } }, create: { userAId: duoId[0]!, userBId: duoId[1]!, current: streak.current, longest: streak.longest, lastDuoDate: streak.lastDate }, update: { current: streak.current, longest: streak.longest, lastDuoDate: streak.lastDate } });
    const weekStart = weekStartForLocalDate(localDateAt(new Date(), timezone));
    const weeklyXp = await prisma.weeklyLeague.findFirst({ where: { userId: friend.id, weekStart }, select: { weeklyXp: true } });
    const completedActivity = friend.profile?.shareStreak ? friend.dayLogs.filter((log) => log.status === "COMPLETED").map((log) => ({ id: `done:${friend.id}:${log.localDate}`, friend: friend.displayName, type: "completed-goal", at: log.localDate })) : [];
    const badgeActivity = friend.profile?.shareXp ? friend.achievements.map((achievement) => ({ id: `badge:${achievement.key}:${friend.id}`, friend: friend.displayName, type: "badge", at: achievement.unlockedAt.toISOString(), title: achievement.key })) : [];
    return { id: friend.id, displayName: friend.displayName, profile: friend.profile, pet: friend.pet, level: levelForXp(friend.stats?.xp ?? 0), xp: friend.profile?.shareXp === false ? null : friend.stats?.xp ?? 0, weeklyXp: friend.profile?.shareXp === false ? null : weeklyXp?.weeklyXp ?? 0, currentStreak: friend.profile?.shareStreak === false ? null : friend.stats?.currentStreak ?? 0, finishedToday: friend.profile?.shareStreak === false ? null : completed, duoStreak: updated.current, waitingFor: friend.profile?.shareStreak === false ? null : selfDone && !completed ? friend.displayName : completed && !selfDone ? "you" : null, activity: [...completedActivity, ...badgeActivity] };
  }));
  const pending = await invitesFor(userId);
  const activity = result.flatMap((friend) => friend.activity).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 20);
  return { currentUserId: userId, friendToken: self.profile?.friendToken ?? "", privacy: { shareStreak: self.profile?.shareStreak ?? true, shareXp: self.profile?.shareXp ?? true }, friends: result, invites: pending, activity, leaderboard: [...result].sort((a, b) => (b.weeklyXp ?? 0) - (a.weeklyXp ?? 0)), pollAfterSeconds: 10 };
}
