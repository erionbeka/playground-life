# Blob Hands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the hero blob mascot a visible left hand and a visible right hand, and make it reach with **both** hands when the cursor is below it.

**Architecture:** `BlobCritter` already tracks a single cursor vector (`px`, `py` — pixels from the blob's centre to the pointer). The new two-arm system gives each arm its own shoulder anchor, its own rotation, and its own stretch factor, all derived from that vector. When the pointer sits in the lower half of the blob's reach circle, both arms extend and angle inward so the hands converge under the body.

**Tech Stack:** React 18, framer-motion 11 (`useMotionValue`, `useSpring`, `useTransform`, `useMotionValueEvent`), Vitest 3, Testing Library 16.

**Spec:** `docs/superpowers/specs/2026-10-21-database-first-app-design.md` (Part 2)

## Global Constraints

- Only the **hero** blob changes. The five small "play pals" (`HomePage.tsx:314-322`) and the CTA blob (`HomePage.tsx:395`) keep their current look.
- The mascot is built from `<div>` elements with inline styles — there is no SVG in `BlobCritter.tsx`. Do not introduce one.
- The reduced-motion branch renders **no arms**.
- Every new element is `aria-hidden` — the mascot's accessible name comes from the `label` prop only.
- All geometry is expressed in multiples of the `size` prop so the mascot scales at every breakpoint.
- Run `npm run lint && npm run typecheck:server && npm test` after each task.

---

## Geometry reference (read this before writing the arms)

The blob body is `bodyWidth = size` wide and `bodyHeight = size * squash` tall.

**Shoulders** sit near the left and right edges of the body:

```
shoulderLeftX  = bodyWidth * 0.08
shoulderRightX = bodyWidth * 0.92
shoulderY      = bodyHeight * 0.55
```

**Each arm extends outward from its shoulder** and is anchored at the shoulder
end, so shrinking the arm pulls the hand back towards the body instead of
dragging it through the body:

| Arm | Element position | `width` | `transformOrigin` | Hand position |
|---|---|---|---|---|
| Left | `left: shoulderLeftX - size * 0.4` | `size * 0.4` | `"right center"` | `left: -size * 0.055` (past the arm's left end) |
| Right | `left: shoulderRightX` | `size * 0.4` | `"left center"` | `right: -size * 0.055` (past the arm's right end) |

Because the origin is the shoulder, the arm's **natural direction** differs per
side, and so does the rotation that points it at a target:

| Arm | Natural direction | CSS rotation to point at a target direction `(dx, dy)` |
|---|---|---|
| Left | local −x (points left) | `atan2(dy, dx) * 180 / PI − 180` |
| Right | local +x (points right) | `atan2(dy, dx) * 180 / PI` |

Reference rotations (screen coordinates, `y` grows downwards):

| Pose | Left arm | Right arm |
|---|---|---|
| Rest (hanging down and outward) | `−45°` | `+45°` |
| Straight down | `−90°` | `+90°` |
| Down **and inward** (the two-handed grab) | `−135°` | `+135°` |

**Stretch** is a `scaleX` factor, not a pixel length. `0.28` is the retracted
pose, `1` is the arm at full stretch. The hand counter-scales with the arm so
it never stretches.

---

### Task 1: Two always-visible arms with mitten hands

**Files:**
- Modify: `src/components/home/BlobCritter.tsx:516-544` (motion values), `:717-821` (arms and reach arm)
- Modify: `src/pages/HomePage.tsx:239-246` (hero blob and its label)
- Create: `src/test/blob-critter.test.tsx`

**Interfaces:**
- Consumes: nothing (independent of the database-first plan).
- Produces:
  - `BlobCritterProps` gains `reach?: boolean` (default `false`). It replaces the `grabCursor` prop, which is removed.
  - `data-testid="blob-arm-left"`, `data-testid="blob-arm-right"`, `data-testid="blob-hand-left"`, `data-testid="blob-hand-right"`.

- [ ] **Step 1: Write the failing test**

Create `src/test/blob-critter.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import BlobCritter from "@/components/home/BlobCritter";

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({
      matches,
      media: "",
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => true,
    }),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("blob critter arms", () => {
  it("renders a left arm and a right arm with a hand on each when reaching", () => {
    mockMatchMedia(false);

    render(<BlobCritter shape="cat" color="#4daace" size={210} reach />);

    expect(screen.getByTestId("blob-arm-left")).toBeInTheDocument();
    expect(screen.getByTestId("blob-arm-right")).toBeInTheDocument();
    expect(screen.getByTestId("blob-hand-left")).toBeInTheDocument();
    expect(screen.getByTestId("blob-hand-right")).toBeInTheDocument();
  });

  it("renders no arms when reaching is off", () => {
    mockMatchMedia(false);

    render(<BlobCritter shape="cat" color="#4daace" size={110} />);

    expect(screen.queryByTestId("blob-arm-left")).toBeNull();
    expect(screen.queryByTestId("blob-arm-right")).toBeNull();
  });

  it("renders no arms when the OS prefers reduced motion", () => {
    mockMatchMedia(true);

    render(<BlobCritter shape="cat" color="#4daace" size={210} reach />);

    expect(screen.queryByTestId("blob-arm-left")).toBeNull();
    expect(screen.queryByTestId("blob-arm-right")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/blob-critter.test.tsx`
Expected: FAIL — the test ids do not exist and the `reach` prop is not in the props type.

- [ ] **Step 3: Add the motion values**

In `src/components/home/BlobCritter.tsx`:

1. Move `const bodyWidth = size;` and `const bodyHeight = size * squash;` **above** the motion values (they are currently declared at lines 543-544, just below them), so the shoulder anchors can use them.

2. Replace the `grabReach` / `grabAngle` / `grabOpacity` block (lines 538-544) with:

```tsx
  // Shoulder anchors. The arms hang from the sides of the body, so each arm
  // measures the vector to the cursor from its own shoulder.
  const shoulderLeftX = bodyWidth * 0.08;
  const shoulderRightX = bodyWidth * 0.92;
  const shoulderY = bodyHeight * 0.55;

  // How engaged the blob is with the cursor: 0 when the cursor is far away,
  // 1 once it is inside the reach circle. Blending with this instead of a
  // boolean keeps the arms from snapping at the boundary.
  const reachFactor = useTransform(dist, (d) => {
    const outer = size * 1.7;
    const inner = size * 1.1;
    if (d >= outer) return 0;
    if (d <= inner) return 1;
    return (outer - d) / (outer - inner);
  });

  const REST_SCALE = 0.28;
  const ARM_LENGTH = size * 0.4;
  const LEFT_REST_ANGLE = -45;
  const RIGHT_REST_ANGLE = 45;

  // How far each arm stretches, as a scale factor of its rest length.
  const armScaleLeft = useTransform([px, py, reachFactor], ([x, y, factor]: number[]) => {
    const stretch = Math.min(Math.hypot(x - shoulderLeftX, y - shoulderY) * 0.55, size * 0.85) / ARM_LENGTH;
    return REST_SCALE + Math.max(0, stretch - REST_SCALE) * factor;
  });
  const armScaleRight = useTransform([px, py, reachFactor], ([x, y, factor]: number[]) => {
    const stretch = Math.min(Math.hypot(x - shoulderRightX, y - shoulderY) * 0.55, size * 0.85) / ARM_LENGTH;
    return REST_SCALE + Math.max(0, stretch - REST_SCALE) * factor;
  });

  // The angle each arm points in. The left arm's natural direction is local
  // -x and the right arm's is local +x, so they need different offsets.
  const armAngleLeft = useTransform([px, py, reachFactor], ([x, y, factor]: number[]) => {
    const target = (Math.atan2(y - shoulderY, x - shoulderLeftX) * 180) / Math.PI - 180;
    return LEFT_REST_ANGLE + (target - LEFT_REST_ANGLE) * factor;
  });
  const armAngleRight = useTransform([px, py, reachFactor], ([x, y, factor]: number[]) => {
    const target = (Math.atan2(y - shoulderY, x - shoulderRightX) * 180) / Math.PI;
    return RIGHT_REST_ANGLE + (target - RIGHT_REST_ANGLE) * factor;
  });
```

- [ ] **Step 4: Replace the arms and the reach arm**

In `src/components/home/BlobCritter.tsx`, delete the current idle-arms block and the `grabCursor` reach-arm block (the two `motion.div` blocks with the key `arm-${side}` and the one guarded by `grabCursor ? ... : null`, lines 717-821 today), and replace them with:

```tsx
        {reach ? (
          <>
            {[-1, 1].map((side) => {
              const isLeft = side === -1;
              const armScale = isLeft ? armScaleLeft : armScaleRight;
              const armAngle = isLeft ? armAngleLeft : armAngleRight;

              return (
                <motion.div
                  key={`arm-${side}`}
                  data-testid={`blob-arm-${isLeft ? "left" : "right"}`}
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: isLeft ? shoulderLeftX - size * 0.4 : shoulderRightX,
                    top: shoulderY,
                    width: size * 0.4,
                    height: size * 0.13,
                    borderRadius: 99,
                    background: color,
                    zIndex: 3,
                    transformOrigin: isLeft ? "right center" : "left center",
                    boxShadow: "inset 0 -3px 6px rgba(0,0,0,0.06)",
                    rotate: armAngle,
                    scaleX: armScale,
                  }}
                >
                  <motion.div
                    data-testid={`blob-hand-${isLeft ? "left" : "right"}`}
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: isLeft ? -size * 0.055 : undefined,
                      right: isLeft ? undefined : -size * 0.055,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: size * 0.16,
                      height: size * 0.15,
                      borderRadius: "48% 48% 52% 52% / 44% 44% 56% 56%",
                      background: color,
                      boxShadow: "inset 0 -3px 5px rgba(0,0,0,0.06)",
                    }}
                  >
                    {/* The inner wrapper cancels the arm's stretch, so the hand
                        keeps its shape while the arm grows. */}
                    <motion.div
                      aria-hidden
                      style={{ position: "absolute", inset: 0, scaleX: armScale }}
                    >
                      <div
                        aria-hidden
                        style={{
                          position: "absolute",
                          left: isLeft ? size * 0.11 : -size * 0.035,
                          top: size * 0.03,
                          width: size * 0.06,
                          height: size * 0.07,
                          borderRadius: "50% 50% 50% 0",
                          background: color,
                          transform: isLeft ? "rotate(18deg)" : "rotate(162deg)",
                          transformOrigin: isLeft ? "bottom left" : "bottom right",
                        }}
                      />
                    </motion.div>
                  </motion.div>
                </motion.div>
              );
            })}
          </>
        ) : null}
```

Three details that make this work:

- The arm has a **fixed** `width` and is stretched with `scaleX`. Animating
  `width` instead would move the hand, because the width shrinks towards the
  transform origin (the shoulder) and the hand is positioned relative to the
  arm's *outer* end.
- The hand's inner wrapper applies the same `scaleX` as the arm, so the hand
  is not stretched along with it.
- The thumb bump sits on the **inner** side of each hand, so the left and
  right hands are visibly different.

The rotation and the stretch are **style** motion values, not an `animate`
target. Handing a motion value to `animate` makes framer-motion resolve the
keyframes by measuring the element, and its measurement table has no entry for
transform props — the lookup throws and takes the whole render loop down with
it. Put them in `style` and wrap them in `useSpring` to keep the springy feel:

```tsx
  const armAngleLeftSpring = useSpring(armAngleLeftFinal, { stiffness: 90, damping: 20 });
  const armAngleRightSpring = useSpring(armAngleRightFinal, { stiffness: 90, damping: 20 });
  const armScaleLeftSpring = useSpring(armScaleLeftFinal, { stiffness: 90, damping: 20 });
  const armScaleRightSpring = useSpring(armScaleRightFinal, { stiffness: 90, damping: 20 });
```

- [ ] **Step 5: Rename the prop**

In `src/components/home/BlobCritter.tsx`:

- In `BlobCritterProps`, replace `grabCursor?: boolean;` with `reach?: boolean;`.
- In the destructured parameter list, replace `grabCursor = false,` with `reach = false,`.
- The reduced-motion branch already renders no arms — leave it as is.
- `Ears`, `Face` and `PersonalityProp` are unchanged.

- [ ] **Step 6: Update the hero usage and its label**

In `src/pages/HomePage.tsx:239-246`, replace the hero blob with:

```tsx
          <BlobCritter
            shape={heroCritter.shape}
            color={heroCritter.color}
            blush={heroCritter.blush}
            size={210}
            reach
            label="A friendly blue blob cat mascot with a left hand and a right hand that reaches for your cursor, grabbing with both hands when you move the pointer below it"
          />
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/test/blob-critter.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 8: Run the full checks**

Run: `npm run lint && npm run typecheck:server && npm test`
Expected: all pass.

---

### Task 2: Both hands reach when the cursor is below the blob

**Files:**
- Modify: `src/components/home/BlobCritter.tsx` — the motion values and the arm block from Task 1
- Modify: `src/test/blob-critter.test.tsx` — add the reach-direction tests

**Interfaces:**
- Consumes: `px`, `py`, `reachFactor` from Task 1.
- Produces:
  - `bothHandsReach` — a numeric `MotionValue<number>` (0 or 1).
  - `data-reach` on each arm element: `"rest"`, `"nearest"` or `"both"`.

- [ ] **Step 1: Write the failing test**

Add to `src/test/blob-critter.test.tsx`:

```tsx
import { act } from "react";
import { fireEvent, waitFor } from "@testing-library/react";
```

and add this describe block:

```tsx
describe("blob critter two-handed reach", () => {
  it("extends both arms when the pointer is below the blob", async () => {
    mockMatchMedia(false);

    render(<BlobCritter shape="cat" color="#4daace" size={210} reach />);

    // jsdom reports a zero-size rect for the blob, so the component sees the
    // cursor at its own origin (0, size * 0.1). A pointer at (0, 600) is
    // therefore well below the blob.
    await act(async () => {
      fireEvent.pointerMove(window, { clientX: 0, clientY: 600 });
    });

    await waitFor(() => {
      expect(screen.getByTestId("blob-arm-left")).toHaveAttribute("data-reach", "both");
      expect(screen.getByTestId("blob-arm-right")).toHaveAttribute("data-reach", "both");
    });
  });

  it("extends only the nearer arm when the pointer is to the side", async () => {
    mockMatchMedia(false);

    render(<BlobCritter shape="cat" color="#4daace" size={210} reach />);

    await act(async () => {
      fireEvent.pointerMove(window, { clientX: 600, clientY: 0 });
    });

    await waitFor(() => {
      expect(screen.getByTestId("blob-arm-right")).toHaveAttribute("data-reach", "nearest");
      expect(screen.getByTestId("blob-arm-left")).toHaveAttribute("data-reach", "rest");
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/blob-critter.test.tsx`
Expected: FAIL — the arms have no `data-reach` attribute.

- [ ] **Step 3: Add the two-handed reach**

In `src/components/home/BlobCritter.tsx`, add `useMotionValueEvent` to the
framer-motion import list at the top of the file:

```tsx
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTime,
  useTransform,
} from "framer-motion";
```

Add these motion values after `armAngleRight`:

```tsx
  // A cursor in the lower half of the reach circle makes the blob grab with
  // both hands instead of just the nearer arm.
  const bothHandsReach = useTransform([px, py, reachFactor], ([x, y, factor]: number[]) =>
    factor > 0.35 && y > 0 && y > Math.abs(x) * 0.6 ? 1 : 0
  );

  // Which side of the body the cursor is on. Each side is tracked separately
  // so the arms swap over when the cursor crosses the centre line.
  const cursorIsLeft = useTransform(px, (x) => (x < 0 ? 1 : 0));
  const cursorIsRight = useTransform(px, (x) => (x > 0 ? 1 : 0));

  // Reach mode per arm: 0 = resting, 1 = the nearest arm reaches, 2 = both.
  const reachModeLeft = useTransform(
    [bothHandsReach, cursorIsLeft],
    ([both, left]: number[]) => (both ? 2 : left ? 1 : 0)
  );
  const reachModeRight = useTransform(
    [bothHandsReach, cursorIsRight],
    ([both, right]: number[]) => (both ? 2 : right ? 1 : 0)
  );

  // When the cursor is below the blob, both arms angle down and inward so
  // the hands converge under the body instead of both pointing straight down.
  const armAngleLeftFinal = useTransform(
    [armAngleLeft, bothHandsReach],
    ([normal, both]: number[]) => normal + (-135 - normal) * both
  );
  const armAngleRightFinal = useTransform(
    [armAngleRight, bothHandsReach],
    ([normal, both]: number[]) => normal + (135 - normal) * both
  );

  // Both arms extend fully when the grab is two-handed, even if one of them
  // is further from the cursor than the other.
  const armScaleLeftFinal = useTransform(
    [armScaleLeft, bothHandsReach],
    ([scale, both]: number[]) => (both ? Math.max(scale, 0.85) : scale)
  );
  const armScaleRightFinal = useTransform(
    [armScaleRight, bothHandsReach],
    ([scale, both]: number[]) => (both ? Math.max(scale, 0.85) : scale)
  );
```

Add the React state and the motion-value listeners. Put this next to the other
`useState` calls in the component:

```tsx
  const [reachMode, setReachMode] = useState<{ left: number; right: number }>({ left: 0, right: 0 });

  useMotionValueEvent(reachModeLeft, "change", (value) => {
    setReachMode((current) => (current.left === value ? current : { ...current, left: value }));
  });
  useMotionValueEvent(reachModeRight, "change", (value) => {
    setReachMode((current) => (current.right === value ? current : { ...current, right: value }));
  });
```

- [ ] **Step 4: Wire the new values into the arms**

In the arm block from Task 1, replace:

```tsx
              const armScale = isLeft ? armScaleLeft : armScaleRight;
              const armAngle = isLeft ? armAngleLeft : armAngleRight;
```

with:

```tsx
              const armScale = isLeft ? armScaleLeftFinal : armScaleRightFinal;
              const armAngle = isLeft ? armAngleLeftFinal : armAngleRightFinal;
              const mode = isLeft ? reachMode.left : reachMode.right;
```

and add the `data-reach` attribute to the arm element:

```tsx
                <motion.div
                  key={`arm-${side}`}
                  data-testid={`blob-arm-${isLeft ? "left" : "right"}`}
                  data-reach={REACH_MODE_LABEL[mode]}
                  aria-hidden
```

Add the label map at module scope, above the component:

```tsx
const REACH_MODE_LABEL: Record<number, string> = {
  0: "rest",
  1: "nearest",
  2: "both",
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/test/blob-critter.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 6: Run the full checks**

Run: `npm run lint && npm run typecheck:server && npm test`
Expected: all pass.

---

### Task 3: Verify the behaviour in a browser

**Files:**
- None (verification only).

**Interfaces:**
- Consumes: the two-arm system from Tasks 1-2.
- Produces: nothing.

- [ ] **Step 1: Start the app**

Run: `npm run dev`
Expected: Vite serves the app on `http://localhost:8080`.

- [ ] **Step 2: Check the hands are visible**

Open `http://localhost:8080` and look at the hero blob.

Expected: a left hand and a right hand are visible on either side of the body,
each a rounded mitten with a thumb bump on the inner side, resting slightly
down and outward.

- [ ] **Step 3: Check the reach**

Move the pointer slowly around the blob.

Expected: the arm on the pointer's side extends and turns toward the pointer;
the other arm stays near the body. Move the pointer **below** the blob.

Expected: **both** arms extend downward and angle inward, so the two hands
converge under the body pointing at the pointer.

- [ ] **Step 4: Check the reduced-motion path**

Turn on "Reduce motion" in the OS (Windows: Settings → Accessibility → Visual effects → Animation effects).

Expected: the blob renders without arms and does not track the pointer.

- [ ] **Step 5: Check the small play pals are unchanged**

Scroll to the "Play pals" row.

Expected: the five small blobs have no arms, exactly as before.
