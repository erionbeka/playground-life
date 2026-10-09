# Switch & Dwell Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dwell and single-switch scanning input modes that drive the existing game buttons, AAC bar, and in-game dialogs without modifying any engine.

**Architecture:** A settings store (`src/lib/inputMode.ts`) mirrors the existing `sensory.ts` external-store pattern. An `InputModeProvider` around the `GamePlayer` subtree owns a registry of named DOM "regions" (`play`, `aac`, `dialog`) and renders exactly one controller: `DwellController` (pointer-over timer + ring) or `ScanController` (linear highlight + switch signal). Both activate targets with real `focus()` then `click()` so existing engine/AAC/scoring paths run unchanged.

**Tech Stack:** React + TypeScript, Vite, vitest v3 + jsdom + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-10-09-switch-dwell-input-design.md`

**Note on VCS:** This workspace is not a git repository, so commit steps are omitted. Each task ends with a test/verification "Checkpoint" instead.

## Global Constraints

- Do NOT modify anything under `src/components/game/engines/**`.
- Activation must call `element.focus()` then `element.click()` exactly once per signal.
- Settings persist to `localStorage` under `pp-input-mode-v1`; store mirrors `src/lib/sensory.ts`.
- Shell is PowerShell; `npx`/`.ps1` shims are blocked. Run binaries via `.bin`:
  - Single test file: `& .\node_modules\.bin\vitest.cmd run <path>`
  - Full client suite: `& .\node_modules\.bin\vitest.cmd run --reporter=basic`
  - Server suite: `& .\node_modules\.bin\vitest.cmd run server/test`
  - Client types: `& .\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.app.json`
  - Server types: `npm.cmd run typecheck:server`
  - Lint: `npm.cmd run lint`
- `useReducedMotionMode` and `reduceMotionEffects` come from `@/lib/motion`; `calmMode` from `useSensory()` in `@/lib/sensory`.
- Default timings: dwell `900` ms, scan `1200` ms. Presets: slow `1600/1800`, medium `900/1200`, fast `500/800`.
- Default switch keys: `["Space", "Enter"]`. Click-to-signal defaults on.

---

### Task 1: Input-mode settings store

**Files:**
- Create: `src/lib/inputMode.ts`
- Test: `src/test/inputMode.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type InputMode = "default" | "dwell" | "switch"`
  - `type TimingPreset = "slow" | "medium" | "fast"`
  - `interface InputModeSettings { mode; dwellMs; scanIntervalMs; scanAutostart; switchKeys: string[]; switchOnClick; showDwellRing; perChild: Record<string, Partial<InputModeSettings>> }`
  - `const DEFAULT_INPUT_MODE: InputModeSettings`
  - `const TIMING_PRESETS: Record<TimingPreset, { dwellMs: number; scanIntervalMs: number }>`
  - `getInputModeSnapshot(): InputModeSettings`
  - `subscribeInputMode(l: () => void): () => void`
  - `updateInputMode(patch: Partial<Omit<InputModeSettings, "perChild">>): void`
  - `updateChildInputMode(childId: string, patch: Partial<Omit<InputModeSettings, "perChild">>): void`
  - `clearChildInputMode(childId: string): void`
  - `useInputMode(): InputModeSettings`
  - `effectiveInputMode(childId?: string): InputModeSettings`
  - `applyTimingPreset(preset: TimingPreset, childId?: string): void`
  - `presetFor(s: Pick<InputModeSettings, "dwellMs" | "scanIntervalMs">): TimingPreset | null`
  - `resetInputMode(): void` (test helper)

- [ ] **Step 1: Write the failing test**

```ts
// src/test/inputMode.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_INPUT_MODE,
  applyTimingPreset,
  clearChildInputMode,
  effectiveInputMode,
  getInputModeSnapshot,
  presetFor,
  resetInputMode,
  updateChildInputMode,
  updateInputMode,
} from "@/lib/inputMode";

describe("inputMode store", () => {
  beforeEach(() => {
    localStorage.clear();
    resetInputMode();
  });

  it("starts from defaults", () => {
    expect(getInputModeSnapshot().mode).toBe("default");
    expect(DEFAULT_INPUT_MODE.dwellMs).toBe(900);
    expect(DEFAULT_INPUT_MODE.switchKeys).toEqual(["Space", "Enter"]);
  });

  it("persists global updates to localStorage", () => {
    updateInputMode({ mode: "dwell", dwellMs: 1200 });
    expect(getInputModeSnapshot().mode).toBe("dwell");
    const raw = JSON.parse(localStorage.getItem("pp-input-mode-v1") ?? "{}");
    expect(raw.mode).toBe("dwell");
    expect(raw.dwellMs).toBe(1200);
  });

  it("layers a per-child override over the global settings", () => {
    updateInputMode({ mode: "switch", scanIntervalMs: 1500 });
    updateChildInputMode("child-1", { scanIntervalMs: 700 });
    expect(effectiveInputMode("child-1").scanIntervalMs).toBe(700);
    expect(effectiveInputMode("child-1").mode).toBe("switch");
    expect(effectiveInputMode("child-2").scanIntervalMs).toBe(1500);
    expect(effectiveInputMode().scanIntervalMs).toBe(1500);
  });

  it("clears a child override", () => {
    updateChildInputMode("child-1", { dwellMs: 300 });
    clearChildInputMode("child-1");
    expect(effectiveInputMode("child-1").dwellMs).toBe(DEFAULT_INPUT_MODE.dwellMs);
  });

  it("applies timing presets globally or per child", () => {
    applyTimingPreset("fast");
    expect(getInputModeSnapshot().dwellMs).toBe(500);
    expect(getInputModeSnapshot().scanIntervalMs).toBe(800);
    applyTimingPreset("slow", "child-1");
    expect(effectiveInputMode("child-1").dwellMs).toBe(1600);
    expect(getInputModeSnapshot().dwellMs).toBe(500);
  });

  it("detects the active preset", () => {
    expect(presetFor({ dwellMs: 900, scanIntervalMs: 1200 })).toBe("medium");
    expect(presetFor({ dwellMs: 1234, scanIntervalMs: 1200 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/inputMode.test.ts`
Expected: FAIL — cannot resolve `@/lib/inputMode`.

- [ ] **Step 3: Write the store**

```ts
// src/lib/inputMode.ts
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
  const entry = (Object.entries(TIMING_PRESETS) as [TimingPreset, { dwellMs: number; scanIntervalMs: number }][]).find(
    ([, t]) => t.dwellMs === s.dwellMs && t.scanIntervalMs === s.scanIntervalMs,
  );
  return entry ? entry[0] : null;
}

export function resetInputMode(): void {
  state = cloneDefaults();
  persist();
  emit();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/inputMode.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Checkpoint**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/inputMode.test.ts`
Expected: PASS. Do not proceed if red.

---

### Task 2: Target discovery & region resolution

**Files:**
- Create: `src/components/input/targets.ts`
- Test: `src/test/targets.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `const TARGET_SELECTOR: string`
  - `interface RegionRegistration { name: string; priority: number; element: HTMLElement | null }`
  - `isEligibleTarget(el: Element | null | undefined): el is HTMLElement`
  - `collectTargets(root: ParentNode | null): HTMLElement[]`
  - `resolveActiveTargets(regions: RegionRegistration[]): HTMLElement[]`

- [ ] **Step 1: Write the failing test**

```ts
// src/test/targets.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import { collectTargets, resolveActiveTargets, type RegionRegistration } from "@/components/input/targets";

function host(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

describe("collectTargets", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("collects buttons, role=button and links in DOM order", () => {
    const root = host(`
      <div>
        <button id="a">A</button>
        <div role="button" id="b">B</div>
        <a href="#x" id="c">C</a>
      </div>`);
    expect(collectTargets(root).map((el) => el.id)).toEqual(["a", "b", "c"]);
  });

  it("skips disabled, aria-disabled and data-input-ignore elements", () => {
    const root = host(`
      <button id="ok">ok</button>
      <button id="dis" disabled>dis</button>
      <div role="button" id="aria" aria-disabled="true">aria</div>
      <button id="ign" data-input-ignore>ign</button>`);
    expect(collectTargets(root).map((el) => el.id)).toEqual(["ok"]);
  });

  it("skips elements hidden with display:none", () => {
    const root = host(`<button id="vis">v</button><button id="hid" style="display:none">h</button>`);
    expect(collectTargets(root).map((el) => el.id)).toEqual(["vis"]);
  });

  it("keeps only the innermost element of nested targets", () => {
    const root = host(`<div role="button" id="outer"><button id="inner">i</button></div>`);
    expect(collectTargets(root).map((el) => el.id)).toEqual(["inner"]);
  });
});

describe("resolveActiveTargets", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("orders play before aac when no dialog is present", () => {
    const root = host(`
      <div id="play"><button id="p1">p1</button></div>
      <div id="aac"><button id="a1">a1</button></div>`);
    const play: RegionRegistration = { name: "play", priority: 20, element: root.querySelector("#play") };
    const aac: RegionRegistration = { name: "aac", priority: 10, element: root.querySelector("#aac") };
    expect(resolveActiveTargets([aac, play]).map((el) => el.id)).toEqual(["p1", "a1"]);
  });

  it("uses only dialog targets when a dialog is present", () => {
    const root = host(`
      <div id="play"><button id="p1">p1</button></div>
      <div id="aac"><button id="a1">a1</button></div>
      <div id="dialog"><button id="d1">d1</button></div>`);
    const regions: RegionRegistration[] = [
      { name: "aac", priority: 10, element: root.querySelector("#aac") },
      { name: "play", priority: 20, element: root.querySelector("#play") },
      { name: "dialog", priority: 30, element: root.querySelector("#dialog") },
    ];
    expect(resolveActiveTargets(regions).map((el) => el.id)).toEqual(["d1"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/targets.test.ts`
Expected: FAIL — cannot resolve `@/components/input/targets`.

- [ ] **Step 3: Write the helpers**

```ts
// src/components/input/targets.ts
export const TARGET_SELECTOR = [
  "button:not([disabled])",
  '[role="button"]:not([disabled])',
  "a[href]",
  "[data-input-target]:not([data-input-ignore])",
].join(", ");

export interface RegionRegistration {
  name: string;
  priority: number;
  element: HTMLElement | null;
}

function isVisible(el: HTMLElement): boolean {
  if (el.hasAttribute("hidden")) return false;
  const anyEl = el as HTMLElement & { checkVisibility?: () => boolean };
  if (typeof anyEl.checkVisibility === "function") {
    try {
      return anyEl.checkVisibility();
    } catch {
      /* fall through to computed style */
    }
  }
  const style = typeof window !== "undefined" ? window.getComputedStyle(el) : null;
  if (style && (style.display === "none" || style.visibility === "hidden")) return false;
  return true;
}

