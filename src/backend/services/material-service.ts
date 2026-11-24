import { ApiError } from "@/backend/lib/api";
import { localDateAt, localMidnight, weekStartForLocalDate } from "@/backend/lib/habit-math";
import { sanitizeNoteHtml } from "@/shared/sanitization/note-sanitizer";
import { resolveExternalMedia } from "@/backend/lib/storage-rules";
import { assertOwnership } from "@/backend/middleware/ownership";
import { prisma } from "@/backend/lib/prisma";
import { claimStoredFilesUnusedByMemories } from "@/backend/repositories/storage-repository";
import { ownedStoredFile } from "@/backend/repositories/storage-repository";
import { countMaterialsCreatedSince, createFolderRecord, createOwnedMaterial, deleteFolderRecord, deleteOwnedMaterial, findOwnedMaterial, folderDescendants, listFolders, listOwnedMaterials, materialTags, ownedFolder, updateFolderRecord, updateOwnedMaterial } from "@/backend/repositories/material-repository";
import { removeStoredFiles, signOwnedStoredFile } from "@/backend/services/storage/storage-service";
import { evaluateAchievements } from "@/backend/services/game-service";
import type { CreateFolderInput, CreateMaterialInput, MaterialListInput, UpdateFolderInput, UpdateMaterialInput } from "@/backend/validators/materials";

const allowedMaterialFiles = new Set(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "text/plain", "image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4"]);

export async function createMaterial(userId: string, input: CreateMaterialInput) {
  assertOwnership(userId, userId);
  const data = await validateMaterialRefs(userId, input);
  const material = await createOwnedMaterial(userId, data);
  const [item, unlockedBadges] = await Promise.all([serializeMaterial(userId, material), input.type === "NOTE" ? evaluateAchievements(userId, "material-created") : Promise.resolve([])]);
  return { material: item, unlockedBadges };
}

export async function updateMaterial(userId: string, id: string, input: UpdateMaterialInput) {
  assertOwnership(userId, userId);
  const current = await findOwnedMaterial(userId, id);
  if (!current) throw materialNotFound();
  const merged = {
    type: input.type ?? current.type as CreateMaterialInput["type"], title: input.title ?? current.title,
    content: input.content ?? current.content, url: input.url === undefined ? current.url : input.url,
    folderId: input.folderId === undefined ? current.folderId : input.folderId, fileId: input.fileId === undefined ? current.fileId : input.fileId,
    tags: input.tags ?? current.tags, pinned: input.pinned ?? current.pinned, favourite: input.favourite ?? current.favourite,
  };
  const data = await validateMaterialRefs(userId, merged);
  const updated = await updateOwnedMaterial(userId, id, data);
  if (!updated) throw materialNotFound();
  if (current.fileId && current.fileId !== updated.fileId) {
    const unused = await claimStoredFilesUnusedByMemories(userId, [current.fileId]);
    await removeStoredFiles(userId, unused);
  }
  return { material: await serializeMaterial(userId, updated) };
}

export async function getMaterial(userId: string, id: string) {
  assertOwnership(userId, userId);
  const material = await findOwnedMaterial(userId, id);
  if (!material) throw materialNotFound();
  return serializeMaterial(userId, material);
}

export async function getMaterials(userId: string, input: MaterialListInput) {
  assertOwnership(userId, userId);
  if (input.cursor && !(await findOwnedMaterial(userId, input.cursor))) throw materialNotFound();
  if (input.folderId && !(await ownedFolder(userId, input.folderId))) throw folderNotFound();
  const rows = await listOwnedMaterials(userId, { q: input.q, type: input.type, tag: input.tag?.toLocaleLowerCase(), favourite: input.favourite === undefined ? undefined : input.favourite === "true", folderId: input.folderId, sort: input.sort, cursor: input.cursor, limit: input.limit });
  const hasMore = rows.length > input.limit;
  const items = await Promise.all((hasMore ? rows.slice(0, input.limit) : rows).map((row) => serializeMaterial(userId, row)));
  const now = new Date();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { profile: { select: { timezone: true } }, stats: { select: { currentStreak: true } } } });
  const today = localDateAt(now, user?.profile?.timezone ?? "UTC");
  const weekStart = weekStartForLocalDate(today);
  const savedThisWeek = await countMaterialsCreatedSince(userId, localMidnight(weekStart, user?.profile?.timezone ?? "UTC"));
  return { items, nextCursor: hasMore ? rows[input.limit - 1]?.id ?? null : null, savedThisWeek, currentStreak: user?.stats?.currentStreak ?? 0 };
}

export async function getMaterialTags(userId: string) { assertOwnership(userId, userId); return materialTags(userId); }

