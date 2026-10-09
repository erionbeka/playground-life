import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RESPONSE_MODES, RESPONSE_MODE_OPTIONS, responseModeOption } from "@/lib/responseModes";
import ResponseModes from "@/components/game/ResponseModes";

describe("response modes", () => {
  it("offers vocal and symbol responses alongside switch, dwell, and touch", () => {
    expect(RESPONSE_MODES).toContain("vocal/verbal");
    expect(RESPONSE_MODES).toContain("symbol selection");
    expect(RESPONSE_MODES).toContain("switch/scanning");
    expect(RESPONSE_MODES).toContain("dwell");
    expect(RESPONSE_MODES).toContain("touch");
  });

  it("has a label, emoji, and hint for every mode", () => {
    expect(RESPONSE_MODE_OPTIONS.length).toBe(RESPONSE_MODES.length);
    for (const mode of RESPONSE_MODES) {
      const option = responseModeOption(mode);
      expect(option?.label.length).toBeGreaterThan(0);
      expect(option?.emoji.length).toBeGreaterThan(0);
      expect(option?.hint.length).toBeGreaterThan(0);
    }
  });

  it("reports the chosen mode when a child answers another way", () => {
    const onResponse = vi.fn();
    render(<ResponseModes onResponse={onResponse} />);
    fireEvent.click(screen.getByRole("button", { name: "Answered by: Spoken word" }));
    expect(onResponse).toHaveBeenCalledWith("vocal/verbal");
  });
});
