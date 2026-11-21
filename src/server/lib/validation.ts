import type { NextRequest } from "next/server";
import type { z } from "zod";
import { ApiError } from "@/server/lib/api";

export function withZodValidation<TSchema extends z.ZodTypeAny>(schema: TSchema) {
  return async (request: NextRequest): Promise<z.infer<TSchema>> => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, "INVALID_REQUEST", "Request body must be valid JSON.");
    }
    const result = schema.safeParse(body);
    if (!result.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Please check the submitted fields.");
    }
    return result.data;
  };
}

export function withZodSearchParams<TSchema extends z.ZodTypeAny>(schema: TSchema) {
  return (request: Request): z.infer<TSchema> => {
    const parsed = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", "Please check the query parameters.");
    return parsed.data;
  };
}
