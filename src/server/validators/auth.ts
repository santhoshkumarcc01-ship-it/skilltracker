import { z } from "zod";

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const password = z.string().min(10).max(128);

export const signupSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  email,
  password,
  confirmPassword: z.string().min(1).max(128),
}).refine((value) => value.password === value.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." });

export const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
export const deleteAccountSchema = z.object({ password: z.string().min(1).max(128) });
const timeZone = z.string().trim().min(1).max(100).refine((value) => {
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; }
  catch { return false; }
}, "Choose a valid timezone.");
export const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  timezone: timeZone.default("UTC"),
  dailyGoal: z.number().int().min(1).max(10),
  pet: z.enum(["sprout", "cloud", "comet", "pebble"]),
  onboarded: z.literal(true).default(true),
}).strict();

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
