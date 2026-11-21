"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChunkyButton } from "@/components/ui";
import { apiRequest } from "@/lib/api-client";
import { currentUserQueryKey } from "@/components/providers/auth";

export function LogoutButton() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await apiRequest("/api/v1/auth/logout", { method: "POST" });
      queryClient.removeQueries({ queryKey: currentUserQueryKey });
      router.replace("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign out. Try again.");
    } finally { setBusy(false); }
  }
  return <div><ChunkyButton variant="ghost" className="w-full justify-start" onClick={signOut} disabled={busy}>{busy ? "Signing out…" : "↪ Sign out"}</ChunkyButton>{error && <p className="mt-1 text-sm text-coral-foreground" role="alert">{error}</p>}</div>;
}

