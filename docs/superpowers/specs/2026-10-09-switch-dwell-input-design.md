# Switch & Dwell Input — Design Spec

> Status: Draft for review
> Scope: Child-facing play loop (game engines, AAC core-word bar, in-game dialogs)

## Goal

Let a child operate the play loop with two alternative input methods that do **not**
require precise pointing:

1. **Dwell** — hold a pointer (mouse, touch, or eye-gaze-as-mouse) over a target; a
   progress ring fills; the target activates when the dwell time elapses.
2. **Single-switch scanning** — a highlight moves through the available targets on a
   timer; a single switch signal activates the highlighted target, then scanning stops.

The layer must work across **gameplay engines, the AAC core-word bar, and in-game
dialogs** (celebration, quit, breathing), while leaving engine source untouched and the
existing 432-test client suite / 13-test server suite green.

## Constraints

- Engines render plain `<button onClick>` / `[role="button"]` targets. The input layer
  must drive them as-is; do not refactor engines.
- Activation must route through the element's real `click()` so every existing path still
  runs: `onInteraction`, session recorder, AAC logging, scoring, completion.
- One switch signal = at most one activation (no double fire).
- Dwell/scan timing is adjustable (WCAG 2.2.1 "Timing Adjustable").
- Respect reduced-motion / calm mode (`useReducedMotionMode` and `reduceMotionEffects`
  from `@/lib/motion`, plus `calmMode` from `@/lib/sensory`).
- No per-diagnosis branches; behavior follows stored settings only.

## Non-goals (v1)

- Two-switch / step scanning (one switch advances, a second selects).
- Row/column (group) scanning. The target registry is designed so it can be added later.
- Gamepad API / dedicated on-screen switch hardware (revisit after v1).
- Guardian/therapist/admin tooling — those surfaces keep normal input.
- Persisting input mode to the server; v1 is local-only.

## Requirements

| # | Requirement |
|---|---|
| R1 | Three modes: `default`, `dwell`, `switch`, selected in settings. |
| R2 | Dwell: pointer-over target → progress ring → activate at `dwellMs`. |
| R3 | Switch: linear auto-scan over active targets → switch signal activates current → scan stops. |
| R4 | Switch source: any configured key (default Space/Enter) plus click/tap anywhere; both configurable. |
| R5 | Timing: slow/medium/fast presets **and** per-setting sliders (dwell ms, scan interval ms). |
| R6 | Settings persist locally; per-child overrides layer over the global default. |
| R7 | Coverage: `play`, `aac`, `dialog` regions with modal precedence. |
| R8 | Activation = `focus()` then `click()` exactly once, then re-resolve targets. |
| R9 | Visible, high-contrast highlight for the active/scanning target that works with screen readers (real focus). |
| R10 | A pause/stop affordance for scanning and a visible dwell ring that can be disabled. |
| R11 | Honors `prefers-reduced-motion` / calm mode (reduced or static highlight + ring). |

## Architecture

Self-contained subsystem under `src/components/input/` plus a store in `src/lib/`.

### `src/lib/inputMode.ts` (store + pure logic)

External store mirroring `src/lib/sensory.ts` (`useSyncExternalStore`, localStorage key
`pp-input-mode-v1`).

```ts
export type InputMode = "default" | "dwell" | "switch";
export type TimingPreset = "slow" | "medium" | "fast";

export interface InputModeSettings {
  mode: InputMode;
  dwellMs: number;              // default 900
  scanIntervalMs: number;       // default 1200
  scanAutostart: boolean;       // default true
  switchKeys: string[];         // default ["Space", "Enter"]
  switchOnClick: boolean;       // default true
  showDwellRing: boolean;       // default true
  perChild: Record<string, Partial<InputModeSettings>>;
}

export const TIMING_PRESETS: Record<TimingPreset, { dwellMs: number; scanIntervalMs: number }> = {
  slow:   { dwellMs: 1600, scanIntervalMs: 1800 },
  medium: { dwellMs: 900,  scanIntervalMs: 1200 },
  fast:   { dwellMs: 500,  scanIntervalMs: 800  },
};
```

Exports: `getInputModeSnapshot`, `subscribeInputMode`, `updateInputMode(patch)`,
`useInputMode()`, `effectiveInputMode(childId?)` (global merged with the child override),
and `presetFor(settings)` / `applyTimingPreset(preset)`.

### `src/components/input/InputModeProvider.tsx`

