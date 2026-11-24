import { z } from "zod";
import { MATERIAL_UPLOAD_MIMES } from "@/backend/lib/storage-rules";

export const materialUploadPresignSchema = z.object({ mimeType: z.enum(MATERIAL_UPLOAD_MIMES), size: z.number().int().positive(), purpose: z.literal("material") }).strict();

export const materialTypes = ["NOTE", "FILE", "LINK", "VIDEO"] as const;
const tags = z.array(z.string().trim().min(1).max(32)).max(20).default([]);
const materialFields = {
  type: z.enum(materialTypes),
  title: z.string().trim().min(1).max(160),
  content: z.string().max(100_000).default(""),
  url: z.string().trim().max(2048).nullable().optional(),
  folderId: z.string().cuid().nullable().optional(),
  fileId: z.string().cuid().nullable().optional(),
  tags,
  pinned: z.boolean().default(false),
  favourite: z.boolean().default(false),
};
const validMedia = (value: { type: string; url?: string | null; fileId?: string | null }) => {
  switch (value.type) {
    case "NOTE": return !value.url && !value.fileId;
    case "FILE": return Boolean(value.fileId) && !value.url;
    case "LINK": return Boolean(value.url) && !value.fileId;
    case "VIDEO": return Boolean(value.url) !== Boolean(value.fileId);
    default: return false;
  }
};
export const createMaterialSchema = z.object(materialFields).strict().refine(validMedia, "Add the content required for this material type.");
export const updateMaterialSchema = z.object({
  type: materialFields.type.optional(), title: materialFields.title.optional(), content: materialFields.content.optional(),
  url: materialFields.url, folderId: materialFields.folderId, fileId: materialFields.fileId,
  tags: materialFields.tags.optional(), pinned: materialFields.pinned.optional(), favourite: materialFields.favourite.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Change at least one field.");
export const materialListSchema = z.object({
  q: z.string().trim().max(120).optional(), type: z.enum(materialTypes).optional(), tag: z.string().trim().max(32).optional(),
  favourite: z.enum(["true", "false"]).optional(), folderId: z.string().cuid().optional(), sort: z.enum(["recent", "oldest", "title", "updated"]).default("recent"),
  cursor: z.string().cuid().optional(), limit: z.coerce.number().int().min(1).max(30).default(18), timeline: z.enum(["true", "false"]).optional(),
}).strict();
export const createFolderSchema = z.object({ name: z.string().trim().min(1).max(80), parentId: z.string().cuid().nullable().optional(), color: z.enum(["green", "blue", "yellow", "purple", "coral"]).default("green") }).strict();
export const updateFolderSchema = z.object({ name: z.string().trim().min(1).max(80).optional(), parentId: z.string().cuid().nullable().optional(), color: z.enum(["green", "blue", "yellow", "purple", "coral"]).optional() }).strict().refine((value) => Object.keys(value).length > 0, "Change at least one field.");
export const folderTreeQuerySchema = z.object({}).strict();
export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;
export type MaterialListInput = z.infer<typeof materialListSchema>;
export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;
