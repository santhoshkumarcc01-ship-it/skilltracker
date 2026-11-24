import { Card } from "@/frontend/components/ui";
import { SoundControls } from "@/frontend/components/game/SoundControls";
import { GamePreferences } from "@/frontend/components/game/GamePreferences";
import { PetSettings } from "@/frontend/components/pets/PetSettings";
import { AccountSettings } from "@/frontend/components/settings/AccountSettings";

export default function SettingsPage() {
  return <div className="space-y-5"><header><p className="text-sm font-extrabold tracking-[.14em] text-primary-foreground">YOUR PLAY SPACE</p><h1 className="font-heading text-3xl font-bold">Settings</h1></header>
    <Card><h2 className="mb-4 font-heading text-2xl font-bold">Your companion</h2><PetSettings /></Card>
    <Card><h2 className="mb-4 font-heading text-2xl font-bold">Profile and account</h2><AccountSettings /></Card>
    <Card><h2 className="mb-4 font-heading text-2xl font-bold">Gentle reminders</h2><GamePreferences /></Card>
    <Card><h2 className="mb-4 font-heading text-2xl font-bold">Sound</h2><SoundControls /></Card>
  </div>;
}