Context provider mounted by `GamePlayer` around its whole subtree (play board, AAC bar,
overlays). Responsibilities:

- Read the effective settings (from `useInputMode()` + current `childId`).
- Own the **RegionRegistry** (map of `name → { element, priority }`).
- Expose:
  - `useTargetRegion(name, priority)` → returns a `ref` callback an overlay/board attaches
    to its root element; auto-unregisters on unmount.
  - `useInputModeContext()` → `{ mode, settings, regions, signal, pause, resume }`.
- Render exactly one controller based on `mode`: nothing (`default`), `DwellController`,
  or `ScanController`.
- Render a single shared **ActivationRing** host used by both dwell and scan highlight.

### `src/components/input/targets.ts`

Pure, DOM-light helpers (fully unit-testable without React):

- `TARGET_SELECTOR` = `button:not([disabled]), [role="button"]:not([disabled]), a[href], [data-input-target]:not([data-input-ignore])`.
- `collectTargets(root): HTMLElement[]` — query in DOM order, filter to visible
  (`getClientRects().length > 0`) and not `[data-input-ignore]`, dedupe.
- `resolveActiveTargets(regions): HTMLElement[]` — apply region precedence (below), concat
  in order, drop regions with no targets.

### Region precedence

| Region | Priority | Mounted by |
|---|---|---|
| `dialog` | 30 | CelebrationOverlay, quit dialog, breathing overlay |
| `play` | 20 | engine board container in `GamePlayer` |
| `aac` | 10 | `CoreWordBar` |

- If a `dialog` region is present with ≥1 target → **only** dialog targets are active.
- Otherwise → `play` targets followed by `aac` targets.
- Regions are re-resolved on mount/unmount, on `mode` change, after each activation, and on
  `MutationObserver` changes within active regions (next card appears, options re-render).

### Activation

```
activate(element):
  if (element.disabled || !stillConnected(element)) return
  element.focus()
  element.click()          // exactly once, guarded per signal
  re-resolve targets
  if scanning: stop()
```

Real `focus()` gives screen readers and switch users the same, well-defined highlight;
`click()` reuses every existing engine path unchanged.

## Dwell

`DwellController` attaches `pointermove` / `pointerdown` handling to the union of active
region roots (or `document`, then filter).

- Resolve the candidate via `event.target.closest(TARGET_SELECTOR)` within an active region.
- On entering a new eligible target, start a `requestAnimationFrame`/timer loop for
  `dwellMs`, rendering the progress ring over the target's bounding box.
- Moving off the target, target removal, `pointerleave`, scroll, or region change cancels
  the timer and hides the ring.
- On completion, `activate(target)` and lock until pointer leaves the target (prevents
  re-fire while the pointer is still over it).
- **Touch fallback:** with no hover, a press-and-hold (`pointerdown` → hold) drives the same
  timer; early release cancels (no accidental taps).
- `showDwellRing` can hide the ring (still activates), for users who prefer no motion.

## Switch scanning

`SwitchInput` captures the signal:

- `keydown` where `event.key` (or `event.code`) is in `switchKeys` → `preventDefault` + signal.
- `pointerdown`/`click` anywhere when `switchOnClick` → signal.
- Signals are debounced (~250 ms) and coalesced so one press = one signal.

`ScanController`:

- Maintains an index into `resolveActiveTargets(regions)`.
- On start (`scanAutostart` when a region mounts, or the first signal from idle): highlight
  index 0 and begin an interval of `scanIntervalMs`, wrapping at the end.
- Highlight = real `focus()` on the target plus a `.scan-target` class (and the shared ring
  host, reduced under calm mode).
- On signal **while scanning** → `activate(current)` then **stop** (R3).
- On signal **while stopped** → resume scanning at index 0.
- Pauses while there are zero targets; resumes automatically when targets appear.
- Exposes `pause()` / `resume()`; a visible "⏸ Pause scanning" control and Escape also pause.
- Never activates `disabled` targets; skips elements that unmount mid-cycle.

Interaction note: in `switch` mode a bare tap/click is treated as the switch signal, not a
direct target press (single-input contract). This is documented in the settings panel.

## Settings UI & persistence

`InputModeSettings.tsx`, rendered inside the existing `SensoryControls` panel (an "Access"
section):

- Mode selector: Default / Dwell / Switch.
- Preset chips: Slow / Medium / Fast (sets both timings).
- Sliders: Dwell time (300–2500 ms), Scan speed (400–2500 ms interval); disabled unless the
  relevant mode is active.
