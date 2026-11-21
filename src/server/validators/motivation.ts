import { z } from "zod";

export const stickyColors = ["lemon", "peach", "mint", "lavender", "sky", "rose", "cream", "lilac"] as const;
export const paperStyles = ["lined", "grid", "kraft", "pastel", "washi", "polaroid"] as const;
const positionFields = {
  x: z.number().finite().min(-1000).max(1000), y: z.number().finite().min(-1000).max(1000),
  width: z.number().finite().min(1).max(100), height: z.number().finite().min(1).max(100),
  rotation: z.number().finite().min(-360).max(360), zIndex: z.number().int().min(-10000).max(10000),
};
export const createNoteSchema = z.object({
  kind: z.enum(["STICKY", "PAPER"]), text: z.string().max(1200).default(""), quote: z.string().trim().max(400).nullable().optional(),
  attribution: z.string().trim().max(120).nullable().optional(), fileId: z.string().cuid().nullable().optional(),
  color: z.enum(stickyColors).default("lemon"), paperStyle: z.enum(paperStyles).default("lined"), ...positionFields,
  pinned: z.boolean().default(false),
}).strict().superRefine((value, ctx) => {
  if (value.kind === "STICKY" && !value.text.trim()) ctx.addIssue({ code: "custom", message: "Add a few words to your sticky note.", path: ["text"] });
  if (value.kind === "PAPER" && !value.quote?.trim() && !value.fileId && !value.text.trim()) ctx.addIssue({ code: "custom", message: "Add a quote, text, or image to your paper.", path: ["quote"] });
  if (value.kind === "STICKY" && value.fileId) ctx.addIssue({ code: "custom", message: "Images can be attached to themed papers.", path: ["fileId"] });
});

export const updateNoteSchema = z.object({
  text: z.string().max(1200).optional(), quote: z.string().trim().max(400).nullable().optional(),
  attribution: z.string().trim().max(120).nullable().optional(), fileId: z.string().cuid().nullable().optional(),
  color: z.enum(stickyColors).optional(), paperStyle: z.enum(paperStyles).optional(), pinned: z.boolean().optional(),
  x: positionFields.x.optional(), y: positionFields.y.optional(), width: positionFields.width.optional(), height: positionFields.height.optional(),
  rotation: positionFields.rotation.optional(), zIndex: positionFields.zIndex.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Change at least one field.");

export const bulkNotePositionsSchema = z.object({ notes: z.array(z.object({ id: z.string().cuid(), ...positionFields }).strict()).min(1).max(100) })
  .strict().refine(({ notes }) => new Set(notes.map((note) => note.id)).size === notes.length, "Note positions must be unique.");

export const favoriteQuoteSchema = z.object({ quote: z.string().trim().min(1).max(400), author: z.string().trim().min(1).max(120) }).strict();
export const favoriteQuoteDeleteSchema = z.object({ id: z.string().cuid() }).strict();
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type FavoriteQuoteInput = z.infer<typeof favoriteQuoteSchema>;
