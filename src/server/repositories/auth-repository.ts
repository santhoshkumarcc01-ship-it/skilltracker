import { Prisma, type Profile, type Session, type User } from "@prisma/client";
import { prisma } from "@/server/lib/prisma";

export class RefreshRotationConflict extends Error {}
export type UserWithProfile = User & { profile: Profile | null };

export function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createUserWithProfile(input: {
  email: string; displayName: string; passwordHash: string; friendToken: string;
}): Promise<UserWithProfile> {
  return prisma.user.create({
    data: {
      email: input.email,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
      profile: { create: { friendToken: input.friendToken, timezone: "UTC", dailyGoal: 3, onboarded: false } },
    },
    include: { profile: true },
  });
}

export async function findUserByEmail(email: string): Promise<UserWithProfile | null> {
  return prisma.user.findUnique({ where: { email }, include: { profile: true } });
}

export async function findUserById(id: string): Promise<UserWithProfile | null> {
  return prisma.user.findUnique({ where: { id }, include: { profile: true } });
}

export async function createSession(input: {
  userId: string; familyId: string; refreshTokenHash: string; expiresAt: Date;
}): Promise<Session> {
  return prisma.session.create({ data: input });
}

export async function findSessionByRefreshHash(refreshTokenHash: string) {
  return prisma.session.findUnique({ where: { refreshTokenHash }, include: { user: { include: { profile: true } } } });
}

export async function rotateSession(input: {
  currentSessionId: string;
  userId: string;
  familyId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  now: Date;
}): Promise<Session> {
  return prisma.$transaction(async (tx) => {
    const next = await tx.session.create({
      data: { userId: input.userId, familyId: input.familyId, refreshTokenHash: input.refreshTokenHash, expiresAt: input.expiresAt },
    });
    const replaced = await tx.session.updateMany({
      where: { id: input.currentSessionId, revokedAt: null, expiresAt: { gt: input.now } },
      data: { revokedAt: input.now, replacedById: next.id },
    });
    if (replaced.count !== 1) throw new RefreshRotationConflict();
    return next;
  });
}

export async function revokeSession(id: string, now = new Date()): Promise<void> {
  await prisma.session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: now } });
}

export async function revokeFamily(familyId: string, now = new Date()): Promise<void> {
  await prisma.session.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: now } });
}

export async function findActiveSession(sessionId: string, userId: string, now = new Date()) {
  return prisma.session.findFirst({
    where: { id: sessionId, userId, revokedAt: null, expiresAt: { gt: now } },
    include: { user: { include: { profile: true } } },
  });
}

export async function updateOwnedProfile(userId: string, data: {
  displayName?: string; timezone: string; dailyGoal: number; pet: string; onboarded: true;
}) {
  const result = await prisma.profile.updateMany({ where: { userId }, data: {
    timezone: data.timezone, dailyGoal: data.dailyGoal, pet: data.pet, onboarded: data.onboarded,
  } });
  if (result.count !== 1) return null;
  if (data.displayName) await prisma.user.updateMany({ where: { id: userId }, data: { displayName: data.displayName } });
  return prisma.profile.findUnique({ where: { userId } });
}

export async function exportOwnedUserData(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, displayName: true, createdAt: true, updatedAt: true,
      profile: true,
      sessions: { select: { id: true, familyId: true, expiresAt: true, revokedAt: true, createdAt: true } },
      auditLogs: { select: { id: true, action: true, emailHash: true, ipHash: true, metadata: true, createdAt: true } },
      tasks: { orderBy: [{ localDate: "asc" }, { position: "asc" }], select: { id: true, localDate: true, title: true, category: true, scheduledStart: true, plannedMinutes: true, position: true, startedAt: true, elapsedSeconds: true, completedAt: true, awardedXp: true, createdAt: true, updatedAt: true } },
      dayLogs: { orderBy: { localDate: "asc" }, select: { localDate: true, status: true, xpEarned: true, gemsEarned: true, createdAt: true, updatedAt: true } },
      stats: { select: { xp: true, gems: true, hearts: true, currentStreak: true, longestStreak: true, streakFreezeCount: true, lastCompletedDate: true, createdAt: true, updatedAt: true } },
      pet: true,
      preferences: true,
      items: { include: { item: true }, orderBy: { purchasedAt: "asc" } },
      achievements: { orderBy: { unlockedAt: "asc" } },
      notifications: { orderBy: { createdAt: "asc" } },
      leagues: { orderBy: { weekStart: "asc" } },
      friendLinks: { include: { friend: { select: { id: true, displayName: true } } }, orderBy: { createdAt: "asc" } },
      memories: { orderBy: { occurredAt: "asc" }, select: {
        id: true, title: true, story: true, tags: true, occurredAt: true, mood: true, sourceUrl: true, createdAt: true, updatedAt: true,
        mediaFile: { select: { id: true, mimeType: true, size: true, createdAt: true } },
        posterFile: { select: { id: true, mimeType: true, size: true, createdAt: true } },
      } },
      materials: { orderBy: { createdAt: "asc" }, select: {
        id: true, type: true, title: true, content: true, url: true, tags: true, pinned: true, favourite: true, createdAt: true, updatedAt: true,
        folder: { select: { id: true, name: true } }, file: { select: { id: true, mimeType: true, size: true, createdAt: true } },
      } },
      folders: { orderBy: { createdAt: "asc" } },
      motivationNotes: { orderBy: [{ zIndex: "asc" }, { createdAt: "asc" }], include: { file: { select: { id: true, mimeType: true, size: true, createdAt: true } } } },
      favoriteQuotes: { orderBy: { createdAt: "asc" } },
    },
  });
}

export function userStorageObjects(userId: string) {
  return prisma.storedFile.findMany({ where: { userId }, select: { id: true, objectKey: true, thumbnailKey: true } });
}

export function userPendingStorageObjects(userId: string) {
  return prisma.pendingUpload.findMany({ where: { userId }, select: { objectKey: true } });
}

export async function deleteOwnedUser(userId: string): Promise<void> {
  await prisma.user.delete({ where: { id: userId } });
}
