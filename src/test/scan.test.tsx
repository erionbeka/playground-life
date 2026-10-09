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
