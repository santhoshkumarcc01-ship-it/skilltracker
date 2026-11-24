import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { assertCsrf } from "@/backend/lib/csrf";
import { requireUser } from "@/backend/middleware/require-user";
import { blockFriend, getDuoStreak, removeFriend, unblockFriend } from "@/backend/services/friend-service";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) { try { const user = await requireUser(request); const { id } = await context.params; return dataResponse(await getDuoStreak(user.id, id)); } catch (error) { return apiErrorResponse(error); } }
export async function DELETE(request: NextRequest, context: Context) { try { assertCsrf(request); const user = await requireUser(request); const { id } = await context.params; return dataResponse(await removeFriend(user.id, id)); } catch (error) { return apiErrorResponse(error); } }
export async function PATCH(request: NextRequest, context: Context) { try { assertCsrf(request); const user = await requireUser(request); const { id } = await context.params; const mode = request.nextUrl.searchParams.get("mode"); return dataResponse(mode === "unblock" ? await unblockFriend(user.id, id) : await blockFriend(user.id, id)); } catch (error) { return apiErrorResponse(error); } }

