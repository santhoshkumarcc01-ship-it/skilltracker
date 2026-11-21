import { ApiError } from "@/server/lib/api";
import { addLocalDays, localDateAt, localHourAt, localMidnight, weekStartForLocalDate } from "@/server/lib/habit-math";
import { BADGES, evaluateBadgeRules, type BadgeContext } from "@/server/lib/badge-rules";
import { SHOP_ITEMS } from "@/server/lib/shop-catalog";
import { assertOwnership } from "@/server/middleware/ownership";
import { addNotification, addWeeklyXp as addWeeklyXpRecord, awardBadges, badgeContext, connectByFriendToken, countFriendsCompletedOnDates, ensureLeague, ensurePet, feedPet, friendList, friendsAtRisk, grantBond, leagueBoard, leagueMember, markNotificationRead, notifications, petInventory, preferences, previousLeagueRank, purchaseShopItem, saveFriendRiskNotifications, shopInventory, unreadNotifications, unlockedAchievements, updatePet, updatePreferences } from "@/server/repositories/game-repository";
import { getStats, habitProfile } from "@/server/repositories/habit-repository";

const petKinds = new Set(["cat", "fox", "panda", "dragon", "axolotl"]);
const leagueOrder = ["BRONZE", "SILVER", "GOLD", "SAPPHIRE", "RUBY", "DIAMOND"];

export async function getPet(userId: string) {
  assertOwnership(userId, userId);
  const profile = await habitProfile(userId);
  const species = profile?.pet && petKinds.has(profile.pet) ? profile.pet : "cat";
  const [pet, inventory] = await Promise.all([ensurePet(userId, species), petInventory(userId)]);
  return { ...pet, inventory: inventory.map(({ item }) => item) };
}

export async function savePet(userId: string, input: { name?: string; species?: string; equippedHat?: string | null; equippedGlasses?: string | null; equippedScarf?: string | null }) {
  await getPet(userId);
  const inventory = await petInventory(userId);
  for (const [field, category] of [["equippedHat", "hat"], ["equippedGlasses", "glasses"], ["equippedScarf", "scarf"]] as const) {
    const itemId = input[field];
    if (itemId && !inventory.some(({ item }) => item.id === itemId && item.category === category)) throw new ApiError(403, "ITEM_NOT_OWNED", "Buy that accessory before equipping it.");
  }
  const pet = await updatePet(userId, input);
  return { ...pet, inventory: inventory.map(({ item }) => item) };
}

export async function feedUserPet(userId: string) {
  await getPet(userId);
  await getStats(userId);
  if (!(await feedPet(userId, 10))) throw new ApiError(409, "NOT_ENOUGH_GEMS", "Feeding your buddy costs 10 gems.");
  return getPet(userId);
}

export async function getShop(userId: string) {
  assertOwnership(userId, userId);
  const [inventory, stats] = await Promise.all([shopInventory(userId), getStats(userId)]);
  return { ...inventory, gems: stats.gems };
}

export async function buyShopItem(userId: string, itemId: string) {
  await getStats(userId);
  const result = await purchaseShopItem(userId, itemId);
  if (result.kind === "missing") throw new ApiError(404, "ITEM_NOT_FOUND", "That shop item is no longer available.");
  if (result.kind === "owned") throw new ApiError(409, "ALREADY_OWNED", "You already have this accessory.");
  if (result.kind === "poor") throw new ApiError(409, "NOT_ENOUGH_GEMS", "You need more gems for that accessory.");
  await addNotification(userId, { type: "purchase", title: "A new look for your buddy", message: `${result.item.name} is ready to equip.` });
  return result.item;
}

export async function getUserPreferences(userId: string) { assertOwnership(userId, userId); return preferences(userId); }
export async function saveUserPreferences(userId: string, input: { reduceFomo?: boolean; reduceMotion?: boolean; theme?: "light" | "dark"; soundMuted?: boolean; soundVolume?: number; ambientEnabled?: boolean }) { assertOwnership(userId, userId); return updatePreferences(userId, input); }

export async function getNotifications(userId: string) {
  const includeFriendWarnings = !(await preferences(userId)).reduceFomo;
  const [items, unreadCount] = await Promise.all([notifications(userId, includeFriendWarnings), unreadNotifications(userId, includeFriendWarnings)]);
  return { items, unreadCount };
}
export async function readNotifications(userId: string, input: { id?: string; readAll?: boolean }) {
  const result = await markNotificationRead(userId, input.id);
  if (input.id && result.count !== 1) throw new ApiError(404, "NOTIFICATION_NOT_FOUND", "Notification not found.");
  return getNotifications(userId);
}

  export async function evaluateAchievements(userId: string, event: "task-complete" | "friend-made" | "chest-open" | "memory-created" | "material-created") {
  const profile = await habitProfile(userId);
  const base = await badgeContext(userId, profile?.timezone ?? "UTC");
    const context: BadgeContext = { ...base, friendMade: event === "friend-made", chestOpened: event === "chest-open", memoryCreated: event === "memory-created", materialCreated: event === "material-created" };
  const candidateKeys = evaluateBadgeRules(context).filter((key) => !base.existing.includes(key));
  const unlocked = await awardBadges(userId, candidateKeys, BADGES);
  return unlocked.map(({ key }) => ({ key, ...BADGES[key as keyof typeof BADGES] }));
}

