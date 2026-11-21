"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { PET_COMPONENTS } from "@/components/pets/PetIllustrations";
import { Card, ChunkyButton, Input, Tag, Toast } from "@/components/ui";
import { emitGameEvent } from "@/lib/game-events";

type Item = { id: string; name: string; emoji: string; category: string };
type Pet = { species: keyof typeof PET_COMPONENTS; name: string; bondLevel: number; bondXp: number; equippedHat: string | null; equippedGlasses: string | null; equippedScarf: string | null; inventory: Item[] };
const species = Object.keys(PET_COMPONENTS) as (keyof typeof PET_COMPONENTS)[];
export function PetSettings() {
  const client = useQueryClient();
  const petQuery = useQuery({ queryKey: ["user-pet"], queryFn: () => apiRequest<{ pet: Pet }>("/api/v1/pets").then((result) => result.pet) });
  const [name, setName] = useState("");
  const currentPetName = petQuery.data?.name;
  useEffect(() => { if (currentPetName) setName(currentPetName); }, [currentPetName]);
  const update = useMutation({ mutationFn: (data: Partial<Pick<Pet, "name" | "species" | "equippedHat" | "equippedGlasses" | "equippedScarf">>) => apiRequest<{ pet: Pet }>("/api/v1/pets", { method: "PATCH", body: JSON.stringify(data) }), onSuccess: (result) => { client.setQueryData(["user-pet"], result.pet); emitGameEvent("pet-update"); }, onError: () => emitGameEvent("mistake") });
  const feed = useMutation({ mutationFn: () => apiRequest<{ pet: Pet }>("/api/v1/pets/feed", { method: "POST", body: JSON.stringify({}) }), onSuccess: (result) => { client.setQueryData(["user-pet"], result.pet); void client.invalidateQueries({ queryKey: ["dashboard"] }); emitGameEvent("feed"); }, onError: () => emitGameEvent("mistake") });
  if (petQuery.isPending) return <Card><div className="animate-pulse text-ink/80">Getting your buddy ready…</div></Card>;
  if (!petQuery.data) return <Toast tone="error" message="Your pet couldn’t load. Refresh settings to try again." />;
  const pet = petQuery.data;
  const Pet = PET_COMPONENTS[pet.species];
  const categoryOptions = (category: "hat" | "glasses" | "scarf", selected: string | null) => <select aria-label={`Equipped ${category}`} className="min-h-11 rounded-xl border-2 border-border bg-card px-3" value={selected ?? ""} onChange={(event) => { const key = category === "hat" ? "equippedHat" : category === "glasses" ? "equippedGlasses" : "equippedScarf"; update.mutate({ [key]: event.target.value || null } as Partial<Pick<Pet, "name" | "species" | "equippedHat" | "equippedGlasses" | "equippedScarf">>); }}><option value="">None</option>{pet.inventory.filter((item) => item.category === category).map((item) => <option value={item.id} key={item.id}>{item.emoji} {item.name}</option>)}</select>;
  return <div id="pet" className="space-y-5">
    <div className="flex flex-wrap items-center gap-4 rounded-3xl bg-canvas p-4"><Pet mood="happy" size={104} /><div><h2 className="font-heading text-2xl font-bold">{pet.name}</h2><p className="text-sm text-ink/80">Bond level {pet.bondLevel} · {pet.bondXp % 100}/100 bond XP</p><div className="mt-2 flex flex-wrap gap-2"><Tag>{pet.species}</Tag><Tag tone="purple">{pet.inventory.length} accessories</Tag></div></div><ChunkyButton className="ml-auto" variant="secondary" disabled={feed.isPending} onClick={() => feed.mutate()}>🍓 Feed · 10 gems</ChunkyButton></div>
    <div className="grid gap-4 md:grid-cols-2"><div className="grid gap-2"><label htmlFor="pet-name" className="font-bold">Pet name</label><Input id="pet-name" value={name} maxLength={24} onChange={(event) => setName(event.target.value)} /><ChunkyButton size="sm" variant="ghost" disabled={!name.trim() || name.trim() === pet.name || update.isPending} onClick={() => update.mutate({ name: name.trim() })}>Save name</ChunkyButton></div><label className="grid gap-2 font-bold">Choose your companion<select className="min-h-12 rounded-2xl border-2 border-border bg-card px-3" value={pet.species} onChange={(event) => update.mutate({ species: event.target.value as Pet["species"] })}>{species.map((kind) => <option value={kind} key={kind}>{kind[0]!.toUpperCase() + kind.slice(1)}</option>)}</select></label></div>
    <fieldset className="grid gap-3 rounded-3xl border-2 border-border p-4 sm:grid-cols-3"><legend className="px-2 font-heading text-lg font-bold">Equipped accessories</legend>{(["hat", "glasses", "scarf"] as const).map((category) => <label key={category} className="grid gap-2 text-sm font-bold capitalize">{category}{categoryOptions(category, category === "hat" ? pet.equippedHat : category === "glasses" ? pet.equippedGlasses : pet.equippedScarf)}</label>)}</fieldset>
    {update.isError && <Toast tone="error" message="Your pet couldn’t be updated. Check your inventory and try again." />}{feed.isError && <Toast tone="error" message="There aren’t enough gems for a snack right now." />}
  </div>;
}

