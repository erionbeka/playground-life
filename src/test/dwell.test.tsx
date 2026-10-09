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

function setup(onClick: () => void) {
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
