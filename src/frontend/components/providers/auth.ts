"use client";

import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "@/frontend/lib/api-client";

export const currentUserQueryKey = ["auth", "current-user"] as const;

export function useCurrentUser() {
  return useQuery({ queryKey: currentUserQueryKey, queryFn: getCurrentUser, staleTime: 30_000 });
}

