import { z } from "zod";
import { MATERIAL_UPLOAD_MIMES, STORY_UPLOAD_MIMES } from "@/server/lib/storage-rules";

export const uploadMimeTypes = STORY_UPLOAD_MIMES;
export const materialUploadMimeTypes = MATERIAL_UPLOAD_MIMES;
export const uploadPresignSchema = z.object({ mimeType: z.enum(uploadMimeTypes), size: z.number().int().positive(), purpose: z.enum(["story", "motivation"]).optional() }).strict();
export const motivationUploadPresignSchema = z.object({ mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]), size: z.number().int().positive(), purpose: z.literal("motivation") }).strict();
export const materialUploadPresignSchema = z.object({ mimeType: z.enum(materialUploadMimeTypes), size: z.number().int().positive(), purpose: z.literal("material") }).strict();
export const uploadConfirmSchema = z.object({ key: z.string().min(8).max(300) }).strict();
const memoryFields = {
  title: z.string().trim().min(1).max(120),
  story: z.string().max(8000).default(""),
  tags: z.array(z.string().trim().min(1).max(32)).max(12).default([]),
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((date) => !Number.isNaN(Date.parse(`${date}T00:00:00.000Z`)), "Enter a valid date."),
  mood: z.string().trim().max(24).nullable().optional(),
  sourceUrl: z.string().trim().max(2048).nullable().optional(),
  mediaFileId: z.string().cuid().nullable().optional(),
  posterFileId: z.string().cuid().nullable().optional(),
};
const memoryMediaRefine = (value: { sourceUrl?: string | null; mediaFileId?: string | null; posterFileId?: string | null }) => Boolean(value.sourceUrl) !== Boolean(value.mediaFileId) && (!value.posterFileId || Boolean(value.mediaFileId));
export const createMemorySchema = z.object(memoryFields).strict().refine(memoryMediaRefine, "Choose one uploaded file or one URL.").refine((value) => new Set(value.tags.map((tag) => tag.toLocaleLowerCase())).size === value.tags.length, "Tags must be unique.");
export const updateMemorySchema = z.object({
  title: memoryFields.title.optional(),
  story: memoryFields.story.optional(),
  tags: memoryFields.tags.optional(),
  occurredAt: memoryFields.occurredAt.optional(),
  mood: memoryFields.mood,
  sourceUrl: memoryFields.sourceUrl,
  mediaFileId: memoryFields.mediaFileId,
  posterFileId: memoryFields.posterFileId,
}).strict().refine((value) => Object.keys(value).length > 0, "Change at least one field.").refine((value) => {
  if (value.sourceUrl === undefined && value.mediaFileId === undefined && value.posterFileId === undefined) return true;
  return memoryMediaRefine(value);
}, "Choose one uploaded file or one URL.");
export const memoryListQuerySchema = z.object({
  tag: z.string().trim().max(32).optional(),
  mood: z.string().trim().max(24).optional(),
  from: memoryFields.occurredAt.optional(),
  to: memoryFields.occurredAt.optional(),
  q: z.string().trim().max(120).optional(),
  cursor: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(30).default(12),
}).strict().refine((value) => !value.from || !value.to || value.from <= value.to, "Date range is invalid.");
export const tagQuerySchema = z.object({ q: z.string().trim().max(32).default("") }).strict();
export type CreateMemoryInput = z.infer<typeof createMemorySchema>;
export type UpdateMemoryInput = z.infer<typeof updateMemorySchema>;
export type MemoryListInput = z.infer<typeof memoryListQuerySchema>;
