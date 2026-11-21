import { z } from "zod";

export const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a real calendar date.");
const localDate = localDateSchema;
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const createTaskSchema = z.object({ localDate, title: z.string().trim().min(1).max(120), category: z.string().trim().min(1).max(40), scheduledStart: time, plannedMinutes: z.number().int().min(1).max(480) }).strict();
export const updateTaskSchema = z.object({ localDate, title: z.string().trim().min(1).max(120).optional(), category: z.string().trim().min(1).max(40).optional(), scheduledStart: time.optional(), plannedMinutes: z.number().int().min(1).max(480).optional(), position: z.number().int().min(0).optional() }).strict();
export const startTaskSchema = z.object({ localDate, action: z.enum(["start", "pause", "resume"]).default("start") }).strict();
export const completeTaskSchema = z.object({ localDate }).strict();
export const dayQuerySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const freezePurchaseSchema = z.object({}).strict();
