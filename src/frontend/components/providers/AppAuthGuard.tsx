"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentUser } from "@/frontend/components/providers/auth";
import { SessionRefresher } from "@/frontend/components/providers/SessionRefresher";

export function AppAuthGuard({ children }: { children: ReactNode }) {
  const { data: user, isPending, isError } = useCurrentUser();
  const pathname = usePathname();
  const router = useRouter();
  const onboarded = Boolean(user?.profile?.onboarded);

  useEffect(() => {
    if (isError) router.replace("/login");
    else if (user && !onboarded && pathname !== "/onboarding") router.replace("/onboarding");
    else if (user && onboarded && pathname === "/onboarding") router.replace("/dashboard");
  }, [isError, onboarded, pathname, router, user]);

  if (isPending || isError || !user || (!onboarded && pathname !== "/onboarding") || (onboarded && pathname === "/onboarding")) {
    return <div className="grid min-h-[50vh] place-items-center" role="status"><span className="font-heading text-xl font-bold">Getting your hop ready…</span></div>;
  }
  return <><SessionRefresher userId={user.id} />{children}</>;
}

