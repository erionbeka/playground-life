import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_INPUT_MODE,
  applyTimingPreset,
  clearChildInputMode,
  effectiveInputMode,
  getInputModeSnapshot,
  presetFor,
  resetInputMode,
  updateChildInputMode,
  updateInputMode,
} from "@/lib/inputMode";

describe("inputMode store", () => {
  beforeEach(() => {
    localStorage.clear();
    resetInputMode();
  });

  it("starts from defaults", () => {
    expect(getInputModeSnapshot().mode).toBe("default");
    expect(DEFAULT_INPUT_MODE.dwellMs).toBe(900);
    expect(DEFAULT_INPUT_MODE.switchKeys).toEqual(["Space", "Enter"]);
  });

  it("persists global updates to localStorage", () => {
    updateInputMode({ mode: "dwell", dwellMs: 1200 });
    expect(getInputModeSnapshot().mode).toBe("dwell");
    const raw = JSON.parse(localStorage.getItem("pp-input-mode-v1") ?? "{}");
    expect(raw.mode).toBe("dwell");
    expect(raw.dwellMs).toBe(1200);
  });

  it("layers a per-child override over the global settings", () => {
    updateInputMode({ mode: "switch", scanIntervalMs: 1500 });
    updateChildInputMode("child-1", { scanIntervalMs: 700 });
    expect(effectiveInputMode("child-1").scanIntervalMs).toBe(700);
    expect(effectiveInputMode("child-1").mode).toBe("switch");
    expect(effectiveInputMode("child-2").scanIntervalMs).toBe(1500);
    expect(effectiveInputMode().scanIntervalMs).toBe(1500);
  });

  it("clears a child override", () => {
    updateChildInputMode("child-1", { dwellMs: 300 });
    clearChildInputMode("child-1");
    expect(effectiveInputMode("child-1").dwellMs).toBe(DEFAULT_INPUT_MODE.dwellMs);
  });

  it("applies timing presets globally or per child", () => {
    applyTimingPreset("fast");
    expect(getInputModeSnapshot().dwellMs).toBe(500);
    expect(getInputModeSnapshot().scanIntervalMs).toBe(800);
    applyTimingPreset("slow", "child-1");
    expect(effectiveInputMode("child-1").dwellMs).toBe(1600);
    expect(getInputModeSnapshot().dwellMs).toBe(500);
  });

  it("detects the active preset", () => {
    expect(presetFor({ dwellMs: 900, scanIntervalMs: 1200 })).toBe("medium");
    expect(presetFor({ dwellMs: 1234, scanIntervalMs: 1200 })).toBeNull();
  });
});
