"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/frontend/lib/api-client";
import { getSoundPrefs, initializeSound, playSound, setAmbientEnabled, setMuted, setVolume, subscribeSoundPrefs, type SoundName } from "@/frontend/lib/sound";
import { ChunkyButton, Toggle, Toast } from "@/frontend/components/ui";

const soundNames: SoundName[] = ["click", "success", "streak", "levelUp", "chest", "poke", "error", "purchase"];
type PreferenceData = { soundMuted: boolean; soundVolume: number; ambientEnabled: boolean };
export function SoundControls() {
  const [prefs, updatePrefs] = useState(getSoundPrefs());
  const queryClient = useQueryClient();
  const preference = useQuery({ queryKey: ["preferences"], queryFn: () => apiRequest<{ preferences: PreferenceData }>("/api/v1/preferences").then((result) => result.preferences) });
  const save = useMutation({ mutationFn: (input: Partial<PreferenceData>) => apiRequest<{ preferences: PreferenceData }>("/api/v1/preferences", { method: "PATCH", body: JSON.stringify(input) }), onSuccess: (result) => queryClient.setQueryData(["preferences"], result.preferences) });
  useEffect(() => subscribeSoundPrefs(updatePrefs), []);
  useEffect(() => { if (!preference.data) return; setMuted(preference.data.soundMuted); setVolume(preference.data.soundVolume); setAmbientEnabled(preference.data.ambientEnabled); }, [preference.data]);
  const update = (input: Partial<PreferenceData>) => { if ("soundMuted" in input) setMuted(input.soundMuted!); if ("soundVolume" in input) setVolume(input.soundVolume!); if ("ambientEnabled" in input) setAmbientEnabled(input.ambientEnabled!); save.mutate(input); };
  return <div className="space-y-4" onPointerDownCapture={initializeSound} onKeyDownCapture={initializeSound}>
    <div className="flex flex-wrap items-center justify-between gap-4"><Toggle checked={prefs.muted} onChange={(muted) => update({ soundMuted: muted })} label={prefs.muted ? "Sound muted" : "Sound on"} /><Toggle checked={prefs.ambientEnabled} onChange={(ambientEnabled) => update({ ambientEnabled })} label="Ambient loop" /><label className="flex items-center gap-3 font-semibold">Volume <input aria-label="Sound volume" type="range" min="0" max="1" step="0.05" value={prefs.volume} onChange={(event) => { initializeSound(); update({ soundVolume: Number(event.target.value) }); }} /></label></div>
    <div className="flex flex-wrap gap-3">{soundNames.map((name) => <ChunkyButton key={name} size="sm" variant="secondary" onClick={() => { initializeSound(); playSound(name); }}>{name === "levelUp" ? "Level up" : name}</ChunkyButton>)}</div>
    {save.isError && <Toast tone="error" message="Sound preferences could not sync to your account. They remain saved on this device." />}
    <p className="text-sm text-ink/80">Sound starts after your first interaction. Preferences sync to your account and this device.</p>
  </div>;
}

