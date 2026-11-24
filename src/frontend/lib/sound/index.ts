"use client";

import { Howl, Howler } from "howler";

export type SoundName = "click" | "success" | "streak" | "levelUp" | "chest" | "poke" | "error" | "purchase";
export type SoundPrefs = { muted: boolean; volume: number; ambientEnabled: boolean };
const STORAGE_KEY = "habithop:sound-settings";
const frequencies: Record<SoundName, number[]> = {
  click: [560], success: [523, 659, 784], streak: [440, 554, 659, 880],
  levelUp: [392, 494, 587, 784, 988], chest: [330, 494, 659, 988], poke: [660, 740], error: [330, 247], purchase: [587, 740, 880],
};
let sounds: Partial<Record<SoundName, Howl>> = {};
let ambient: Howl | undefined;
let initialized = false;
let prefs: SoundPrefs = { muted: false, volume: 0.45, ambientEnabled: true };
const subscribers = new Set<(value: SoundPrefs) => void>();

function waveUrl(sequence: number[], duration = 0.42): string {
  const rate = 22050;
  const samples = Math.floor(rate * duration);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  write(0, "RIFF"); view.setUint32(4, 36 + samples * 2, true); write(8, "WAVE"); write(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i += 1) {
    const t = i / rate;
    const note = Math.min(sequence.length - 1, Math.floor(t / (duration / sequence.length)));
    const local = (t * sequence.length) % 1;
    const envelope = Math.min(1, local * 12) * Math.max(0, 1 - local * 0.85);
    const tone = Math.sin(2 * Math.PI * sequence[note] * t) * 0.42 + Math.sin(2 * Math.PI * sequence[note] * 2 * t) * 0.08;
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, tone * envelope)) * 32767, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function readPrefs(): SoundPrefs {
  try { const stored = localStorage.getItem(STORAGE_KEY); if (stored) return { ...prefs, ...JSON.parse(stored) } as SoundPrefs; } catch { /* Storage may be unavailable. */ }
  return prefs;
}
function emitPrefs() { subscribers.forEach((listener) => listener(prefs)); }
function persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* Storage may be unavailable. */ } }

/** Call only from a user gesture. Sound objects are not created or played before this call. */
export function initializeSound(): void {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;
  prefs = readPrefs();
  Howler.volume(prefs.volume);
  Howler.mute(prefs.muted);
  sounds = Object.fromEntries(Object.entries(frequencies).map(([name, notes]) => [name, new Howl({ src: [waveUrl(notes)], volume: 1, preload: true })])) as Partial<Record<SoundName, Howl>>;
  ambient = new Howl({ src: [waveUrl([110, 164.81, 220], 4)], loop: true, volume: 0.035, html5: false });
  if (!prefs.muted && prefs.ambientEnabled) ambient.play();
  emitPrefs();
}
export function playSound(name: SoundName): void { if (!initialized) return; if (sounds[name]) sounds[name]?.play(); }
export function setMuted(muted: boolean): void { prefs = { ...prefs, muted }; Howler.mute(muted); if (initialized && ambient) { if (muted || !prefs.ambientEnabled) ambient.pause(); else ambient.play(); } persist(); emitPrefs(); }
export function setAmbientEnabled(ambientEnabled: boolean): void { prefs = { ...prefs, ambientEnabled }; if (initialized && ambient) { if (prefs.muted || !ambientEnabled) ambient.pause(); else ambient.play(); } persist(); emitPrefs(); }
export function setVolume(volume: number): void { prefs = { ...prefs, volume: Math.max(0, Math.min(1, volume)) }; Howler.volume(prefs.volume); persist(); emitPrefs(); }
export function getSoundPrefs(): SoundPrefs { return prefs; }
export function subscribeSoundPrefs(listener: (value: SoundPrefs) => void): () => void { subscribers.add(listener); return () => subscribers.delete(listener); }

