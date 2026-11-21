import { z } from "zod";
import { weekStartForLocalDate } from "@/server/lib/habit-math";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Invalid date.");
export const reportWeekQuery = z.object({ week: dateSchema.optional() }).superRefine(({ week }, context) => {
  if (!week) return;
  if (weekStartForLocalDate(week) !== week) context.addIssue({ code: "custom", message: "Choose a Monday to start the report week.", path: ["week"] });
});
