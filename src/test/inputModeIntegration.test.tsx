import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import InputModeProvider from "@/components/input/InputModeProvider";
import { useTargetRegion } from "@/components/input/context";
import { resetInputMode, updateInputMode } from "@/lib/inputMode";

function PlaySurface({
  onAac,
  onDialog,
  showDialog = true,
}: {
  onAac: () => void;
  onDialog: () => void;
  showDialog?: boolean;
}) {
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
      {showDialog ? (
        <div ref={dialogRef}>
          <button onClick={onDialog}>Continue</button>
        </div>
      ) : null}
    </div>
  );
}

describe("switch scan across regions", () => {
  beforeEach(() => {
    localStorage.clear();
    resetInputMode();
    vi.useFakeTimers();
  });

  it("scans only dialog targets and activates once, then stops (autostart)", () => {
    const onDialog = vi.fn();
    updateInputMode({ mode: "switch", scanIntervalMs: 1000, scanAutostart: true, switchKeys: ["Space"] });
    render(
      <InputModeProvider>
        <PlaySurface onAac={vi.fn()} onDialog={onDialog} />
      </InputModeProvider>,
    );
    // autostart highlights the first active target; a dialog region overrides play + aac
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Continue" }));
    act(() => fireEvent.keyDown(window, { key: "Space" }));
    expect(onDialog).toHaveBeenCalledTimes(1);
    // stops on activation: no further activations while idle
    act(() => vi.advanceTimersByTime(4000));
    expect(onDialog).toHaveBeenCalledTimes(1);
  });

  it("cycles play then aac when no dialog is present", () => {
    const onAac = vi.fn();
    updateInputMode({ mode: "switch", scanIntervalMs: 1000, scanAutostart: true, switchKeys: ["Space"] });
    render(
      <InputModeProvider>
        <PlaySurface onAac={onAac} onDialog={vi.fn()} showDialog={false} />
      </InputModeProvider>,
    );
    const playA = screen.getByRole("button", { name: "Play A" });
    const playB = screen.getByRole("button", { name: "Play B" });
    const aacButton = screen.getByRole("button", { name: "Want" });
    expect(document.activeElement).toBe(playA);
    act(() => vi.advanceTimersByTime(1000));
    expect(document.activeElement).toBe(playB);
    act(() => vi.advanceTimersByTime(1000));
    expect(document.activeElement).toBe(aacButton);
  });
});