export function isEligibleTarget(el: Element | null | undefined): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.matches("[data-input-ignore]")) return false;
  if (el.hasAttribute("disabled")) return false;
  if (el.getAttribute("aria-disabled") === "true") return false;
  return isVisible(el);
}

export function collectTargets(root: ParentNode | null): HTMLElement[] {
  if (!root) return [];
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(TARGET_SELECTOR)).filter(isEligibleTarget);
  return nodes.filter((el) => !nodes.some((other) => other !== el && el.contains(other)));
}

export function resolveActiveTargets(regions: RegionRegistration[]): HTMLElement[] {
  const withTargets = regions
    .map((region) => ({ region, targets: collectTargets(region.element) }))
    .filter((entry) => entry.targets.length > 0);
  const dialogs = withTargets.filter((entry) => entry.region.name === "dialog");
  const active = dialogs.length > 0 ? dialogs : withTargets.filter((entry) => entry.region.name !== "dialog");
  return active
    .slice()
    .sort((a, b) => b.region.priority - a.region.priority)
    .flatMap((entry) => entry.targets);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/targets.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Checkpoint**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/targets.test.ts src/test/inputMode.test.ts`
Expected: PASS.

---

### Task 3: Activation ring, switch-signal hook, context & provider

**Files:**
- Create: `src/components/input/ActivationRing.tsx`
- Create: `src/components/input/SwitchInput.tsx`
- Create: `src/components/input/context.ts`
- Create: `src/components/input/InputModeProvider.tsx`
- Test: `src/test/inputProvider.test.tsx`

**Interfaces:**
- Consumes: `src/lib/inputMode.ts` (Task 1), `src/components/input/targets.ts` (Task 2).
- Produces:
  - `ActivationRing(props: { rect: { left; top; width; height } | null; progress: number; reduced?: boolean }): JSX.Element | null`
  - `useSwitchSignal(opts: { keys: string[]; onClick: boolean; enabled: boolean; onSignal: () => void }): void`
  - `interface InputModeContextValue { mode: InputMode; settings: InputModeSettings; childId?: string; version: number; setRegion(name, priority, element): void; activate(element): void }`
  - `InputModeContext: React.Context<InputModeContextValue | null>`
  - `useInputModeContext(): InputModeContextValue | null`
  - `useTargetRegion(name: string, priority: number): (element: HTMLElement | null) => void`
  - `InputModeProvider(props: { childId?: string; modeOverride?: InputMode; children: ReactNode }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
// src/test/inputProvider.test.tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import InputModeProvider from "@/components/input/InputModeProvider";
import { useTargetRegion } from "@/components/input/context";
import { getInputModeSnapshot, resetInputMode } from "@/lib/inputMode";

function Harness({ onClick }: { onClick: () => void }) {
  const ref = useTargetRegion("play", 20);
  return (
    <div ref={ref}>
      <button onClick={onClick}>Target A</button>
    </div>
  );
}

describe("InputModeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    resetInputMode();
  });

  it("renders children and exposes no controller in default mode", () => {
    render(
      <InputModeProvider>
        <Harness onClick={() => {}} />
      </InputModeProvider>,
    );
    expect(screen.getByRole("button", { name: "Target A" })).toBeTruthy();
    expect(getInputModeSnapshot().mode).toBe("default");
  });

  it("resolves active targets from a registered region", () => {
    const seen: string[] = [];
    render(
      <InputModeProvider modeOverride="dwell">
        <Harness onClick={() => seen.push("a")} />
      </InputModeProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Target A" }));
    expect(seen).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/inputProvider.test.tsx`
Expected: FAIL — cannot resolve `@/components/input/InputModeProvider`.

- [ ] **Step 3a: Write `ActivationRing.tsx`**

```tsx
// src/components/input/ActivationRing.tsx
interface RingRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export default function ActivationRing({
  rect,
  progress,
  reduced = false,
}: {
  rect: RingRect | null;
  progress: number;
  reduced?: boolean;
}) {
  if (!rect) return null;
  const size = Math.max(rect.width, rect.height) + 20;
  const radius = size / 2 - 5;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        left: rect.left + rect.width / 2 - size / 2,
        top: rect.top + rect.height / 2 - size / 2,
        width: size,
        height: size,
        pointerEvents: "none",
        zIndex: 9999,
        opacity: reduced ? 0.85 : 1,
      }}
    >
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(15,23,42,0.25)"
          strokeWidth={5}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#22c55e"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
    </div>
  );
}
```

- [ ] **Step 3b: Write `SwitchInput.tsx`**

```tsx
// src/components/input/SwitchInput.tsx
import { useEffect, useRef } from "react";

const DEBOUNCE_MS = 250;

export function useSwitchSignal({
  keys,
  onClick,
  enabled,
  onSignal,
}: {
  keys: string[];
  onClick: boolean;
  enabled: boolean;
  onSignal: () => void;
}): void {
  const signalRef = useRef(onSignal);
  signalRef.current = onSignal;
  const lastRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const emit = () => {
      const now = Date.now();
      if (now - lastRef.current < DEBOUNCE_MS) return;
      lastRef.current = now;
      signalRef.current();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (keys.includes(event.key) || keys.includes(event.code)) {
        event.preventDefault();
        emit();
      }
    };
    const onPointerDown = () => emit();
    window.addEventListener("keydown", onKeyDown);
    if (onClick) window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [keys, onClick, enabled]);
}
```

- [ ] **Step 3c: Write `context.ts`**

```ts
// src/components/input/context.ts
import { createContext, useCallback, useContext } from "react";
import type { InputMode, InputModeSettings } from "@/lib/inputMode";

