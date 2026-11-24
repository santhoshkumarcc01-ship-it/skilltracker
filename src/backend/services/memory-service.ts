import { ApiError } from "@/backend/lib/api";
import { resolveExternalMedia, STORY_UPLOAD_MIMES } from "@/backend/lib/storage-rules";
import { assertOwnership } from "@/backend/middleware/ownership";
import { deleteOwnedMemory, createOwnedMemory, existingTags, findOwnedMemory, listOwnedMemories, ownedMemoryCursor, updateOwnedMemory } from "@/backend/repositories/memory-repository";
import { ownedStoredFile } from "@/backend/repositories/storage-repository";
import { cleanupUnusedStoredFiles, removeStoredFiles, signOwnedStoredFile } from "@/backend/services/storage/storage-service";
import { evaluateAchievements } from "@/backend/services/game-service";
import type { CreateMemoryInput, MemoryListInput, UpdateMemoryInput } from "@/backend/validators/memories";

export async function createMemory(userId: string, input: CreateMemoryInput) {
  assertOwnership(userId, userId);
  const fields = await prepareMemoryFields(userId, input);
  const memory = await createOwnedMemory(userId, fields);
  if (!memory) throw new ApiError(409, "FILE_ALREADY_ATTACHED", "That upload is already attached to a memory.");
  const [view, unlockedBadges] = await Promise.all([serializeMemory(userId, memory), evaluateAchievements(userId, "memory-created")]);
  return { memory: view, unlockedBadges };
}

export async function updateMemory(userId: string, id: string, input: UpdateMemoryInput) {
  assertOwnership(userId, userId);
  const current = await findOwnedMemory(userId, id);
  if (!current) throw new ApiError(404, "MEMORY_NOT_FOUND", "Memory not found.");
  const combined = {
    title: input.title ?? current.title,
    story: input.story === undefined ? current.story : input.story,
    tags: input.tags ?? current.tags,
    occurredAt: input.occurredAt ?? current.occurredAt.toISOString().slice(0, 10),
    mood: input.mood === undefined ? current.mood : input.mood,
    sourceUrl: input.sourceUrl === undefined ? current.sourceUrl : input.sourceUrl,
    mediaFileId: input.mediaFileId === undefined ? current.mediaFileId : input.mediaFileId,
    posterFileId: input.posterFileId === undefined ? current.posterFileId : input.posterFileId,
  };
  const fields = await prepareMemoryFields(userId, combined);
  const updated = await updateOwnedMemory(userId, id, fields);
  if (!updated) throw new ApiError(409, "FILE_ALREADY_ATTACHED", "That upload is already attached to a memory.");
  const oldIds = [current.mediaFileId, current.posterFileId].filter((fileId): fileId is string => Boolean(fileId));
  await cleanupUnusedStoredFiles(userId, oldIds.filter((fileId) => fileId !== updated.mediaFileId && fileId !== updated.posterFileId));
  return { memory: await serializeMemory(userId, updated) };
}

export async function getMemory(userId: string, id: string) {
  assertOwnership(userId, userId);
  const memory = await findOwnedMemory(userId, id);
  if (!memory) throw new ApiError(404, "MEMORY_NOT_FOUND", "Memory not found.");
  return serializeMemory(userId, memory);
}

export async function getMemories(userId: string, input: MemoryListInput) {
  assertOwnership(userId, userId);
  if (input.cursor && !(await ownedMemoryCursor(userId, input.cursor))) throw new ApiError(404, "MEMORY_NOT_FOUND", "Memory not found.");
  const rows = await listOwnedMemories(userId, {
    tag: input.tag?.toLocaleLowerCase(),
    mood: input.mood,
    q: input.q,
    cursor: input.cursor,
    limit: input.limit,
    ...(input.from ? { from: new Date(`${input.from}T00:00:00.000Z`) } : {}),
    ...(input.to ? { toExclusive: nextDate(input.to) } : {}),
  });
  const hasMore = rows.length > input.limit;
  const page = hasMore ? rows.slice(0, input.limit) : rows;
  return { items: await Promise.all(page.map((row) => serializeMemory(userId, row))), nextCursor: hasMore ? page.at(-1)?.id ?? null : null };
}