export async function getAchievements(userId: string) {
  assertOwnership(userId, userId);
  const unlocked = await unlockedAchievements(userId);
  return { badges: Object.entries(BADGES).map(([key, definition]) => ({ key, ...definition, unlockedAt: unlocked.find((badge) => badge.key === key)?.unlockedAt ?? null })) };
}

export async function recordTaskGameRewards(userId: string, xp: number) {
  await getPet(userId);
  const [pet, unlockedBadges] = await Promise.all([grantBond(userId, 5), evaluateAchievements(userId, "task-complete")]);
  await awardWeeklyXp(userId, xp);
  return { pet: { species: pet.species, name: pet.name, bondLevel: pet.bondLevel }, unlockedBadges };
}

export async function recordChestOpen(userId: string, xp: number) {
  const unlockedBadges = await evaluateAchievements(userId, "chest-open");
  await awardWeeklyXp(userId, xp);
  return { unlockedBadges };
}

export async function addFriend(userId: string, friendToken: string) {
  const result = await connectByFriendToken(userId, friendToken.trim().toUpperCase());
  if (result.kind === "missing") throw new ApiError(404, "FRIEND_NOT_FOUND", "We couldn’t find that friend code.");
  if (result.kind === "self") throw new ApiError(400, "CANNOT_ADD_SELF", "That’s your own friend code.");
  await evaluateAchievements(userId, "friend-made");
  return getFriends(userId);
}

export async function getFriends(userId: string) {
  const profile = await habitProfile(userId);
  const date = localDateAt(new Date(), profile?.timezone ?? "UTC");
  const [friends, userPrefs] = await Promise.all([friendList(userId), preferences(userId)]);
  const riskRecords = await friendsAtRisk(userId);
  const warnings = userPrefs.reduceFomo ? [] : riskRecords.filter(({ friend }) => {
    const timezone = friend.profile?.timezone ?? "UTC";
    const friendDate = localDateAt(new Date(), timezone);
    return localHourAt(new Date(), timezone) >= 18 && friend.tasks.some((task) => task.localDate === friendDate);
  });
  const warningIds = warnings.map(({ friend }) => friend.id);
  await saveFriendRiskNotifications(userId, warningIds, date, new Map(warnings.map(({ friend }) => [friend.id, friend.displayName])));
  const friendDates = friends.map(({ friend }) => ({ friendId: friend.id, localDate: localDateAt(new Date(), friend.profile?.timezone ?? "UTC") }));
  return { friends: friends.map(({ friend }) => friend), finishedToday: await countFriendsCompletedOnDates(userId, friendDates), streakWarnings: warnings.map(({ friend }) => ({ id: friend.id, displayName: friend.displayName, streak: friend.stats?.currentStreak ?? 0 })) };
}

export async function getLeague(userId: string) {
  const profile = await habitProfile(userId);
  const timezone = profile?.timezone ?? "UTC";
  const today = localDateAt(new Date(), timezone);
  const weekStart = weekStartForLocalDate(today);
  const previousWeek = addLocalDays(weekStart, -7);
  const current = await leagueMember(userId, weekStart);
  if (!current) {
    const previousMember = await previousLeagueRank(userId, previousWeek);
    let league = previousMember?.previous.league ?? "BRONZE";
    if (previousMember && previousMember.count >= 5) {
      const rank = previousMember.rank;
      const promotionCutoff = Math.max(1, Math.ceil(previousMember.count * .2));
      const demotionCutoff = Math.floor(previousMember.count * .8);
      const at = leagueOrder.indexOf(league);
      if (rank <= promotionCutoff && at < leagueOrder.length - 1) league = leagueOrder[at + 1]!;
      else if (rank > demotionCutoff && at > 0) league = leagueOrder[at - 1]!;
    }
    await ensureLeague(userId, weekStart, league);
  }
  const [member, board] = await Promise.all([leagueMember(userId, weekStart), leagueBoard(weekStart, (await leagueMember(userId, weekStart))?.league ?? "BRONZE")]);
  const expiresAt = localMidnight(addLocalDays(weekStart, 7), timezone);
  return { league: member?.league ?? "BRONZE", weeklyXp: member?.weeklyXp ?? 0, rank: board.findIndex((row) => row.userId === userId) + 1, participantCount: board.length, board: board.map(({ userId: id, weeklyXp, user }, index) => ({ id, name: user.displayName, pet: user.pet, weeklyXp, rank: index + 1 })), expiresAt: expiresAt.toISOString(), promotionSpots: Math.max(1, Math.ceil(board.length * .2)), demotionSpots: Math.max(1, board.length - Math.floor(board.length * .8)), demotionCutoff: Math.floor(board.length * .8) };
}

export async function awardWeeklyXp(userId: string, xp: number) {
  await getLeague(userId);
  const profile = await habitProfile(userId);
  const weekStart = weekStartForLocalDate(localDateAt(new Date(), profile?.timezone ?? "UTC"));
  await addWeeklyXpRecord(userId, weekStart, xp);
}

export function gameShopCatalog() { return SHOP_ITEMS; }
