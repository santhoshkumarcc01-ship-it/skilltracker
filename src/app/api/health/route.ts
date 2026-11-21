import { NextResponse } from "next/server";
import { prisma } from "@/server/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ data: { status: "ok" } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: { code: "UNAVAILABLE", message: "Service is temporarily unavailable." } }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

