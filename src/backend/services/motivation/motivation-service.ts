import { ApiError } from "@/backend/lib/api";
import { assertOwnership } from "@/backend/middleware/ownership";
import { ownedStoredFile, claimStoredFilesUnusedByMemories } from "@/backend/repositories/storage-repository";
import { addFavoriteQuote, createOwnedNote, deleteFavoriteQuote, deleteOwnedNote, findOwnedNote, listFavoriteQuotes, listOwnedNotes, updateOwnedNote, updateOwnedNotePositions } from "@/backend/repositories/motivation-repository";
import { removeStoredFiles, signOwnedStoredFile } from "@/backend/services/storage/storage-service";
import { clampBoardPosition, orderByBoardLayer } from "@/shared/motivation/board-math";
import { motivationWriteLimiter } from "./write-limit";
import type { CreateNoteInput, FavoriteQuoteInput, UpdateNoteInput } from "@/backend/validators/motivation";

export async function getMotivationBoard(userId: string) {
  assertOwnership(userId, userId);
  const [rows, favorites] = await Promise.all([listOwnedNotes(userId), listFavoriteQuotes(userId)]);
  const notes = await Promise.all(orderByBoardLayer(rows).map((note) => serializeNote(userId, note)));
  return { notes, favorites };
}

export async function createMotivationNote(userId: string, input: CreateNoteInput) {
  assertOwnership(userId, userId); checkWriteLimit(userId);
  const fileId = await validateImage(userId, input.kind, input.fileId ?? null);
  const position = clampBoardPosition(input);
  const note = await createOwnedNote(userId, {
    kind: input.kind, text: cleanText(input.text, 1200), quote: cleanText(input.quote ?? "", 400) || null, attribution: cleanText(input.attribution ?? "", 120) || null,
    fileId, color: input.color, paperStyle: input.paperStyle, ...position, pinned: input.pinned,
  });
  if (!note) throw new ApiError(409, "BOARD_LIMIT_REACHED", "Your board is full. Remove a note before adding another.");
  return serializeNote(userId, note);
}

export async function updateMotivationNote(userId: string, id: string, input: UpdateNoteInput) {
  assertOwnership(userId, userId); checkWriteLimit(userId);
  let current = await findOwnedNote(userId, id);
  if (!current) throw noteNotFound();
  const kind = current.kind as "STICKY" | "PAPER";
  let promotedZIndex: number | undefined;
  if (input.zIndex !== undefined) {
    const ordered = orderByBoardLayer(await listOwnedNotes(userId)).filter((note) => note.id !== id);
    promotedZIndex = ordered.length + 1;
    const all = [...ordered, current];
    const saved = await updateOwnedNotePositions(userId, all.map((note, index) => ({ id: note.id, x: note.x, y: note.y, width: note.width, height: note.height, rotation: note.rotation, zIndex: index + 1 })));
    if (!saved) throw noteNotFound();
    current = await findOwnedNote(userId, id);
    if (!current) throw noteNotFound();
  }
  const fileId = input.fileId === undefined ? current.fileId : await validateImage(userId, kind, input.fileId);
  const text = input.text === undefined ? current.text : cleanText(input.text, 1200);
  const quote = input.quote === undefined ? current.quote : cleanText(input.quote ?? "", 400) || null;
  if (kind === "STICKY" && !text.trim()) throw new ApiError(400, "EMPTY_STICKY", "Add a few words to your sticky note.");
  if (kind === "STICKY" && fileId) throw new ApiError(400, "INVALID_NOTE_IMAGE", "Images can be attached to themed papers.");
  if (kind === "PAPER" && !text.trim() && !quote && !fileId) throw new ApiError(400, "EMPTY_PAPER", "Add a quote, text, or image to your paper.");
  const position = clampBoardPosition({ x: input.x ?? current.x, y: input.y ?? current.y, width: input.width ?? current.width, height: input.height ?? current.height, rotation: input.rotation ?? current.rotation, zIndex: promotedZIndex ?? input.zIndex ?? current.zIndex });
  const updated = await updateOwnedNote(userId, id, {
    ...(input.text === undefined ? {} : { text }), ...(input.quote === undefined ? {} : { quote }),
    ...(input.attribution === undefined ? {} : { attribution: cleanText(input.attribution ?? "", 120) || null }),
    ...(input.fileId === undefined ? {} : { fileId }), ...(input.color === undefined ? {} : { color: input.color }),
    ...(input.paperStyle === undefined ? {} : { paperStyle: input.paperStyle }), ...(input.pinned === undefined ? {} : { pinned: input.pinned }),
    ...position,
  });
  if (!updated) throw noteNotFound();
  if (current.fileId && current.fileId !== updated.fileId) {
    const unused = await claimStoredFilesUnusedByMemories(userId, [current.fileId]);
    await removeStoredFiles(userId, unused);
  }
  return serializeNote(userId, updated);
}

