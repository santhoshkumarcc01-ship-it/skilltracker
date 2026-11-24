import { ApiError } from "@/backend/lib/api";

export function assertOwnership(requesterId: string, ownerId: string): void {
  if (!requesterId || requesterId !== ownerId) throw new ApiError(404, "NOT_FOUND", "Resource not found.");
}
