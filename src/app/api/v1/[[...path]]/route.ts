import { NextResponse } from "next/server";

function notFound() {
  return NextResponse.json({ error: { code: "NOT_FOUND", message: "API endpoint not found." } }, { status: 404, headers: { "Cache-Control": "no-store" } });
}

export const GET = notFound;
export const HEAD = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
export const OPTIONS = notFound;

