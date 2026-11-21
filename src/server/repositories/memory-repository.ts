import { Prisma } from "@prisma/client";
import { prisma } from "@/server/lib/prisma";

const memoryInclude = { mediaFile: true, posterFile: true } satisfies Prisma.MemoryInclude;
export type MemoryInput = { title?: string; story?: string; tags?: string[]; occurredAt?: Date; mood?: string | null; sourceUrl?: string | null; mediaFileId?: string | null; posterFileId?: string | null };

export function findOwnedMemory(userId: string, id: string) {
  return prisma.memory.findFirst({ where: { userId, id }, include: memoryInclude });
}

export async function listOwnedMemories(userId: string, input: { tag?: string; mood?: string; from?: Date; toExclusive?: Date; q?: string; cursor?: string; limit: number }) {
  const where: Prisma.MemoryWhereInput = {
    userId,
    ...(input.tag ? { tags: { has: input.tag } } : {}),
    ...(input.mood ? { mood: input.mood } : {}),
    ...(input.from || input.toExclusive ? { occurredAt: { ...(input.from ? { gte: input.from } : {}), ...(input.toExclusive ? { lt: input.toExclusive } : {}) } } : {}),
    ...(input.q ? { OR: [{ title: { contains: input.q, mode: "insensitive" } }, { story: { contains: input.q, mode: "insensitive" } }] } : {}),
  };
  return prisma.memory.findMany({ where, include: memoryInclude, orderBy: [{ occurredAt: "desc" }, { id: "desc" }], take: input.limit + 1, ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}) });
}

export async function createOwnedMemory(userId: string, input: Required<Pick<MemoryInput, "title" | "story" | "tags" | "occurredAt">> & Pick<MemoryInput, "mood" | "sourceUrl" | "mediaFileId" | "posterFileId">) {
  return prisma.$transaction(async (tx) => {
    const fileIds = [input.mediaFileId, input.posterFileId].filter((id): id is string => Boolean(id));
    if (fileIds.length) {
      const files = await tx.storedFile.findMany({ where: { userId, id: { in: fileIds }, mediaFor: { none: {} }, posterFor: { none: {} }, materialFor: { none: {} }, motivationFor: { none: {} } }, select: { id: true } });
      if (files.length !== new Set(fileIds).size) return null;
    }
    return tx.memory.create({ data: { ...input, userId }, include: memoryInclude });
  });
}

export async function updateOwnedMemory(userId: string, id: string, input: MemoryInput) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.memory.findFirst({ where: { userId, id }, include: memoryInclude });
    if (!current) return null;
    const requestedIds = [input.mediaFileId, input.posterFileId].filter((fileId): fileId is string => Boolean(fileId));
    const newIds = requestedIds.filter((fileId) => fileId !== current.mediaFileId && fileId !== current.posterFileId);
    if (newIds.length) {
      const files = await tx.storedFile.findMany({ where: { userId, id: { in: newIds }, mediaFor: { none: {} }, posterFor: { none: {} }, materialFor: { none: {} }, motivationFor: { none: {} } }, select: { id: true } });
      if (files.length !== new Set(newIds).size) return null;
    }
    return tx.memory.update({ where: { id }, data: input, include: memoryInclude });
  });
}

export async function deleteOwnedMemory(userId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const memory = await tx.memory.findFirst({ where: { userId, id }, include: memoryInclude });
    if (!memory) return null;
    await tx.memory.delete({ where: { id } });
    const ids = [memory.mediaFileId, memory.posterFileId].filter((fileId): fileId is string => Boolean(fileId));
    const files = ids.length ? await tx.storedFile.findMany({ where: { userId, id: { in: ids }, mediaFor: { none: {} }, posterFor: { none: {} }, materialFor: { none: {} }, motivationFor: { none: {} } } }) : [];
    if (files.length) await tx.storedFile.deleteMany({ where: { userId, id: { in: files.map((file) => file.id) } } });
    return { files, memory };
  });
}

export async function ownedMemoryCursor(userId: string, id: string) {
  return prisma.memory.findFirst({ where: { userId, id }, select: { id: true } });
}

export async function existingTags(userId: string, query: string) {
  const rows = await prisma.memory.findMany({ where: { userId }, select: { tags: true } });
  const prefix = query.toLocaleLowerCase();
  return [...new Set(rows.flatMap((row) => row.tags))].filter((tag) => tag.toLocaleLowerCase().includes(prefix)).sort((a, b) => a.localeCompare(b)).slice(0, 12);
}
