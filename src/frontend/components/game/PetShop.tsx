"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/frontend/lib/api-client";
import { emitGameEvent } from "@/frontend/lib/game-events";
import { Card, ChunkyButton, EmptyState, Skeleton, Toast } from "@/frontend/components/ui";
import { HopPet } from "@/frontend/components/pets/HopPet";

type ShopItem = { id: string; name: string; description: string; category: string; price: number; emoji: string; color: string; owned: boolean };
type ShopData = { items: ShopItem[]; gems: number };
export function PetShop() {
  const client = useQueryClient();
  const shop = useQuery({ queryKey: ["shop"], queryFn: () => apiRequest<ShopData>("/api/v1/shop") });
  const buy = useMutation({ mutationFn: (id: string) => apiRequest<{ item: ShopItem }>(`/api/v1/shop/${id}/purchase`, { method: "POST", body: JSON.stringify({}) }), onMutate: async (id) => { await client.cancelQueries({ queryKey: ["shop"] }); const before = client.getQueryData<ShopData>(["shop"]); if (before) { const item = before.items.find((value) => value.id === id); client.setQueryData<ShopData>(["shop"], { ...before, gems: Math.max(0, before.gems - (item?.price ?? 0)), items: before.items.map((value) => value.id === id ? { ...value, owned: true } : value) }); } return { before }; }, onError: (_error, _id, context) => { if (context?.before) client.setQueryData(["shop"], context.before); emitGameEvent("mistake"); }, onSuccess: (result) => { emitGameEvent("purchase", { message: `${result.item.name} is ready to wear!` }); }, onSettled: () => { void client.invalidateQueries({ queryKey: ["shop"] }); void client.invalidateQueries({ queryKey: ["dashboard"] }); void client.invalidateQueries({ queryKey: ["user-pet"] }); } });
  if (shop.isPending) return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Skeleton className="h-60" key={index} />)}</div>;
  if (shop.isError || !shop.data) return <Card><EmptyState pet={<HopPet size={64} />} title="The shop’s taking a tiny break" description="Your buddy’s closet will be back soon." /></Card>;
  return <div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-extrabold tracking-[.14em] text-primary-foreground">BUDDY BOUTIQUE</p><h1 className="font-heading text-3xl font-bold">A little something for your pal</h1><p className="mt-1 text-ink/80">Every look is yours to keep.</p></div><div className="rounded-2xl border-2 border-border bg-card px-4 py-2 font-heading text-lg font-bold">💎 {shop.data.gems} gems</div></div>
    {buy.isError && <Toast tone="error" message={buy.error instanceof Error ? buy.error.message : "That purchase couldn’t go through."} />}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{shop.data.items.map((item) => <Card key={item.id} className="flex flex-col overflow-hidden p-0"><div className="grid min-h-36 place-items-center" style={{ backgroundColor: item.color }}><span className="drop-shadow-sm" style={{ fontSize: 68 }} aria-hidden="true">{item.emoji}</span></div><div className="flex flex-1 flex-col p-5"><p className="text-xs font-extrabold uppercase tracking-wider text-ink/80">{item.category}</p><h2 className="mt-1 font-heading text-xl font-bold">{item.name}</h2><p className="mt-1 flex-1 text-sm text-ink/80">{item.description}</p><ChunkyButton className="mt-4 w-full" variant={item.owned ? "ghost" : "primary"} disabled={item.owned || buy.isPending || shop.data.gems < item.price} onClick={() => buy.mutate(item.id)}>{item.owned ? "In your closet" : `Buy · ${item.price} 💎`}</ChunkyButton></div></Card>)}</div>
  </div>;
}

