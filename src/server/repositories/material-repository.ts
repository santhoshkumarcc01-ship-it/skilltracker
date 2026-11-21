import { Prisma } from "@prisma/client";
import { prisma } from "@/server/lib/prisma";

const include = { folder: { select: { id: true, name: true } }, file: true } satisfies Prisma.MaterialInclude;
export function findOwnedMaterial(userId: string, id: string) { return prisma.material.findFirst({ where: { userId, id }, include }); }
export function ownedFolder(userId: string, id: string) { return prisma.materialFolder.findFirst({ where: { userId, id } }); }
export function folderDescendants(userId: string) { return prisma.materialFolder.findMany({ where: { userId }, select: { id: true, parentId: true } }); }
export function listFolders(userId: string) { return prisma.materialFolder.findMany({ where: { userId }, orderBy: [{ name: "asc" }, { id: "asc" }] }); }
export function createFolderRecord(userId: string, data: { name: string; parentId: string | null; color: string }) { return prisma.materialFolder.create({ data: { ...data, userId } }); }
export function updateFolderRecord(userId: string, id: string, data: { name?: string; parentId?: string | null; color?: string }) { return prisma.materialFolder.updateMany({ where: { userId, id }, data }); }
export function deleteFolderRecord(userId: string, id: string) { return prisma.materialFolder.deleteMany({ where: { userId, id } }); }

export async function listOwnedMaterials(userId: string, input: { q?: string; type?: string; tag?: string; favourite?: boolean; folderId?: string; sort: string; cursor?: string; limit: number }) {
  const where: Prisma.MaterialWhereInput = {
    userId,
    ...(input.type ? { type: input.type } : {}),
    ...(input.tag ? { tags: { has: input.tag } } : {}),
    ...(input.favourite === undefined ? {} : { favourite: input.favourite }),
    ...(input.folderId ? { folderId: input.folderId } : {}),
    ...(input.q ? { OR: [{ title: { contains: input.q, mode: "insensitive" } }, { content: { contains: input.q, mode: "insensitive" } }, { tags: { has: input.q.toLocaleLowerCase() } }] } : {}),
  };
  const orderBy: Prisma.MaterialOrderByWithRelationInput[] = input.sort === "oldest" ? [{ createdAt: "asc" }, { id: "asc" }] : input.sort === "title" ? [{ title: "asc" }, { id: "asc" }] : input.sort === "updated" ? [{ updatedAt: "desc" }, { id: "desc" }] : [{ pinned: "desc" }, { createdAt: "desc" }, { id: "desc" }];
  return prisma.material.findMany({ where, include, orderBy, take: input.limit + 1, ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}) });
}
export function createOwnedMaterial(userId: string, data: Omit<Prisma.MaterialUncheckedCreateInput, "userId">) { return prisma.material.create({ data: { ...data, userId }, include }); }
export function updateOwnedMaterial(userId: string, id: string, data: Prisma.MaterialUpdateManyMutationInput) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.material.updateMany({ where: { userId, id }, data });
    if (result.count !== 1) return null;
    return tx.material.findFirst({ where: { userId, id }, include });
  });
}
export async function deleteOwnedMaterial(userId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const material = await tx.material.findFirst({ where: { userId, id }, include });
    if (!material) return null;
    await tx.material.deleteMany({ where: { userId, id } });
    let file = null;
    if (material.fileId) {
      const remaining = await tx.storedFile.findFirst({ where: { userId, id: material.fileId, materialFor: { none: {} }, mediaFor: { none: {} }, posterFor: { none: {} }, motivationFor: { none: {} } } });
      if (remaining) { await tx.storedFile.deleteMany({ where: { userId, id: remaining.id } }); file = remaining; }
    }
    return { material, file };
  });
}
export function countMaterialsCreatedSince(userId: string, from: Date) { return prisma.material.count({ where: { userId, createdAt: { gte: from } } }); }
export async function materialTags(userId: string) { const rows = await prisma.material.findMany({ where: { userId }, select: { tags: true } }); return [...new Set(rows.flatMap((row) => row.tags))].sort(); }
