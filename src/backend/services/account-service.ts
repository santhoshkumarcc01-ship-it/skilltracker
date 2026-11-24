import { ApiError } from "@/backend/lib/api";
import { writeAudit } from "@/backend/lib/audit";
import { verifyPassword } from "@/backend/lib/auth/password";
import { assertOwnership } from "@/backend/middleware/ownership";
import { deleteOwnedUser, exportOwnedUserData, findUserById, updateOwnedProfile } from "@/backend/repositories/auth-repository";
import { removeAllUserStorage } from "@/backend/services/storage/storage-service";
import type { ProfileInput } from "@/backend/validators/auth";

export async function updateProfile(userId: string, input: ProfileInput) {
  assertOwnership(userId, userId);
  const profile = await updateOwnedProfile(userId, input);
  if (!profile) throw new ApiError(404, "NOT_FOUND", "Profile not found.");
  return profile;
}

export async function exportUserData(userId: string) {
  assertOwnership(userId, userId);
  const data = await exportOwnedUserData(userId);
  if (!data) throw new ApiError(404, "NOT_FOUND", "Account not found.");
  return data;
}

export async function deleteAccount(userId: string, password: string, ip?: string): Promise<void> {
  const user = await findUserById(userId);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }
  await writeAudit("account_deleted", { userId: user.id, email: user.email, ip });
  assertOwnership(user.id, user.id);
  await removeAllUserStorage(user.id);
  await deleteOwnedUser(user.id);
}
