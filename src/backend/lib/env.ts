import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(32),
  S3_ENDPOINT: z.string().url(),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(3),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  TASK_COMPLETION_FRACTION: z.coerce.number().min(0.05).max(1).default(0.25),
  CRON_SECRET: z.string().min(32).optional(),
  REPORT_CRON_SECRET: z.string().min(32).optional(),
});

/** Parse eagerly so a server process fails at boot with a clear configuration error. */
export const env = environmentSchema.parse(process.env);
export type Environment = z.infer<typeof environmentSchema>;
