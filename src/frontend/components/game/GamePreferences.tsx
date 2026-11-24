"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/frontend/lib/api-client";
import { ChunkyButton, Skeleton, Toggle, Toast } from "@/frontend/components/ui";

type Preferences = { reduceFomo: boolean; reduceMotion: boolean; theme: "light" | "dark" };
export function GamePreferences() {
  const client = useQueryClient();
  const preferences = useQuery({ queryKey: ["preferences"], queryFn: () => apiRequest<{ preferences: Preferences }>("/api/v1/preferences").then((result) => result.preferences) });
  const update = useMutation({ mutationFn: (patch: Partial<Preferences>) => apiRequest<{ preferences: Preferences }>("/api/v1/preferences", { method: "PATCH", body: JSON.stringify(patch) }), onMutate: async (patch) => { await client.cancelQueries({ queryKey: ["preferences"] }); const previous = client.getQueryData<Preferences>(["preferences"]); client.setQueryData(["preferences"], { ...(previous ?? { reduceFomo: false, reduceMotion: false }), ...patch }); return { previous }; }, onError: (_error, _value, context) => { if (context?.previous) client.setQueryData(["preferences"], context.previous); }, onSuccess: (result) => client.setQueryData(["preferences"], result.preferences) });
  if (preferences.isPending) return <Skeleton className="h-20" />;
  if (preferences.isError || !preferences.data) return <Toast tone="error" message="Game preferences are unavailable right now." />;
  return <div className="space-y-4"><label className="flex flex-wrap items-center gap-3 font-bold">Color theme<select aria-label="Color theme" className="min-h-11 rounded-xl border-2 border-border bg-card px-3" value={preferences.data.theme} onChange={(event) => update.mutate({ theme: event.target.value as Preferences["theme"] })}><option value="light">Light</option><option value="dark">Dark</option></select></label><div><Toggle checked={preferences.data.reduceMotion} onChange={(value) => update.mutate({ reduceMotion: value })} label="Reduce motion" /><p className="mt-1 text-sm text-ink/80">Limit decorative movement and page transitions.</p></div><div><Toggle checked={preferences.data.reduceFomo} onChange={(value) => update.mutate({ reduceFomo: value })} label="Reduce FOMO prompts" /><p className="mt-1 text-sm text-ink/80">When on, we hide countdown pressure and use gentle reminders to keep play at your pace.</p></div>{update.isError && <ChunkyButton size="sm" variant="ghost" onClick={() => void preferences.refetch()}>Try again</ChunkyButton>}</div>;
}

