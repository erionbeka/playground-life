import { useSyncExternalStore } from "react";

export type InputMode = "default" | "dwell" | "switch";
export type TimingPreset = "slow" | "medium" | "fast";

export interface InputModeSettings {
  mode: InputMode;
  dwellMs: number;
  scanIntervalMs: number;
  scanAutostart: boolean;
  switchKeys: string[];
  switchOnClick: boolean;
  showDwellRing: boolean;
  perChild: Record<string, Partial<InputModeSettings>>;
}

type StorableSettings = Omit<InputModeSettings, "perChild">;

export const DEFAULT_INPUT_MODE: InputModeSettings = {
  mode: "default",
  dwellMs: 900,
  scanIntervalMs: 1200,
  scanAutostart: true,
  switchKeys: ["Space", "Enter"],
  switchOnClick: true,
  showDwellRing: true,
  perChild: {},
};

export const TIMING_PRESETS: Record<TimingPreset, { dwellMs: number; scanIntervalMs: number }> = {
  slow: { dwellMs: 1600, scanIntervalMs: 1800 },
  medium: { dwellMs: 900, scanIntervalMs: 1200 },
  fast: { dwellMs: 500, scanIntervalMs: 800 },
};

export const DWELL_RANGE = { min: 300, max: 2500, step: 50 };
export const SCAN_RANGE = { min: 400, max: 2500, step: 50 };

const STORAGE_KEY = "pp-input-mode-v1";
type Listener = () => void;
const listeners = new Set<Listener>();

function cloneDefaults(): InputModeSettings {
  return { ...DEFAULT_INPUT_MODE, switchKeys: [...DEFAULT_INPUT_MODE.switchKeys], perChild: {} };
}

function load(): InputModeSettings {
  const defaults = cloneDefaults();
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<InputModeSettings>;
    const perChild =
      parsed.perChild && typeof parsed.perChild === "object" ? parsed.perChild : {};
    return {
      ...defaults,
      ...parsed,
      switchKeys: Array.isArray(parsed.switchKeys) ? parsed.switchKeys : defaults.switchKeys,
      perChild,
    };
  } catch {
    return defaults;
  }
}

let state: InputModeSettings = load();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function getInputModeSnapshot(): InputModeSettings {
  return state;
}

export function subscribeInputMode(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateInputMode(patch: Partial<StorableSettings>): void {
  state = { ...state, ...patch };
  persist();
  emit();
}

export function updateChildInputMode(childId: string, patch: Partial<StorableSettings>): void {
  state = {
    ...state,
    perChild: { ...state.perChild, [childId]: { ...state.perChild[childId], ...patch } },
  };
  persist();
  emit();
}

export function clearChildInputMode(childId: string): void {
  const next = { ...state.perChild };
  delete next[childId];
  state = { ...state, perChild: next };
  persist();
  emit();
}

export function useInputMode(): InputModeSettings {
  return useSyncExternalStore(subscribeInputMode, getInputModeSnapshot, getInputModeSnapshot);
}

export function effectiveInputMode(childId?: string): InputModeSettings {
  if (!childId) return state;
  const override = state.perChild[childId];
  if (!override) return state;
  return { ...state, ...override, perChild: state.perChild };
}

export function applyTimingPreset(preset: TimingPreset, childId?: string): void {
  const timing = TIMING_PRESETS[preset];
  if (childId) updateChildInputMode(childId, timing);
  else updateInputMode(timing);
}

export function presetFor(
  s: Pick<InputModeSettings, "dwellMs" | "scanIntervalMs">,
): TimingPreset | null {
  const entry = (
    Object.entries(TIMING_PRESETS) as [
      TimingPreset,
      { dwellMs: number; scanIntervalMs: number },
    ][]
  ).find(([, t]) => t.dwellMs === s.dwellMs && t.scanIntervalMs === s.scanIntervalMs);
  return entry ? entry[0] : null;
}

export function resetInputMode(): void {
  state = cloneDefaults();
  persist();
  emit();
}
