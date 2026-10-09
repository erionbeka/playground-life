import { beforeEach, describe, expect, it } from "vitest";
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
