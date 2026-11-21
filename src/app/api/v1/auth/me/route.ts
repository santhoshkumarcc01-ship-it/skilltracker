import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/server/lib/api";
import { requireUser } from "@/server/middleware/require-user";

export async function GET(request: NextRequest) {
  try {
    return dataResponse({ user: await requireUser(request) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

