import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/server/lib/api";
import { assertCsrf } from "@/server/lib/csrf";
import { requireUser } from "@/server/middleware/require-user";
import { markSharedGoalProgress } from "@/server/services/friend-service";
const goalId = (request: Request) => new URL(request.url).pathname.split("/").at(-2) ?? "";
export async function POST(request: NextRequest) { try { assertCsrf(request); const user = await requireUser(request); return dataResponse(await markSharedGoalProgress(user.id, goalId(request))); } catch (error) { return apiErrorResponse(error); } }

