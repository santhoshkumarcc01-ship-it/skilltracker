import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { assertCsrf } from "@/backend/lib/csrf";
import { requireUser } from "@/backend/middleware/require-user";
import { pokeFriend } from "@/backend/services/friend-service";
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) { try { assertCsrf(request); const user = await requireUser(request); const { id } = await context.params; return dataResponse(await pokeFriend(user.id, id)); } catch (error) { return apiErrorResponse(error); } }