export async function getMemoryTags(userId: string, query: string) {
  assertOwnership(userId, userId);
  return existingTags(userId, query.toLocaleLowerCase());
}

export async function removeMemory(userId: string, id: string) {
  assertOwnership(userId, userId);
  const removed = await deleteOwnedMemory(userId, id);
  if (!removed) throw new ApiError(404, "MEMORY_NOT_FOUND", "Memory not found.");
  await removeStoredFiles(userId, removed.files);
  return { id };
}

type MemoryFieldInput = {
  title?: string;
  story?: string;
  tags?: string[];
  occurredAt?: string;
  mood?: string | null;
  sourceUrl?: string | null;
  mediaFileId?: string | null;
  posterFileId?: string | null;
};

async function prepareMemoryFields(userId: string, input: MemoryFieldInput) {
  const sourceUrl = input.sourceUrl ? resolveExternalMedia(input.sourceUrl).url : null;
  const mediaFileId = input.mediaFileId || null;
  const posterFileId = input.posterFileId || null;
  if (Boolean(sourceUrl) === Boolean(mediaFileId)) throw new ApiError(400, "INVALID_MEMORY_MEDIA", "Choose one uploaded file or one URL.");
  let mediaFile = null;
  if (mediaFileId) {
    mediaFile = await ownedStoredFile(userId, mediaFileId);
    if (!mediaFile) throw new ApiError(404, "FILE_NOT_FOUND", "File not found.");
    if (!(STORY_UPLOAD_MIMES as readonly string[]).includes(mediaFile.mimeType)) throw new ApiError(415, "UNSUPPORTED_MEDIA", "That upload cannot be used for a story memory.");
  }
  if (posterFileId) {
    const poster = await ownedStoredFile(userId, posterFileId);
    if (!poster) throw new ApiError(404, "FILE_NOT_FOUND", "File not found.");
    if (!mediaFile?.mimeType.startsWith("video/") || poster.mimeType !== "image/webp") throw new ApiError(400, "INVALID_POSTER", "A poster image can only be attached to a video.");
  }
  return {
    title: String(input.title ?? "").trim(),
    story: sanitizePlainText(String(input.story ?? "")),
    tags: normalizeTags(Array.isArray(input.tags) ? input.tags.map(String) : []),
    occurredAt: parseDateOnly(String(input.occurredAt ?? "")),
    mood: typeof input.mood === "string" && input.mood ? input.mood : null,
    sourceUrl,
    mediaFileId,
    posterFileId,
  };
}

function normalizeTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim().replace(/^#+/, "").toLocaleLowerCase()).filter(Boolean))];
}
function sanitizePlainText(value: string) {
  return value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, 8000);
}
function parseDateOnly(value: string) {
  const date = new Date(`${value}T12:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new ApiError(400, "INVALID_DATE", "Choose a valid memory date.");
  return date;
}
function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

async function serializeMemory(userId: string, memory: Awaited<ReturnType<typeof findOwnedMemory>>) {
  if (!memory) throw new ApiError(404, "MEMORY_NOT_FOUND", "Memory not found.");
  const [media, poster] = await Promise.all([
    memory.mediaFile ? signOwnedStoredFile(userId, memory.mediaFile) : null,
    memory.posterFile ? signOwnedStoredFile(userId, memory.posterFile) : null,
  ]);
  const external = memory.sourceUrl ? resolveExternalMedia(memory.sourceUrl) : null;
  return {
    id: memory.id,
    title: memory.title,
    story: memory.story,
    tags: memory.tags,
    occurredAt: memory.occurredAt.toISOString().slice(0, 10),
    mood: memory.mood,
    sourceUrl: memory.sourceUrl,
    mediaFileId: memory.mediaFileId,
    posterFileId: memory.posterFileId,
    mimeType: media?.file.mimeType ?? null,
    mediaType: media?.file.mimeType.startsWith("video/") ? "video" : media ? "image" : external?.kind ?? "link",
    mediaUrl: media?.url ?? external?.url ?? null,
    thumbnailUrl: media?.thumbnailUrl ?? null,
    posterUrl: poster?.url ?? media?.thumbnailUrl ?? null,
    embedUrl: external?.embedUrl ?? null,
    createdAt: memory.createdAt.toISOString(),
    updatedAt: memory.updatedAt.toISOString(),
  };
}
