import type { Profile, User } from "@prisma/client";
import type { UserWithProfile } from "@/backend/repositories/auth-repository";

export type PublicUser = Pick<User, "id" | "email" | "displayName" | "createdAt"> & { profile: Profile | null };

export function toPublicUser(user: UserWithProfile): PublicUser {
  return { id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt, profile: user.profile };
}