export interface InputModeContextValue {
  mode: InputMode;
  settings: InputModeSettings;
  childId?: string;
  version: number;
  setRegion: (name: string, priority: number, element: HTMLElement | null) => void;
  activate: (element: HTMLElement) => void;
}

export const InputModeContext = createContext<InputModeContextValue | null>(null);

export function useInputModeContext(): InputModeContextValue | null {
  return useContext(InputModeContext);
}

export function useTargetRegion(name: string, priority: number) {
  const context = useContext(InputModeContext);
  const setRegion = context?.setRegion;
  return useCallback(
    (element: HTMLElement | null) => {
      setRegion?.(name, priority, element);
    },
    [setRegion, name, priority],
  );
}
```

- [ ] **Step 3d: Write `InputModeProvider.tsx`**

```tsx
// src/components/input/InputModeProvider.tsx
import { ReactNode, useCallback, useMemo, useReducer, useRef, useState } from "react";
import { InputMode, effectiveInputMode, useInputMode } from "@/lib/inputMode";
import { useReducedMotionMode } from "@/lib/motion";
import { useSensory } from "@/lib/sensory";
import { InputModeContext, InputModeContextValue } from "./context";
import { RegionRegistration, resolveActiveTargets } from "./targets";
import ActivationRing from "./ActivationRing";
import DwellController from "./DwellController";
import ScanController from "./ScanController";