export async function saveMotivationPositions(userId: string, updates: { id: string; x: number; y: number; width: number; height: number; rotation: number; zIndex: number }[]) {
  assertOwnership(userId, userId); checkWriteLimit(userId);
  const normalized = updates.map(({ id, ...position }) => ({ id, ...clampBoardPosition(position) }));
  if (!(await updateOwnedNotePositions(userId, normalized))) throw noteNotFound();
  return { saved: normalized.length };
}

export async function duplicateMotivationNote(userId: string, id: string) {
  assertOwnership(userId, userId); checkWriteLimit(userId);
  const source = await findOwnedNote(userId, id);
  if (!source) throw noteNotFound();
  const position = clampBoardPosition({ x: source.x + 4, y: source.y + 4, width: source.width, height: source.height, rotation: source.rotation, zIndex: source.zIndex + 1 });
  const duplicate = await createOwnedNote(userId, {
    kind: source.kind, text: source.text, quote: source.quote, attribution: source.attribution, fileId: source.fileId,
    color: source.color, paperStyle: source.paperStyle, pinned: false, ...position,
  });
  if (!duplicate) throw new ApiError(409, "BOARD_LIMIT_REACHED", "Your board is full. Remove a note before duplicating.");
  return serializeNote(userId, duplicate);
}

export async function removeMotivationNote(userId: string, id: string) {
  assertOwnership(userId, userId); checkWriteLimit(userId);
  const deleted = await deleteOwnedNote(userId, id);
  if (!deleted) throw noteNotFound();
  if (deleted.unusedFile) await removeStoredFiles(userId, [deleted.unusedFile]);
  return { id };
}

export async function getFavoriteQuotes(userId: string) { assertOwnership(userId, userId); return listFavoriteQuotes(userId); }
export async function addFavoriteMotivationQuote(userId: string, input: FavoriteQuoteInput) {
  assertOwnership(userId, userId); checkWriteLimit(userId);
  return addFavoriteQuote(userId, cleanText(input.quote, 400), cleanText(input.author, 120));
}
export async function removeFavoriteMotivationQuote(userId: string, id: string) {
  assertOwnership(userId, userId); checkWriteLimit(userId);
  if (!(await deleteFavoriteQuote(userId, id)).count) throw new ApiError(404, "QUOTE_NOT_FOUND", "Favorite quote not found.");
  return { id };
}

async function validateImage(userId: string, kind: string, fileId: string | null) {
  if (!fileId) return null;
  if (kind !== "PAPER") throw new ApiError(400, "INVALID_NOTE_IMAGE", "Images can be attached to themed papers.");
  const file = await ownedStoredFile(userId, fileId);
  if (!file) throw new ApiError(404, "FILE_NOT_FOUND", "Image not found.");
  if (!new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]).has(file.mimeType)) throw new ApiError(415, "INVALID_NOTE_IMAGE", "Choose a JPG, PNG, WebP, or GIF image.");
  return file.id;
}

async function serializeNote(userId: string, note: NonNullable<Awaited<ReturnType<typeof findOwnedNote>>>) {
  const media = note.file ? await signOwnedStoredFile(userId, note.file) : null;
  return {
    id: note.id, kind: note.kind, text: note.text, quote: note.quote, attribution: note.attribution, fileId: note.fileId,
    imageUrl: media?.url ?? null, thumbnailUrl: media?.thumbnailUrl ?? null, color: note.color, paperStyle: note.paperStyle,
    x: note.x, y: note.y, width: note.width, height: note.height, rotation: note.rotation, zIndex: note.zIndex, pinned: note.pinned,
    createdAt: note.createdAt.toISOString(), updatedAt: note.updatedAt.toISOString(),
  };
}

function checkWriteLimit(userId: string) {
  if (!motivationWriteLimiter.allow(userId)) throw new ApiError(429, "MOTIVATION_RATE_LIMITED", "That’s a lot of board changes at once. Please pause and try again.", { "Retry-After": "60" });
}
function cleanText(value: string, maximum: number) { return value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, maximum); }
function noteNotFound() { return new ApiError(404, "NOTE_NOT_FOUND", "Board item not found."); }
