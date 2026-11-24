import { prisma } from "@/backend/lib/prisma";

export function createPendingUpload(userId: string, objectKey: string, declaredMime: string, declaredSize: number, purpose: string, expiresAt: Date) {
  return prisma.pendingUpload.create({ data: { userId, objectKey, declaredMime, declaredSize, purpose, expiresAt } });
}
export function pendingUpload(userId: string, objectKey: string) {
  return prisma.pendingUpload.findFirst({ where: { userId, objectKey } });
}
export async function claimPendingUpload(userId: string, objectKey: string) {
  const result = await prisma.pendingUpload.updateMany({ where: { userId, objectKey, expiresAt: { gt: new Date() }, confirming: false }, data: { confirming: true } });
  return result.count === 1;
}
export function releasePendingUploadClaim(userId: string, objectKey: string) {
  return prisma.pendingUpload.updateMany({ where: { userId, objectKey, confirming: true }, data: { confirming: false } });
}
export function deletePendingUpload(userId: string, objectKey: string) {
  return prisma.pendingUpload.deleteMany({ where: { userId, objectKey } });
}
export function confirmStoredFile(userId: string, objectKey: string, mimeType: string, size: number, thumbnailKey: string | null) {
  return prisma.$transaction(async (tx) => {
    const pending = await tx.pendingUpload.findFirst({ where: { userId, objectKey, expiresAt: { gt: new Date() } } });
    if (!pending) return null;
    const file = await tx.storedFile.create({ data: { userId, objectKey, mimeType, size, thumbnailKey } });
    await tx.pendingUpload.delete({ where: { id: pending.id } });
    return file;
  });
}
export function ownedStoredFile(userId: string, id: string) {
  return prisma.storedFile.findFirst({ where: { userId, id } });
}
export async function claimStoredFilesUnusedByMemories(userId: string, ids: string[]) {
  if (!ids.length) return [];
  return prisma.$transaction(async (tx) => {
    const where = { userId, id: { in: ids }, mediaFor: { none: {} }, posterFor: { none: {} }, materialFor: { none: {} }, motivationFor: { none: {} } };
    const files = await tx.storedFile.findMany({ where });
    if (files.length) await tx.storedFile.deleteMany({ where: { id: { in: files.map((file) => file.id) }, userId } });
    return files;
  });
}
