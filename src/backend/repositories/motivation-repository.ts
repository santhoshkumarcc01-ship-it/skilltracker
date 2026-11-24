import { Prisma } from "@prisma/client";
import { prisma } from "@/backend/lib/prisma";

const include = { file: { select: { userId: true, id: true, mimeType: true, size: true, objectKey: true, thumbnailKey: true } } } satisfies Prisma.MotivationNoteInclude;

export function listOwnedNotes(userId: string) { return prisma.motivationNote.findMany({ where: { userId }, include, orderBy: [{ zIndex: "asc" }, { createdAt: "asc" }, { id: "asc" }] }); }
export function findOwnedNote(userId: string, id: string) { return prisma.motivationNote.findFirst({ where: { userId, id }, include }); }

export async function createOwnedNote(userId: string, data: Omit<Prisma.MotivationNoteUncheckedCreateInput, "userId">) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const count = await tx.motivationNote.count({ where: { userId } });
        if (count >= 100) return null;
        return tx.motivationNote.create({ data: { ...data, userId }, include });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt === 2 || !(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034")) throw error;
    }
  }
  return null;
}

export async function updateOwnedNote(userId: string, id: string, data: Prisma.MotivationNoteUpdateManyMutationInput) {
  const result = await prisma.motivationNote.updateMany({ where: { userId, id }, data });
  if (!result.count) return null;
  return findOwnedNote(userId, id);
}

export async function updateOwnedNotePositions(userId: string, updates: { id: string; x: number; y: number; width: number; height: number; rotation: number; zIndex: number }[]) {
  return prisma.$transaction(async (tx) => {
    const ids = updates.map(({ id }) => id);
    const count = await tx.motivationNote.count({ where: { userId, id: { in: ids } } });
    if (count !== ids.length) return false;
    await Promise.all(updates.map(({ id, ...position }) => tx.motivationNote.updateMany({ where: { userId, id }, data: position })));
    return true;
  });
}

export async function deleteOwnedNote(userId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const note = await tx.motivationNote.findFirst({ where: { userId, id }, include });
    if (!note) return null;
    await tx.motivationNote.deleteMany({ where: { userId, id } });
    let unusedFile = null;
    if (note.fileId) {
      unusedFile = await tx.storedFile.findFirst({ where: { userId, id: note.fileId, mediaFor: { none: {} }, posterFor: { none: {} }, materialFor: { none: {} }, motivationFor: { none: {} } } });
      if (unusedFile) await tx.storedFile.deleteMany({ where: { userId, id: unusedFile.id } });
    }
    return { note, unusedFile };
  });
}

export function listFavoriteQuotes(userId: string) { return prisma.favoriteQuote.findMany({ where: { userId }, orderBy: [{ createdAt: "desc" }, { id: "asc" }] }); }
export async function addFavoriteQuote(userId: string, quote: string, author: string) {
  const existing = await prisma.favoriteQuote.findFirst({ where: { userId, quote, author } });
  return existing ?? prisma.favoriteQuote.create({ data: { userId, quote, author } });
}
export function deleteFavoriteQuote(userId: string, id: string) { return prisma.favoriteQuote.deleteMany({ where: { userId, id } }); }
