import { useSyncExternalStore } from "react";

export interface SensorySettings {
  soundOn: boolean;
  calmMode: boolean;
}

type Listener = () => void;

const STORAGE_KEY = "pp-sensory-v1";
const listeners = new Set<Listener>();

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function load(): SensorySettings {
  const defaults: SensorySettings = { soundOn: true, calmMode: prefersReducedMotion() };
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<SensorySettings>;
    return {
      soundOn: parsed.soundOn ?? true,
      calmMode: parsed.calmMode ?? defaults.calmMode,
    };
  } catch {
    return defaults;
  }
}

let state: SensorySettings = load();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
}

export function getSensorySnapshot(): SensorySettings {
  return state;
}

export function subscribeSensory(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateSensory(patch: Partial<SensorySettings>) {
  state = { ...state, ...patch };
  persist();
  listeners.forEach((listener) => listener());
}

export function useSensory(): SensorySettings {
  return useSyncExternalStore(subscribeSensory, getSensorySnapshot, getSensorySnapshot);
}
