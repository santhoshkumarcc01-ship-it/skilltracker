"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { currentUserQueryKey } from "@/frontend/components/providers/auth";
import { ApiClientError, type CurrentUser } from "@/frontend/lib/api-client";
import { refreshSession } from "@/frontend/lib/api-client";

const REFRESH_AFTER_MS = 12 * 60 * 1000;

export function SessionRefresher({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (delay = REFRESH_AFTER_MS) => {
      timer = setTimeout(async () => {
        try {
          const user: CurrentUser = await refreshSession();
          if (!active) return;
          queryClient.setQueryData(currentUserQueryKey, user);
          schedule();
        } catch (error) {
          if (!active) return;
          if (error instanceof ApiClientError && error.status === 401) {
            void queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
            return;
          }
          schedule(30_000);
        }
      }, delay);
    };
    schedule();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [queryClient, userId]);
  return null;
}

