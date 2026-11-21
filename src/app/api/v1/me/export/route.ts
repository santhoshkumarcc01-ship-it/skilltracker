import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/server/lib/api";
import { requireUser } from "@/server/middleware/require-user";
import { exportUserData } from "@/server/services/account-service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    return dataResponse({ export: await exportUserData(user.id) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

