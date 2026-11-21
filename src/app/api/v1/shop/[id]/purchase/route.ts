import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse, ApiError } from "@/server/lib/api";
import { assertCsrf } from "@/server/lib/csrf";
import { withZodValidation } from "@/server/lib/validation";
import { requireUser } from "@/server/middleware/require-user";
import { buyShopItem } from "@/server/services/game-service";
import { emptyActionSchema, shopItemIdSchema } from "@/server/validators/game";
const validate = withZodValidation(emptyActionSchema);
type Context = { params: Promise<{ id: string }> };
export async function POST(request: NextRequest, context: Context) { try { assertCsrf(request); const user = await requireUser(request); await validate(request); const { id } = await context.params; const parsedId = shopItemIdSchema.safeParse(id); if (!parsedId.success) throw new ApiError(400, "VALIDATION_ERROR", "Invalid item identifier."); return dataResponse({ item: await buyShopItem(user.id, parsedId.data) }, 201); } catch (error) { return apiErrorResponse(error); } }

