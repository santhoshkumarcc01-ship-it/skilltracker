"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/frontend/lib/api-client";
import { currentUserQueryKey, useCurrentUser } from "@/frontend/components/providers/auth";
import type { CurrentUser } from "@/frontend/lib/api-client";
import { ChunkyButton, Input, Modal, Skeleton, Toast } from "@/frontend/components/ui";

export function AccountSettings() {
  const user = useCurrentUser();
  const router = useRouter();
  const client = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [dailyGoal, setDailyGoal] = useState(3);
  const [pet, setPet] = useState("sprout");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [accountMessage, setAccountMessage] = useState("");
  useEffect(() => {
    if (!user.data) return;
    setDisplayName(user.data.displayName);
    setTimezone(user.data.profile?.timezone ?? "UTC");
    setDailyGoal(user.data.profile?.dailyGoal ?? 3);
    setPet(user.data.profile?.pet ?? "sprout");
  }, [user.data]);

  const saveProfile = useMutation({
    mutationFn: () => apiRequest<{ profile: NonNullable<CurrentUser["profile"]> }>("/api/v1/me/profile", { method: "PATCH", body: JSON.stringify({ displayName, timezone, dailyGoal, pet, onboarded: true }) }),
    onSuccess: () => { setAccountMessage("Your profile is saved."); void client.invalidateQueries({ queryKey: currentUserQueryKey }); },
  });
  const deleteAccount = useMutation({
    mutationFn: () => apiRequest<{ ok: true }>("/api/v1/me", { method: "DELETE", body: JSON.stringify({ password }) }),
    onSuccess: () => { setDeleteOpen(false); router.replace("/login?deleted=1"); },
  });

  async function exportData() {
    setAccountMessage("");
    try {
      const data = await apiRequest<Record<string, unknown>>("/api/v1/me/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = url; link.download = "habithop-account-export.json"; link.click(); URL.revokeObjectURL(url);
      setAccountMessage("Your account export has downloaded.");
    } catch { setAccountMessage("We couldn’t export your data just now. Please try again."); }
  }

  if (user.isPending) return <Skeleton className="h-72" />;
  if (user.isError || !user.data) return <Toast tone="error" message="Your profile couldn’t load. Refresh the page to try again." />;
  return <div className="space-y-5">
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); setAccountMessage(""); saveProfile.mutate(); }}>
      <label className="grid gap-1 font-bold">Display name<Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={60} /></label>
      <label className="grid gap-1 font-bold">Timezone<Input value={timezone} onChange={(event) => setTimezone(event.target.value)} list="timezone-options" required maxLength={100} aria-describedby="timezone-help" /></label>
      <datalist id="timezone-options"><option value={Intl.DateTimeFormat().resolvedOptions().timeZone} /><option value="UTC" /><option value="America/New_York" /><option value="Europe/London" /><option value="Asia/Kolkata" /><option value="Asia/Tokyo" /></datalist>
      <p id="timezone-help" className="text-sm text-ink/80 sm:col-span-2">Used to set your daily date boundary. Choose a valid IANA timezone such as Asia/Kolkata.</p>
      <label className="grid gap-1 font-bold">Daily goal (tasks)<Input type="number" min={1} max={10} value={dailyGoal} onChange={(event) => setDailyGoal(Number(event.target.value))} required /></label>
      <label className="grid gap-1 font-bold">Onboarding companion<select className="min-h-12 rounded-2xl border-2 border-border bg-card px-4" value={pet} onChange={(event) => setPet(event.target.value)}><option value="sprout">Sprout</option><option value="cloud">Cloud</option><option value="comet">Comet</option><option value="pebble">Pebble</option></select></label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><ChunkyButton type="submit" disabled={saveProfile.isPending}>{saveProfile.isPending ? "Saving…" : "Save profile"}</ChunkyButton><ChunkyButton type="button" variant="ghost" onClick={() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)}>Use device timezone</ChunkyButton>{saveProfile.isError && <span role="alert" className="text-sm font-bold text-coral-foreground">We couldn’t save these changes. Check the timezone and retry.</span>}</div>
    </form>
    <div className="border-t-2 border-border pt-4"><h3 className="font-heading text-lg font-bold">Your account data</h3><p className="mb-3 text-sm text-ink/80">Download a copy of your profile, progress, saved items, and account history.</p><ChunkyButton variant="secondary" onClick={() => void exportData()}>Download my data</ChunkyButton>{accountMessage && <p role="status" className="mt-2 text-sm">{accountMessage}</p>}</div>
    <div className="border-t-2 border-border pt-4"><h3 className="font-heading text-lg font-bold">Delete account</h3><p className="mb-3 text-sm text-ink/80">Permanently remove your account and saved content. Confirm with your password.</p><ChunkyButton variant="danger" onClick={() => setDeleteOpen(true)}>Delete my account</ChunkyButton>{deleteAccount.isError && <p role="alert" className="mt-2 text-sm font-bold text-coral-foreground">The account could not be deleted. Check your password and try again.</p>}</div>
    <Modal open={deleteOpen} onClose={() => { setDeleteOpen(false); setPassword(""); }} title="Delete your account?"><p className="mb-4 text-sm text-ink/80">This permanently deletes your account, saved items, and private uploads.</p><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); deleteAccount.mutate(); }}><label className="grid gap-1 font-bold">Password<Input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><div className="flex justify-end gap-2"><ChunkyButton type="button" variant="ghost" onClick={() => setDeleteOpen(false)}>Keep account</ChunkyButton><ChunkyButton type="submit" variant="danger" disabled={deleteAccount.isPending}>{deleteAccount.isPending ? "Deleting…" : "Delete permanently"}</ChunkyButton></div></form></Modal>
  </div>;
}