- Switch keys capture field; "activate on click/tap" toggle.
- "Show dwell ring" toggle; live **test pad** (a sandbox of buttons) to try the mode.
- Global values persist to `pp-input-mode-v1`; when a `childId` is in context, edits write
  to `perChild[childId]` (a "Use for all children" button clears the override).

`effectiveInputMode(childId)` = `{ ...global, ...perChild[childId] }` (override wins).

## Coverage & integration

- `GamePlayer` wraps its subtree in `InputModeProvider` and marks the board container as the
  `play` region.
- `CoreWordBar` registers the `aac` region (persistent during play).
- Celebration / quit / breathing overlays register the `dialog` region (highest priority),
  so while a dialog is open only its buttons scan/dwell — including "Keep playing", "Continue",
  "I'm ready to go back", and "Leave now".
- Nothing in `src/components/game/engines/**` changes.

## Accessibility

- Real DOM focus drives both highlight and screen-reader position; the ring is decorative
  (`aria-hidden`), the class is visual only.
- Timing adjustable via presets + sliders; pause always available.
- Focus outline is never removed for scan-highlighted elements; highlight color meets ≥3:1
  against the board background.
- Under calm/reduced-motion, the ring becomes a static outline and the scan highlight does
  not pulse.
- Works with the existing keyboard path: in `default` mode nothing changes.

## Edge cases

- Target unmounts mid-dwell/mid-scan → cancel / re-resolve, no stale activation.
- Dialog opens during scan → targets switch to dialog set; scan restarts on index 0.
- Duplicate activation blocked (per-signal and per-dwell-completion guard).
- Empty region → scanning pauses until targets exist.
- Nested targets (`[role="button"]` inside a button) → `closest()` picks the innermost;
  `collectTargets` dedupes ancestors.
- Elements with `data-input-ignore` are skipped everywhere.

## Testing & acceptance criteria

Unit (vitest + jsdom, fake timers):

- `inputMode.test.ts` — store read/write, preset application, `effectiveInputMode` override
  merge, localStorage round-trip.
- `targets.test.ts` — `collectTargets` visibility/order/ignore/disabled filtering;
  `resolveActiveTargets` dialog precedence and play→aac ordering.
- `dwell.test.tsx` — pointer over target, advance `dwellMs` → target clicked once; move away
  → no click; touch-hold path; ring suppressed when `showDwellRing=false`.
- `scan.test.tsx` — autostart highlights index 0; interval advances and wraps; key signal
  activates the focused target once and stops; second signal resumes; click signal works;
  disabled targets skipped.

Integration:

- Render a real engine (e.g. a `choice-request` and a `matching` category game) inside
  `InputModeProvider` in `switch` mode → drive scan + signal until the game's existing
  `onComplete` fires.
- Render with a `dialog` overlay open → assert only dialog targets are scanned.
- Full suite stays green: client `vitest run` (432 tests) and server `vitest run server/test`
  (13 tests); client + server `tsc` clean; lint 0 errors.

Definition of done:

- Modes selectable and persisted; presets + sliders work; per-child override applies.
- Dwell activates gameplay, AAC bar, and dialog buttons.
- Single-switch scan activates each of those once and stops on activation.
- Accessibility checklist above satisfied; calm mode reduces/removes motion.
- No engine file modified; existing tests green.

## New files

- `src/lib/inputMode.ts`
- `src/components/input/InputModeProvider.tsx`
- `src/components/input/targets.ts`
- `src/components/input/DwellController.tsx`
- `src/components/input/ScanController.tsx`
- `src/components/input/SwitchInput.tsx`
- `src/components/input/ActivationRing.tsx`
- `src/components/input/InputModeSettings.tsx`
- Tests: `src/test/inputMode.test.ts`, `src/test/targets.test.ts`,
  `src/test/dwell.test.tsx`, `src/test/scan.test.tsx`

## Touched (integration only)

- `src/components/game/GamePlayer.tsx` — wrap subtree, mark `play` region, and mark the
  inline quit dialog (already in this file) as a `dialog` region.
- `src/components/aac/CoreWordBar.tsx` — mark `aac` region.
- `src/components/game/CelebrationOverlay.tsx` and
  `src/components/game/BreathingOverlay.tsx` — mark `dialog` region.
- `src/components/game/SensoryControls.tsx` — mount `InputModeSettings` inside the panel
  (component currently takes `{ onBreathingBreak? }`).
