import type { NextRequest } from "next/server";
import { apiErrorResponse, dataResponse } from "@/backend/lib/api";
import { assertCsrf } from "@/backend/lib/csrf";
import { withZodValidation } from "@/backend/lib/validation";
import { requireUser } from "@/backend/middleware/require-user";
import { addFavoriteMotivationQuote, getFavoriteQuotes, removeFavoriteMotivationQuote } from "@/backend/services/motivation/motivation-service";
import { favoriteQuoteDeleteSchema, favoriteQuoteSchema } from "@/backend/validators/motivation";

const validateAdd = withZodValidation(favoriteQuoteSchema);
const validateDelete = withZodValidation(favoriteQuoteDeleteSchema);
export async function GET(request: NextRequest) {
  try { const user = await requireUser(request); return dataResponse(await getFavoriteQuotes(user.id)); }
  catch (error) { return apiErrorResponse(error); }
}
export async function POST(request: NextRequest) {
  try { assertCsrf(request); const user = await requireUser(request); return dataResponse(await addFavoriteMotivationQuote(user.id, await validateAdd(request)), 201); }
  catch (error) { return apiErrorResponse(error); }
}
export async function DELETE(request: NextRequest) {
  try { assertCsrf(request); const user = await requireUser(request); return dataResponse(await removeFavoriteMotivationQuote(user.id, (await validateDelete(request)).id)); }
  catch (error) { return apiErrorResponse(error); }
}