function ScanStyles() {
  return (
    <style>{
      ".scan-target{outline:4px solid #22c55e;outline-offset:3px;border-radius:12px;}"
    }</style>
  );
}

export default function InputModeProvider({
  childId,
  modeOverride,
  children,
}: {
  childId?: string;
  modeOverride?: InputMode;
  children: ReactNode;
}) {
  const global = useInputMode();
  const reducedMotion = useReducedMotionMode();
  const calm = useSensory().calmMode;
  const reduced = reducedMotion || calm;

  const settings = useMemo(() => {
    const base = effectiveInputMode(childId);
    return modeOverride ? { ...base, mode: modeOverride } : base;
  }, [global, childId, modeOverride]);

  const regionsRef = useRef<RegionRegistration[]>([]);
  const [version, bumpVersion] = useReducer((value: number) => value + 1, 0);
  const [paused, setPaused] = useState(false);

  const setRegion = useCallback((name: string, priority: number, element: HTMLElement | null) => {
    const next = regionsRef.current.filter((region) => region.name !== name);
    if (element) next.push({ name, priority, element });
    regionsRef.current = next;
    bumpVersion();
  }, []);

  const activate = useCallback((element: HTMLElement) => {
    if (!element || !element.isConnected) return;
    if (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true") return;
    element.focus({ preventScroll: true });
    element.click();
    bumpVersion();
  }, []);

  const value = useMemo<InputModeContextValue>(
    () => ({ mode: settings.mode, settings, childId, version, setRegion, activate }),
    [settings, childId, version, setRegion, activate],
  );

  return (
    <InputModeContext.Provider value={value}>
      <ScanStyles />
      {children}
      {settings.mode === "dwell" ? (
        <DwellController
          regionsRef={regionsRef}
          version={version}
          dwellMs={settings.dwellMs}
          showRing={settings.showDwellRing}
          reduced={reduced}
          onActivate={activate}
        />
      ) : null}
      {settings.mode === "switch" ? (
        <>
          <ScanController
            regionsRef={regionsRef}
            version={version}
            scanIntervalMs={settings.scanIntervalMs}
            scanAutostart={settings.scanAutostart}
            switchKeys={settings.switchKeys}
            switchOnClick={settings.switchOnClick}
            reduced={reduced}
            paused={paused}
            onPause={setPaused}
            onActivate={activate}
          />
          <button
            type="button"
            data-input-ignore
            onClick={() => setPaused((current) => !current)}
            style={{ position: "fixed", bottom: 12, right: 12, zIndex: 10000 }}
            className="rounded-full bg-slate-900/80 px-4 py-2 text-sm font-bold text-white"
          >
            {paused ? "▶ Resume scanning" : "⏸ Pause scanning"}
          </button>
        </>
      ) : null}
    </InputModeContext.Provider>
  );
}

export { ActivationRing };
```

`DwellController` and `ScanController` are created in Tasks 4 and 5. Until then, create minimal placeholder files so this task compiles and its test passes (they are replaced wholesale in their tasks):

```tsx
// src/components/input/DwellController.tsx (placeholder replaced in Task 4)
import { MutableRefObject } from "react";
import { RegionRegistration } from "./targets";
export default function DwellController(_props: {
  regionsRef: MutableRefObject<RegionRegistration[]>;
  version: number;
  dwellMs: number;
  showRing: boolean;
  reduced: boolean;
  onActivate: (el: HTMLElement) => void;
}) {
  return null;
}
```

```tsx
// src/components/input/ScanController.tsx (placeholder replaced in Task 5)
import { MutableRefObject } from "react";
import { RegionRegistration } from "./targets";
export default function ScanController(_props: {
  regionsRef: MutableRefObject<RegionRegistration[]>;
  version: number;
  scanIntervalMs: number;
  scanAutostart: boolean;
  switchKeys: string[];
  switchOnClick: boolean;
  reduced: boolean;
  paused: boolean;
  onPause: (paused: boolean) => void;
  onActivate: (el: HTMLElement) => void;
}) {
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/inputProvider.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Checkpoint**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/inputProvider.test.tsx src/test/targets.test.ts`
Expected: PASS.

---

### Task 4: DwellController

**Files:**
- Modify: `src/components/input/DwellController.tsx` (replace placeholder)
- Test: `src/test/dwell.test.tsx`

**Interfaces:**
- Consumes: `targets.ts` (`resolveActiveTargets`, `isEligibleTarget`, `TARGET_SELECTOR`), `ActivationRing`.
- Produces: `default function DwellController(props: { regionsRef; version; dwellMs; showRing; reduced; onActivate })` (same signature as the placeholder).

Implementation detail: uses `event.target` (works in jsdom and browsers) rather than `document.elementFromPoint`. Timer is a `setInterval` that accumulates elapsed time via `Date.now()` in `STEP_MS = 50` increments; on reaching `dwellMs` it activates once and locks until the pointer leaves that target.

- [ ] **Step 1: Write the failing test**

```tsx
// src/test/dwell.test.tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import InputModeProvider from "@/components/input/InputModeProvider";
import { useTargetRegion } from "@/components/input/context";
import { resetInputMode } from "@/lib/inputMode";

function Harness({ onClick }: { onClick: () => void }) {
  const ref = useTargetRegion("play", 20);
  return (
    <div ref={ref}>
      <button onClick={onClick}>A</button>
      <button onClick={onClick}>B</button>
    </div>
  );
}

function setup(onClick: () => void, dwellMs = 900) {
  return render(
    <InputModeProvider modeOverride="dwell">
      <Harness onClick={onClick} />
    </InputModeProvider>,
  );
}

describe("DwellController", () => {
  beforeEach(() => {
    localStorage.clear();
    resetInputMode();
    vi.useFakeTimers();
  });

  it("activates a target after holding the pointer over it", () => {
    const onClick = vi.fn();
    setup(onClick);
    const a = screen.getByRole("button", { name: "A" });
    fireEvent.pointerMove(a, { clientX: 1, clientY: 1 });
    act(() => vi.advanceTimersByTime(900 + 60));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not activate when the pointer leaves before the dwell completes", () => {
    const onClick = vi.fn();
    setup(onClick);
    const a = screen.getByRole("button", { name: "A" });
    const b = screen.getByRole("button", { name: "B" });
    fireEvent.pointerMove(a, { clientX: 1, clientY: 1 });
    act(() => vi.advanceTimersByTime(400));
    fireEvent.pointerMove(b, { clientX: 2, clientY: 2 });
    act(() => vi.advanceTimersByTime(600));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not re-fire while the pointer stays on the activated target", () => {
    const onClick = vi.fn();
    setup(onClick);
    const a = screen.getByRole("button", { name: "A" });
    fireEvent.pointerMove(a, { clientX: 1, clientY: 1 });
    act(() => vi.advanceTimersByTime(960));
    fireEvent.pointerMove(a, { clientX: 1, clientY: 1 });
    act(() => vi.advanceTimersByTime(960));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/dwell.test.tsx`
Expected: FAIL — activation never happens (placeholder returns null).

- [ ] **Step 3: Implement DwellController**

```tsx
// src/components/input/DwellController.tsx
import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import ActivationRing from "./ActivationRing";
import { RegionRegistration, TARGET_SELECTOR, isEligibleTarget, resolveActiveTargets } from "./targets";

const STEP_MS = 50;

interface Props {
  regionsRef: MutableRefObject<RegionRegistration[]>;
  version: number;
  dwellMs: number;
  showRing: boolean;
  reduced: boolean;
  onActivate: (el: HTMLElement) => void;
}

interface RingState {
  rect: { left: number; top: number; width: number; height: number };
  progress: number;
}

export default function DwellController({ regionsRef, version, dwellMs, showRing, reduced, onActivate }: Props) {
  const [ring, setRing] = useState<RingState | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const lockRef = useRef<HTMLElement | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    targetRef.current = null;
    setRing(null);
  }, []);

  const begin = useCallback(
    (element: HTMLElement) => {
      if (targetRef.current === element) return;
      stop();
      targetRef.current = element;
      startRef.current = Date.now();
      timerRef.current = window.setInterval(() => {
        const current = targetRef.current;
        if (!current || !current.isConnected) {
          stop();
          return;
        }
        const progress = Math.min(1, (Date.now() - startRef.current) / dwellMs);
        if (showRing) {
          const rect = current.getBoundingClientRect();
          setRing({ rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, progress });
        }
        if (progress >= 1) {
          lockRef.current = current;
          onActivate(current);
          stop();
        }
      }, STEP_MS);
    },
    [dwellMs, onActivate, showRing, stop],
  );

  useEffect(() => {
    const resolveFromEvent = (event: Event): HTMLElement | null => {
      const hit = event.target as Element | null;
      const target = hit?.closest?.(TARGET_SELECTOR) as HTMLElement | null;
      if (!target || !isEligibleTarget(target)) return null;
      return resolveActiveTargets(regionsRef.current).includes(target) ? target : null;
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const eligible = resolveFromEvent(event);
      if (!eligible) {
        lockRef.current = null;
        stop();
        return;
      }
      if (lockRef.current === eligible) return;
      begin(eligible);
    };

    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      const eligible = resolveFromEvent(event);
      if (eligible) begin(eligible);
    };

    const onRelease = () => {
      lockRef.current = null;
      stop();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onRelease);
    window.addEventListener("pointercancel", onRelease);
    window.addEventListener("blur", onRelease);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onRelease);
      window.removeEventListener("pointercancel", onRelease);
      window.removeEventListener("blur", onRelease);
      stop();
    };
  }, [begin, stop, regionsRef, version]);

  return <ActivationRing rect={ring?.rect ?? null} progress={ring?.progress ?? 0} reduced={reduced} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/dwell.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Checkpoint**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/dwell.test.tsx src/test/inputProvider.test.tsx`
Expected: PASS.

---

### Task 5: ScanController

**Files:**
- Modify: `src/components/input/ScanController.tsx` (replace placeholder)
- Test: `src/test/scan.test.tsx`

**Interfaces:**
- Consumes: `targets.ts`, `SwitchInput.tsx` `useSwitchSignal`, `ActivationRing`.
- Produces: `default function ScanController(props: { regionsRef; version; scanIntervalMs; scanAutostart; switchKeys; switchOnClick; reduced; paused; onPause; onActivate })` (same signature as the placeholder).

Behavior: on start, highlight index 0 and advance on `scanIntervalMs` (wrapping). A switch signal while scanning activates the highlighted element once then stops; while stopped it (re)starts. `Escape` pauses. Re-resolves on `version` change and autostarts when `scanAutostart` and not paused.

- [ ] **Step 1: Write the failing test**

```tsx
// src/test/scan.test.tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import InputModeProvider from "@/components/input/InputModeProvider";
import { useTargetRegion } from "@/components/input/context";
import { resetInputMode, updateInputMode } from "@/lib/inputMode";

function Harness({ onClick }: { onClick: () => void }) {
  const ref = useTargetRegion("play", 20);
  return (
    <div ref={ref}>
      <button onClick={onClick}>A</button>
      <button onClick={onClick}>B</button>
    </div>
  );
}

function setup(onClick: () => void, autostart = false) {
  updateInputMode({ mode: "switch", scanIntervalMs: 1200, scanAutostart: autostart, switchKeys: ["Space"] });
  return render(
    <InputModeProvider>
      <Harness onClick={onClick} />
    </InputModeProvider>,
  );
}

describe("ScanController", () => {
  beforeEach(() => {
    localStorage.clear();
    resetInputMode();
    vi.useFakeTimers();
  });

  it("starts on the first signal and highlights in DOM order", () => {
    setup(vi.fn());
    act(() => fireEvent.keyDown(window, { key: "Space" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "A" }));
    act(() => vi.advanceTimersByTime(1200));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "B" }));
  });

  it("activates the highlighted target once and stops scanning", () => {
    const onClick = vi.fn();
    setup(onClick);
    act(() => fireEvent.keyDown(window, { key: "Space" })); // start -> highlight A
    act(() => vi.advanceTimersByTime(1200)); // -> highlight B
    act(() => fireEvent.keyDown(window, { key: "Space" })); // activate B, stop
    expect(onClick).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(3600));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("autostarts when configured", () => {
    setup(vi.fn(), true);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "A" }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/scan.test.tsx`
Expected: FAIL — no highlight (placeholder returns null).

- [ ] **Step 3: Implement ScanController**

```tsx
// src/components/input/ScanController.tsx
import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import { useSwitchSignal } from "./SwitchInput";
import { RegionRegistration, isEligibleTarget, resolveActiveTargets } from "./targets";

interface Props {
  regionsRef: MutableRefObject<RegionRegistration[]>;
  version: number;
  scanIntervalMs: number;
  scanAutostart: boolean;
  switchKeys: string[];
  switchOnClick: boolean;
  reduced: boolean;
  paused: boolean;
  onPause: (paused: boolean) => void;
  onActivate: (el: HTMLElement) => void;
}

export default function ScanController({
  regionsRef,
  version,
  scanIntervalMs,
  scanAutostart,
  switchKeys,
  switchOnClick,
  paused,
  onPause,
  onActivate,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const scanningRef = useRef(false);
  const indexRef = useRef(0);
  const prevRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearHighlight = useCallback(() => {
    prevRef.current?.classList.remove("scan-target");
    prevRef.current = null;
  }, []);

  const highlight = useCallback((index: number, list = resolveActiveTargets(regionsRef.current)) => {
    if (list.length === 0) {
      clearHighlight();
      setActiveIndex(-1);
      return;
    }
    const normalized = ((index % list.length) + list.length) % list.length;
    indexRef.current = normalized;
    const element = list[normalized];
    prevRef.current?.classList.remove("scan-target");
    element.classList.add("scan-target");
    element.focus({ preventScroll: true });
    prevRef.current = element;
    setActiveIndex(normalized);
  }, [clearHighlight, regionsRef]);

  const stop = useCallback(() => {
    scanningRef.current = false;
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    clearHighlight();
    setActiveIndex(-1);
  }, [clearHighlight]);

  const start = useCallback(() => {
    const list = resolveActiveTargets(regionsRef.current);
    if (list.length === 0) return;
    scanningRef.current = true;
    highlight(0, list);
    if (timerRef.current != null) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      if (resolveActiveTargets(regionsRef.current).length === 0) return;
      highlight(indexRef.current + 1);
    }, scanIntervalMs);
  }, [highlight, regionsRef, scanIntervalMs]);

  const signalRef = useRef<() => void>(() => {});
  signalRef.current = () => {
    if (scanningRef.current) {
      const element = prevRef.current;
      stop();
      if (element && element.isConnected && isEligibleTarget(element)) onActivate(element);
    } else {
      start();
    }
  };

  const onSignal = useCallback(() => signalRef.current(), []);
  useSwitchSignal({ keys: switchKeys, onClick: switchOnClick, enabled: !paused, onSignal });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onPause(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onPause]);

  useEffect(() => {
    if (paused) {
      stop();
      return;
    }
    if (scanAutostart) start();
  }, [paused, scanAutostart, start, stop]);

  useEffect(() => {
    if (scanningRef.current) highlight(0);
    else if (scanAutostart && !paused) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  useEffect(() => () => stop(), [stop]);

  return (
    <span
      aria-hidden="true"
      data-input-ignore
      data-scan-index={activeIndex}
      style={{ display: "none" }}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/scan.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Checkpoint**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/scan.test.tsx src/test/dwell.test.tsx src/test/inputProvider.test.tsx`
Expected: PASS.

---

### Task 6: InputModeSettings UI

**Files:**
- Create: `src/components/input/InputModeSettings.tsx`
- Test: `src/test/inputModeSettings.test.tsx`

**Interfaces:**
- Consumes: `src/lib/inputMode.ts` (Task 1), `useInputModeContext` (Task 3).
- Produces: `default function InputModeSettings(): JSX.Element`.

Renders inside the provider context (so it can read `childId`). If `childId` is set, edits write to that child's override; otherwise to the global settings. Includes a "Use for all children" button that clears the override.

- [ ] **Step 1: Write the failing test**

```tsx
// src/test/inputModeSettings.test.tsx
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import InputModeProvider from "@/components/input/InputModeProvider";
import InputModeSettings from "@/components/input/InputModeSettings";
import { effectiveInputMode, resetInputMode } from "@/lib/inputMode";

function renderPanel(childId?: string) {
  return render(
    <InputModeProvider childId={childId}>
      <InputModeSettings />
    </InputModeProvider>,
  );
}

describe("InputModeSettings", () => {
  beforeEach(() => {
    localStorage.clear();
    resetInputMode();
  });

  it("switches the global mode", () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText(/input mode/i), { target: { value: "switch" } });
    expect(effectiveInputMode().mode).toBe("switch");
  });

  it("applies a timing preset", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /fast/i }));
    expect(effectiveInputMode().dwellMs).toBe(500);
    expect(effectiveInputMode().scanIntervalMs).toBe(800);
  });

  it("writes a per-child override and clears it", () => {
    renderPanel("child-1");
    fireEvent.change(screen.getByLabelText(/input mode/i), { target: { value: "dwell" } });
    expect(effectiveInputMode("child-1").mode).toBe("dwell");
    fireEvent.click(screen.getByRole("button", { name: /use for all children/i }));
    expect(effectiveInputMode("child-1").mode).toBe(effectiveInputMode().mode);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/inputModeSettings.test.tsx`
Expected: FAIL — cannot resolve `@/components/input/InputModeSettings`.

- [ ] **Step 3: Implement the settings panel**

```tsx
// src/components/input/InputModeSettings.tsx
import {
  DWELL_RANGE,
  SCAN_RANGE,
  TIMING_PRESETS,
  TimingPreset,
  applyTimingPreset,
  clearChildInputMode,
  effectiveInputMode,
  presetFor,
  updateChildInputMode,
  updateInputMode,
} from "@/lib/inputMode";
import { useInputModeContext } from "./context";

export default function InputModeSettings() {
  const context = useInputModeContext();
  const childId = context?.childId;
  const settings = context?.settings ?? effectiveInputMode();
  const scoped = childId ? effectiveInputMode(childId) : settings;
  const preset = presetFor(scoped);

  const patch = (values: Parameters<typeof updateInputMode>[0]) => {
    if (childId) updateChildInputMode(childId, values);
    else updateInputMode(values);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/70 p-4">
      <label className="flex items-center justify-between gap-3 text-sm font-bold">
        Input mode
        <select
          aria-label="Input mode"
          className="rounded-lg border border-slate-300 bg-white px-2 py-1"
          value={settings.mode}
          onChange={(event) => patch({ mode: event.target.value as typeof settings.mode })}
        >
          <option value="default">Default (tap / click)</option>
          <option value="dwell">Dwell (hold to activate)</option>
          <option value="switch">Switch (single-switch scan)</option>
        </select>
      </label>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(TIMING_PRESETS) as TimingPreset[]).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => applyTimingPreset(name, childId)}
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              preset === name ? "bg-primary text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {name} preset
          </button>
        ))}
      </div>

      <label className="block text-sm font-bold">
        Dwell time ({scoped.dwellMs} ms)
        <input
          aria-label="Dwell time"
          type="range"
          min={DWELL_RANGE.min}
          max={DWELL_RANGE.max}
          step={DWELL_RANGE.step}
          value={scoped.dwellMs}
          disabled={settings.mode !== "dwell"}
          onChange={(event) => patch({ dwellMs: Number(event.target.value) })}
          className="w-full"
        />
      </label>

      <label className="block text-sm font-bold">
        Scan speed ({scoped.scanIntervalMs} ms)
        <input
          aria-label="Scan speed"
          type="range"
          min={SCAN_RANGE.min}
          max={SCAN_RANGE.max}
          step={SCAN_RANGE.step}
          value={scoped.scanIntervalMs}
          disabled={settings.mode !== "switch"}
          onChange={(event) => patch({ scanIntervalMs: Number(event.target.value) })}
          className="w-full"
        />
      </label>

      <label className="flex items-center gap-2 text-sm font-bold">
        <input
          type="checkbox"
          checked={scoped.scanAutostart}
          onChange={(event) => patch({ scanAutostart: event.target.checked })}
        />
        Start scanning automatically
      </label>

      <label className="flex items-center gap-2 text-sm font-bold">
        <input
          type="checkbox"
          checked={scoped.switchOnClick}
          onChange={(event) => patch({ switchOnClick: event.target.checked })}
        />
        Click / tap counts as the switch
      </label>

      <label className="flex items-center gap-2 text-sm font-bold">
        <input
          type="checkbox"
          checked={scoped.showDwellRing}
          onChange={(event) => patch({ showDwellRing: event.target.checked })}
        />
        Show dwell progress ring
      </label>

      <label className="block text-sm font-bold">
        Switch keys (comma separated)
        <input
          aria-label="Switch keys"
          type="text"
          value={scoped.switchKeys.join(", ")}
          onChange={(event) =>
            patch({
              switchKeys: event.target.value
                .split(",")
                .map((key) => key.trim())
                .filter(Boolean),
            })
          }
          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1"
        />
      </label>

      {childId ? (
        <button
          type="button"
          onClick={() => clearChildInputMode(childId)}
          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"
        >
          Use for all children
        </button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/inputModeSettings.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Checkpoint**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/inputModeSettings.test.tsx`
Expected: PASS.

---

### Task 7: Wire into GamePlayer & SensoryControls

**Files:**
- Modify: `src/components/game/GamePlayer.tsx` (wrap subtree; register `play`, `aac`, `dialog` regions)
- Modify: `src/components/game/SensoryControls.tsx` (mount `InputModeSettings`)
- Test: `src/test/inputModeIntegration.test.tsx`

**Interfaces:**
- Consumes: `InputModeProvider` (Task 3), `useTargetRegion` (Task 3), `InputModeSettings` (Task 6).
- Produces: no new exported API; integration only.

Region strategy (all inside `GamePlayer`, no engine/overlay edits):
- Wrap the engine render area in `<div ref={playRef}>` where `const playRef = useTargetRegion("play", 20)`.
- Wrap `<CoreWordBar .../>` in `<div ref={aacRef}>` where `const aacRef = useTargetRegion("aac", 10)`.
- Wrap each overlay/dialog block (`celebrationVisible`, `quitVisible`, `breathingVisible`) in a `<div ref={dialogRef}>` where `const dialogRef = useTargetRegion("dialog", 30)`. Only one is visible at a time in practice; the last mounted takes the `dialog` slot.
- Wrap the `GamePlayer` return in `<InputModeProvider childId={assignment.childId}>`.

- [ ] **Step 1: Read the current GamePlayer around the return, engine area, quizzes and overlays**

Run: open `src/components/game/GamePlayer.tsx` and locate:
- the top-level returned JSX,
- the engine render block,
- `<SensoryControls onBreathingBreak={openBreathing} />`,
- the `celebrationVisible`, `quitVisible`, `breathingVisible` blocks, and `<CoreWordBar onLog={handleAacLog} />`.

- [ ] **Step 2: Write the failing integration test**

```tsx
// src/test/inputModeIntegration.test.tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import InputModeProvider from "@/components/input/InputModeProvider";
import { useTargetRegion } from "@/components/input/context";
import { resetInputMode, updateInputMode } from "@/lib/inputMode";

function PlaySurface({ onAac, onDialog }: { onAac: () => void; onDialog: () => void }) {
  const playRef = useTargetRegion("play", 20);
  const aacRef = useTargetRegion("aac", 10);
  const dialogRef = useTargetRegion("dialog", 30);
  return (
    <div>
      <div ref={playRef}>
        <button onClick={() => {}}>Play A</button>
        <button onClick={() => {}}>Play B</button>
      </div>
      <div ref={aacRef}>
        <button onClick={onAac}>Want</button>
      </div>
      <div ref={dialogRef}>
        <button onClick={onDialog}>Continue</button>
      </div>
    </div>
  );
}

describe("switch scan across regions", () => {
  beforeEach(() => {
    localStorage.clear();
    resetInputMode();
    vi.useFakeTimers();
  });

  it("scans play then aac, and dialog takes precedence", () => {
    const onAac = vi.fn();
    updateInputMode({ mode: "switch", scanIntervalMs: 1000, scanAutostart: true, switchKeys: ["Space"] });
    render(
      <InputModeProvider>
        <PlaySurface onAac={onAac} onDialog={vi.fn()} />
      </InputModeProvider>,
    );
    // autostart highlights the first active (dialog) target
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Continue" }));
    act(() => fireEvent.keyDown(window, { key: "Space" }));
    // dialog still present -> only dialog targets scanned; activation stays in dialog
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Continue" }));
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/inputModeIntegration.test.tsx`
Expected: FAIL — `PlaySurface` renders but the test only passes once region resolution is correct; if it already passes, keep it as a regression guard. The GamePlayer wiring is verified separately in Step 5.

- [ ] **Step 4: Edit `GamePlayer.tsx`**

1. Add imports near the other component imports:
```tsx
import InputModeProvider from "@/components/input/InputModeProvider";
import { useTargetRegion } from "@/components/input/context";
```
2. Inside the component body, add the region refs:
```tsx
const playRef = useTargetRegion("play", 20);
const aacRef = useTargetRegion("aac", 10);
const dialogRef = useTargetRegion("dialog", 30);
```
3. Wrap the top-level returned JSX's children in `<InputModeProvider childId={assignment.childId}> ... </InputModeProvider>`.
4. Attach `ref={playRef}` to a `<div>` wrapping the engine render area; `ref={aacRef}` to a `<div>` wrapping `<CoreWordBar .../>`; and `ref={dialogRef}` to a `<div>` wrapping each of the `celebrationVisible`, `quitVisible`, and `breathingVisible` blocks. Keep existing classNames/behaviour; wrapper `<div>`s are layout-neutral (fixed overlays position themselves independently).

- [ ] **Step 5: Edit `SensoryControls.tsx`**

Import and render the panel inside the existing container:
```tsx
import InputModeSettings from "@/components/input/InputModeSettings";
```
Add `<InputModeSettings />` as the last child of the returned panel.

- [ ] **Step 6: Run checks**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/inputModeIntegration.test.tsx`
Expected: PASS.
Run: `& .\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 7: Checkpoint**

Run: `& .\node_modules\.bin\vitest.cmd run src/test/inputModeIntegration.test.tsx`
Expected: PASS.

---

### Task 8: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Client typecheck**

Run: `& .\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 2: Server typecheck (unchanged, must stay clean)**

Run: `npm.cmd run typecheck:server`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm.cmd run lint`
Expected: 0 errors (pre-existing warnings allowed).

- [ ] **Step 4: Full client suite**

Run: `& .\node_modules\.bin\vitest.cmd run --reporter=basic`
Expected: previous 432 tests pass plus the new input-mode tests.

- [ ] **Step 5: Server suite**

Run: `& .\node_modules\.bin\vitest.cmd run server/test`
Expected: 13 tests pass.

- [ ] **Step 6: Manual smoke (optional if a dev server is running)**

Set mode to Dwell via the Access panel, hold over an engine button, confirm it activates after ~0.9 s. Set mode to Switch, confirm the highlight cycles and Space activates the highlighted button. Open the quit dialog and confirm only its buttons scan.

---

## Self-Review

**Spec coverage:**
- Modes default/dwell/switch → Task 1 (store) + Task 6 (UI). ✓
- Dwell behavior + ring → Task 4. ✓
- Single-switch linear scan, stops on activation → Task 5. ✓
- Switch source (keys + click, configurable) → Task 1 (`switchKeys`, `switchOnClick`) + Task 5 (`useSwitchSignal`). ✓
- Presets + sliders, persisted, per-child override → Task 1 + Task 6. ✓
- Coverage: play/aac/dialog with modal precedence → Task 2 + Task 7. ✓
- focus-then-click activation once → Task 3 (`activate`) guarded by dwell lock (Task 4) and scan stop (Task 5). ✓
- Visible highlight + screen-reader via real focus → Task 5 (`.scan-target` + `focus()`), `ScanStyles`. ✓
- Pause affordance → Task 3 (button) + Task 5 (Escape). ✓
- Reduced motion/calm → Task 3 (`reduced` from `useReducedMotionMode`/`calmMode`) + `ActivationRing` opacity. ✓
- No engine edits → Tasks 7 targets only GamePlayer/SensoryControls. ✓

**Placeholder scan:** The only intentionally-thin files are `DwellController.tsx`/`ScanController.tsx` placeholders in Task 3, which are fully replaced in Tasks 4 and 5. No other TBD/TODO.

**Type consistency:** `RegionRegistration` shape `{ name, priority, element }` is used identically in Tasks 2–5. `InputModeSettings` field names (`dwellMs`, `scanIntervalMs`, `scanAutostart`, `switchKeys`, `switchOnClick`, `showDwellRing`, `perChild`) match across Tasks 1, 3, 5, 6. Controller prop names match the Task 3 wiring (`regionsRef`, `version`, `onActivate`, `paused`, `onPause`). `useTargetRegion(name, priority)` returns `(element: HTMLElement | null) => void` in Task 3 and is used that way in Tasks 4, 6, 7.
