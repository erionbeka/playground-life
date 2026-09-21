import { act, render, screen } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { reduceMotionEffects, useReducedMotionMode, watchReducedMotion } from "@/lib/motion";
import { updateSensory } from "@/lib/sensory";
import CelebrationOverlay from "@/components/game/CelebrationOverlay";
import BlobBackground from "@/components/BlobBackground";

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<(event: { matches: boolean }) => void>();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: (cb: () => void) => listeners.add(() => cb()),
      removeListener: (cb: () => void) => listeners.delete(cb as never),
      addEventListener: (_: string, cb: () => void) => listeners.add(cb as never),
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb as never),
      dispatchEvent: () => true,
      _listeners: listeners,
    }),
  });
  return listeners;
}

afterEach(() => {
  vi.clearAllMocks();
  updateSensory({ soundOn: true, calmMode: false });
});

describe("platform reduced-motion contract", () => {
  it("suppresses effects when reduced or calm is set", () => {
    expect(reduceMotionEffects(false, false)).toBe(false);
    expect(reduceMotionEffects(true, false)).toBe(true);
    expect(reduceMotionEffects(false, true)).toBe(true);
    expect(reduceMotionEffects(true, true)).toBe(true);
  });

  it("watchReducedMotion fires on change and unsubscribes cleanly", () => {
    const listeners = mockMatchMedia(false);
    const cb = vi.fn();
    const unsubscribe = watchReducedMotion(cb);
    expect(cb).toHaveBeenCalledWith(false);
    act(() => {
      for (const listener of listeners) (listener as (e: { matches: boolean }) => void)({ matches: true });
    });
    expect(cb).toHaveBeenCalledWith(true);
    unsubscribe();
    listeners.clear();
    act(() => {
      for (const listener of listeners) (listener as (e: { matches: boolean }) => void)({ matches: false });
    });
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("useReducedMotionMode tracks the live OS preference", () => {
    mockMatchMedia(false);
    const { result, rerender } = renderHook(() => useReducedMotionMode());
    expect(result.current).toBe(false);
    rerender();
    expect(result.current).toBe(false);
  });

  it("celebration shows no confetti when the OS prefers reduced motion", () => {
    mockMatchMedia(true);
    render(
      <CelebrationOverlay
        childName="Sam"
        childAvatar="🦊"
        message="All done"
        themes={[{ icon: "🎉", accentClass: "", glowClass: "", label: "party" }]}
        reward={null}
        onContinue={vi.fn()}
      />,
    );
    const confettiLayer = screen.getByTestId("confetti-layer");
    expect(confettiLayer.children.length).toBe(0);
    expect(screen.getByTestId("confetti-layer")).toBeInTheDocument();
  });

  it("blob background stays static when the OS prefers reduced motion", () => {
    mockMatchMedia(true);
    render(<BlobBackground />);
    expect(screen.getByTestId("blob-static")).toBeInTheDocument();
  });
});