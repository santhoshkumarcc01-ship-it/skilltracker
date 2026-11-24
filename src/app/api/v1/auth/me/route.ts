import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { requireUser } from "@/backend/middleware/require-user";

export async function GET(request: NextRequest) {
  try {
    return dataResponse({ user: await requireUser(request) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

