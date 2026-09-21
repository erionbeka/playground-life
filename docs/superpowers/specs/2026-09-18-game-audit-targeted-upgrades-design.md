# Game Audit & Targeted Upgrades — Design Spec (Approach 2)

> Supports: `docs/superpowers/plans/2026-09-18-game-audit-targeted-upgrades.md`

## Goal

Turn the 410-game catalog into a set where **every** game either (a) has a real trial-based learning mechanic with correct/incorrect answers, or (b) is a deliberately open, evidence-based exploration activity (PECS/AAC-driven) that is clearly labelled and measured. Fix all confirmed Tier-2/Tier-4 defects without regressing the 581-test green suite.

## Constraints

- Keep all engines' existing completion paths and the `playGame` smoke loop green.
- Exploration engines (Social, ChoiceRequest, Regulation, FlexibleThinking) MUST stay open-ended — regression tests assert "no single right answer". Conversions would break tests AND the PECS/AAC evidence base. They are NOT converted; they get clarity polish only if trivial.
- No per-diagnosis branches; adaptation flows from `difficulty`/`supportLevel`/`readinessStage`/`calmMode`.
- Honest metrics: correct trials + errors from real taps.

## Confirmed defects (with evidence)

### Tier 2 — presentation/mechanic mismatch
1. **Shadow/silhouette matching leaks the answer text.** `MatchingEngine.tsx:331` always renders `{card.item.label}` in a fully visible span even when `card.silhouette` is true. The shadow game (Froebel Shadow Forms etc.) is defeated by readable text. Fix: render the label `sr-only` (or opacity-0) when silhouette, keeping a11y.
2. **Five motor games are tap-in-disguise.** `games.ts:460-476` defines "Drag & Drop", "Pinch & Zoom", "Catch the Ball", "Pop & Hold", "Target Aim" under `engine: "tapping"` → they hit the generic TapPlay float-tap loop (no drag/hold/aim). TRACE_THEMES correctly routes Trace Lines / Connect Dots / Swipe Patterns / Follow the Path / Slow Drag / Circle Draw / Zig-Zag Trace / Spiral Trace / Rainbow Arc / Heart Trace / Star Trace to real TracingEngine. Fix target: implement real gesture variants for the 5, or re-describe honestly.

### Tier 3 — logicless/purposeless engines
3. **Playground: any tap on any target = correct.** `PlaygroundEngine.tsx:156-171` records `correct: true` for every scene tap; stepDone = pulses>=tapsNeeded regardless of which action is tapped. It is a "tap anything to advance" loop. Fix: make the step's intended action (targets[0], matching prompt/token) the correct tap; wrong target = gentle miss, error count, no pulse.
4. **MagicToys: score frozen at 100, no discriminator.** `MagicToysEngine.tsx:80-97` — `correctTrials: toys.length` regardless of which toys tapped; errors always 0. It's cause-effect play (fine for early learners) but indistinguishable from filler in metrics. Fix: keep cause-effect delight, but add a "find the popping toy" receptive-id leader round at each difficulty where one target is prompted and others are decoys; errors count real wrong taps. (Keeps high-support calm cause-effect mode.)

### Tier 4 — data bugs
5. **`"Next: Next:"` naming.** `games.ts:1227` — `name: \`Next: ${name}\`` where `name` already starts with "Next: " → browsers see "Next: Next: Color Trios". Fix: push plain `name`.
6. **Poisoned odd-one-out row.** `OddOneOutEngine.tsx:107` — `{ group: ["🐕","🐈","🐇"], odd: "🐶", reason: "a beagle is a dog…" }`. Both 🐕 and 🐶 are dogs → ambiguous. Replace row 0 of `expertAnimals` with an unambiguous row where odd is a genuinely different category member.
7. **Counting themes fall back to ⭐.** `gameAssets.tsx:330-331` (`getThemeVisual`) + `THEME_EMOJI` (lines 1-102) missing keys for: `dots`, `marbles`, `penguins` (only "penguin" exists), `monkeys` (only "monkey"), `donuts` (only "donut"), `cupcakes`, `presents`, `candles`, `bees` (only "bee"). Counting games for these themes render ⭐ tokens → indistinguishable. Fix: add plural/singular keys.
8. **Sorting itemMap gaps.** `SortingEngine.tsx:20-58` — keys `wet`, `toys`, `tools` missing (only `dry`, `toyset` present). Games "Sort Wet vs Dry" (games.ts:1123) and "Sort Toys vs Tools" (1124) fall back to `["⭐","🎈","🧩","🎨"]`. Fix: add the three keys + hints.
9. **MagicToys TOY_SETS missing 10 themes.** `MagicToysEngine.tsx:19-29` has only bubbles/instruments/animals/vehicles/garden/weather/ocean/space/default. magicWorlds themes forest, bakery, dinosaurs, circus, pond, winter, jungle, bedroom, farmMagic, seaMagic all fall back to default. Fix: add 10 themed sets.

## Non-goals (verified intentional, leave alone)
- PatternNextEngine (real trial engine with decoys + adaptive distractorAdjust; trio themes added).
- Social/ChoiceRequest/Regulation/FlexibleThinking exploration design (regression-guarded; evidence-based).
- MatchingEngine flip/open/category variants (labels intentionally readable there).

## Verification
- Full suite: `cmd /c "npx vitest run"` (581+ tests, GREEN).
- Traditional lint: `npx tsc --noEmit` if available; else lint script.
- Visual smoke: `scripts/visual-smoke.cjs` on `http://127.0.0.1:8082` — all checks true; catalog total intact (410).