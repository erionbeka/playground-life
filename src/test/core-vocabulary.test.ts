import { describe, expect, it } from "vitest";
import { CORE_WORDS, CORE_WORD_SET } from "@/lib/coreVocabulary";

describe("core vocabulary manifest", () => {
  it("defines a non-empty core set", () => {
    expect(CORE_WORDS.length).toBeGreaterThanOrEqual(12);
  });

  it("keeps ids and labels unique and non-empty", () => {
    const ids = CORE_WORDS.map((word) => word.id);
    const labels = CORE_WORDS.map((word) => word.label);
    expect(new Set(ids).size).toBe(ids.length);
    for (const word of CORE_WORDS) {
      expect(word.id.trim()).not.toBe("");
      expect(word.label.trim()).not.toBe("");
      expect(word.spoken.trim()).not.toBe("");
    }
  });

  it("includes the essential requesting and regulating core words", () => {
    const ids = new Set(CORE_WORDS.map((word) => word.id));
    for (const required of ["i", "want", "more", "go", "stop", "help", "all-done", "yes", "no"]) {
      expect(ids.has(required)).toBe(true);
    }
  });

  it("preserves a fixed display order for stable motor planning", () => {
    expect(CORE_WORDS.map((word) => word.id)).toEqual([
      "i",
      "want",
      "more",
      "go",
      "stop",
      "help",
      "all-done",
      "my-turn",
      "please",
      "yes",
      "no",
      "look",
    ]);
  });

  it("exposes the set for lookup", () => {
    expect(CORE_WORD_SET.get("want")?.label).toBe("want");
    expect(CORE_WORD_SET.get("missing-id")).toBeUndefined();
  });
});
