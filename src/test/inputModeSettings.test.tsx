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
