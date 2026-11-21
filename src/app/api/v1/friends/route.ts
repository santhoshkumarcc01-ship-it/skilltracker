import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/server/lib/api";
import { requireUser } from "@/server/middleware/require-user";
import { getFriendCollaboration } from "@/server/services/friend-service";
export async function GET(request: NextRequest) { try { const user = await requireUser(request); return dataResponse(await getFriendCollaboration(user.id)); } catch (error) { return apiErrorResponse(error); } }

