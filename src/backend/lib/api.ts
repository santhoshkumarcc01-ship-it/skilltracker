import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status, headers: { "Cache-Control": "no-store", ...error.headers } },
    );
  }
  // Never serialize error.message, stack, request bodies, tokens, or email addresses.
  console.error(JSON.stringify({ event: "api_unhandled_error", name: error instanceof Error ? error.name : "UnknownError" }));
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}

export function dataResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status, headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
}
