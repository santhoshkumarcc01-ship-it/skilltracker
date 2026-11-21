import { z } from "zod";

export const petSpeciesSchema = z.enum(["cat", "fox", "panda", "dragon", "axolotl"]);
export const petUpdateSchema = z.object({
  name: z.string().trim().min(1).max(24).optional(),
  species: petSpeciesSchema.optional(),
  equippedHat: z.string().max(80).nullable().optional(),
  equippedGlasses: z.string().max(80).nullable().optional(),
  equippedScarf: z.string().max(80).nullable().optional(),
}).strict();
export const emptyActionSchema = z.object({}).strict();
export const preferencesSchema = z.object({
  reduceFomo: z.boolean().optional(),
  reduceMotion: z.boolean().optional(),
  theme: z.enum(["light", "dark"]).optional(),
  soundMuted: z.boolean().optional(),
  soundVolume: z.number().min(0).max(1).optional(),
  ambientEnabled: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Change at least one preference.");
export const notificationReadSchema = z.object({ id: z.string().cuid().optional(), readAll: z.boolean().optional() }).strict().refine((value) => value.id || value.readAll, "Choose a notification to mark as read.");
export const friendTokenSchema = z.object({ friendToken: z.string().trim().min(10).max(10).regex(/^[0-9A-HJKMNP-TV-Z]{10}$/i) }).strict();
export const friendInviteSchema = z.object({ friendToken: z.string().trim().length(10).regex(/^[0-9A-HJKMNP-TV-Z]{10}$/i) }).strict();
export const inviteActionSchema = z.object({ action: z.enum(["accept", "decline", "cancel"]) }).strict();
export const friendIdSchema = z.object({ friendId: z.string().cuid() }).strict();
export const sharedGoalSchema = z.object({ friendId: z.string().cuid(), title: z.string().trim().min(1).max(120), targetDays: z.number().int().min(1).max(100) }).strict();
export const friendPrivacySchema = z.object({ shareStreak: z.boolean().optional(), shareXp: z.boolean().optional() }).strict().refine((value) => Object.keys(value).length > 0);
export const shopItemIdSchema = z.string().min(2).max(80).regex(/^[a-z0-9-]+$/);