export async function createFolder(userId: string, input: CreateFolderInput) {
  assertOwnership(userId, userId);
  if (input.parentId && !(await ownedFolder(userId, input.parentId))) throw folderNotFound();
  return publicFolder(await createFolderRecord(userId, { name: input.name, parentId: input.parentId ?? null, color: input.color }));
}
export async function getFolderTree(userId: string) { assertOwnership(userId, userId); return { folders: (await listFolders(userId)).map(publicFolder) }; }
export async function updateFolder(userId: string, id: string, input: UpdateFolderInput) {
  assertOwnership(userId, userId);
  const current = await ownedFolder(userId, id);
  if (!current) throw folderNotFound();
  if (input.parentId) {
    if (!(await ownedFolder(userId, input.parentId))) throw folderNotFound();
    const all = await folderDescendants(userId);
    const descendants = new Set<string>([id]);
    let changed = true;
    while (changed) { changed = false; for (const row of all) if (row.parentId && descendants.has(row.parentId) && !descendants.has(row.id)) { descendants.add(row.id); changed = true; } }
    if (descendants.has(input.parentId)) throw new ApiError(400, "FOLDER_CYCLE", "A folder cannot be moved inside itself.");
  }
  const result = await updateFolderRecord(userId, id, input);
  if (!result.count) throw folderNotFound();
  const updated = await ownedFolder(userId, id);
  return updated ? publicFolder(updated) : null;
}
export async function deleteFolder(userId: string, id: string) {
  assertOwnership(userId, userId);
  const result = await deleteFolderRecord(userId, id);
  if (!result.count) throw folderNotFound();
  return { id };
}

export async function removeMaterial(userId: string, id: string) {
  assertOwnership(userId, userId);
  const deleted = await deleteOwnedMaterial(userId, id);
  if (!deleted) throw materialNotFound();
  if (deleted.file) await removeStoredFiles(userId, [deleted.file]);
  return { id };
}

async function validateMaterialRefs(userId: string, input: CreateMaterialInput | (CreateMaterialInput & Record<string, unknown>)) {
  if (input.folderId && !(await ownedFolder(userId, input.folderId))) throw folderNotFound();
  let file = null;
  if (input.fileId) {
    file = await ownedStoredFile(userId, input.fileId);
    if (!file) throw new ApiError(404, "FILE_NOT_FOUND", "File not found.");
    if (!allowedMaterialFiles.has(file.mimeType)) throw new ApiError(415, "UNSUPPORTED_MEDIA", "That file type is not supported in the Material Library.");
    if (input.type === "VIDEO" && file.mimeType !== "video/mp4") throw new ApiError(415, "INVALID_VIDEO", "Choose an MP4 video for this material.");
    if (input.type !== "VIDEO" && file.mimeType.startsWith("video/")) throw new ApiError(415, "INVALID_FILE", "Video uploads belong in a video material.");
  }
  let url: string | null = input.url ?? null;
  if (url) {
    const safe = resolveExternalMedia(url);
    if (input.type === "VIDEO" && safe.kind !== "youtube" && safe.kind !== "vimeo") throw new ApiError(400, "INVALID_VIDEO_URL", "Use a YouTube or Vimeo video URL.");
    url = safe.url;
  }
  const valid = input.type === "NOTE" ? !url && !file : input.type === "FILE" ? Boolean(file) && !url : input.type === "LINK" ? Boolean(url) && !file : Boolean(url) !== Boolean(file);
  if (!valid) throw new ApiError(400, "INVALID_MATERIAL", "Add the content required for this material type.");
  return {
    type: input.type, title: input.title.trim(), content: input.type === "NOTE" ? sanitizeNoteHtml(input.content) : input.content,
    url, folderId: input.folderId ?? null, fileId: input.fileId ?? null, tags: normalizeTags(input.tags), pinned: input.pinned, favourite: input.favourite,
  };
}

async function serializeMaterial(userId: string, material: NonNullable<Awaited<ReturnType<typeof findOwnedMaterial>>>) {
  const external = material.url ? resolveExternalMedia(material.url) : null;
  const stored = material.fileId && material.file ? await signOwnedStoredFile(userId, material.file) : null;
  const domain = external ? new URL(external.url).hostname.replace(/^www\./, "") : null;
  return { id: material.id, type: material.type, title: material.title, content: material.content, url: external?.url ?? null, embedUrl: external?.embedUrl ?? null, domain, folder: material.folder, folderId: material.folderId, fileId: material.fileId, fileName: material.file ? material.file.objectKey.split("/").at(-1) : null, mimeType: material.file?.mimeType ?? null, size: material.file?.size ?? null, downloadUrl: stored?.url ?? null, thumbnailUrl: stored?.thumbnailUrl ?? null, tags: material.tags, pinned: material.pinned, favourite: material.favourite, createdAt: material.createdAt.toISOString(), updatedAt: material.updatedAt.toISOString() };
}

function normalizeTags(tags: string[]) { return [...new Set((tags ?? []).map((tag) => tag.trim().replace(/^#+/, "").toLocaleLowerCase()).filter(Boolean))]; }
function publicFolder(folder: NonNullable<Awaited<ReturnType<typeof ownedFolder>>>) { return { id: folder.id, parentId: folder.parentId, name: folder.name, color: folder.color, createdAt: folder.createdAt.toISOString(), updatedAt: folder.updatedAt.toISOString() }; }
function materialNotFound() { return new ApiError(404, "MATERIAL_NOT_FOUND", "Material not found."); }
function folderNotFound() { return new ApiError(404, "FOLDER_NOT_FOUND", "Folder not found."); }
